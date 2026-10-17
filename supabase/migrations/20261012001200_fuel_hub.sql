BEGIN;

CREATE TYPE fuel_type AS ENUM ('DIESEL','PETROL');
CREATE TYPE fuel_voucher_status AS ENUM ('GENERATED','REDEEMED','EXPIRED');

CREATE TABLE fuel_bunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 120),
  brand text NOT NULL CHECK(length(trim(brand)) BETWEEN 2 AND 60),
  address text NOT NULL CHECK(length(trim(address)) BETWEEN 5 AND 500),
  latitude double precision NOT NULL CHECK(latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK(longitude BETWEEN -180 AND 180),
  discount_per_litre numeric(8,2) NOT NULL DEFAULT 0,
  is_partner boolean NOT NULL DEFAULT false,
  fuel_types_available text[] NOT NULL CHECK(cardinality(fuel_types_available) BETWEEN 1 AND 2 AND fuel_types_available <@ ARRAY['diesel','petrol'] AND array_position(fuel_types_available,NULL) IS NULL),
  contact_phone text NOT NULL DEFAULT '' CHECK(length(contact_phone)<=25),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK((is_partner AND discount_per_litre>0 AND discount_per_litre<=10) OR (NOT is_partner AND discount_per_litre=0))
);
CREATE INDEX fuel_bunks_coordinates ON fuel_bunks(latitude,longitude) WHERE is_active;

-- Provision these permissions only through a trusted administrator/database operator.
CREATE TABLE fuel_partner_access (
  user_id uuid PRIMARY KEY REFERENCES users(id),
  can_register boolean NOT NULL DEFAULT false,
  can_offer_discounts boolean NOT NULL DEFAULT false
);
CREATE TABLE fuel_bunk_staff (
  bunk_id uuid NOT NULL REFERENCES fuel_bunks(id),
  user_id uuid NOT NULL REFERENCES users(id),
  PRIMARY KEY(bunk_id,user_id)
);
CREATE TABLE fuel_vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id),
  bunk_id uuid NOT NULL REFERENCES fuel_bunks(id),
  equipment_id uuid REFERENCES equipment(id),
  fuel_type fuel_type NOT NULL,
  quantity_litres numeric(10,2) NOT NULL CHECK(quantity_litres BETWEEN 1 AND 2000),
  discount_rate numeric(8,2) NOT NULL CHECK(discount_rate>0 AND discount_rate<=10),
  estimated_savings numeric(12,2) NOT NULL CHECK(estimated_savings=round(quantity_litres*discount_rate,2)),
  voucher_code text NOT NULL UNIQUE CHECK(voucher_code ~ '^[A-F0-9]{8}$'),
  verification_token uuid NOT NULL DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL,
  status fuel_voucher_status NOT NULL DEFAULT 'GENERATED',
  expires_at timestamptz NOT NULL DEFAULT now()+interval '24 hours',
  created_at timestamptz NOT NULL DEFAULT now(),
  redeemed_at timestamptz,
  redeemed_by uuid REFERENCES users(id),
  actual_quantity_litres numeric(10,2),
  UNIQUE(owner_id,request_id),
  CHECK(expires_at>created_at),
  CHECK((status='REDEEMED' AND redeemed_at IS NOT NULL AND redeemed_by IS NOT NULL AND actual_quantity_litres IS NOT NULL AND actual_quantity_litres BETWEEN 1 AND quantity_litres) OR (status<>'REDEEMED' AND redeemed_at IS NULL AND redeemed_by IS NULL AND actual_quantity_litres IS NULL))
);
CREATE INDEX fuel_vouchers_owner ON fuel_vouchers(owner_id,created_at DESC);
ALTER TABLE fuel_bunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuel_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuel_partner_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuel_bunk_staff ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON fuel_bunks,fuel_vouchers,fuel_partner_access,fuel_bunk_staff FROM anon,authenticated;

