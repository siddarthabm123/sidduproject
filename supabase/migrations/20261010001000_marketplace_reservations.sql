BEGIN;

ALTER TABLE bookings ADD COLUMN reservation_start date;
ALTER TABLE bookings ADD COLUMN reservation_end date;
ALTER TABLE bookings ADD COLUMN request_expires_at timestamptz;
ALTER TABLE bookings ADD COLUMN cancellation_reason text;
UPDATE bookings SET reservation_start=requested_date::date,
  reservation_end=requested_date::date+CASE WHEN billing_unit='hour' THEN greatest(1,ceil(coalesce(quantity,1)/24)::integer) ELSE 1 END,
  request_expires_at=CASE WHEN status='pending' THEN created_at+interval '24 hours' END;
ALTER TABLE bookings ALTER COLUMN reservation_start SET NOT NULL;
ALTER TABLE bookings ALTER COLUMN reservation_end SET NOT NULL;
ALTER TABLE bookings ADD CONSTRAINT booking_reservation_interval CHECK(reservation_end>reservation_start);
CREATE INDEX bookings_reservation_idx ON bookings(equipment_id,reservation_start,reservation_end);
REVOKE SELECT ON bookings FROM authenticated;
GRANT SELECT(id,public_code,customer_id,owner_id,equipment_id,status,accepted_at,completed_at,completion_requested_at,auction_id,
  requested_date,reservation_start,reservation_end,request_expires_at,equipment_units,quantity,billing_unit,total_cost_paise,amount_paid_paise) ON bookings TO authenticated;

CREATE TABLE booking_requests(
  customer_id uuid NOT NULL REFERENCES users(id),request_id uuid NOT NULL,
  payload jsonb NOT NULL,booking_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(customer_id,request_id)
);
ALTER TABLE booking_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON booking_requests FROM anon,authenticated;

