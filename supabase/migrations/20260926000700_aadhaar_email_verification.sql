ALTER TABLE users
  ADD COLUMN IF NOT EXISTS aadhaar_last4 text,
  ADD COLUMN IF NOT EXISTS aadhaar_verified_at timestamptz;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_aadhaar_last4_format;

ALTER TABLE users
  ADD CONSTRAINT users_aadhaar_last4_format
  CHECK (aadhaar_last4 IS NULL OR aadhaar_last4 ~ '^[0-9]{4}$');

COMMENT ON COLUMN users.aadhaar_last4 IS
  'Last four digits only. The complete Aadhaar number must never be stored by RigDesk.';

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
  selected_aadhaar_last4 text;
BEGIN
  selected_role := CASE WHEN new.raw_user_meta_data->>'role' IN ('customer', 'owner')
    THEN (new.raw_user_meta_data->>'role')::user_role ELSE 'customer'::user_role END;
  selected_name := COALESCE(NULLIF(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1), 'RigDesk user');
  selected_workspace := COALESCE(NULLIF(new.raw_user_meta_data->>'workspace_name', ''), selected_name || ' workspace');
  selected_upi := COALESCE(NULLIF(new.raw_user_meta_data->>'upi_id', ''), 'set-upi@bank');
  selected_bank := COALESCE(NULLIF(new.raw_user_meta_data->>'bank_name', ''), 'Linked bank pending');
  selected_aadhaar_last4 := CASE WHEN new.raw_user_meta_data->>'aadhaar_last4' ~ '^[0-9]{4}$'
    THEN new.raw_user_meta_data->>'aadhaar_last4' ELSE NULL END;

  INSERT INTO public.users (id, role, full_name, workspace_name, phone, email, service_area, aadhaar_last4)
  VALUES (new.id, selected_role, selected_name, selected_workspace, new.raw_user_meta_data->>'phone',
    COALESCE(new.email, new.id::text || '@auth.local'), new.raw_user_meta_data->>'service_area', selected_aadhaar_last4)
  ON CONFLICT (id) DO UPDATE SET email = excluded.email, aadhaar_last4 = COALESCE(excluded.aadhaar_last4, users.aadhaar_last4), updated_at = now();

  INSERT INTO public.wallets (user_id, upi_id, bank_name, available_balance_paise)
  VALUES (new.id, selected_upi, selected_bank, 0)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN new;
END;
$$;

REVOKE ALL ON FUNCTION app_private.handle_new_auth_user() FROM PUBLIC;
