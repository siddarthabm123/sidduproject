INSERT INTO borewell_terrain_rates (terrain_name, rig_method, rate_paise_per_foot)
VALUES
  ('Hard Granite / Blue Basalt', 'DTH Rig', 9500),
  ('Sandy Alluvium', 'Rotary Mud Rig', 11000),
  ('Soft Soil / Red Earth', 'Rotary Rig', 8500)
ON CONFLICT DO NOTHING;

INSERT INTO borewell_casing_options (name, detail, rate_paise_per_foot)
VALUES
  ('6.5" Heavy Duty PVC', '10 kg/cm2', 36000),
  ('7" M.S. Steel Heavy Casing', 'High-load casing', 62000),
  ('Slotted PVC Sand Screen', 'Aquifer filtration', 42000)
ON CONFLICT DO NOTHING;
