BEGIN;
ALTER TABLE payment_jobs ADD COLUMN reconciliation_required boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.report_booking_issue(p_booking_id uuid,p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE target bookings;
BEGIN
  SELECT * INTO target FROM bookings WHERE id=p_booking_id AND auth.uid() IN(customer_id,owner_id) FOR UPDATE;
  IF target.id IS NULL OR NOT (target.status IN('mobilizing','on_site','in_progress') OR
    target.status='completed' AND target.completed_at>=now()-interval '48 hours') OR length(trim(coalesce(p_reason,''))) NOT BETWEEN 10 AND 2000 THEN
    RAISE EXCEPTION 'An active booking and an issue description of 10 to 2000 characters are required'; END IF;
  INSERT INTO booking_disputes(booking_id,reporter_id,reason) VALUES(target.id,auth.uid(),trim(p_reason))
    ON CONFLICT(booking_id) DO UPDATE SET status='OPEN',reporter_id=excluded.reporter_id,reason=excluded.reason WHERE booking_disputes.status='RESOLVED';
  IF NOT FOUND THEN RAISE EXCEPTION 'This booking already has an open issue'; END IF;
  INSERT INTO audit_events(actor_id,booking_id,event_type) VALUES(auth.uid(),target.id,'booking.issue_reported');
END $$;

CREATE OR REPLACE FUNCTION app_private.booking_dispute_financial_hook()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.status='OPEN' THEN
    -- Same lock as the server's submission transaction; a committed dispute wins over a later payout.
    PERFORM 1 FROM bookings WHERE id=NEW.booking_id FOR UPDATE;
    UPDATE payment_escrows SET status='DISPUTED' WHERE booking_id=NEW.booking_id AND status<>'REFUNDED';
    UPDATE payment_jobs SET status='CANCELLED' WHERE escrow_id IN(SELECT id FROM payment_escrows WHERE booking_id=NEW.booking_id) AND kind='PAYOUT' AND status='PENDING';
    -- An in-flight request may already exist at the provider. Preserve it for webhook reconciliation.
    UPDATE payment_jobs SET reconciliation_required=true,last_error='Dispute during or after submission: provider reconciliation required'
      WHERE escrow_id IN(SELECT id FROM payment_escrows WHERE booking_id=NEW.booking_id) AND kind='PAYOUT' AND status IN('PROCESSING','SUBMITTED','SUCCEEDED');
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.finish_payment_job(p_job uuid,p_lease uuid,p_reference text,p_error text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF p_reference IS NULL AND p_error IS NULL THEN RAISE EXCEPTION 'Worker result required'; END IF;
  UPDATE payment_jobs SET status=CASE WHEN p_error IS NULL THEN 'SUBMITTED' ELSE 'PROCESSING' END,
    provider_reference=coalesce(p_reference,provider_reference),last_error=left(p_error,500),available_at=now()+interval '1 minute',
    lease_until=CASE WHEN p_error IS NOT NULL THEN now()+interval '1 minute' END,
    reconciliation_required=(p_error IS NOT NULL)
    WHERE id=p_job AND status='PROCESSING' AND lease_token=p_lease;
END $$;

CREATE OR REPLACE FUNCTION public.validate_payment_job(p_job uuid,p_lease uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM payment_jobs j WHERE j.id=p_job AND j.status='PROCESSING' AND j.lease_token=p_lease AND j.lease_until>now()
    AND (j.kind='REFUND' OR EXISTS(SELECT 1 FROM payment_escrows e JOIN payment_accounts a ON a.user_id=e.vendor_id
      WHERE e.id=j.escrow_id AND e.status='HOLDING' AND a.payout_enabled AND a.vendor_destination=j.destination
      AND NOT EXISTS(SELECT 1 FROM booking_disputes d WHERE d.booking_id=e.booking_id AND d.status='OPEN'))));
$$;
REVOKE ALL ON FUNCTION public.finish_payment_job(uuid,uuid,text,text),public.validate_payment_job(uuid,uuid),app_private.booking_dispute_financial_hook() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_payment_job(uuid,uuid,text,text),public.validate_payment_job(uuid,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.report_booking_issue(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.report_booking_issue(uuid,text) TO authenticated;
COMMIT;
