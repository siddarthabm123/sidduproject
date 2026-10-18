BEGIN;
CREATE TABLE public.booking_work_entries(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),booking_id uuid NOT NULL REFERENCES bookings(id),created_by uuid NOT NULL REFERENCES users(id),
 work_date date NOT NULL,hours numeric(5,2) NOT NULL CHECK(hours>0 AND hours<=24),
 meter_start numeric(12,2),meter_end numeric(12,2),notes text NOT NULL CHECK(length(trim(notes)) BETWEEN 10 AND 2000),
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN('PENDING','APPROVED','REJECTED')),
 review_note text,reviewed_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),request_id uuid NOT NULL,
 UNIQUE(booking_id,request_id),CHECK((meter_start IS NULL AND meter_end IS NULL) OR (meter_start IS NOT NULL AND meter_end IS NOT NULL AND meter_start>=0 AND meter_end>=meter_start))
);
CREATE INDEX booking_work_entries_booking ON booking_work_entries(booking_id,work_date);
ALTER TABLE booking_work_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON booking_work_entries FROM PUBLIC,anon,authenticated;
GRANT SELECT ON booking_work_entries TO authenticated;
CREATE POLICY booking_parties_read_work ON booking_work_entries FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM bookings b WHERE b.id=booking_id AND auth.uid() IN(b.customer_id,b.owner_id)));

CREATE FUNCTION public.record_booking_work(p_booking uuid,p_date date,p_hours numeric,p_notes text,p_request uuid,p_meter_start numeric DEFAULT NULL,p_meter_end numeric DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE job bookings; previous booking_work_entries; entry booking_work_entries;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='28000'; END IF;
 SELECT * INTO job FROM bookings WHERE id=p_booking FOR UPDATE;
 IF job.id IS NULL OR job.owner_id<>auth.uid() THEN RAISE EXCEPTION 'Assigned equipment owner required' USING ERRCODE='42501'; END IF;
 SELECT * INTO previous FROM booking_work_entries WHERE booking_id=p_booking AND request_id=p_request;
 IF previous.id IS NOT NULL THEN
   IF previous.work_date IS DISTINCT FROM p_date OR previous.hours IS DISTINCT FROM p_hours OR previous.notes IS DISTINCT FROM trim(p_notes) OR previous.meter_start IS DISTINCT FROM p_meter_start OR previous.meter_end IS DISTINCT FROM p_meter_end THEN RAISE EXCEPTION 'Request ID was used with different work details' USING ERRCODE='22023'; END IF;
   RETURN to_jsonb(previous);
 END IF;
 IF job.status NOT IN('on_site','in_progress') OR p_request IS NULL OR p_date IS NULL OR p_date>current_date OR p_date<job.reservation_start OR p_date>=job.reservation_end OR
   p_hours IS NULL OR p_hours::text IN('NaN','Infinity','-Infinity') OR p_hours<=0 OR p_hours>24 OR p_hours<>round(p_hours,2) OR length(trim(coalesce(p_notes,''))) NOT BETWEEN 10 AND 2000 OR
   ((p_meter_start IS NULL)<>(p_meter_end IS NULL)) OR (p_meter_start IS NOT NULL AND (p_meter_start::text IN('NaN','Infinity','-Infinity') OR p_meter_end::text IN('NaN','Infinity','-Infinity') OR p_meter_start<0 OR p_meter_end<p_meter_start OR p_meter_start>9999999999 OR p_meter_end>9999999999 OR p_meter_start<>round(p_meter_start,2) OR p_meter_end<>round(p_meter_end,2))) THEN RAISE EXCEPTION 'Invalid work entry or booking period' USING ERRCODE='22023'; END IF;
 IF (SELECT coalesce(sum(hours),0) FROM booking_work_entries WHERE booking_id=p_booking AND work_date=p_date AND status<>'REJECTED')+p_hours>24 THEN RAISE EXCEPTION 'Daily work entries cannot exceed 24 hours' USING ERRCODE='22023'; END IF;
 INSERT INTO booking_work_entries(booking_id,created_by,work_date,hours,notes,request_id,meter_start,meter_end)
 VALUES(p_booking,auth.uid(),p_date,p_hours,trim(p_notes),p_request,p_meter_start,p_meter_end) RETURNING * INTO entry;
 INSERT INTO workspace_notifications(recipient_id,event_key,title_key,record_id,target_path) VALUES(job.customer_id,'work:'||entry.id,'Work log approval requested',job.id,'/customer/bookings');
 RETURN to_jsonb(entry);
END $$;

CREATE FUNCTION public.review_booking_work(p_entry uuid,p_approve boolean,p_note text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE entry booking_work_entries; job bookings;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='28000'; END IF;
 SELECT b.* INTO job FROM bookings b JOIN booking_work_entries e ON e.booking_id=b.id WHERE e.id=p_entry FOR UPDATE OF b;
 IF job.id IS NULL OR job.customer_id<>auth.uid() THEN RAISE EXCEPTION 'Booking customer required' USING ERRCODE='42501'; END IF;
 SELECT * INTO entry FROM booking_work_entries WHERE id=p_entry FOR UPDATE;
 IF p_approve IS NULL OR length(coalesce(p_note,''))>500 OR (NOT p_approve AND length(trim(coalesce(p_note,'')))<5) THEN RAISE EXCEPTION 'Add a reason when rejecting a work entry' USING ERRCODE='22023'; END IF;
 IF entry.status<>'PENDING' THEN
   IF entry.status=(CASE WHEN p_approve THEN 'APPROVED' ELSE 'REJECTED' END) AND coalesce(entry.review_note,'')=trim(coalesce(p_note,'')) THEN RETURN to_jsonb(entry); END IF;
   RAISE EXCEPTION 'This work entry has already been reviewed' USING ERRCODE='22023';
 END IF;
 IF job.status='cancelled' THEN RAISE EXCEPTION 'Cancelled booking cannot approve work' USING ERRCODE='22023'; END IF;
 UPDATE booking_work_entries SET status=CASE WHEN p_approve THEN 'APPROVED' ELSE 'REJECTED' END,review_note=trim(coalesce(p_note,'')),reviewed_at=now() WHERE id=p_entry RETURNING * INTO entry;
 INSERT INTO workspace_notifications(recipient_id,event_key,title_key,record_id,target_path) VALUES(job.owner_id,'work-reviewed:'||entry.id,'Work log reviewed',job.id,'/owner/jobs');
 RETURN to_jsonb(entry);
END $$;
REVOKE ALL ON FUNCTION public.record_booking_work(uuid,date,numeric,text,uuid,numeric,numeric),public.review_booking_work(uuid,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_booking_work(uuid,date,numeric,text,uuid,numeric,numeric),public.review_booking_work(uuid,boolean,text) TO authenticated;
COMMIT;
