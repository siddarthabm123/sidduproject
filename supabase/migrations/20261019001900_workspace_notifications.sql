BEGIN;
CREATE TABLE public.workspace_notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),recipient_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 event_key text NOT NULL,title_key text NOT NULL,record_id uuid NOT NULL,
 target_path text NOT NULL CHECK(target_path IN('/customer/bookings','/owner/jobs','/dashboard/customer/hire-workers','/dashboard/owner/workforce')),
 created_at timestamptz NOT NULL DEFAULT now(),read_at timestamptz,
 UNIQUE(recipient_id,event_key)
);
ALTER TABLE public.workspace_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workspace_notifications FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.workspace_notifications TO authenticated;
CREATE POLICY recipient_reads_notifications ON public.workspace_notifications FOR SELECT TO authenticated USING(recipient_id=auth.uid());
CREATE INDEX workspace_notifications_recipient ON public.workspace_notifications(recipient_id,created_at DESC);

CREATE FUNCTION public.mark_workspace_notifications_read(p_ids uuid[]) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='28000'; END IF;
 IF p_ids IS NULL OR cardinality(p_ids)>50 THEN RAISE EXCEPTION 'Choose up to 50 notifications' USING ERRCODE='22023'; END IF;
 UPDATE workspace_notifications SET read_at=coalesce(read_at,now()) WHERE recipient_id=auth.uid() AND id=ANY(p_ids);
END $$;
REVOKE ALL ON FUNCTION public.mark_workspace_notifications_read(uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mark_workspace_notifications_read(uuid[]) TO authenticated;

CREATE FUNCTION app_private.notify_booking_parties() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE title text; event text; actor uuid:=auth.uid();
BEGIN
 IF TG_OP='INSERT' THEN title:='New booking request';
 ELSIF NEW.status IS DISTINCT FROM OLD.status THEN title:='Booking status updated';
 ELSIF NEW.completion_requested_at IS DISTINCT FROM OLD.completion_requested_at AND NEW.completion_requested_at IS NOT NULL THEN title:='Completion approval requested';
 ELSE RETURN NEW; END IF;
 event:='booking:'||NEW.id||':'||NEW.status||':'||coalesce(NEW.completion_requested_at::text,'')||':'||NEW.updated_at;
 INSERT INTO workspace_notifications(recipient_id,event_key,title_key,record_id,target_path)
 SELECT recipient,event,title,NEW.id,path FROM (VALUES (NEW.customer_id,'/customer/bookings'),(NEW.owner_id,'/owner/jobs')) AS parties(recipient,path)
 WHERE recipient IS DISTINCT FROM actor ON CONFLICT(recipient_id,event_key) DO NOTHING;
 RETURN NEW;
END $$;
CREATE TRIGGER workspace_booking_notifications AFTER INSERT OR UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION app_private.notify_booking_parties();

CREATE FUNCTION app_private.notify_hiring_parties() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE title text; manager uuid; manager_role user_role; event text;
BEGIN
 IF TG_OP='INSERT' THEN title:='New hiring request';
 ELSIF NEW.offer_version IS DISTINCT FROM OLD.offer_version THEN title:='Wage offer updated';
 ELSIF NEW.status IS DISTINCT FROM OLD.status THEN title:='Hiring status updated';
 ELSE RETURN NEW; END IF;
 SELECT w.user_id,u.role INTO manager,manager_role FROM worker_profiles w JOIN users u ON u.id=w.user_id WHERE w.id=NEW.worker_id;
 event:='hire:'||NEW.id||':'||NEW.offer_version||':'||NEW.status;
 INSERT INTO workspace_notifications(recipient_id,event_key,title_key,record_id,target_path)
 SELECT recipient,event,title,NEW.id,path FROM (VALUES
 (NEW.employer_id,CASE WHEN NEW.employer_type='OWNER' THEN '/dashboard/owner/workforce' ELSE '/dashboard/customer/hire-workers' END),
 (manager,CASE WHEN manager_role='owner' THEN '/dashboard/owner/workforce' ELSE '/dashboard/customer/hire-workers' END)) AS parties(recipient,path)
 WHERE recipient IS NOT NULL AND recipient IS DISTINCT FROM auth.uid() ON CONFLICT(recipient_id,event_key) DO NOTHING;
 RETURN NEW;
END $$;
CREATE TRIGGER workspace_hiring_notifications AFTER INSERT OR UPDATE ON public.worker_hires FOR EACH ROW EXECUTE FUNCTION app_private.notify_hiring_parties();

CREATE FUNCTION app_private.notify_booking_issue() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE job bookings; event text;
BEGIN
 IF TG_OP='UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
 SELECT * INTO job FROM bookings WHERE id=NEW.booking_id;
 event:='issue:'||NEW.booking_id||':'||NEW.status||':'||NEW.created_at;
 INSERT INTO workspace_notifications(recipient_id,event_key,title_key,record_id,target_path)
 SELECT recipient,event,'Booking issue updated',NEW.booking_id,path FROM (VALUES(job.customer_id,'/customer/bookings'),(job.owner_id,'/owner/jobs')) AS parties(recipient,path)
 WHERE recipient IS DISTINCT FROM auth.uid() ON CONFLICT(recipient_id,event_key) DO NOTHING;
 RETURN NEW;
END $$;
CREATE TRIGGER workspace_issue_notifications AFTER INSERT OR UPDATE ON public.booking_disputes FOR EACH ROW EXECUTE FUNCTION app_private.notify_booking_issue();
REVOKE ALL ON FUNCTION app_private.notify_booking_parties(),app_private.notify_hiring_parties(),app_private.notify_booking_issue() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.marketplace_availability(p_start date,p_end date DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE last_day date:=coalesce(p_end,p_start);
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='28000'; END IF;
 IF p_start IS NULL OR p_start<current_date OR last_day<p_start OR last_day-p_start>365 THEN RAISE EXCEPTION 'Choose a booking period of up to 366 days' USING ERRCODE='22023'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('equipment_id',e.id,'remaining_units',
   greatest(0,CASE WHEN e.status='ready' THEN e.available_units-app_private.reserved_units(e.id,p_start,last_day+1) ELSE 0 END))),'[]')
 FROM equipment e JOIN users u ON u.id=e.owner_id WHERE u.email NOT LIKE '%@rigdesk.demo' AND (e.is_verified OR e.owner_id=auth.uid()));
