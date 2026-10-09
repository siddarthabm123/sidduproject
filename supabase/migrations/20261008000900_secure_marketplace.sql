BEGIN;

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS available_units integer NOT NULL DEFAULT 1 CHECK (available_units BETWEEN 1 AND 100);
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS equipment_units integer NOT NULL DEFAULT 1 CHECK (equipment_units BETWEEN 1 AND 100);
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS completion_requested_at timestamptz;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS amount_paid_paise integer NOT NULL DEFAULT 0 CHECK (amount_paid_paise >= 0);
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS payment_due_at timestamptz;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_recorded_payment_limit CHECK (amount_paid_paise <= total_cost_paise) NOT VALID;

-- UI state is not a source of truth for bookings, equipment or money.
CREATE OR REPLACE FUNCTION public.set_app_state_value(p_key text, p_value jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_key NOT IN ('language', 'theme') THEN RAISE EXCEPTION 'Only preferences can be saved as app state'; END IF;
  IF (p_key = 'language' AND p_value NOT IN ('"en"'::jsonb, '"hi"'::jsonb, '"kn"'::jsonb)) OR
     (p_key = 'theme' AND p_value NOT IN ('"light"'::jsonb, '"dark"'::jsonb)) THEN RAISE EXCEPTION 'Invalid preference'; END IF;
  INSERT INTO public.user_app_state(user_id,state) VALUES(auth.uid(),jsonb_build_object(p_key,p_value))
  ON CONFLICT(user_id) DO UPDATE SET state=jsonb_set(user_app_state.state,ARRAY[p_key],p_value),updated_at=now()
  RETURNING state INTO result;
  RETURN result;
END $$;
REVOKE INSERT, UPDATE, DELETE ON public.user_app_state FROM authenticated;
GRANT SELECT ON public.user_app_state TO authenticated;

REVOKE INSERT, UPDATE, DELETE ON public.users FROM authenticated;
GRANT UPDATE(full_name, workspace_name, phone, service_area, address, aadhaar_last4, updated_at) ON public.users TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.wallets FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.bookings FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.wallet_deposit(integer,text) FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.wallet_withdraw(integer,text) FROM authenticated, anon, PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON public.equipment FROM authenticated;
GRANT INSERT(owner_id,title,sector,category,registration_number,capacity,status,pricing_unit,base_rate_paise,telematics_id,current_address,current_lat,current_lng,image_url,specs,available_units) ON public.equipment TO authenticated;
GRANT UPDATE(title,sector,category,registration_number,capacity,status,pricing_unit,base_rate_paise,current_address,current_lat,current_lng,image_url,specs,available_units,updated_at) ON public.equipment TO authenticated;
DROP POLICY IF EXISTS "owners can manage their equipment" ON public.equipment;
CREATE POLICY "owners can manage their equipment" ON public.equipment FOR ALL TO authenticated
USING(owner_id=auth.uid()) WITH CHECK(owner_id=auth.uid() AND EXISTS(SELECT 1 FROM users WHERE id=auth.uid() AND role='owner'));

CREATE OR REPLACE FUNCTION public.update_wallet_profile(p_upi text,p_bank text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  UPDATE wallets SET upi_id=left(p_upi,120),bank_name=left(p_bank,120),updated_at=now() WHERE user_id=auth.uid();
END $$;

CREATE OR REPLACE FUNCTION public.marketplace_equipment()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(e) || jsonb_build_object('owner_name',u.workspace_name,
    'rating',(SELECT round(avg(r.rating),1) FROM reviews r WHERE r.equipment_id=e.id),
    'review_count',(SELECT count(*) FROM reviews r WHERE r.equipment_id=e.id))), '[]'::jsonb)
  FROM equipment e JOIN users u ON u.id=e.owner_id
  WHERE auth.uid() IS NOT NULL AND u.email NOT LIKE '%@rigdesk.demo' AND (e.is_verified OR e.owner_id=auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.request_equipment_booking(p_items jsonb,p_date date,p_address text,p_lat numeric,p_lng numeric,p_quantity numeric,p_instructions text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid:=auth.uid(); item jsonb; machine equipment; units integer; used integer; base integer; fee integer; row bookings; result jsonb:='[]';
BEGIN
  IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM users WHERE id=actor AND role='customer') THEN RAISE EXCEPTION 'Customer account required'; END IF;
  IF p_date IS NULL OR p_date<current_date OR length(trim(coalesce(p_address,'')))<5 OR length(p_address)>500 OR
     p_lat IS NULL OR p_lng IS NULL OR p_lat NOT BETWEEN -90 AND 90 OR p_lng NOT BETWEEN -180 AND 180 OR
     p_quantity IS NULL OR p_quantity NOT BETWEEN 0.01 AND 10000 THEN RAISE EXCEPTION 'Invalid booking date, address, coordinates or quantity'; END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'Choose between 1 and 20 equipment listings'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) x GROUP BY x->>'equipment_id' HAVING count(*)>1) THEN RAISE EXCEPTION 'Duplicate equipment selection'; END IF;
  -- Lock in ID order, so concurrent requests cannot oversubscribe or deadlock.
  FOR item IN SELECT x FROM jsonb_array_elements(p_items) x ORDER BY x->>'equipment_id' LOOP
    SELECT * INTO machine FROM equipment WHERE id=(item->>'equipment_id')::uuid FOR UPDATE;
    units:=(item->>'units')::integer;
    IF machine.id IS NULL OR NOT machine.is_verified OR machine.status<>'ready' OR machine.owner_id=actor OR machine.base_rate_paise<=0 OR EXISTS(SELECT 1 FROM users WHERE id=machine.owner_id AND email LIKE '%@rigdesk.demo') OR
       units IS NULL OR units NOT BETWEEN 1 AND machine.available_units THEN RAISE EXCEPTION 'Equipment is unavailable or unit count is invalid'; END IF;
    SELECT coalesce(sum(equipment_units),0) INTO used FROM bookings WHERE equipment_id=machine.id AND requested_date::date=p_date AND status NOT IN ('completed','cancelled');
    IF used+units>machine.available_units THEN RAISE EXCEPTION 'Not enough units available on the selected date'; END IF;
    base:=round(machine.base_rate_paise::numeric*p_quantity*units); fee:=round(base::numeric*0.035);
    INSERT INTO bookings(public_code,customer_id,owner_id,equipment_id,billing_unit,quantity,unit_rate_paise,requested_date,job_address,job_lat,job_lng,instructions,base_cost_paise,platform_fee_paise,total_cost_paise,owner_earnings_paise,equipment_units,payment_due_at)
    VALUES('RD-'||gen_random_uuid()::text,actor,machine.owner_id,machine.id,machine.pricing_unit,p_quantity,machine.base_rate_paise,p_date,p_address,p_lat,p_lng,left(p_instructions,2000),base,fee,base+fee,base,units,p_date+interval '7 days') RETURNING * INTO row;
    result:=result||jsonb_build_array(to_jsonb(row));
  END LOOP;
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.my_booking_records()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(b)||jsonb_build_object('equipment_title',e.title,'owner_name',o.workspace_name,'customer_name',c.full_name,
    'owner_phone',CASE WHEN b.accepted_at IS NOT NULL AND b.status<>'cancelled' THEN o.phone END,
    'customer_phone',CASE WHEN b.accepted_at IS NOT NULL AND b.status<>'cancelled' THEN c.phone END) ORDER BY b.created_at DESC),'[]'::jsonb)
  FROM bookings b JOIN equipment e ON e.id=b.equipment_id JOIN users o ON o.id=b.owner_id JOIN users c ON c.id=b.customer_id
  WHERE auth.uid() IN(b.customer_id,b.owner_id);
