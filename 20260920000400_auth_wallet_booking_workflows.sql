CREATE SCHEMA IF NOT EXISTS app_private;

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
BEGIN
  selected_role :=
    CASE
      WHEN new.raw_user_meta_data->>'role' IN ('customer', 'owner')
        THEN (new.raw_user_meta_data->>'role')::user_role
      ELSE 'customer'::user_role
    END;

  selected_name := COALESCE(NULLIF(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1), 'RigDesk user');
  selected_workspace := COALESCE(NULLIF(new.raw_user_meta_data->>'workspace_name', ''), selected_name || ' workspace');
  selected_upi := COALESCE(NULLIF(new.raw_user_meta_data->>'upi_id', ''), 'set-upi@bank');
  selected_bank := COALESCE(NULLIF(new.raw_user_meta_data->>'bank_name', ''), 'Linked bank pending');

  INSERT INTO public.users (id, role, full_name, workspace_name, phone, email, service_area)
  VALUES (
    new.id,
    selected_role,
    selected_name,
    selected_workspace,
    new.raw_user_meta_data->>'phone',
    COALESCE(new.email, new.id::text || '@auth.local'),
    new.raw_user_meta_data->>'service_area'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = excluded.email,
    updated_at = now();

  INSERT INTO public.wallets (user_id, upi_id, bank_name, available_balance_paise)
  VALUES (new.id, selected_upi, selected_bank, 0)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_create_riglogix_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_create_riglogix_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION app_private.handle_new_auth_user();

REVOKE ALL ON FUNCTION app_private.handle_new_auth_user() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.wallet_deposit(p_amount_paise integer, p_reference text DEFAULT NULL)
RETURNS public.wallets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := (SELECT auth.uid());
  result_wallet public.wallets;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_amount_paise IS NULL OR p_amount_paise <= 0 THEN
    RAISE EXCEPTION 'Deposit amount must be positive';
  END IF;

  UPDATE public.wallets
  SET available_balance_paise = available_balance_paise + p_amount_paise,
      updated_at = now()
  WHERE user_id = actor
  RETURNING * INTO result_wallet;

  IF result_wallet.id IS NULL THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;

  INSERT INTO public.wallet_transactions (wallet_id, type, amount_paise, note, reference)
  VALUES (result_wallet.id, 'upi_deposit', p_amount_paise, 'UPI wallet deposit', p_reference);

  RETURN result_wallet;
END;
$$;

CREATE OR REPLACE FUNCTION public.wallet_withdraw(p_amount_paise integer, p_reference text DEFAULT NULL)
RETURNS public.wallets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := (SELECT auth.uid());
  result_wallet public.wallets;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_amount_paise IS NULL OR p_amount_paise <= 0 THEN
    RAISE EXCEPTION 'Withdrawal amount must be positive';
  END IF;

  UPDATE public.wallets
  SET available_balance_paise = available_balance_paise - p_amount_paise,
      updated_at = now()
  WHERE user_id = actor
    AND available_balance_paise >= p_amount_paise
  RETURNING * INTO result_wallet;

  IF result_wallet.id IS NULL THEN
    RAISE EXCEPTION 'Insufficient available wallet balance';
  END IF;

  INSERT INTO public.wallet_transactions (wallet_id, type, amount_paise, note, reference)
  VALUES (result_wallet.id, 'bank_withdrawal', p_amount_paise, 'Bank withdrawal', p_reference);

  RETURN result_wallet;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_booking(p_booking_id uuid)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := (SELECT auth.uid());
  target_booking public.bookings;
  customer_wallet public.wallets;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO target_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF target_booking.id IS NULL THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF target_booking.owner_id <> actor THEN
    RAISE EXCEPTION 'Only the owner can accept this booking';
  END IF;

  IF target_booking.status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending bookings can be accepted';
  END IF;

  UPDATE public.wallets
  SET available_balance_paise = available_balance_paise - target_booking.wallet_hold_paise,
      locked_balance_paise = locked_balance_paise + target_booking.wallet_hold_paise,
      updated_at = now()
  WHERE user_id = target_booking.customer_id
    AND available_balance_paise >= target_booking.wallet_hold_paise
  RETURNING * INTO customer_wallet;

  IF customer_wallet.id IS NULL THEN
    RAISE EXCEPTION 'Customer wallet does not have enough available balance for the safety deposit';
  END IF;

  INSERT INTO public.wallet_transactions (wallet_id, booking_id, type, amount_paise, note)
  VALUES (customer_wallet.id, target_booking.id, 'safety_deposit_lock', target_booking.wallet_hold_paise, 'Safety deposit locked after owner acceptance');

  UPDATE public.bookings
  SET status = 'confirmed',
      cancellation_locked = true,
      accepted_at = now(),
      updated_at = now()
  WHERE id = target_booking.id
  RETURNING * INTO target_booking;

  INSERT INTO public.audit_events (actor_id, booking_id, event_type, metadata)
  VALUES (actor, target_booking.id, 'booking.accepted', jsonb_build_object('wallet_hold_paise', target_booking.wallet_hold_paise));

  RETURN target_booking;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_booking(p_booking_id uuid)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := (SELECT auth.uid());
  target_booking public.bookings;
  customer_wallet public.wallets;
  penalty integer;
  refund integer;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO target_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF target_booking.id IS NULL THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF target_booking.customer_id <> actor THEN
    RAISE EXCEPTION 'Only the customer can cancel this booking';
  END IF;

  IF target_booking.status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'Completed or cancelled bookings cannot be cancelled again';
  END IF;

  IF target_booking.status = 'pending' THEN
    UPDATE public.bookings
    SET status = 'cancelled',
        cancelled_at = now(),
        updated_at = now()
    WHERE id = target_booking.id
    RETURNING * INTO target_booking;

    INSERT INTO public.audit_events (actor_id, booking_id, event_type, metadata)
    VALUES (actor, target_booking.id, 'booking.cancelled_before_acceptance', '{}'::jsonb);

    RETURN target_booking;
  END IF;

  penalty := LEAST(target_booking.wallet_hold_paise, target_booking.penalty_amount_paise);
  refund := GREATEST(0, target_booking.wallet_hold_paise - penalty);

  UPDATE public.wallets
  SET locked_balance_paise = GREATEST(0, locked_balance_paise - target_booking.wallet_hold_paise),
      available_balance_paise = available_balance_paise + refund,
      penalty_debits_paise = penalty_debits_paise + penalty,
      updated_at = now()
  WHERE user_id = target_booking.customer_id
    AND locked_balance_paise >= target_booking.wallet_hold_paise
  RETURNING * INTO customer_wallet;

  IF customer_wallet.id IS NULL THEN
    RAISE EXCEPTION 'Locked safety deposit not found';
  END IF;

  IF refund > 0 THEN
    INSERT INTO public.wallet_transactions (wallet_id, booking_id, type, amount_paise, note)
    VALUES (customer_wallet.id, target_booking.id, 'safety_deposit_release', refund, 'Remaining safety deposit released after cancellation');
  END IF;

  INSERT INTO public.wallet_transactions (wallet_id, booking_id, type, amount_paise, note)
  VALUES (customer_wallet.id, target_booking.id, 'penalty_debit', penalty, 'Cancellation penalty deducted from safety deposit');

  UPDATE public.bookings
  SET status = 'cancelled',
      cancelled_at = now(),
      updated_at = now()
  WHERE id = target_booking.id
  RETURNING * INTO target_booking;

  INSERT INTO public.audit_events (actor_id, booking_id, event_type, metadata)
  VALUES (actor, target_booking.id, 'booking.cancelled_after_acceptance', jsonb_build_object('penalty_paise', penalty, 'refund_paise', refund));

  RETURN target_booking;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_booking(p_booking_id uuid)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := (SELECT auth.uid());
  target_booking public.bookings;
  customer_wallet public.wallets;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO target_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF target_booking.id IS NULL THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF target_booking.owner_id <> actor THEN
    RAISE EXCEPTION 'Only the owner can complete this booking';
  END IF;

  IF target_booking.status NOT IN ('confirmed', 'mobilizing', 'on_site', 'in_progress') THEN
    RAISE EXCEPTION 'Only active accepted bookings can be completed';
  END IF;

  UPDATE public.wallets
  SET locked_balance_paise = GREATEST(0, locked_balance_paise - target_booking.wallet_hold_paise),
      available_balance_paise = available_balance_paise + target_booking.wallet_hold_paise,
      updated_at = now()
  WHERE user_id = target_booking.customer_id
    AND locked_balance_paise >= target_booking.wallet_hold_paise
  RETURNING * INTO customer_wallet;

  IF customer_wallet.id IS NULL THEN
    RAISE EXCEPTION 'Locked safety deposit not found';
  END IF;

  INSERT INTO public.wallet_transactions (wallet_id, booking_id, type, amount_paise, note)
  VALUES (customer_wallet.id, target_booking.id, 'safety_deposit_release', target_booking.wallet_hold_paise, 'Safety deposit released after work completion');

  UPDATE public.bookings
  SET status = 'completed',
      completed_at = now(),
      updated_at = now()
  WHERE id = target_booking.id
  RETURNING * INTO target_booking;

  INSERT INTO public.audit_events (actor_id, booking_id, event_type, metadata)
  VALUES (actor, target_booking.id, 'booking.completed', jsonb_build_object('released_hold_paise', target_booking.wallet_hold_paise));

  RETURN target_booking;
END;
$$;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.borewell_casing_options, public.borewell_terrain_rates TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users, public.wallets, public.wallet_transactions, public.equipment, public.bookings, public.equipment_locations, public.reviews, public.audit_events TO authenticated;

REVOKE ALL ON FUNCTION public.wallet_deposit(integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wallet_withdraw(integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_booking(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_booking(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_booking(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.wallet_deposit(integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_withdraw(integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_booking(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_booking(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_booking(uuid) TO authenticated;
