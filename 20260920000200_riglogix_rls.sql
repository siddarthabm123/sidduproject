ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE borewell_casing_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE borewell_terrain_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can read their own profile"
  ON users FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = id);

CREATE POLICY "users can update their own profile"
  ON users FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY "users can read their own wallet"
  ON wallets FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "users can read their own wallet transactions"
  ON wallet_transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM wallets
      WHERE wallets.id = wallet_transactions.wallet_id
        AND wallets.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "any signed in user can read verified equipment"
  ON equipment FOR SELECT
  TO authenticated
  USING (is_verified = true OR owner_id = (SELECT auth.uid()));

CREATE POLICY "owners can manage their equipment"
  ON equipment FOR ALL
  TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

CREATE POLICY "signed in users can read active casing options"
  ON borewell_casing_options FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "signed in users can read active terrain rates"
  ON borewell_terrain_rates FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "booking parties can read bookings"
  ON bookings FOR SELECT
  TO authenticated
  USING (
    customer_id = (SELECT auth.uid())
    OR owner_id = (SELECT auth.uid())
  );

CREATE POLICY "customers can create their own bookings"
  ON bookings FOR INSERT
  TO authenticated
  WITH CHECK (customer_id = (SELECT auth.uid()));

CREATE POLICY "booking parties can update bookings"
  ON bookings FOR UPDATE
  TO authenticated
  USING (
    customer_id = (SELECT auth.uid())
    OR owner_id = (SELECT auth.uid())
  )
  WITH CHECK (
    customer_id = (SELECT auth.uid())
    OR owner_id = (SELECT auth.uid())
  );

CREATE POLICY "booking parties can read equipment locations"
  ON equipment_locations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM bookings
      WHERE bookings.id = equipment_locations.booking_id
        AND (
          bookings.customer_id = (SELECT auth.uid())
          OR bookings.owner_id = (SELECT auth.uid())
        )
    )
    OR EXISTS (
      SELECT 1
      FROM equipment
      WHERE equipment.id = equipment_locations.equipment_id
        AND equipment.owner_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "owners can insert equipment locations"
  ON equipment_locations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM equipment
      WHERE equipment.id = equipment_locations.equipment_id
        AND equipment.owner_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "booking parties can read reviews"
  ON reviews FOR SELECT
  TO authenticated
  USING (
    reviewer_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM bookings
      WHERE bookings.id = reviews.booking_id
        AND (
          bookings.customer_id = (SELECT auth.uid())
          OR bookings.owner_id = (SELECT auth.uid())
        )
    )
  );

CREATE POLICY "customers can create reviews for their bookings"
  ON reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    reviewer_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM bookings
      WHERE bookings.id = reviews.booking_id
        AND bookings.customer_id = (SELECT auth.uid())
        AND bookings.status = 'completed'
    )
  );

CREATE POLICY "users can read their audit events"
  ON audit_events FOR SELECT
  TO authenticated
  USING (actor_id = (SELECT auth.uid()));