CREATE TABLE booking_disputes(
  booking_id uuid PRIMARY KEY REFERENCES bookings(id),reporter_id uuid NOT NULL REFERENCES users(id),
  reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 10 AND 2000),
  status text NOT NULL DEFAULT 'OPEN' CHECK(status IN('OPEN','RESOLVED')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE booking_disputes ENABLE ROW LEVEL SECURITY;
CREATE POLICY parties_read_disputes ON booking_disputes FOR SELECT TO authenticated
USING(EXISTS(SELECT 1 FROM bookings WHERE id=booking_id AND auth.uid() IN(customer_id,owner_id)));
GRANT SELECT ON booking_disputes TO authenticated;

-- Count the maximum daily load, rather than summing disjoint reservations.
CREATE FUNCTION app_private.reserved_units(p_equipment uuid,p_start date,p_end date)
RETURNS integer LANGUAGE sql STABLE SET search_path=public AS $$
  SELECT coalesce(max(load),0)::integer FROM (
    SELECT day,coalesce(sum(b.equipment_units),0) AS load
    FROM generate_series(p_start::timestamp,(p_end-1)::timestamp,interval '1 day') day
    LEFT JOIN bookings b ON b.equipment_id=p_equipment AND b.reservation_start<=day::date AND b.reservation_end>day::date
      AND b.status NOT IN('cancelled','completed')
      AND (b.status<>'pending' OR b.request_expires_at>now())
    GROUP BY day
  ) daily;
$$;
REVOKE ALL ON FUNCTION app_private.reserved_units(uuid,date,date) FROM PUBLIC;

DROP FUNCTION public.request_equipment_booking(jsonb,date,text,numeric,numeric,numeric,text);
CREATE FUNCTION public.request_equipment_booking(p_items jsonb,p_date date,p_address text,p_lat numeric,p_lng numeric,p_quantity numeric,
  p_instructions text DEFAULT '',p_request_id uuid DEFAULT NULL,p_end_date date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid:=auth.uid(); item jsonb; machine equipment; units integer; base numeric; fee numeric;
  row bookings; result jsonb:='[]'; ids uuid[]:='{}'; request_key uuid:=coalesce(p_request_id,gen_random_uuid());
  payload jsonb; previous booking_requests; last_day date; minimum_days integer;
BEGIN
  IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM users WHERE id=actor AND role='customer') THEN RAISE EXCEPTION 'Customer account required'; END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'Choose between 1 and 20 equipment listings'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) x GROUP BY x->>'equipment_id' HAVING count(*)>1) THEN RAISE EXCEPTION 'Duplicate equipment selection'; END IF;
  payload:=jsonb_build_object('items',(SELECT jsonb_agg(x ORDER BY x->>'equipment_id') FROM jsonb_array_elements(p_items) x),
    'date',p_date,'end_date',p_end_date,'address',p_address,'lat',p_lat,'lng',p_lng,'quantity',p_quantity,'instructions',coalesce(p_instructions,''));
  INSERT INTO booking_requests(customer_id,request_id,payload) VALUES(actor,request_key,payload) ON CONFLICT DO NOTHING;
  SELECT * INTO previous FROM booking_requests WHERE customer_id=actor AND request_id=request_key FOR UPDATE;
  IF previous.payload<>payload THEN RAISE EXCEPTION 'This request ID belongs to different booking details'; END IF;
  IF cardinality(previous.booking_ids)>0 THEN
    RETURN (SELECT jsonb_agg(to_jsonb(b) ORDER BY b.equipment_id) FROM bookings b WHERE b.id=ANY(previous.booking_ids));
  END IF;
  IF p_date IS NULL OR p_date<current_date OR p_date>current_date+730 OR length(trim(coalesce(p_address,''))) NOT BETWEEN 5 AND 500 OR
     p_lat IS NULL OR p_lng IS NULL OR p_lat NOT BETWEEN -90 AND 90 OR p_lng NOT BETWEEN -180 AND 180 OR
     p_quantity IS NULL OR p_quantity NOT BETWEEN 0.01 AND 10000 OR length(coalesce(p_instructions,''))>2000 THEN
    RAISE EXCEPTION 'Invalid booking date, address, coordinates or quantity'; END IF;
  FOR item IN SELECT x FROM jsonb_array_elements(p_items) x ORDER BY x->>'equipment_id' LOOP
    SELECT * INTO machine FROM equipment WHERE id=(item->>'equipment_id')::uuid FOR UPDATE;
    IF coalesce(item->>'units','') !~ '^[0-9]+$' THEN RAISE EXCEPTION 'Units must be whole numbers'; END IF;
    units:=(item->>'units')::integer;
    IF machine.id IS NULL OR NOT machine.is_verified OR machine.status<>'ready' OR machine.owner_id=actor OR machine.base_rate_paise<=0 OR
       EXISTS(SELECT 1 FROM users WHERE id=machine.owner_id AND email LIKE '%@rigdesk.demo') OR units NOT BETWEEN 1 AND machine.available_units THEN
      RAISE EXCEPTION 'Equipment is unavailable or unit count is invalid'; END IF;
    minimum_days:=CASE WHEN machine.pricing_unit='hour' THEN greatest(1,ceil(p_quantity/24)::integer) ELSE 1 END;
    last_day:=coalesce(p_end_date,p_date+minimum_days-1);
    IF last_day<p_date+minimum_days-1 OR last_day-p_date NOT BETWEEN 0 AND 365 THEN RAISE EXCEPTION 'Booking period is too short or exceeds one year'; END IF;
    IF app_private.reserved_units(machine.id,p_date,last_day+1)+units>machine.available_units THEN RAISE EXCEPTION 'Not enough units available in the selected period'; END IF;
    base:=round(machine.base_rate_paise::numeric*p_quantity*units); fee:=round(base*0.035);
    IF base+fee>2147483647 THEN RAISE EXCEPTION 'Booking amount exceeds the supported limit'; END IF;
    INSERT INTO bookings(public_code,customer_id,owner_id,equipment_id,billing_unit,quantity,unit_rate_paise,requested_date,job_address,job_lat,job_lng,instructions,
      base_cost_paise,platform_fee_paise,total_cost_paise,owner_earnings_paise,equipment_units,payment_due_at,reservation_start,reservation_end,request_expires_at)
    VALUES('RD-'||gen_random_uuid()::text,actor,machine.owner_id,machine.id,machine.pricing_unit,p_quantity,machine.base_rate_paise,p_date,p_address,p_lat,p_lng,
      coalesce(p_instructions,''),base,fee,base+fee,base,units,last_day+interval '7 days',p_date,last_day+1,now()+interval '24 hours') RETURNING * INTO row;
    ids:=array_append(ids,row.id);result:=result||jsonb_build_array(to_jsonb(row));
  END LOOP;
  UPDATE booking_requests SET booking_ids=ids WHERE customer_id=actor AND request_id=request_key;
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.accept_booking(p_booking_id uuid)
RETURNS bookings LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE target bookings; machine equipment;
BEGIN
  SELECT * INTO target FROM bookings WHERE id=p_booking_id AND owner_id=auth.uid() FOR UPDATE;
  IF target.id IS NULL OR target.status<>'pending' OR target.wallet_hold_paise<>0 OR target.request_expires_at IS NULL OR target.request_expires_at<=now() OR target.reservation_start<current_date THEN
    RAISE EXCEPTION 'Only an unexpired pending request can be accepted'; END IF;
  SELECT * INTO machine FROM equipment WHERE id=target.equipment_id FOR UPDATE;
  IF NOT machine.is_verified OR machine.status<>'ready' OR app_private.reserved_units(machine.id,target.reservation_start,target.reservation_end)>machine.available_units THEN
    RAISE EXCEPTION 'Equipment is no longer available'; END IF;
  UPDATE bookings SET status='confirmed',accepted_at=now(),updated_at=now() WHERE id=target.id RETURNING * INTO target;
  INSERT INTO audit_events(actor_id,booking_id,event_type) VALUES(auth.uid(),target.id,'booking.accepted_without_payment');
  RETURN target;
