BEGIN;
CREATE TABLE public.platform_admins(
  user_id uuid PRIMARY KEY REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_admins FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION app_private.worker_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM users WHERE id=auth.uid() AND role='admin') OR EXISTS(SELECT 1 FROM platform_admins WHERE user_id=auth.uid());
$$;
CREATE FUNCTION public.admin_access() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT app_private.worker_admin(); $$;
CREATE FUNCTION public.admin_review_queue() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT app_private.worker_admin() THEN RAISE EXCEPTION 'Admin review required' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object(
    'equipment',(SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.created_at DESC),'[]') FROM equipment e),
    'workers',(SELECT coalesce(jsonb_agg(to_jsonb(w)-'request_payload' ORDER BY w.created_at DESC),'[]') FROM worker_profiles w),
    'disputes',(SELECT coalesce(jsonb_agg(to_jsonb(d)||jsonb_build_object('funded',EXISTS(SELECT 1 FROM payment_escrows e WHERE e.booking_id=d.booking_id)) ORDER BY d.created_at DESC),'[]') FROM booking_disputes d WHERE d.status='OPEN'),
    'users',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',full_name,'role',role)),'[]') FROM users WHERE email NOT LIKE '%@rigdesk.demo'),
    'bunks',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name)),'[]') FROM fuel_bunks WHERE is_active),
    'partner_access',(SELECT coalesce(jsonb_agg(to_jsonb(a)),'[]') FROM fuel_partner_access a),
    'staff',(SELECT coalesce(jsonb_agg(to_jsonb(s)),'[]') FROM fuel_bunk_staff s));
END $$;

CREATE FUNCTION public.admin_review_equipment(p_id uuid,p_verified boolean,p_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT app_private.worker_admin() THEN RAISE EXCEPTION 'Admin review required' USING ERRCODE='42501'; END IF;
  IF p_verified IS NULL OR length(trim(coalesce(p_reason,''))) NOT BETWEEN 10 AND 2000 THEN RAISE EXCEPTION 'A review reason is required'; END IF;
  UPDATE equipment SET is_verified=p_verified,updated_at=now() WHERE id=p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Equipment not found'; END IF;
  INSERT INTO audit_events(actor_id,event_type,metadata) VALUES(auth.uid(),'equipment.admin_review',jsonb_build_object('equipment_id',p_id,'verified',p_verified,'reason',p_reason));
END $$;

CREATE FUNCTION public.admin_resolve_booking_issue(p_booking uuid,p_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b bookings;
BEGIN
  IF NOT app_private.worker_admin() THEN RAISE EXCEPTION 'Admin review required' USING ERRCODE='42501'; END IF;
  IF length(trim(coalesce(p_reason,''))) NOT BETWEEN 10 AND 2000 THEN RAISE EXCEPTION 'A review reason is required'; END IF;
  SELECT * INTO b FROM bookings WHERE id=p_booking FOR UPDATE;
  IF b.id IS NULL THEN RAISE EXCEPTION 'Booking not found'; END IF;
  IF b.amount_paid_paise<>0 OR b.wallet_hold_paise<>0 OR EXISTS(SELECT 1 FROM payment_escrows WHERE booking_id=b.id) THEN
    RAISE EXCEPTION 'Funded dispute requires payment-provider reconciliation; no funds have been released'; END IF;
  UPDATE booking_disputes SET status='RESOLVED' WHERE booking_id=b.id AND status='OPEN';
  IF NOT FOUND THEN RAISE EXCEPTION 'Open dispute not found'; END IF;
  INSERT INTO audit_events(actor_id,booking_id,event_type,metadata) VALUES(auth.uid(),b.id,'dispute.resolved',jsonb_build_object('reason',p_reason));
END $$;

CREATE FUNCTION public.admin_fuel_access(p_user uuid,p_register boolean,p_discount boolean,p_bunk uuid DEFAULT NULL,p_staff boolean DEFAULT false) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT app_private.worker_admin() THEN RAISE EXCEPTION 'Admin review required' USING ERRCODE='42501'; END IF;
  IF p_register IS NULL OR p_discount IS NULL OR p_staff IS NULL OR (p_discount AND NOT p_register) THEN RAISE EXCEPTION 'Invalid partner permissions'; END IF;
  IF NOT EXISTS(SELECT 1 FROM users WHERE id=p_user AND email NOT LIKE '%@rigdesk.demo') THEN RAISE EXCEPTION 'Registered account required'; END IF;
  INSERT INTO fuel_partner_access(user_id,can_register,can_offer_discounts) VALUES(p_user,p_register,p_discount)
    ON CONFLICT(user_id) DO UPDATE SET can_register=excluded.can_register,can_offer_discounts=excluded.can_offer_discounts;
  IF p_bunk IS NOT NULL THEN
    IF p_staff THEN INSERT INTO fuel_bunk_staff(bunk_id,user_id) VALUES(p_bunk,p_user) ON CONFLICT DO NOTHING;
    ELSE DELETE FROM fuel_bunk_staff WHERE bunk_id=p_bunk AND user_id=p_user; END IF;
  END IF;
  INSERT INTO audit_events(actor_id,event_type,metadata) VALUES(auth.uid(),'fuel.admin_access',jsonb_build_object('user_id',p_user,'register',p_register,'discount',p_discount,'bunk',p_bunk,'staff',p_staff));
END $$;
REVOKE ALL ON FUNCTION public.admin_access(),public.admin_review_queue(),public.admin_review_equipment(uuid,boolean,text),public.admin_resolve_booking_issue(uuid,text),public.admin_fuel_access(uuid,boolean,boolean,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_access(),public.admin_review_queue(),public.admin_review_equipment(uuid,boolean,text),public.admin_resolve_booking_issue(uuid,text),public.admin_fuel_access(uuid,boolean,boolean,uuid,boolean) TO authenticated;
COMMIT;
