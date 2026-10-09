-- Demo marketplace records shown by the Siddartha and Mahesh profiles.
-- Fixed IDs make this migration idempotent and safe to reapply.

INSERT INTO users (id, role, full_name, workspace_name, phone, email, service_area, is_verified)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'customer', 'Siddartha', 'Siddartha Borewell and Site Works', '9876543210', 'siddartha@rigdesk.demo', 'Bengaluru', true),
  ('20000000-0000-4000-8000-000000000001', 'owner', 'Mahesh Kumar', 'Mahesh Heavy Equipment Services', '9988776655', 'mahesh@rigdesk.demo', 'Bengaluru', true),
  ('20000000-0000-4000-8000-000000000002', 'owner', 'Ananya Rao', 'AquaCore Drilling', '9900112233', 'ananya@rigdesk.demo', 'Hoskote', true),
  ('20000000-0000-4000-8000-000000000003', 'owner', 'Ravi Prakash', 'Northline Earthworks', '9900112244', 'ravi@rigdesk.demo', 'Whitefield', true),
  ('20000000-0000-4000-8000-000000000004', 'owner', 'Naveen Gowda', 'Kaveri Agri Rentals', '9900112255', 'naveen@rigdesk.demo', 'Bengaluru Rural', true)
ON CONFLICT (id) DO UPDATE SET
  full_name = excluded.full_name,
  workspace_name = excluded.workspace_name,
  phone = excluded.phone,
  service_area = excluded.service_area,
  is_verified = excluded.is_verified,
  updated_at = now();

INSERT INTO wallets (id, user_id, upi_id, bank_name, available_balance_paise, locked_balance_paise)
VALUES
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'siddartha@upi', 'Demo Customer Bank', 12500000, 1901900),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'mahesh@upi', 'Demo Owner Bank', 21800000, 0),
  ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', 'aquacore@upi', 'Demo Owner Bank', 33600000, 0),
  ('30000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000003', 'northline@upi', 'Demo Owner Bank', 28400000, 0),
  ('30000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000004', 'kaveri@upi', 'Demo Owner Bank', 16500000, 0)
ON CONFLICT (user_id) DO UPDATE SET
  upi_id = excluded.upi_id,
  bank_name = excluded.bank_name,
  available_balance_paise = excluded.available_balance_paise,
  locked_balance_paise = excluded.locked_balance_paise,
  updated_at = now();

