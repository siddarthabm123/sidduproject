-- Read-only production audit. No user records, documents or secrets are returned.
SELECT jsonb_pretty(jsonb_build_object(
  'public_tables', (SELECT jsonb_agg(table_name ORDER BY table_name)
    FROM information_schema.tables WHERE table_schema = 'public'),
  'prerequisite_columns', (SELECT jsonb_agg(table_name || '.' || column_name ORDER BY table_name, column_name)
    FROM information_schema.columns WHERE table_schema = 'public' AND
    ((table_name = 'users' AND column_name IN ('aadhaar_last4', 'address')) OR
     (table_name = 'bookings' AND column_name IN ('amount_paid_paise', 'reservation_start', 'reservation_end', 'completion_requested_at')) OR
     (table_name = 'equipment' AND column_name = 'available_units'))),
  'public_functions', (SELECT jsonb_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' ORDER BY p.proname)
    FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname IN ('marketplace_equipment', 'request_equipment_booking', 'fuel_hub_context', 'save_worker_profile', 'my_workforce_records','marketplace_availability','mark_workspace_notifications_read','claim_provider_request','record_booking_work','review_booking_work')),
  'private_schema', to_regnamespace('app_private'),
  'migration_history', to_regclass('supabase_migrations.schema_migrations'),
  'worker_document_bucket', (SELECT jsonb_agg(jsonb_build_object('id', id, 'public', public,
    'file_size_limit', file_size_limit, 'allowed_mime_types', allowed_mime_types))
    FROM storage.buckets WHERE id = 'worker-documents'),
  'storage_policies', (SELECT jsonb_agg(jsonb_build_object('name', policyname, 'command', cmd,
    'roles', roles, 'using', qual, 'check', with_check)) FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects')
)) AS setup_audit;