END $$;

CREATE OR REPLACE FUNCTION public.cancel_booking(p_booking_id uuid)
RETURNS bookings LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result bookings;
BEGIN
  UPDATE bookings SET status='cancelled',cancelled_at=now(),updated_at=now(),cancellation_reason='Customer cancelled before dispatch'
  WHERE id=p_booking_id AND customer_id=auth.uid() AND status IN('pending','confirmed') AND completion_requested_at IS NULL AND wallet_hold_paise=0 RETURNING * INTO result;
  IF result.id IS NULL THEN RAISE EXCEPTION 'Work already underway or funded bookings require issue review'; END IF;
  RETURN result;
END $$;

CREATE FUNCTION public.decline_booking(p_booking_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE bookings SET status='cancelled',cancelled_at=now(),updated_at=now(),cancellation_reason='Owner declined'
  WHERE id=p_booking_id AND owner_id=auth.uid() AND status='pending' AND wallet_hold_paise=0;
  IF NOT FOUND THEN RAISE EXCEPTION 'Only the assigned owner can decline a pending request'; END IF;
END $$;

CREATE FUNCTION public.report_booking_issue(p_booking_id uuid,p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE target bookings;
BEGIN
  SELECT * INTO target FROM bookings WHERE id=p_booking_id AND auth.uid() IN(customer_id,owner_id) FOR UPDATE;
  IF target.id IS NULL OR target.status NOT IN('mobilizing','on_site','in_progress') OR length(trim(coalesce(p_reason,''))) NOT BETWEEN 10 AND 2000 THEN
    RAISE EXCEPTION 'An active booking and an issue description of 10 to 2000 characters are required'; END IF;
  INSERT INTO booking_disputes(booking_id,reporter_id,reason) VALUES(target.id,auth.uid(),trim(p_reason));
  INSERT INTO audit_events(actor_id,booking_id,event_type) VALUES(auth.uid(),target.id,'booking.issue_reported');
END $$;

CREATE OR REPLACE FUNCTION public.complete_booking(p_booking_id uuid)
RETURNS bookings LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result bookings;
BEGIN
  SELECT * INTO result FROM bookings WHERE id=p_booking_id AND customer_id=auth.uid() FOR UPDATE;
  IF result.id IS NULL OR result.status<>'in_progress' OR result.completion_requested_at IS NULL OR result.wallet_hold_paise<>0 OR
    EXISTS(SELECT 1 FROM booking_disputes WHERE booking_id=p_booking_id AND status='OPEN') THEN
    RAISE EXCEPTION 'Customer confirmation and resolution of open issues are required'; END IF;
  UPDATE bookings SET status='completed',completed_at=now(),updated_at=now()
  WHERE id=p_booking_id RETURNING * INTO result;
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.my_booking_records()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE bookings SET status='cancelled',cancelled_at=now(),updated_at=now(),cancellation_reason='Request expired'
  WHERE auth.uid() IN(customer_id,owner_id) AND status='pending' AND request_expires_at<=now() AND wallet_hold_paise=0;
  RETURN (SELECT coalesce(jsonb_agg(to_jsonb(b)||jsonb_build_object('equipment_title',e.title,'owner_name',o.workspace_name,'customer_name',c.full_name,
    'dispute_status',d.status,'dispute_reason',d.reason,
    'job_address',CASE WHEN b.customer_id=auth.uid() OR b.accepted_at IS NOT NULL AND b.status<>'cancelled' THEN b.job_address ELSE NULL END,
    'job_lat',CASE WHEN b.customer_id=auth.uid() OR b.accepted_at IS NOT NULL AND b.status<>'cancelled' THEN b.job_lat ELSE NULL END,
    'job_lng',CASE WHEN b.customer_id=auth.uid() OR b.accepted_at IS NOT NULL AND b.status<>'cancelled' THEN b.job_lng ELSE NULL END,
    'instructions',CASE WHEN b.customer_id=auth.uid() OR b.accepted_at IS NOT NULL AND b.status<>'cancelled' THEN b.instructions ELSE NULL END,
    'owner_phone',CASE WHEN b.accepted_at IS NOT NULL AND b.status<>'cancelled' THEN o.phone END,
    'customer_phone',CASE WHEN b.accepted_at IS NOT NULL AND b.status<>'cancelled' THEN c.phone END) ORDER BY b.created_at DESC),'[]'::jsonb)
    FROM bookings b JOIN equipment e ON e.id=b.equipment_id JOIN users o ON o.id=b.owner_id JOIN users c ON c.id=b.customer_id
    LEFT JOIN booking_disputes d ON d.booking_id=b.id WHERE auth.uid() IN(b.customer_id,b.owner_id));
END $$;

CREATE FUNCTION app_private.reverify_equipment()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF auth.uid()=OLD.owner_id AND ROW(NEW.title,NEW.sector,NEW.category,NEW.registration_number,NEW.capacity,NEW.specs,NEW.available_units)
    IS DISTINCT FROM ROW(OLD.title,OLD.sector,OLD.category,OLD.registration_number,OLD.capacity,OLD.specs,OLD.available_units) THEN NEW.is_verified:=false; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER equipment_identity_changed BEFORE UPDATE ON equipment FOR EACH ROW EXECUTE FUNCTION app_private.reverify_equipment();
REVOKE ALL ON FUNCTION app_private.reverify_equipment() FROM PUBLIC;

ALTER TABLE marketplace_auctions ADD COLUMN job_area text NOT NULL DEFAULT '' CHECK(length(job_area)<=200);
ALTER TABLE marketplace_auctions ADD COLUMN public_description text NOT NULL DEFAULT '' CHECK(length(public_description)<=2000);
ALTER TABLE marketplace_auctions ADD COLUMN duration_days integer NOT NULL DEFAULT 1 CHECK(duration_days BETWEEN 1 AND 366);
DROP POLICY authenticated_read_auctions ON marketplace_auctions;
CREATE POLICY parties_read_private_auctions ON marketplace_auctions FOR SELECT TO authenticated USING(customer_id=auth.uid() OR
  EXISTS(SELECT 1 FROM bookings b WHERE b.auction_id=marketplace_auctions.id AND b.owner_id=auth.uid() AND b.accepted_at IS NOT NULL AND b.status<>'cancelled'));
DROP POLICY customer_create_auction ON marketplace_auctions;
CREATE POLICY customer_create_auction ON marketplace_auctions FOR INSERT TO authenticated WITH CHECK(customer_id=auth.uid() AND status='OPEN'
  AND requested_date BETWEEN current_date AND current_date+730 AND expires_at>now() AND expires_at<=now()+interval '7 days'
  AND EXISTS(SELECT 1 FROM users WHERE id=auth.uid() AND role='customer'));
-- Direct inserts must not accept server-owned identity/timestamps or status.
REVOKE INSERT ON marketplace_auctions FROM authenticated;
GRANT INSERT(customer_id,title,description,job_address,requested_date,ceiling_paise,job_area,public_description,duration_days) ON marketplace_auctions TO authenticated;
CREATE FUNCTION public.marketplace_auction_records()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.id,'customer_id',a.customer_id,'title',a.title,'job_area',a.job_area,
    'description',CASE WHEN a.customer_id=auth.uid() THEN a.description ELSE a.public_description END,
    'job_address',CASE WHEN a.customer_id=auth.uid() OR EXISTS(SELECT 1 FROM bookings b WHERE b.auction_id=a.id AND b.owner_id=auth.uid() AND b.accepted_at IS NOT NULL AND b.status<>'cancelled') THEN a.job_address ELSE NULL END,
    'requested_date',a.requested_date,'duration_days',a.duration_days,'ceiling_paise',a.ceiling_paise,'status',a.status,'expires_at',a.expires_at)
    ORDER BY a.created_at DESC),'[]'::jsonb) FROM marketplace_auctions a WHERE auth.uid() IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.award_marketplace_bid(p_bid uuid)