END $$;
REVOKE ALL ON FUNCTION public.marketplace_availability(date,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.marketplace_availability(date,date) TO authenticated;

CREATE TABLE public.provider_request_limits(
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,service text NOT NULL CHECK(service IN('places','recommendations')),
 window_start timestamptz NOT NULL,request_count integer NOT NULL,PRIMARY KEY(user_id,service)
);
ALTER TABLE public.provider_request_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.provider_request_limits FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.claim_provider_request(p_service text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE count integer; minute timestamptz:=date_trunc('minute',now());
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM users WHERE id=auth.uid()) THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='28000'; END IF;
 IF p_service NOT IN('places','recommendations') OR p_service IS NULL THEN RAISE EXCEPTION 'Invalid provider' USING ERRCODE='22023'; END IF;
 INSERT INTO provider_request_limits(user_id,service,window_start,request_count) VALUES(auth.uid(),p_service,minute,1)
 ON CONFLICT(user_id,service) DO UPDATE SET window_start=minute,request_count=CASE WHEN provider_request_limits.window_start=minute THEN least(provider_request_limits.request_count+1,1000) ELSE 1 END RETURNING request_count INTO count;
 RETURN count<=CASE WHEN p_service='places' THEN 10 ELSE 20 END;
END $$;
REVOKE ALL ON FUNCTION public.claim_provider_request(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_provider_request(text) TO authenticated;
COMMIT;
