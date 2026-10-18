BEGIN;

CREATE OR REPLACE FUNCTION public.request_equipment_booking(p_items jsonb,p_date date,p_address text,p_lat numeric,p_lng numeric,p_quantity numeric,
  p_instructions text DEFAULT '',p_request_id uuid DEFAULT NULL,p_end_date date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid:=auth.uid(); item jsonb; machine equipment; units integer; base numeric; fee numeric; item_quantity numeric;
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
    item_quantity:=CASE WHEN item ? 'quantity' THEN (item->>'quantity')::numeric ELSE p_quantity END;
    IF item_quantity IS NULL OR item_quantity NOT BETWEEN 0.01 AND 10000 THEN RAISE EXCEPTION 'Invalid equipment quantity'; END IF;
    IF machine.id IS NULL OR NOT machine.is_verified OR machine.status<>'ready' OR machine.owner_id=actor OR machine.base_rate_paise<=0 OR
       EXISTS(SELECT 1 FROM users WHERE id=machine.owner_id AND email LIKE '%@rigdesk.demo') OR units NOT BETWEEN 1 AND machine.available_units THEN
      RAISE EXCEPTION 'Equipment is unavailable or unit count is invalid'; END IF;
    minimum_days:=CASE WHEN machine.pricing_unit='hour' THEN greatest(1,ceil(item_quantity/24)::integer) ELSE 1 END;
    last_day:=coalesce(p_end_date,p_date+minimum_days-1);
    IF last_day<p_date+minimum_days-1 OR last_day-p_date NOT BETWEEN 0 AND 365 THEN RAISE EXCEPTION 'Booking period is too short or exceeds one year'; END IF;
    IF app_private.reserved_units(machine.id,p_date,last_day+1)+units>machine.available_units THEN RAISE EXCEPTION 'Not enough units available in the selected period'; END IF;
    base:=round(machine.base_rate_paise::numeric*item_quantity*units); fee:=round(base*0.035);
    IF base+fee>2147483647 THEN RAISE EXCEPTION 'Booking amount exceeds the supported limit'; END IF;
    INSERT INTO bookings(public_code,customer_id,owner_id,equipment_id,billing_unit,quantity,unit_rate_paise,requested_date,job_address,job_lat,job_lng,instructions,
      base_cost_paise,platform_fee_paise,total_cost_paise,owner_earnings_paise,equipment_units,payment_due_at,reservation_start,reservation_end,request_expires_at)
    VALUES('RD-'||gen_random_uuid()::text,actor,machine.owner_id,machine.id,machine.pricing_unit,item_quantity,machine.base_rate_paise,p_date,p_address,p_lat,p_lng,
      coalesce(p_instructions,''),base,fee,base+fee,base,units,last_day+interval '7 days',p_date,last_day+1,now()+interval '24 hours') RETURNING * INTO row;
    ids:=array_append(ids,row.id);result:=result||jsonb_build_array(to_jsonb(row));
  END LOOP;
  UPDATE booking_requests SET booking_ids=ids WHERE customer_id=actor AND request_id=request_key;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.request_equipment_booking(jsonb,date,text,numeric,numeric,numeric,text,uuid,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.request_equipment_booking(jsonb,date,text,numeric,numeric,numeric,text,uuid,date) TO authenticated;
COMMIT;
