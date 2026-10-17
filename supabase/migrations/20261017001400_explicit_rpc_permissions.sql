BEGIN;

-- Supabase can grant EXECUTE directly to anon through default privileges.
-- Revoking only PUBLIC does not remove those role-specific grants.
DO $$
DECLARE target record;
BEGIN
  FOR target IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS arguments
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE p.prokind='f' AND (
      n.nspname='app_private' OR
      (n.nspname='public' AND p.proname IN (
        'set_app_state_value','update_wallet_profile','marketplace_equipment',
        'request_equipment_booking','my_booking_records','accept_booking',
        'advance_booking','complete_booking','cancel_booking','decline_booking',
        'report_booking_issue','place_marketplace_bid','award_marketplace_bid',
        'marketplace_auction_records','review_booking','bond_record',
        'fuel_hub_context','fuel_bunks_nearby','register_fuel_bunk',
        'generate_fuel_voucher','my_fuel_vouchers','redeem_fuel_voucher',
        'save_worker_profile','search_workers','hire_worker',
        'my_workforce_records','respond_worker_hire','review_worker_profile'
      ))
    )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon',
      target.nspname,target.proname,target.arguments);
    IF target.nspname='app_private' THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM authenticated',
        target.nspname,target.proname,target.arguments);
    END IF;
  END LOOP;
  IF to_regprocedure('app_private.worker_admin()') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION app_private.worker_admin() TO authenticated;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
