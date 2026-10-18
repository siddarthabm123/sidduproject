BEGIN;
ALTER TABLE worker_hires ADD COLUMN expected_wage numeric(12,2),ADD COLUMN initial_offer numeric(12,2),
  ADD COLUMN offer_by text NOT NULL DEFAULT 'EMPLOYER' CHECK(offer_by IN('EMPLOYER','WORKER')),
  ADD COLUMN offer_version integer NOT NULL DEFAULT 1 CHECK(offer_version>0),
  ADD COLUMN offer_history jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(offer_history)='array'),
  ADD COLUMN site_latitude double precision CHECK(site_latitude BETWEEN -90 AND 90),
  ADD COLUMN site_longitude double precision CHECK(site_longitude BETWEEN -180 AND 180);
UPDATE worker_hires h SET expected_wage=w.wage_rate,initial_offer=h.agreed_wage FROM worker_profiles w WHERE w.id=h.worker_id;
ALTER TABLE worker_hires ALTER COLUMN expected_wage SET NOT NULL,ALTER COLUMN initial_offer SET NOT NULL,
  ADD CHECK(expected_wage BETWEEN 1 AND 1000000),ADD CHECK(initial_offer BETWEEN 1 AND 1000000),
  ADD CHECK((site_latitude IS NULL)=(site_longitude IS NULL));