INSERT INTO equipment (id, owner_id, title, sector, category, registration_number, capacity, status, pricing_unit, base_rate_paise, fuel_percent, engine_hours, telematics_id, current_address, current_lat, current_lng, image_url, specs, is_verified)
VALUES
  ('40000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'Atlas Copco 1500ft High-Pressure Borewell Rig', 'Agriculture', 'Borewell Rig', 'KA 53 BR 1500', '1,500 ft depth', 'on_job', 'foot', 9500, 88, 1320, 'DEMO-AT1500-441', 'Hoskote, Bengaluru', 13.0712, 77.7984, '/assets/borewell-rig.jpg', '["1200 CFM / 350 PSI compressor", "DTH hammer", "Rotary mud support"]', true),
  ('40000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000003', 'X300 Crawler Excavator', 'Construction', 'Excavator', 'KA 51 AB 1024', '30 tonne', 'on_job', 'hour', 285000, 78, 2140, 'DEMO-X300-804', 'Whitefield, Bengaluru', 12.9698, 77.7499, '/assets/heavy-excavator.jpg', '["1.5 m3 bucket", "6.7 m digging depth"]', true),
  ('40000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', 'DT420 Tipper Truck', 'Logistics', 'Tipper Truck', 'KA 01 MN 8842', '16 tonne', 'on_job', 'km', 20000, 64, 3890, 'DEMO-DT420-112', 'Hosur Road, Bengaluru', 12.9156, 77.6502, '/assets/tipper-truck.jpg', '["10 wheel drive", "14 m3 body"]', true),
  ('40000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000004', 'FarmMate 75 HP 4WD Tractor', 'Agriculture', 'Tractor', 'KA 40 TR 7544', '75 HP', 'ready', 'hour', 120000, 81, 1890, 'DEMO-FM75-309', 'Hoskote, Bengaluru', 13.0712, 77.7984, '/assets/tractor-4wd.jpg', '["4WD", "Differential lock", "Rear PTO"]', true),
  ('40000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000001', 'CAT 140K Motor Grader', 'Road & Infrastructure', 'Motor Grader', 'KA 03 QX 7741', '14 ft blade', 'maintenance', 'hour', 235000, 31, 5980, 'DEMO-CAT140-230', 'Tumakuru Road, Bengaluru', 13.0410, 77.5050, '/assets/motor-grader.jpg', '["14 ft moldboard", "Fine grading control"]', true),
  ('40000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000001', 'SkidPro Compact Loader', 'Landscaping & Utilities', 'Skid Steer Loader', 'KA 04 SK 3302', '0.45 m3 bucket', 'ready', 'hour', 125000, 58, 3140, 'DEMO-SKID-332', 'Jakkur, Bengaluru', 13.0781, 77.6067, '/assets/skid-steer.jpg', '["Compact footprint", "Attachment-ready hydraulics"]', true)
ON CONFLICT (id) DO UPDATE SET
  owner_id = excluded.owner_id,
  status = excluded.status,
  fuel_percent = excluded.fuel_percent,
  current_address = excluded.current_address,
  current_lat = excluded.current_lat,
  current_lng = excluded.current_lng,
  is_verified = excluded.is_verified,
  updated_at = now();

INSERT INTO bookings (id, public_code, customer_id, owner_id, equipment_id, status, service_type, billing_unit, quantity, unit_rate_paise, requested_date, shift_label, start_time, job_address, job_lat, job_lng, route_km, instructions, base_cost_paise, platform_fee_paise, total_cost_paise, owner_earnings_paise, wallet_hold_paise, penalty_amount_paise, cancellation_locked, accepted_at, completed_at, cancelled_at, created_at)
VALUES
  ('50000000-0000-4000-8000-000000000001', 'RLX-260901', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001', 'in_progress', 'Agricultural borewell drilling', 'foot', 1200, 9500, '2026-09-28 07:00+05:30', 'Day shift', '07:00', 'East Valley Mango Orchard, Hoskote', 13.0712, 77.7984, null, 'Drill beside plot marker B-12.', 11400000, 399000, 11799000, 11400000, 1179900, 590000, true, '2026-09-24 12:00+05:30', null, null, '2026-09-24 09:15+05:30'),
  ('50000000-0000-4000-8000-000000000002', 'RLX-260902', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000002', 'mobilizing', 'Foundation excavation', 'hour', 16, 285000, '2026-09-29 07:30+05:30', 'Day shift', '07:30', 'Ridgeview Villas, Whitefield east gate', 12.9820, 77.7350, null, 'Enter through east gate.', 4560000, 159600, 4719600, 4560000, 472000, 236000, true, '2026-09-25 14:00+05:30', null, null, '2026-09-25 11:30+05:30'),
  ('50000000-0000-4000-8000-000000000003', 'RLX-260903', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000003', 'confirmed', 'Aggregate hauling', 'km', 84, 20000, '2026-09-30 08:00+05:30', 'Day shift', '08:00', 'Hosur Road batching plant to Chandapura yard', 12.8260, 77.6810, 42, 'Two trips per vehicle.', 1680000, 58800, 1738800, 1680000, 250000, 150000, true, '2026-09-25 17:00+05:30', null, null, '2026-09-25 15:10+05:30'),
  ('50000000-0000-4000-8000-000000000004', 'RLX-260904', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000004', 'pending', 'Deep ploughing', 'hour', 8, 120000, '2026-10-02 06:00+05:30', 'Morning', '06:00', 'Survey 84, Nandagudi Road, Hoskote', 13.1010, 77.8830, null, 'Bring seven-foot rotavator attachment.', 960000, 33600, 993600, 960000, 250000, 150000, false, null, null, null, '2026-09-26 08:20+05:30'),
  ('50000000-0000-4000-8000-000000000005', 'RLX-260905', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000005', 'completed', 'Road base grading', 'hour', 12, 235000, '2026-09-20 07:00+05:30', 'Day shift', '07:00', 'Industrial service road, Nelamangala', 13.0980, 77.3950, null, 'Final level tolerance plus or minus 15 mm.', 2820000, 98700, 2918700, 2820000, 291900, 150000, true, '2026-09-18 12:00+05:30', '2026-09-20 19:00+05:30', null, '2026-09-18 10:00+05:30'),
  ('50000000-0000-4000-8000-000000000006', 'RLX-260906', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000006', 'cancelled', 'Utility trenching', 'hour', 6, 145000, '2026-09-22 08:00+05:30', 'Day shift', '08:00', 'Yelahanka New Town utility corridor', 13.1005, 77.5940, null, 'Cancelled after owner confirmation due to permit delay.', 870000, 30500, 900500, 870000, 250000, 150000, true, '2026-09-21 16:00+05:30', null, '2026-09-21 18:00+05:30', '2026-09-21 14:45+05:30')
ON CONFLICT (id) DO UPDATE SET
  status = excluded.status,
  requested_date = excluded.requested_date,
  instructions = excluded.instructions,
  updated_at = now();