$$;

CREATE OR REPLACE FUNCTION public.accept_booking(p_booking_id uuid)
RETURNS public.bookings LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result bookings;
BEGIN
  UPDATE bookings SET status='confirmed',accepted_at=now(),updated_at=now()
  WHERE id=p_booking_id AND owner_id=auth.uid() AND status='pending' AND wallet_hold_paise=0 RETURNING * INTO result;
  IF result.id IS NULL THEN RAISE EXCEPTION 'Only the assigned owner can accept a pending request'; END IF;
  INSERT INTO audit_events(actor_id,booking_id,event_type) VALUES(auth.uid(),result.id,'booking.accepted_without_payment');
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.advance_booking(p_booking_id uuid)
RETURNS public.bookings LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result bookings;
BEGIN
  SELECT * INTO result FROM bookings WHERE id=p_booking_id AND owner_id=auth.uid() FOR UPDATE;
  IF result.id IS NULL THEN RAISE EXCEPTION 'Assigned owner required'; END IF;
  IF result.status NOT IN('confirmed','mobilizing','on_site','in_progress') OR result.completion_requested_at IS NOT NULL THEN RAISE EXCEPTION 'No further owner milestone is available'; END IF;
  UPDATE bookings SET status=CASE result.status WHEN 'confirmed' THEN 'mobilizing'::booking_status WHEN 'mobilizing' THEN 'on_site'::booking_status ELSE 'in_progress'::booking_status END,
    completion_requested_at=CASE WHEN result.status='in_progress' THEN now() ELSE NULL END,updated_at=now() WHERE id=result.id RETURNING * INTO result;
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.complete_booking(p_booking_id uuid)
RETURNS public.bookings LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result bookings;
BEGIN
  UPDATE bookings SET status='completed',completed_at=now(),updated_at=now()
  WHERE id=p_booking_id AND customer_id=auth.uid() AND status='in_progress' AND completion_requested_at IS NOT NULL AND wallet_hold_paise=0 RETURNING * INTO result;
  IF result.id IS NULL THEN RAISE EXCEPTION 'Customer confirmation of owner-completed work is required'; END IF;
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.cancel_booking(p_booking_id uuid)
RETURNS public.bookings LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result bookings;
BEGIN
  UPDATE bookings SET status='cancelled',cancelled_at=now(),updated_at=now()
  WHERE id=p_booking_id AND customer_id=auth.uid() AND status NOT IN('completed','cancelled') AND wallet_hold_paise=0 RETURNING * INTO result;
  IF result.id IS NULL THEN RAISE EXCEPTION 'Cannot cancel this record; funded legacy bookings require support review'; END IF;
  RETURN result;