-- Keep the existing reservation checks private; legacy public overloads must not bypass negotiation.
ALTER FUNCTION public.hire_worker(uuid,timestamptz,timestamptz,numeric,wage_type,text,text,uuid) SET SCHEMA app_private;
ALTER FUNCTION public.respond_worker_hire(uuid,text) SET SCHEMA app_private;
REVOKE ALL ON FUNCTION app_private.hire_worker(uuid,timestamptz,timestamptz,numeric,wage_type,text,text,uuid),app_private.respond_worker_hire(uuid,text) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.hire_worker(p_worker uuid,p_start timestamptz,p_end timestamptz,p_wage numeric,p_wage_type wage_type,p_site text,p_machine text,p_request uuid,
 p_lat double precision DEFAULT NULL,p_lng double precision DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid:=app_private.worker_actor(); previous worker_hires; worker worker_profiles; result jsonb; target uuid;
BEGIN
 PERFORM 1 FROM users WHERE id=actor FOR UPDATE;
 IF (p_lat IS NULL)<>(p_lng IS NULL) OR p_lat NOT BETWEEN -90 AND 90 OR p_lng NOT BETWEEN -180 AND 180 THEN
   RAISE EXCEPTION 'Choose valid site coordinates' USING ERRCODE='22023'; END IF;
 SELECT * INTO previous FROM worker_hires WHERE employer_id=actor AND request_id=p_request;
 IF FOUND THEN
   IF previous.worker_id IS DISTINCT FROM p_worker OR previous.start_date IS DISTINCT FROM p_start OR previous.end_date IS DISTINCT FROM p_end OR
     previous.initial_offer IS DISTINCT FROM p_wage OR previous.wage_type IS DISTINCT FROM p_wage_type OR previous.site_location IS DISTINCT FROM p_site OR
     coalesce(previous.machine_description,'')<>coalesce(p_machine,'') OR previous.site_latitude IS DISTINCT FROM p_lat OR previous.site_longitude IS DISTINCT FROM p_lng THEN
     RAISE EXCEPTION 'Request ID belongs to different hire details' USING ERRCODE='22023'; END IF;
   RETURN to_jsonb(previous);
 END IF;
 SELECT * INTO worker FROM worker_profiles WHERE id=p_worker FOR UPDATE;
 IF worker.id IS NULL OR worker.wage_type IS DISTINCT FROM p_wage_type THEN RAISE EXCEPTION 'Worker wage type changed. Refresh and try again.' USING ERRCODE='22023'; END IF;
 result:=app_private.hire_worker(p_worker,p_start,p_end,p_wage,p_wage_type,p_site,p_machine,p_request);target:=(result->>'id')::uuid;
 UPDATE worker_hires SET expected_wage=worker.wage_rate,initial_offer=p_wage,site_latitude=p_lat,site_longitude=p_lng,
   offer_history=jsonb_build_array(jsonb_build_object('version',1,'side','EMPLOYER','action','OFFER','amount',p_wage,'note','','created_at',now()))
   WHERE id=target RETURNING to_jsonb(worker_hires.*) INTO result;
 RETURN result;
END $$;

-- Defaults permit the original private insert to run; the wrapper snapshots the actual worker rate in the same transaction.
ALTER TABLE worker_hires ALTER COLUMN expected_wage SET DEFAULT 1,ALTER COLUMN initial_offer SET DEFAULT 1;

CREATE FUNCTION public.respond_worker_hire(p_id uuid,p_action text,p_amount numeric DEFAULT NULL,p_expected_version integer DEFAULT NULL,p_note text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid:=app_private.worker_actor(); row worker_hires; worker worker_profiles; target uuid; side text; result jsonb;
BEGIN
 SELECT worker_id INTO target FROM worker_hires WHERE id=p_id;
 SELECT * INTO worker FROM worker_profiles WHERE id=target FOR UPDATE;
 SELECT * INTO row FROM worker_hires WHERE id=p_id FOR UPDATE;
 IF row.id IS NULL OR actor NOT IN(row.employer_id,worker.user_id) THEN RAISE EXCEPTION 'Hiring party required' USING ERRCODE='42501'; END IF;
 side:=CASE WHEN actor=row.employer_id THEN 'EMPLOYER' ELSE 'WORKER' END;
 IF length(coalesce(p_note,''))>500 THEN RAISE EXCEPTION 'Offer note is too long' USING ERRCODE='22023'; END IF;
 IF p_action IN('accept','decline','counter') THEN
   IF row.status<>'PENDING' OR row.request_expires_at<=now() OR row.end_date<=now() OR NOT worker.accepting_requests THEN
     RAISE EXCEPTION 'Only an active pending request can be negotiated' USING ERRCODE='22023'; END IF;
   IF row.offer_by=side THEN RAISE EXCEPTION 'Wait for the other party to respond' USING ERRCODE='22023'; END IF;
   IF p_expected_version IS DISTINCT FROM row.offer_version AND NOT (p_expected_version IS NULL AND row.offer_version=1 AND p_action='accept') THEN
     RAISE EXCEPTION 'Offer changed. Refresh before responding.' USING ERRCODE='22023'; END IF;
 END IF;
 IF p_action='counter' THEN
   IF p_amount IS NULL OR p_amount NOT BETWEEN 1 AND 1000000 OR p_amount<>round(p_amount,2) THEN RAISE EXCEPTION 'Invalid counter-offer amount' USING ERRCODE='22023'; END IF;
   IF side='WORKER' AND p_amount<=row.agreed_wage OR side='EMPLOYER' AND p_amount>=row.agreed_wage THEN
     RAISE EXCEPTION 'Worker counters must be higher; employer counters must be lower' USING ERRCODE='22023'; END IF;
   UPDATE worker_hires SET agreed_wage=p_amount,offer_by=side,offer_version=offer_version+1,updated_at=now() WHERE id=p_id RETURNING * INTO row;
 ELSIF p_action='accept' THEN
   IF EXISTS(SELECT 1 FROM worker_hires WHERE worker_id=worker.id AND id<>row.id AND status='ACTIVE' AND start_date<row.end_date AND end_date>row.start_date) THEN
     RAISE EXCEPTION 'Worker is already reserved for this period' USING ERRCODE='22023'; END IF;
   UPDATE worker_hires SET status='ACTIVE',updated_at=now() WHERE id=p_id RETURNING * INTO row;
 ELSIF p_action='decline' THEN
   UPDATE worker_hires SET status='CANCELLED',updated_at=now() WHERE id=p_id RETURNING * INTO row;
 ELSIF p_action IN('cancel','complete') THEN
   result:=app_private.respond_worker_hire(p_id,p_action);
   SELECT * INTO row FROM worker_hires WHERE id=p_id;
 ELSE RAISE EXCEPTION 'Invalid hire action' USING ERRCODE='22023'; END IF;
 UPDATE worker_hires SET offer_history=offer_history||jsonb_build_array(jsonb_build_object('version',row.offer_version,'side',side,'action',upper(p_action),'amount',row.agreed_wage,'note',coalesce(p_note,''),'created_at',now())) WHERE id=p_id RETURNING * INTO row;
 UPDATE worker_profiles SET availability_status=accepting_requests AND NOT EXISTS(SELECT 1 FROM worker_hires WHERE worker_id=worker.id AND (status='ACTIVE' AND end_date>now() OR status='PENDING' AND request_expires_at>now())) WHERE id=worker.id;
 RETURN to_jsonb(row);
END $$;
REVOKE ALL ON FUNCTION public.hire_worker(uuid,timestamptz,timestamptz,numeric,wage_type,text,text,uuid,double precision,double precision),public.respond_worker_hire(uuid,text,numeric,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hire_worker(uuid,timestamptz,timestamptz,numeric,wage_type,text,text,uuid,double precision,double precision),public.respond_worker_hire(uuid,text,numeric,integer,text) TO authenticated;
COMMIT;