CREATE FUNCTION app_private.fuel_actor() RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid:=auth.uid();
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='28000'; END IF;
  IF NOT EXISTS(SELECT 1 FROM users WHERE id=actor AND role IN('owner','admin')) AND
     NOT EXISTS(SELECT 1 FROM fuel_partner_access WHERE user_id=actor AND can_register) AND
     NOT EXISTS(SELECT 1 FROM fuel_bunk_staff WHERE user_id=actor) THEN
    RAISE EXCEPTION 'Fuel hub access is not permitted' USING ERRCODE='42501';
  END IF;
  RETURN actor;
END $$;
REVOKE ALL ON FUNCTION app_private.fuel_actor() FROM PUBLIC;

CREATE FUNCTION fuel_hub_context() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid:=app_private.fuel_actor(); admin boolean; access fuel_partner_access;
BEGIN
  SELECT role='admin' INTO admin FROM users WHERE id=actor;
  SELECT * INTO access FROM fuel_partner_access WHERE user_id=actor;
  RETURN jsonb_build_object('can_register',admin OR coalesce(access.can_register,false),
    'can_offer_discounts',admin OR coalesce(access.can_offer_discounts,false),
    'can_generate',EXISTS(SELECT 1 FROM users WHERE id=actor AND role='owner'),
    'equipment',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title)),'[]') FROM equipment WHERE owner_id=actor),
    'centers',(SELECT coalesce(jsonb_agg(x),'[]') FROM (
      SELECT 'equipment-'||id AS id,title AS label,current_lat AS latitude,current_lng AS longitude
      FROM equipment WHERE owner_id=actor AND current_lat BETWEEN -90 AND 90 AND current_lng BETWEEN -180 AND 180 AND NOT(current_lat=0 AND current_lng=0)
      UNION ALL
      SELECT 'project-'||id,public_code,job_lat,job_lng FROM bookings
      WHERE owner_id=actor AND accepted_at IS NOT NULL AND status IN('confirmed','mobilizing','on_site','in_progress')
      AND job_lat BETWEEN -90 AND 90 AND job_lng BETWEEN -180 AND 180 AND NOT(job_lat=0 AND job_lng=0)
    ) x));
END $$;

CREATE FUNCTION fuel_bunks_nearby(p_latitude double precision,p_longitude double precision,p_radius_km integer DEFAULT 10,p_fuel text DEFAULT 'diesel',p_partner_only boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM app_private.fuel_actor();
  IF p_latitude IS NULL OR p_longitude IS NULL OR NOT(p_latitude BETWEEN -90 AND 90) OR NOT(p_longitude BETWEEN -180 AND 180) OR
     p_radius_km IS NULL OR p_radius_km NOT IN(5,10,25) OR p_fuel IS NULL OR p_fuel NOT IN('diesel','petrol') OR p_partner_only IS NULL THEN
    RAISE EXCEPTION 'Invalid location or filters' USING ERRCODE='22023';
  END IF;
  -- Haversine distance avoids requiring PostGIS on existing installations.
  RETURN (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY distance_km,id),'[]') FROM (
    SELECT * FROM (
      SELECT b.id,b.name,b.brand,b.address,b.latitude,b.longitude,b.discount_per_litre,b.is_partner,b.fuel_types_available,b.contact_phone,b.created_at,
        6371*2*asin(sqrt(least(1.0,greatest(0.0,
          power(sin(radians(b.latitude-p_latitude)/2),2)+cos(radians(p_latitude))*cos(radians(b.latitude))*power(sin(radians(b.longitude-p_longitude)/2),2))))) AS distance_km
      FROM fuel_bunks b WHERE is_active AND p_fuel=ANY(fuel_types_available) AND (NOT p_partner_only OR is_partner)
    ) nearby WHERE distance_km<=p_radius_km ORDER BY distance_km,id LIMIT 100
  ) x);
END $$;