RETURNS bookings LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE offer marketplace_bids; target marketplace_auctions; machine equipment; fee numeric; result bookings; auction uuid;
BEGIN
  SELECT auction_id INTO auction FROM marketplace_bids WHERE id=p_bid;
  SELECT * INTO target FROM marketplace_auctions WHERE id=auction FOR UPDATE;
  IF target.id IS NULL OR auth.uid() IS NULL OR target.customer_id<>auth.uid() OR target.status<>'OPEN' OR target.expires_at<=now() OR target.requested_date<current_date THEN
    RAISE EXCEPTION 'Only the customer can award an open auction once'; END IF;
  SELECT * INTO offer FROM marketplace_bids WHERE id=p_bid FOR UPDATE;
  SELECT * INTO machine FROM equipment WHERE id=offer.equipment_id FOR UPDATE;
  IF machine.id IS NULL OR machine.owner_id<>offer.owner_id OR NOT machine.is_verified OR machine.status<>'ready' OR
    app_private.reserved_units(machine.id,target.requested_date,target.requested_date+target.duration_days)>=machine.available_units THEN
    RAISE EXCEPTION 'Selected equipment is no longer available'; END IF;
  fee:=round(offer.amount_paise::numeric*0.035);
  IF offer.amount_paise+fee>2147483647 THEN RAISE EXCEPTION 'Booking amount exceeds the supported limit'; END IF;
  INSERT INTO bookings(public_code,customer_id,owner_id,equipment_id,billing_unit,quantity,unit_rate_paise,requested_date,job_address,job_lat,job_lng,
    base_cost_paise,platform_fee_paise,total_cost_paise,owner_earnings_paise,auction_id,payment_due_at,reservation_start,reservation_end,request_expires_at,instructions)
  VALUES('RD-'||gen_random_uuid()::text,auth.uid(),offer.owner_id,offer.equipment_id,'project',1,offer.amount_paise,target.requested_date,target.job_address,0,0,
    offer.amount_paise,fee,offer.amount_paise+fee,offer.amount_paise,target.id,target.requested_date+target.duration_days+interval '7 days',
    target.requested_date,target.requested_date+target.duration_days,now()+interval '24 hours',target.description) RETURNING * INTO result;
  UPDATE marketplace_auctions SET status='AWARDED' WHERE id=target.id;
  RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.request_equipment_booking(jsonb,date,text,numeric,numeric,numeric,text,uuid,date),public.decline_booking(uuid),public.report_booking_issue(uuid,text),public.marketplace_auction_records() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_equipment_booking(jsonb,date,text,numeric,numeric,numeric,text,uuid,date),public.decline_booking(uuid),public.report_booking_issue(uuid,text),public.marketplace_auction_records() TO authenticated;
COMMIT;
