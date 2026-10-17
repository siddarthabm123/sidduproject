BEGIN;

CREATE TYPE escrow_status AS ENUM ('HOLDING','RELEASED','REFUNDED','DISPUTED');
CREATE TABLE payment_policy (
  id boolean PRIMARY KEY DEFAULT true CHECK(id),
  commission_bps integer NOT NULL CHECK(commission_bps BETWEEN 500 AND 1000)
);
INSERT INTO payment_policy VALUES(true,750);
CREATE TABLE payment_accounts (
  user_id uuid PRIMARY KEY REFERENCES users(id),
  customer_reference text UNIQUE,
  vendor_destination text UNIQUE,
  payout_enabled boolean NOT NULL DEFAULT false
);
-- This balance is backed by verified gateway receipts, not prototype wallet credits.
CREATE TABLE payment_balances (
  contractor_id uuid PRIMARY KEY REFERENCES users(id),
  available_amount bigint NOT NULL DEFAULT 0 CHECK(available_amount BETWEEN 0 AND 9007199254740991),
  frozen boolean NOT NULL DEFAULT false
);
CREATE TABLE payment_escrows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),booking_id uuid NOT NULL UNIQUE REFERENCES bookings(id),
  contractor_id uuid NOT NULL REFERENCES users(id),vendor_id uuid NOT NULL REFERENCES users(id),
  locked_amount bigint NOT NULL CHECK(locked_amount BETWEEN 1 AND 2147483647),currency text NOT NULL DEFAULT 'inr' CHECK(currency='inr'),
  status escrow_status NOT NULL DEFAULT 'HOLDING',funding_source text NOT NULL CHECK(funding_source IN('BALANCE','CARD')),
  request_id uuid NOT NULL,payment_intent_id text UNIQUE,
  commission_bps integer NOT NULL CHECK(commission_bps BETWEEN 500 AND 1000),
  commission_amount bigint NOT NULL DEFAULT 0,payout_amount bigint NOT NULL DEFAULT 0,
  payout_due_date timestamptz,release_requested_at timestamptz,released_at timestamptz,refunded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(contractor_id,request_id),
  CHECK(commission_amount>=0 AND payout_amount>=0 AND commission_amount+payout_amount<=locked_amount),
  CHECK((funding_source='CARD')=(payment_intent_id IS NOT NULL))
);
CREATE TABLE inspection_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),booking_id uuid NOT NULL UNIQUE REFERENCES bookings(id),
  phase text NOT NULL DEFAULT 'post_return' CHECK(phase='post_return'),inspector_id uuid NOT NULL REFERENCES users(id),
  damage_flag boolean NOT NULL,notes text NOT NULL CHECK(length(trim(notes)) BETWEEN 3 AND 2000),
  signed_off_by uuid REFERENCES users(id),signed_off_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),
  CHECK((signed_off_by IS NULL)=(signed_off_at IS NULL)),CHECK(NOT damage_flag OR signed_off_at IS NULL)
);
CREATE TABLE payment_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),booking_id uuid NOT NULL UNIQUE REFERENCES bookings(id),
  escrow_id uuid UNIQUE REFERENCES payment_escrows(id),contractor_id uuid NOT NULL REFERENCES users(id),vendor_id uuid NOT NULL REFERENCES users(id),
  gross_amount bigint NOT NULL CHECK(gross_amount>0),commission_amount bigint NOT NULL CHECK(commission_amount>=0),
  vendor_amount bigint NOT NULL CHECK(vendor_amount>0),currency text NOT NULL DEFAULT 'inr' CHECK(currency='inr'),
  due_date timestamptz NOT NULL,paid_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(gross_amount=commission_amount+vendor_amount)
);
CREATE TABLE invoice_factoring_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),invoice_id uuid NOT NULL UNIQUE REFERENCES payment_invoices(id),
  vendor_id uuid NOT NULL REFERENCES users(id),request_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'REQUESTED' CHECK(status IN('REQUESTED','APPROVED','REJECTED','FUNDED')),
  created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(vendor_id,request_id)
);
CREATE TABLE payment_receipts (
  payment_intent_id text PRIMARY KEY,booking_id uuid REFERENCES bookings(id),contractor_id uuid NOT NULL REFERENCES users(id),
  amount bigint NOT NULL CHECK(amount BETWEEN 1 AND 2147483647),currency text NOT NULL CHECK(currency='inr'),
  status text NOT NULL CHECK(status IN('ACCEPTED','REFUND_PENDING','REFUNDED')),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE payment_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),escrow_id uuid REFERENCES payment_escrows(id),
  kind text NOT NULL CHECK(kind IN('PAYOUT','REFUND')),reference text NOT NULL,amount bigint NOT NULL CHECK(amount>0),
  currency text NOT NULL DEFAULT 'inr',destination text,payment_intent_id text,
  status text NOT NULL DEFAULT 'PENDING' CHECK(status IN('PENDING','PROCESSING','SUBMITTED','SUCCEEDED','CANCELLED')),
  attempts integer NOT NULL DEFAULT 0,first_attempt_at timestamptz,lease_token uuid,lease_until timestamptz,available_at timestamptz NOT NULL DEFAULT now(),
  provider_reference text UNIQUE,last_error text,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(kind,reference)
);
CREATE TABLE payment_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),escrow_id uuid REFERENCES payment_escrows(id),contractor_id uuid NOT NULL REFERENCES users(id),
  kind text NOT NULL CHECK(kind IN('BALANCE_CREDIT','ESCROW_LOCK','VENDOR_PAYOUT','COMMISSION','REFUND')),
  amount bigint NOT NULL CHECK(amount>0),reference text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(kind,reference)
);
CREATE TABLE payment_webhook_events (
  event_id text PRIMARY KEY,payload jsonb NOT NULL,processed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payment_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_escrows ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_factoring_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON payment_policy,payment_accounts,payment_balances,payment_escrows,inspection_logs,payment_invoices,invoice_factoring_requests,payment_receipts,payment_jobs,payment_ledger,payment_webhook_events FROM PUBLIC,anon,authenticated;
CREATE POLICY own_payment_balance ON payment_balances FOR SELECT TO authenticated USING(contractor_id=auth.uid());
CREATE POLICY own_escrow ON payment_escrows FOR SELECT TO authenticated USING(auth.uid() IN(contractor_id,vendor_id));
CREATE POLICY own_inspection ON inspection_logs FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM bookings b WHERE b.id=booking_id AND auth.uid() IN(b.customer_id,b.owner_id)));
CREATE POLICY own_invoice ON payment_invoices FOR SELECT TO authenticated USING(auth.uid() IN(contractor_id,vendor_id));
CREATE POLICY own_factoring ON invoice_factoring_requests FOR SELECT TO authenticated USING(vendor_id=auth.uid());
GRANT SELECT ON payment_balances,payment_escrows,inspection_logs,payment_invoices,invoice_factoring_requests TO authenticated;