END $$;

CREATE TABLE IF NOT EXISTS public.marketplace_auctions(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),customer_id uuid NOT NULL REFERENCES users(id),title text NOT NULL CHECK(length(title) BETWEEN 3 AND 200),
  description text NOT NULL,job_address text NOT NULL,requested_date date NOT NULL,ceiling_paise integer NOT NULL CHECK(ceiling_paise>0),
  status text NOT NULL DEFAULT 'OPEN' CHECK(status IN('OPEN','AWARDED','CANCELLED')),created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days'
);
CREATE TABLE IF NOT EXISTS public.marketplace_bids(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),auction_id uuid NOT NULL REFERENCES marketplace_auctions(id),owner_id uuid NOT NULL REFERENCES users(id),
  equipment_id uuid NOT NULL REFERENCES equipment(id),amount_paise integer NOT NULL CHECK(amount_paise>0),eta_minutes integer NOT NULL CHECK(eta_minutes>0),
  created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(auction_id,owner_id)
);
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS auction_id uuid UNIQUE REFERENCES public.marketplace_auctions(id);
ALTER TABLE marketplace_auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_bids ENABLE ROW LEVEL SECURITY;
CREATE POLICY authenticated_read_auctions ON marketplace_auctions FOR SELECT TO authenticated USING(true);
CREATE POLICY customer_create_auction ON marketplace_auctions FOR INSERT TO authenticated WITH CHECK(customer_id=auth.uid() AND status='OPEN' AND requested_date>=current_date AND expires_at>now() AND EXISTS(SELECT 1 FROM users WHERE id=auth.uid() AND role='customer'));
CREATE POLICY authenticated_read_bids ON marketplace_bids FOR SELECT TO authenticated USING(true);
GRANT SELECT,INSERT ON marketplace_auctions TO authenticated;
GRANT SELECT ON marketplace_bids TO authenticated;