CREATE FUNCTION register_fuel_bunk(p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid:=app_private.fuel_actor(); admin boolean; access fuel_partner_access; row fuel_bunks; partner boolean:=coalesce((p_data->>'is_partner')::boolean,false);
BEGIN
  SELECT role='admin' INTO admin FROM users WHERE id=actor;
  SELECT * INTO access FROM fuel_partner_access WHERE user_id=actor;
  IF NOT(admin OR coalesce(access.can_register,false)) OR (partner AND NOT(admin OR coalesce(access.can_offer_discounts,false))) THEN
    RAISE EXCEPTION 'Partner registration permission required' USING ERRCODE='42501';
  END IF;
  INSERT INTO fuel_bunks(name,brand,address,latitude,longitude,discount_per_litre,is_partner,fuel_types_available,contact_phone,created_by)
  VALUES(trim(p_data->>'name'),trim(p_data->>'brand'),trim(p_data->>'address'),(p_data->>'latitude')::double precision,(p_data->>'longitude')::double precision,
    CASE WHEN partner THEN (p_data->>'discount_per_litre')::numeric ELSE 0 END,partner,
    ARRAY(SELECT DISTINCT jsonb_array_elements_text(p_data->'fuel_types_available')),coalesce(trim(p_data->>'contact_phone'),''),actor) RETURNING * INTO row;
  INSERT INTO fuel_bunk_staff(bunk_id,user_id) VALUES(row.id,actor);
  RETURN to_jsonb(row)-'created_by';
END $$;

CREATE FUNCTION generate_fuel_voucher(p_bunk_id uuid,p_fuel fuel_type,p_quantity numeric,p_request_id uuid,p_equipment_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid:=app_private.fuel_actor(); station fuel_bunks; row fuel_vouchers; attempts integer:=0;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM users WHERE id=actor AND role='owner') THEN RAISE EXCEPTION 'Owner account required' USING ERRCODE='42501'; END IF;
  IF p_bunk_id IS NULL OR p_request_id IS NULL OR p_quantity IS NULL OR p_quantity NOT BETWEEN 1 AND 2000 OR p_quantity<>round(p_quantity,2) OR p_fuel IS NULL THEN
    RAISE EXCEPTION 'Invalid voucher quantity or request' USING ERRCODE='22023'; END IF;
  -- Serialize requests per owner; retries cannot create duplicate discounts.
  PERFORM 1 FROM users WHERE id=actor FOR UPDATE;
  SELECT * INTO row FROM fuel_vouchers WHERE owner_id=actor AND request_id=p_request_id;
  IF FOUND THEN
    IF row.bunk_id<>p_bunk_id OR row.fuel_type<>p_fuel OR row.quantity_litres<>p_quantity OR row.equipment_id IS DISTINCT FROM p_equipment_id THEN
      RAISE EXCEPTION 'Request ID belongs to different voucher details' USING ERRCODE='22023'; END IF;
    RETURN to_jsonb(row);
  END IF;
  SELECT * INTO station FROM fuel_bunks WHERE id=p_bunk_id FOR SHARE;
  IF station.id IS NULL OR NOT station.is_active OR NOT station.is_partner OR NOT(lower(p_fuel::text)=ANY(station.fuel_types_available)) THEN
    RAISE EXCEPTION 'Partner discount is unavailable for this fuel' USING ERRCODE='22023'; END IF;
  IF p_equipment_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM equipment WHERE id=p_equipment_id AND owner_id=actor) THEN
    RAISE EXCEPTION 'Choose equipment from your own fleet' USING ERRCODE='42501'; END IF;
  IF (SELECT count(*) FROM fuel_vouchers WHERE owner_id=actor AND status='GENERATED' AND expires_at>now())>=10 THEN
    RAISE EXCEPTION 'Active voucher limit reached' USING ERRCODE='22023'; END IF;
  LOOP
    BEGIN
      INSERT INTO fuel_vouchers(owner_id,bunk_id,equipment_id,fuel_type,quantity_litres,discount_rate,estimated_savings,voucher_code,request_id)
      VALUES(actor,p_bunk_id,p_equipment_id,p_fuel,p_quantity,station.discount_per_litre,round(p_quantity*station.discount_per_litre,2),upper(encode(gen_random_bytes(4),'hex')),p_request_id)
      RETURNING * INTO row;
      RETURN to_jsonb(row);
    EXCEPTION WHEN unique_violation THEN
      attempts:=attempts+1; IF attempts>=10 THEN RAISE; END IF;
    END;
  END LOOP;
END $$;