CREATE FUNCTION public.escrow_quote(p_booking uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b bookings; rate integer;
BEGIN
  SELECT * INTO b FROM bookings WHERE id=p_booking AND customer_id=auth.uid();
  IF b.id IS NULL THEN RAISE EXCEPTION 'Contractor booking required'; END IF;
  SELECT commission_bps INTO rate FROM payment_policy;
  RETURN jsonb_build_object('booking_id',b.id,'contractor_id',b.customer_id,'vendor_id',b.owner_id,'locked_amount',b.total_cost_paise,'currency','inr',
    'commission_bps',rate,'customer_reference',(SELECT customer_reference FROM payment_accounts WHERE user_id=b.customer_id));
END $$;

CREATE FUNCTION public.escrow_get(p_booking uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT to_jsonb(e) FROM payment_escrows e WHERE booking_id=p_booking AND auth.uid() IN(contractor_id,vendor_id);
$$;

CREATE FUNCTION app_private.lock_escrow(p_booking uuid,p_actor uuid,p_request uuid,p_source text,p_intent text)
RETURNS payment_escrows LANGUAGE plpgsql SET search_path=public AS $$
DECLARE b bookings; e payment_escrows; rate integer; machine equipment;
BEGIN
  -- Balance-funded operations consistently lock the balance before bookings/escrow.
  IF p_source='BALANCE' THEN PERFORM 1 FROM payment_balances WHERE contractor_id=p_actor FOR UPDATE; END IF;
  SELECT * INTO b FROM bookings WHERE id=p_booking FOR UPDATE;
  IF b.id IS NULL OR p_actor IS NULL OR b.customer_id<>p_actor OR p_request IS NULL OR
    NOT EXISTS(SELECT 1 FROM users WHERE id=p_actor AND role='customer' AND email NOT LIKE '%@rigdesk.demo') THEN RAISE EXCEPTION 'Contractor booking required'; END IF;
  SELECT * INTO e FROM payment_escrows WHERE booking_id=b.id FOR UPDATE;
  IF e.id IS NOT NULL THEN
    IF e.request_id<>p_request OR e.funding_source<>p_source OR e.payment_intent_id IS DISTINCT FROM p_intent THEN RAISE EXCEPTION 'Booking already has an escrow'; END IF;
    RETURN e;
  END IF;
  IF b.status NOT IN('pending','confirmed') OR b.total_cost_paise<=0 OR b.wallet_hold_paise<>0 OR b.amount_paid_paise<>0 OR b.reservation_start<current_date OR
    (b.status='pending' AND coalesce(b.request_expires_at<=now(),true)) THEN RAISE EXCEPTION 'Booking is not eligible for upfront funding'; END IF;
  SELECT * INTO machine FROM equipment WHERE id=b.equipment_id FOR UPDATE;
  IF NOT machine.is_verified OR machine.status<>'ready' OR app_private.reserved_units(machine.id,b.reservation_start,b.reservation_end)>machine.available_units THEN RAISE EXCEPTION 'Equipment is no longer available'; END IF;
  IF p_source='BALANCE' THEN
    UPDATE payment_balances SET available_amount=available_amount-b.total_cost_paise WHERE contractor_id=p_actor AND NOT frozen AND available_amount>=b.total_cost_paise;
    IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient verified contractor balance'; END IF;
  END IF;
  SELECT commission_bps INTO rate FROM payment_policy;
  INSERT INTO payment_escrows(booking_id,contractor_id,vendor_id,locked_amount,funding_source,request_id,payment_intent_id,commission_bps)
  VALUES(b.id,b.customer_id,b.owner_id,b.total_cost_paise,p_source,p_request,p_intent,rate) RETURNING * INTO e;
  UPDATE bookings SET status='confirmed',accepted_at=coalesce(accepted_at,now()),wallet_hold_paise=total_cost_paise,amount_paid_paise=total_cost_paise,updated_at=now() WHERE id=b.id;
  INSERT INTO payment_ledger(escrow_id,contractor_id,kind,amount,reference) VALUES(e.id,e.contractor_id,'ESCROW_LOCK',e.locked_amount,e.id::text);
  INSERT INTO audit_events(actor_id,booking_id,event_type) VALUES(p_actor,b.id,'escrow.locked');
  RETURN e;
END $$;

CREATE FUNCTION public.escrow_lock_balance(p_booking uuid,p_request uuid)
RETURNS payment_escrows LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN RETURN app_private.lock_escrow(p_booking,auth.uid(),p_request,'BALANCE',NULL); END $$;

CREATE FUNCTION app_private.schedule_escrow_release(p_booking uuid)
RETURNS payment_escrows LANGUAGE plpgsql SET search_path=public AS $$
DECLARE b bookings; e payment_escrows; signed_at timestamptz; fee bigint;
BEGIN
  SELECT * INTO b FROM bookings WHERE id=p_booking FOR UPDATE;
  SELECT * INTO e FROM payment_escrows WHERE booking_id=p_booking FOR UPDATE;
  IF e.id IS NULL THEN RAISE EXCEPTION 'Escrow not found'; END IF;
  SELECT signed_off_at INTO signed_at FROM inspection_logs WHERE booking_id=p_booking AND NOT damage_flag;
  IF signed_at IS NULL OR b.status<>'completed' OR e.status IN('DISPUTED','REFUNDED') OR
    EXISTS(SELECT 1 FROM booking_disputes WHERE booking_id=p_booking AND status='OPEN') THEN RAISE EXCEPTION 'Successful signed-off post_return inspection required'; END IF;
  IF e.release_requested_at IS NOT NULL THEN RETURN e; END IF;
  fee:=(e.locked_amount*e.commission_bps+5000)/10000;
  UPDATE payment_escrows SET commission_amount=fee,payout_amount=locked_amount-fee,release_requested_at=signed_at,payout_due_date=signed_at+interval '48 hours' WHERE id=e.id RETURNING * INTO e;
  INSERT INTO payment_invoices(booking_id,escrow_id,contractor_id,vendor_id,gross_amount,commission_amount,vendor_amount,due_date)
  VALUES(b.id,e.id,e.contractor_id,e.vendor_id,e.locked_amount,fee,e.payout_amount,e.payout_due_date);
  INSERT INTO payment_jobs(escrow_id,kind,reference,amount,payment_intent_id) VALUES(e.id,'PAYOUT',e.id::text,e.payout_amount,e.payment_intent_id);
  RETURN e;
END $$;

CREATE FUNCTION public.escrow_release(p_booking uuid)
RETURNS payment_escrows LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM bookings WHERE id=p_booking AND auth.uid() IN(customer_id,owner_id)) THEN RAISE EXCEPTION 'Booking party required'; END IF;
  RETURN app_private.schedule_escrow_release(p_booking);
END $$;

CREATE FUNCTION public.escrow_refund(p_booking uuid)
RETURNS payment_escrows LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b bookings; e payment_escrows;
BEGIN
  IF EXISTS(SELECT 1 FROM payment_escrows WHERE booking_id=p_booking AND contractor_id=auth.uid() AND funding_source='BALANCE') THEN
    PERFORM 1 FROM payment_balances WHERE contractor_id=auth.uid() FOR UPDATE;
  END IF;
  SELECT * INTO b FROM bookings WHERE id=p_booking AND customer_id=auth.uid() FOR UPDATE;
  SELECT * INTO e FROM payment_escrows WHERE booking_id=b.id FOR UPDATE;
  IF e.id IS NULL THEN RAISE EXCEPTION 'Contractor escrow required'; END IF;
  IF e.status='REFUNDED' THEN RETURN e; END IF;
  IF EXISTS(SELECT 1 FROM payment_jobs WHERE escrow_id=e.id AND kind='REFUND') THEN RETURN e; END IF;
  IF b.status<>'confirmed' OR e.status<>'HOLDING' OR e.release_requested_at IS NOT NULL THEN RAISE EXCEPTION 'Only undisputed pre-dispatch escrow can be refunded'; END IF;
  UPDATE bookings SET status='cancelled',cancelled_at=now(),cancellation_reason='Escrow refund requested',updated_at=now() WHERE id=b.id;
  IF e.funding_source='BALANCE' THEN
    UPDATE payment_balances SET available_amount=available_amount+e.locked_amount WHERE contractor_id=e.contractor_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Verified payment balance missing'; END IF;
    UPDATE payment_escrows SET status='REFUNDED',refunded_at=now() WHERE id=e.id RETURNING * INTO e;
    UPDATE bookings SET wallet_hold_paise=0,amount_paid_paise=0 WHERE id=b.id;
    INSERT INTO payment_ledger(escrow_id,contractor_id,kind,amount,reference) VALUES(e.id,e.contractor_id,'REFUND',e.locked_amount,e.id::text);
  ELSE
    INSERT INTO payment_jobs(escrow_id,kind,reference,amount,payment_intent_id) VALUES(e.id,'REFUND',e.payment_intent_id,e.locked_amount,e.payment_intent_id);
  END IF;
  RETURN e;
END $$;

CREATE FUNCTION app_private.freeze_escrow(p_booking uuid,p_actor uuid,p_reason text)
RETURNS void LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  PERFORM 1 FROM bookings WHERE id=p_booking FOR UPDATE;
  UPDATE payment_escrows SET status='DISPUTED' WHERE booking_id=p_booking AND status<>'REFUNDED';
  UPDATE payment_jobs SET status='CANCELLED' WHERE escrow_id IN(SELECT id FROM payment_escrows WHERE booking_id=p_booking) AND kind='PAYOUT' AND status='PENDING';
  INSERT INTO booking_disputes(booking_id,reporter_id,reason) VALUES(p_booking,p_actor,left(p_reason,2000))
  ON CONFLICT(booking_id) DO UPDATE SET status='OPEN';
  INSERT INTO audit_events(actor_id,booking_id,event_type,metadata) VALUES(p_actor,p_booking,'escrow.disputed',jsonb_build_object('reason',left(p_reason,2000)));
END $$;

CREATE FUNCTION app_private.booking_dispute_financial_hook()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.status='OPEN' THEN
    UPDATE payment_escrows SET status='DISPUTED' WHERE booking_id=NEW.booking_id AND status<>'REFUNDED';
    UPDATE payment_jobs SET status='CANCELLED' WHERE escrow_id IN(SELECT id FROM payment_escrows WHERE booking_id=NEW.booking_id) AND kind='PAYOUT' AND status='PENDING';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER booking_dispute_financial_hook AFTER INSERT OR UPDATE OF status ON booking_disputes FOR EACH ROW EXECUTE FUNCTION app_private.booking_dispute_financial_hook();

CREATE FUNCTION app_private.inspection_financial_hook()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b bookings; fee bigint; rate integer;
BEGIN
  SELECT * INTO b FROM bookings WHERE id=NEW.booking_id FOR UPDATE;
  IF NEW.damage_flag THEN
    PERFORM app_private.freeze_escrow(b.id,NEW.inspector_id,'Post-return damage: '||NEW.notes);
  ELSIF NEW.signed_off_at IS NOT NULL AND (TG_OP='INSERT' OR OLD.signed_off_at IS NULL) THEN
    UPDATE bookings SET status='completed',completed_at=NEW.signed_off_at,updated_at=now() WHERE id=b.id;
    IF EXISTS(SELECT 1 FROM payment_escrows WHERE booking_id=b.id) THEN
      PERFORM app_private.schedule_escrow_release(b.id);
    ELSE
      SELECT commission_bps INTO rate FROM payment_policy;fee:=(b.total_cost_paise::bigint*rate+5000)/10000;
      INSERT INTO payment_invoices(booking_id,contractor_id,vendor_id,gross_amount,commission_amount,vendor_amount,due_date)
      VALUES(b.id,b.customer_id,b.owner_id,b.total_cost_paise,fee,b.total_cost_paise-fee,NEW.signed_off_at+interval '60 days');
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER post_return_financial_hook AFTER INSERT OR UPDATE OF signed_off_at ON inspection_logs FOR EACH ROW EXECUTE FUNCTION app_private.inspection_financial_hook();

CREATE FUNCTION public.record_post_return_inspection(p_booking uuid,p_damage boolean,p_notes text)
RETURNS inspection_logs LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b bookings; result inspection_logs;
BEGIN
  SELECT * INTO b FROM bookings WHERE id=p_booking AND auth.uid() IN(customer_id,owner_id) FOR UPDATE;
  IF b.id IS NULL OR b.status<>'in_progress' OR b.completion_requested_at IS NULL OR p_damage IS NULL THEN RAISE EXCEPTION 'Owner completion request and booking party required'; END IF;
  SELECT * INTO result FROM inspection_logs WHERE booking_id=b.id;
  IF result.id IS NOT NULL THEN
    IF result.damage_flag<>p_damage OR result.notes<>trim(p_notes) THEN RAISE EXCEPTION 'Inspection already recorded; review amendments with support'; END IF;
    RETURN result;
  END IF;
  INSERT INTO inspection_logs(booking_id,inspector_id,damage_flag,notes) VALUES(b.id,auth.uid(),p_damage,trim(p_notes)) RETURNING * INTO result;
  RETURN result;
END $$;

CREATE FUNCTION public.sign_off_post_return(p_inspection uuid)
RETURNS inspection_logs LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result inspection_logs; b bookings;
BEGIN
  SELECT * INTO result FROM inspection_logs WHERE id=p_inspection;
  SELECT * INTO b FROM bookings WHERE id=result.booking_id AND customer_id=auth.uid() FOR UPDATE;
  IF b.id IS NULL OR result.damage_flag OR EXISTS(SELECT 1 FROM booking_disputes WHERE booking_id=b.id AND status='OPEN') THEN RAISE EXCEPTION 'Contractor sign-off of a damage-free inspection required'; END IF;
  IF result.signed_off_at IS NOT NULL THEN RETURN result; END IF;
  IF b.status<>'in_progress' OR b.completion_requested_at IS NULL THEN RAISE EXCEPTION 'Job is not ready for sign-off'; END IF;
  UPDATE inspection_logs SET signed_off_by=auth.uid(),signed_off_at=now() WHERE id=result.id RETURNING * INTO result;
  RETURN result;
END $$;

CREATE FUNCTION public.request_invoice_factoring(p_invoice uuid,p_request uuid)
RETURNS invoice_factoring_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE invoice payment_invoices; result invoice_factoring_requests;
BEGIN
  SELECT * INTO invoice FROM payment_invoices WHERE id=p_invoice AND vendor_id=auth.uid() FOR UPDATE;
  IF invoice.id IS NULL OR invoice.escrow_id IS NOT NULL OR invoice.paid_at IS NOT NULL OR invoice.due_date<=now() OR p_request IS NULL OR
    EXISTS(SELECT 1 FROM booking_disputes WHERE booking_id=invoice.booking_id AND status='OPEN') THEN RAISE EXCEPTION 'Only an undisputed unpaid deferred invoice can be submitted for factoring'; END IF;
  SELECT * INTO result FROM invoice_factoring_requests WHERE invoice_id=invoice.id;
  IF result.id IS NOT NULL THEN RETURN result; END IF;
  INSERT INTO invoice_factoring_requests(invoice_id,vendor_id,request_id) VALUES(invoice.id,auth.uid(),p_request) RETURNING * INTO result;
  RETURN result;
END $$;

-- The entire event, receipt, balance/escrow and outbox mutation is one RPC transaction.
CREATE FUNCTION public.apply_payment_event(p_event_id text,p_event jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE previous jsonb; receipt payment_receipts; b bookings; e payment_escrows; job payment_jobs; amount bigint; actor uuid; event_type text;
BEGIN
  IF length(coalesce(p_event_id,'')) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Invalid gateway event ID'; END IF;
  INSERT INTO payment_webhook_events(event_id,payload) VALUES(p_event_id,p_event) ON CONFLICT DO NOTHING;
  SELECT payload INTO previous FROM payment_webhook_events WHERE event_id=p_event_id FOR UPDATE;
  IF previous<>p_event THEN RAISE EXCEPTION 'Gateway event ID reused with different data'; END IF;
  event_type:=p_event->>'type';
  IF event_type IN('BALANCE_CREDIT','CARD_CAPTURED') THEN
    amount:=(p_event->>'amount')::bigint;actor:=(p_event->>'contractor_id')::uuid;
    IF amount NOT BETWEEN 1 AND 2147483647 OR p_event->>'currency'<>'inr' OR NOT EXISTS(SELECT 1 FROM payment_accounts WHERE user_id=actor AND customer_reference=p_event->>'customer_reference') THEN RAISE EXCEPTION 'Funding account, amount or currency mismatch'; END IF;
    SELECT * INTO receipt FROM payment_receipts WHERE payment_intent_id=p_event->>'payment_intent_id' FOR UPDATE;
    IF receipt.payment_intent_id IS NOT NULL THEN
      IF receipt.contractor_id<>actor OR receipt.amount<>amount OR receipt.booking_id IS DISTINCT FROM nullif(p_event->>'booking_id','')::uuid THEN RAISE EXCEPTION 'Payment intent reused with different funding details'; END IF;
      RETURN jsonb_build_object('duplicate',true,'receipt_status',receipt.status);
    END IF;
    INSERT INTO payment_receipts(payment_intent_id,contractor_id,booking_id,amount,currency,status)
    VALUES(p_event->>'payment_intent_id',actor,nullif(p_event->>'booking_id','')::uuid,amount,'inr','ACCEPTED');
    IF event_type='BALANCE_CREDIT' THEN
      INSERT INTO payment_balances(contractor_id,available_amount) VALUES(actor,amount) ON CONFLICT(contractor_id) DO UPDATE SET available_amount=payment_balances.available_amount+amount;
      INSERT INTO payment_ledger(contractor_id,kind,amount,reference) VALUES(actor,'BALANCE_CREDIT',amount,p_event->>'payment_intent_id');
    ELSE
      SELECT * INTO b FROM bookings WHERE id=(p_event->>'booking_id')::uuid AND customer_id=actor FOR UPDATE;
      IF b.id IS NULL THEN RAISE EXCEPTION 'Funding booking mismatch'; END IF;
      BEGIN
        IF b.total_cost_paise<>amount THEN RAISE EXCEPTION 'Captured amount mismatch'; END IF;
        e:=app_private.lock_escrow(b.id,actor,(p_event->>'request_id')::uuid,'CARD',p_event->>'payment_intent_id');
      EXCEPTION WHEN raise_exception OR unique_violation THEN
        UPDATE payment_receipts SET status='REFUND_PENDING' WHERE payment_intent_id=p_event->>'payment_intent_id';
        INSERT INTO payment_jobs(kind,reference,amount,payment_intent_id) VALUES('REFUND',p_event->>'payment_intent_id',amount,p_event->>'payment_intent_id');
        RETURN jsonb_build_object('refund_pending',true);
      END;
    END IF;
  ELSIF event_type IN('PAYOUT_SUCCEEDED','REFUND_SUCCEEDED') THEN
    SELECT * INTO job FROM payment_jobs WHERE id=(p_event->>'job_id')::uuid;
    IF job.id IS NULL THEN RAISE EXCEPTION 'Payment job not found'; END IF;
    IF job.escrow_id IS NOT NULL THEN
      SELECT booking_id INTO b.id FROM payment_escrows WHERE id=job.escrow_id;
      PERFORM 1 FROM bookings WHERE id=b.id FOR UPDATE;
    END IF;
    SELECT * INTO job FROM payment_jobs WHERE id=job.id FOR UPDATE;
    IF job.status NOT IN('PROCESSING','SUBMITTED','SUCCEEDED') OR job.amount<>(p_event->>'amount')::bigint OR job.currency<>p_event->>'currency' OR
      (job.provider_reference IS NOT NULL AND job.provider_reference<>p_event->>'provider_reference') OR
      (event_type='PAYOUT_SUCCEEDED' AND (job.kind<>'PAYOUT' OR job.destination IS DISTINCT FROM p_event->>'destination')) OR
      (event_type='REFUND_SUCCEEDED' AND (job.kind<>'REFUND' OR job.payment_intent_id IS DISTINCT FROM p_event->>'payment_intent_id')) THEN RAISE EXCEPTION 'Payment job confirmation mismatch'; END IF;
    IF job.status='SUCCEEDED' THEN RETURN jsonb_build_object('duplicate',true); END IF;
    UPDATE payment_jobs SET status='SUCCEEDED',provider_reference=p_event->>'provider_reference',lease_until=NULL WHERE id=job.id;
    IF job.kind='PAYOUT' THEN
      SELECT * INTO e FROM payment_escrows WHERE id=job.escrow_id FOR UPDATE;
      INSERT INTO payment_ledger(escrow_id,contractor_id,kind,amount,reference) VALUES(e.id,e.contractor_id,'VENDOR_PAYOUT',job.amount,job.id::text);
      IF e.commission_amount>0 THEN INSERT INTO payment_ledger(escrow_id,contractor_id,kind,amount,reference) VALUES(e.id,e.contractor_id,'COMMISSION',e.commission_amount,job.id::text); END IF;
      IF e.status<>'DISPUTED' THEN UPDATE payment_escrows SET status='RELEASED',released_at=now() WHERE id=e.id; END IF;
      UPDATE payment_invoices SET paid_at=now() WHERE escrow_id=e.id;
      UPDATE bookings SET wallet_hold_paise=0,owner_earnings_paise=job.amount,updated_at=now() WHERE id=e.booking_id;
    ELSE
      UPDATE payment_receipts SET status='REFUNDED' WHERE payment_intent_id=job.payment_intent_id;
      IF job.escrow_id IS NOT NULL THEN
        UPDATE payment_escrows SET status='REFUNDED',refunded_at=now() WHERE id=job.escrow_id;
        UPDATE bookings SET status='cancelled',cancelled_at=now(),wallet_hold_paise=0,amount_paid_paise=0 WHERE id=b.id;
        INSERT INTO payment_ledger(escrow_id,contractor_id,kind,amount,reference)
        SELECT id,contractor_id,'REFUND',job.amount,job.id::text FROM payment_escrows WHERE id=job.escrow_id;
      END IF;
    END IF;
  ELSIF event_type='DISPUTE_OPENED' THEN
    SELECT * INTO e FROM payment_escrows WHERE payment_intent_id=p_event->>'payment_intent_id';
    IF e.id IS NOT NULL THEN
      PERFORM app_private.freeze_escrow(e.booking_id,e.contractor_id,'Gateway payment dispute requires review');
    ELSE
      SELECT * INTO receipt FROM payment_receipts WHERE payment_intent_id=p_event->>'payment_intent_id';
      IF receipt.payment_intent_id IS NULL OR receipt.booking_id IS NOT NULL THEN RAISE EXCEPTION 'Disputed funding receipt not found'; END IF;
      UPDATE payment_balances SET frozen=true WHERE contractor_id=receipt.contractor_id;
      FOR e IN SELECT * FROM payment_escrows WHERE contractor_id=receipt.contractor_id AND funding_source='BALANCE' AND status='HOLDING' ORDER BY booking_id LOOP
        PERFORM app_private.freeze_escrow(e.booking_id,e.contractor_id,'Balance funding chargeback requires review');
      END LOOP;
    END IF;
  ELSE RAISE EXCEPTION 'Unsupported payment event'; END IF;
  RETURN jsonb_build_object('processed',true,'escrow_id',e.id);
END $$;

CREATE FUNCTION public.claim_payment_jobs(p_limit integer DEFAULT 10)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb:='[]'; job payment_jobs; target_destination text;
BEGIN
  IF p_limit NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Invalid worker batch size'; END IF;
  FOR job IN SELECT j.* FROM payment_jobs j WHERE j.available_at<=now() AND (j.status='PENDING' OR j.status='PROCESSING' AND j.lease_until<now())
    AND (j.kind='REFUND' OR EXISTS(SELECT 1 FROM payment_escrows e JOIN payment_accounts a ON a.user_id=e.vendor_id WHERE e.id=j.escrow_id AND e.status='HOLDING' AND a.payout_enabled AND a.vendor_destination IS NOT NULL))
    ORDER BY j.created_at FOR UPDATE OF j SKIP LOCKED LIMIT p_limit LOOP
    IF job.kind='PAYOUT' THEN SELECT a.vendor_destination INTO target_destination FROM payment_escrows e JOIN payment_accounts a ON a.user_id=e.vendor_id WHERE e.id=job.escrow_id; ELSE target_destination:=NULL; END IF;
    UPDATE payment_jobs SET status='PROCESSING',attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,now()),lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes',destination=coalesce(payment_jobs.destination,target_destination) WHERE id=job.id RETURNING * INTO job;
    result:=result||jsonb_build_array(to_jsonb(job));
  END LOOP;
  RETURN result;
END $$;

CREATE FUNCTION public.finish_payment_job(p_job uuid,p_lease uuid,p_reference text,p_error text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF p_reference IS NULL AND p_error IS NULL THEN RAISE EXCEPTION 'Worker result required'; END IF;
  UPDATE payment_jobs SET status=CASE WHEN p_error IS NULL THEN 'SUBMITTED' ELSE 'PENDING' END,
    provider_reference=coalesce(p_reference,provider_reference),last_error=left(p_error,500),available_at=now()+interval '1 minute',lease_until=NULL
  WHERE id=p_job AND status='PROCESSING' AND lease_token=p_lease;
  -- A webhook may already have settled the same job. Never downgrade it.
END $$;

CREATE FUNCTION public.validate_payment_job(p_job uuid,p_lease uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM payment_jobs j WHERE j.id=p_job AND j.status='PROCESSING' AND j.lease_token=p_lease AND j.lease_until>now()
    AND (j.kind='REFUND' OR EXISTS(SELECT 1 FROM payment_escrows e JOIN payment_accounts a ON a.user_id=e.vendor_id WHERE e.id=j.escrow_id AND e.status='HOLDING' AND a.payout_enabled AND a.vendor_destination=j.destination)));
$$;

REVOKE ALL ON FUNCTION app_private.lock_escrow(uuid,uuid,uuid,text,text),app_private.schedule_escrow_release(uuid),app_private.freeze_escrow(uuid,uuid,text),app_private.inspection_financial_hook(),app_private.booking_dispute_financial_hook() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.escrow_quote(uuid),public.escrow_get(uuid),public.escrow_lock_balance(uuid,uuid),public.escrow_release(uuid),public.escrow_refund(uuid),public.record_post_return_inspection(uuid,boolean,text),public.sign_off_post_return(uuid),public.request_invoice_factoring(uuid,uuid),public.apply_payment_event(text,jsonb),public.claim_payment_jobs(integer),public.finish_payment_job(uuid,uuid,text,text),public.validate_payment_job(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.escrow_quote(uuid),public.escrow_get(uuid),public.escrow_lock_balance(uuid,uuid),public.escrow_release(uuid),public.escrow_refund(uuid),public.record_post_return_inspection(uuid,boolean,text),public.sign_off_post_return(uuid),public.request_invoice_factoring(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_payment_event(text,jsonb),public.claim_payment_jobs(integer),public.finish_payment_job(uuid,uuid,text,text),public.validate_payment_job(uuid,uuid) TO service_role;
COMMIT;