CREATE OR REPLACE FUNCTION public.place_marketplace_bid(p_auction uuid,p_equipment uuid,p_amount integer,p_eta integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE target marketplace_auctions;
BEGIN
  SELECT * INTO target FROM marketplace_auctions WHERE id=p_auction FOR UPDATE;
  IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM users WHERE id=auth.uid() AND role='owner') OR target.id IS NULL OR target.status<>'OPEN' OR target.expires_at<=now() OR target.requested_date<current_date THEN RAISE EXCEPTION 'Open auction and owner account required'; END IF;
  IF p_amount IS NULL OR p_amount<=0 OR p_amount>target.ceiling_paise OR p_eta IS NULL OR p_eta NOT BETWEEN 1 AND 525600 THEN RAISE EXCEPTION 'Invalid bid or ETA'; END IF;
  IF NOT EXISTS(SELECT 1 FROM equipment WHERE id=p_equipment AND owner_id=auth.uid() AND is_verified AND status='ready') THEN RAISE EXCEPTION 'Your verified available equipment is required'; END IF;
  INSERT INTO marketplace_bids(auction_id,owner_id,equipment_id,amount_paise,eta_minutes) VALUES(p_auction,auth.uid(),p_equipment,p_amount,p_eta)
  ON CONFLICT(auction_id,owner_id) DO UPDATE SET equipment_id=excluded.equipment_id,amount_paise=excluded.amount_paise,eta_minutes=excluded.eta_minutes,created_at=now();
END $$;

CREATE OR REPLACE FUNCTION public.award_marketplace_bid(p_bid uuid)
RETURNS public.bookings LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE offer marketplace_bids; target marketplace_auctions; machine equipment; used integer; fee integer; result bookings;
BEGIN
  SELECT * INTO offer FROM marketplace_bids WHERE id=p_bid;
  SELECT * INTO target FROM marketplace_auctions WHERE id=offer.auction_id FOR UPDATE;
  IF target.id IS NULL OR target.customer_id<>auth.uid() OR auth.uid() IS NULL OR target.status<>'OPEN' OR target.expires_at<=now() OR target.requested_date<current_date THEN RAISE EXCEPTION 'Only the customer can award an open auction once'; END IF;
  SELECT * INTO machine FROM equipment WHERE id=offer.equipment_id FOR UPDATE;
  SELECT coalesce(sum(equipment_units),0) INTO used FROM bookings WHERE equipment_id=machine.id AND requested_date::date=target.requested_date AND status NOT IN('completed','cancelled');
  IF NOT machine.is_verified OR machine.status<>'ready' OR used>=machine.available_units THEN RAISE EXCEPTION 'Selected equipment is no longer available'; END IF;
  fee:=round(offer.amount_paise::numeric*0.035);
  INSERT INTO bookings(public_code,customer_id,owner_id,equipment_id,billing_unit,quantity,unit_rate_paise,requested_date,job_address,job_lat,job_lng,base_cost_paise,platform_fee_paise,total_cost_paise,owner_earnings_paise,auction_id,payment_due_at)
  VALUES('RD-'||gen_random_uuid()::text,auth.uid(),offer.owner_id,offer.equipment_id,'project',1,offer.amount_paise,target.requested_date,target.job_address,0,0,offer.amount_paise,fee,offer.amount_paise+fee,offer.amount_paise,target.id,target.requested_date+interval '7 days') RETURNING * INTO result;
  UPDATE marketplace_auctions SET status='AWARDED' WHERE id=target.id;
  RETURN result;
END $$;