CREATE FUNCTION my_fuel_vouchers() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid:=app_private.fuel_actor();
BEGIN
  UPDATE fuel_vouchers SET status='EXPIRED' WHERE owner_id=actor AND status='GENERATED' AND expires_at<=now();
  RETURN (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY created_at DESC),'[]') FROM (
    SELECT v.*,b.name AS bunk_name,b.address AS bunk_address FROM fuel_vouchers v JOIN fuel_bunks b ON b.id=v.bunk_id WHERE owner_id=actor ORDER BY v.created_at DESC LIMIT 100
  ) x);
END $$;

CREATE FUNCTION verify_fuel_voucher(p_id uuid,p_token uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT jsonb_build_object('id',v.id,'bunk_id',v.bunk_id,'bunk_name',b.name,'bunk_address',b.address,'fuel_type',v.fuel_type,'quantity_litres',v.quantity_litres,
    'discount_rate',v.discount_rate,'estimated_savings',v.estimated_savings,'voucher_code',v.voucher_code,'expires_at',v.expires_at,
    'status',CASE WHEN v.status='GENERATED' AND v.expires_at<=now() THEN 'EXPIRED' ELSE v.status::text END)
  FROM fuel_vouchers v JOIN fuel_bunks b ON b.id=v.bunk_id WHERE v.id=p_id AND v.verification_token=p_token;
$$;

CREATE FUNCTION redeem_fuel_voucher(p_id uuid,p_token uuid,p_quantity numeric) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid:=app_private.fuel_actor(); row fuel_vouchers;
BEGIN
  SELECT * INTO row FROM fuel_vouchers WHERE id=p_id AND verification_token=p_token FOR UPDATE;
  IF row.id IS NULL THEN RAISE EXCEPTION 'Voucher not found' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS(SELECT 1 FROM users WHERE id=actor AND role='admin') AND NOT EXISTS(SELECT 1 FROM fuel_bunk_staff WHERE bunk_id=row.bunk_id AND user_id=actor) THEN
    RAISE EXCEPTION 'Assigned pump staff required' USING ERRCODE='42501'; END IF;
  IF row.status<>'GENERATED' THEN RAISE EXCEPTION 'Voucher is no longer active' USING ERRCODE='22023'; END IF;
  IF row.expires_at<=now() THEN
    UPDATE fuel_vouchers SET status='EXPIRED' WHERE id=row.id;
    RETURN jsonb_build_object('error','Voucher has expired','status','EXPIRED');
  END IF;
  IF p_quantity IS NULL OR p_quantity NOT BETWEEN 1 AND row.quantity_litres OR p_quantity<>round(p_quantity,2) THEN
    RAISE EXCEPTION 'Invalid redeemed quantity' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS(SELECT 1 FROM fuel_bunks WHERE id=row.bunk_id AND is_active AND is_partner) THEN
    RAISE EXCEPTION 'Partner discount is unavailable for this fuel' USING ERRCODE='22023'; END IF;
  UPDATE fuel_vouchers SET status='REDEEMED',redeemed_at=now(),redeemed_by=actor,actual_quantity_litres=p_quantity WHERE id=row.id;
  RETURN jsonb_build_object('status','REDEEMED','id',row.id,'actual_quantity_litres',p_quantity,'actual_savings',round(p_quantity*row.discount_rate,2));
END $$;

REVOKE ALL ON FUNCTION fuel_hub_context(),fuel_bunks_nearby(double precision,double precision,integer,text,boolean),register_fuel_bunk(jsonb),generate_fuel_voucher(uuid,fuel_type,numeric,uuid,uuid),my_fuel_vouchers(),verify_fuel_voucher(uuid,uuid),redeem_fuel_voucher(uuid,uuid,numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fuel_hub_context(),fuel_bunks_nearby(double precision,double precision,integer,text,boolean),register_fuel_bunk(jsonb),generate_fuel_voucher(uuid,fuel_type,numeric,uuid,uuid),my_fuel_vouchers(),redeem_fuel_voucher(uuid,uuid,numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION verify_fuel_voucher(uuid,uuid) TO anon,authenticated;
COMMIT;
