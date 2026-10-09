CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('customer', 'owner', 'admin');
CREATE TYPE equipment_status AS ENUM ('ready', 'on_job', 'service_due', 'maintenance', 'offline');
CREATE TYPE pricing_unit AS ENUM ('hour', 'foot', 'km', 'survey', 'project');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'mobilizing', 'on_site', 'in_progress', 'completed', 'cancelled');
CREATE TYPE wallet_transaction_type AS ENUM ('upi_deposit', 'bank_withdrawal', 'safety_deposit_lock', 'safety_deposit_release', 'penalty_debit', 'owner_payout', 'platform_fee');
CREATE TYPE wallet_transaction_status AS ENUM ('pending', 'posted', 'failed', 'reversed');

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role user_role NOT NULL,
  full_name text NOT NULL,
  workspace_name text NOT NULL,
  phone text,
  email text NOT NULL,
  service_area text,
  is_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  upi_id text NOT NULL,
  bank_name text NOT NULL,
  available_balance_paise integer NOT NULL DEFAULT 0,
  locked_balance_paise integer NOT NULL DEFAULT 0,
  penalty_debits_paise integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  sector text NOT NULL,
  category text NOT NULL,
  registration_number text,
  capacity text,
  status equipment_status NOT NULL DEFAULT 'ready',
  pricing_unit pricing_unit NOT NULL,
  base_rate_paise integer NOT NULL,
  fuel_percent integer NOT NULL DEFAULT 0,
  engine_hours integer NOT NULL DEFAULT 0,
  telematics_id text NOT NULL,
  current_address text,
  current_lat numeric(10,7),
  current_lng numeric(10,7),
  image_url text,
  specs jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE borewell_casing_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  detail text,
  rate_paise_per_foot integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE borewell_terrain_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terrain_name text NOT NULL,
  rig_method text NOT NULL,
  rate_paise_per_foot integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_code text NOT NULL,
  customer_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  equipment_id uuid NOT NULL REFERENCES equipment(id) ON DELETE RESTRICT,
  status booking_status NOT NULL DEFAULT 'pending',
  service_type text,
  billing_unit pricing_unit NOT NULL,
  quantity numeric(12,2),
  unit_rate_paise integer,
  requested_date timestamptz NOT NULL,
  shift_label text,
  start_time text,
  job_address text NOT NULL,
  job_lat numeric(10,7) NOT NULL,
  job_lng numeric(10,7) NOT NULL,
  pickup_lat numeric(10,7),
  pickup_lng numeric(10,7),
  route_km numeric(10,2),
  instructions text,
  material_type text,
  stone_size_mm integer,
  casing_option_id uuid REFERENCES borewell_casing_options(id) ON DELETE SET NULL,
  casing_depth_feet integer,
  terrain_rate_id uuid REFERENCES borewell_terrain_rates(id) ON DELETE SET NULL,
  base_cost_paise integer NOT NULL,
  platform_fee_paise integer NOT NULL,
  total_cost_paise integer NOT NULL,
  owner_earnings_paise integer NOT NULL,
  wallet_hold_paise integer NOT NULL DEFAULT 0,
  penalty_amount_paise integer NOT NULL DEFAULT 0,
  cancellation_locked boolean NOT NULL DEFAULT false,
  accepted_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  type wallet_transaction_type NOT NULL,
  status wallet_transaction_status NOT NULL DEFAULT 'posted',
  amount_paise integer NOT NULL,
  note text,
  reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE equipment_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id uuid NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  label text NOT NULL,
  lat numeric(10,7) NOT NULL,
  lng numeric(10,7) NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'prototype'
);

CREATE TABLE reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  equipment_id uuid NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  rating integer NOT NULL,
  text text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_email_idx ON users(email);
CREATE INDEX users_role_idx ON users(role);
CREATE UNIQUE INDEX wallets_user_id_idx ON wallets(user_id);
CREATE INDEX wallets_upi_id_idx ON wallets(upi_id);
CREATE INDEX equipment_owner_id_idx ON equipment(owner_id);
CREATE INDEX equipment_category_idx ON equipment(category);
CREATE INDEX equipment_status_idx ON equipment(status);
CREATE UNIQUE INDEX equipment_telematics_id_idx ON equipment(telematics_id);
CREATE UNIQUE INDEX bookings_public_code_idx ON bookings(public_code);
CREATE INDEX bookings_customer_id_idx ON bookings(customer_id);
CREATE INDEX bookings_owner_id_idx ON bookings(owner_id);
CREATE INDEX bookings_equipment_id_idx ON bookings(equipment_id);
CREATE INDEX bookings_status_idx ON bookings(status);
CREATE INDEX wallet_transactions_wallet_id_idx ON wallet_transactions(wallet_id);
CREATE INDEX wallet_transactions_booking_id_idx ON wallet_transactions(booking_id);
CREATE INDEX equipment_locations_equipment_recorded_idx ON equipment_locations(equipment_id, recorded_at);
CREATE INDEX equipment_locations_booking_id_idx ON equipment_locations(booking_id);
CREATE UNIQUE INDEX reviews_booking_id_idx ON reviews(booking_id);
CREATE INDEX reviews_equipment_id_idx ON reviews(equipment_id);
CREATE INDEX audit_events_actor_id_idx ON audit_events(actor_id);
CREATE INDEX audit_events_booking_id_idx ON audit_events(booking_id);
CREATE INDEX audit_events_event_type_idx ON audit_events(event_type);