REVOKE INSERT,UPDATE,DELETE ON reviews FROM authenticated;
CREATE OR REPLACE FUNCTION public.review_booking(p_booking uuid,p_rating integer,p_text text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE target bookings;
BEGIN
  SELECT * INTO target FROM bookings WHERE id=p_booking AND customer_id=auth.uid() AND status='completed';
  IF target.id IS NULL OR p_rating IS NULL OR p_text IS NULL OR p_rating NOT BETWEEN 1 AND 5 OR length(trim(p_text)) NOT BETWEEN 3 AND 2000 THEN RAISE EXCEPTION 'Review requires your completed booking, a rating and a comment'; END IF;
  INSERT INTO reviews(booking_id,reviewer_id,equipment_id,rating,text) VALUES(target.id,auth.uid(),target.equipment_id,p_rating,p_text);
END $$;

CREATE OR REPLACE FUNCTION public.bond_record(p_booking uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE target bookings; result jsonb;
BEGIN
  SELECT * INTO target FROM bookings WHERE id=p_booking AND auth.uid() IN(customer_id,owner_id);
  IF target.id IS NULL OR target.accepted_at IS NULL OR target.status='cancelled' THEN RAISE EXCEPTION 'An accepted booking belonging to this account is required'; END IF;
  SELECT jsonb_build_object('bookingId',target.id,'dateGenerated',target.accepted_at,'ownerName',o.workspace_name,'ownerContact','Contact held by RigDesk',
    'customerName','Customer reference '||left(target.customer_id::text,8),'customerContact','Not publicly shared',
    'serviceDescription',e.title||'; '||target.equipment_units||' units; quantity '||coalesce(target.quantity,1)||' '||target.billing_unit||'; booking date '||target.requested_date::date,
    'completionDate',coalesce(target.completed_at::text,'Completion pending'),'totalAmount',target.total_cost_paise::numeric/100,
    'amountPaid',target.amount_paid_paise::numeric/100,'remainingAmount',(target.total_cost_paise-target.amount_paid_paise)::numeric/100,
    'dueDate',coalesce(target.payment_due_at::text,'Not agreed'),'customerIpAddress','Not publicly shared','acceptanceTimestamp',target.accepted_at,'mode','live') INTO result
  FROM users o JOIN equipment e ON e.id=target.equipment_id WHERE o.id=target.owner_id;
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.bond_status(p_booking uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT status::text FROM bookings WHERE id=p_booking AND accepted_at IS NOT NULL $$;

REVOKE ALL ON FUNCTION public.set_app_state_value(text,jsonb),public.update_wallet_profile(text,text),public.marketplace_equipment(),public.request_equipment_booking(jsonb,date,text,numeric,numeric,numeric,text),public.my_booking_records(),public.advance_booking(uuid),public.place_marketplace_bid(uuid,uuid,integer,integer),public.award_marketplace_bid(uuid),public.review_booking(uuid,integer,text),public.bond_record(uuid),public.bond_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_app_state_value(text,jsonb),public.update_wallet_profile(text,text),public.marketplace_equipment(),public.request_equipment_booking(jsonb,date,text,numeric,numeric,numeric,text),public.my_booking_records(),public.advance_booking(uuid),public.place_marketplace_bid(uuid,uuid,integer,integer),public.award_marketplace_bid(uuid),public.review_booking(uuid,integer,text),public.bond_record(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bond_status(uuid) TO anon,authenticated;

CREATE OR REPLACE FUNCTION app_private.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  selected_role user_role;
  selected_name text;
  selected_workspace text;
  selected_upi text;
  selected_bank text;
  selected_aadhaar_last4 text;
BEGIN
  selected_role := CASE WHEN new.raw_user_meta_data->>'role' IN ('customer', 'owner')
    THEN (new.raw_user_meta_data->>'role')::user_role ELSE 'customer'::user_role END;
  selected_name := COALESCE(NULLIF(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1), 'RigDesk user');
  selected_workspace := COALESCE(NULLIF(new.raw_user_meta_data->>'workspace_name', ''), selected_name || ' workspace');
  selected_upi := COALESCE(NULLIF(new.raw_user_meta_data->>'upi_id', ''), 'set-upi@bank');
  selected_bank := COALESCE(NULLIF(new.raw_user_meta_data->>'bank_name', ''), 'Linked bank pending');
  selected_aadhaar_last4 := CASE WHEN new.raw_user_meta_data->>'aadhaar_last4' ~ '^[0-9]{4}$'
    THEN new.raw_user_meta_data->>'aadhaar_last4' ELSE NULL END;

  INSERT INTO public.users (id, role, full_name, workspace_name, phone, email, service_area, aadhaar_last4, address)
  VALUES (new.id, selected_role, selected_name, selected_workspace, new.raw_user_meta_data->>'phone',
    COALESCE(new.email, new.id::text || '@auth.local'), new.raw_user_meta_data->>'service_area', selected_aadhaar_last4, left(new.raw_user_meta_data->>'address',500))
  ON CONFLICT (id) DO UPDATE SET email = excluded.email, aadhaar_last4 = COALESCE(excluded.aadhaar_last4, users.aadhaar_last4), updated_at = now();

  INSERT INTO public.wallets (user_id, upi_id, bank_name, available_balance_paise)
  VALUES (new.id, selected_upi, selected_bank, 0)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN new;
END;
$$;

REVOKE ALL ON FUNCTION app_private.handle_new_auth_user() FROM PUBLIC;

COMMIT;
