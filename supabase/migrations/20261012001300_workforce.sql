BEGIN;
CREATE TYPE worker_role AS ENUM ('LABOUR','HEAVY_DRIVER','DRILLER','RIG_OPERATOR','MECHANIC','HELPER','OTHER');
CREATE TYPE wage_type AS ENUM ('DAILY_WAGE','MONTHLY_SALARY');
CREATE TYPE hire_status AS ENUM ('PENDING','ACTIVE','COMPLETED','CANCELLED');
CREATE TYPE worker_employer_type AS ENUM ('CUSTOMER','OWNER');
CREATE TABLE worker_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES users(id),
  full_name text NOT NULL CHECK(length(trim(full_name)) BETWEEN 2 AND 120),
  phone_number text NOT NULL CHECK(phone_number ~ '^\+?[0-9]{10,15}$'),
  worker_role worker_role NOT NULL,experience_years numeric(5,2) NOT NULL CHECK(experience_years BETWEEN 0 AND 60),
  address text NOT NULL CHECK(length(trim(address)) BETWEEN 5 AND 500),
  public_area text NOT NULL CHECK(length(trim(public_area)) BETWEEN 2 AND 120),
  latitude double precision NOT NULL CHECK(latitude BETWEEN -90 AND 90),longitude double precision NOT NULL CHECK(longitude BETWEEN -180 AND 180),
  type_of_work text[] NOT NULL CHECK(cardinality(type_of_work) BETWEEN 1 AND 20),
  wage_rate numeric(12,2) NOT NULL CHECK(wage_rate BETWEEN 1 AND 1000000),wage_type wage_type NOT NULL,
  is_verified boolean NOT NULL DEFAULT false,driving_license_url text,govt_id_url text NOT NULL,
  verified_by uuid REFERENCES users(id),verified_at timestamptz,
  license_class text CHECK(length(license_class)<=100),
  skills text[] NOT NULL DEFAULT '{}' CHECK(cardinality(skills)<=20),availability_status boolean NOT NULL DEFAULT true,
  accepting_requests boolean NOT NULL DEFAULT true,request_id uuid NOT NULL,request_payload jsonb NOT NULL,
  consent_acknowledged_at timestamptz NOT NULL DEFAULT now(),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,request_id),
  CHECK(worker_role<>'HEAVY_DRIVER' OR (driving_license_url IS NOT NULL AND license_class IS NOT NULL AND length(trim(license_class))>0))
);
CREATE INDEX worker_profiles_search ON worker_profiles(worker_role,wage_type) WHERE availability_status;
CREATE TABLE worker_hires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),worker_id uuid NOT NULL REFERENCES worker_profiles(id),employer_id uuid NOT NULL REFERENCES users(id),
  employer_type worker_employer_type NOT NULL,start_date timestamptz NOT NULL,end_date timestamptz NOT NULL,
  agreed_wage numeric(12,2) NOT NULL CHECK(agreed_wage BETWEEN 1 AND 1000000),wage_type wage_type NOT NULL,status hire_status NOT NULL DEFAULT 'PENDING',
  site_location text NOT NULL CHECK(length(trim(site_location)) BETWEEN 5 AND 500),machine_description text CHECK(length(machine_description)<=200),
  request_id uuid NOT NULL,request_expires_at timestamptz NOT NULL DEFAULT now()+interval '24 hours',
  created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employer_id,request_id),CHECK(end_date>start_date AND end_date<=start_date+interval '366 days')
);
CREATE INDEX worker_hires_period ON worker_hires(worker_id,start_date,end_date,status);
ALTER TABLE worker_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_hires ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON worker_profiles,worker_hires FROM anon,authenticated;

CREATE FUNCTION app_private.worker_actor() RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid:=auth.uid();
BEGIN
 IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM users WHERE id=actor) THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='28000'; END IF;
 RETURN actor;
END $$;
CREATE FUNCTION app_private.worker_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM users WHERE id=auth.uid() AND role='admin'); $$;
REVOKE ALL ON FUNCTION app_private.worker_actor(),app_private.worker_admin() FROM PUBLIC;
GRANT USAGE ON SCHEMA app_private TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.worker_admin() TO authenticated;

-- Private object references only; no public government-ID or license URLs.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('worker-documents','worker-documents',false,5242880,ARRAY['application/pdf','image/jpeg','image/png'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
CREATE POLICY worker_upload_own_document ON storage.objects FOR INSERT TO authenticated
WITH CHECK(bucket_id='worker-documents' AND split_part(name,'/',1)=auth.uid()::text);
CREATE POLICY worker_read_own_document ON storage.objects FOR SELECT TO authenticated
USING(bucket_id='worker-documents' AND (split_part(name,'/',1)=auth.uid()::text OR app_private.worker_admin()));

CREATE FUNCTION save_worker_profile(p_data jsonb,p_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid:=app_private.worker_actor(); row worker_profiles; govt text:=p_data->>'govt_id_url'; license text:=p_data->>'driving_license_url';
BEGIN
 IF coalesce((p_data->>'consent')::boolean,false) IS NOT TRUE THEN RAISE EXCEPTION 'Worker consent is required' USING ERRCODE='22023'; END IF;
 IF p_data->>'request_id' IS NULL THEN RAISE EXCEPTION 'Profile request ID required' USING ERRCODE='22023'; END IF;
 IF (p_data->>'wage_rate')::numeric<>round((p_data->>'wage_rate')::numeric,2) THEN RAISE EXCEPTION 'Invalid workforce request' USING ERRCODE='22023'; END IF;
 PERFORM 1 FROM users WHERE id=actor FOR UPDATE;
 IF p_id IS NULL THEN
   SELECT * INTO row FROM worker_profiles WHERE user_id=actor AND request_id=(p_data->>'request_id')::uuid;
   IF FOUND THEN
     IF row.request_payload<>p_data THEN RAISE EXCEPTION 'Request ID belongs to different profile details' USING ERRCODE='22023'; END IF;
     RETURN to_jsonb(row)-'request_payload';
   END IF;
 END IF;
 IF p_id IS NOT NULL THEN
   SELECT * INTO row FROM worker_profiles WHERE id=p_id FOR UPDATE;
   IF row.id IS NULL OR row.user_id<>actor THEN RAISE EXCEPTION 'Only the profile manager can edit this worker' USING ERRCODE='42501'; END IF;
 END IF;
 IF govt IS NULL OR split_part(govt,'/',1)<>actor::text OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='worker-documents' AND name=govt) OR
   (license IS NOT NULL AND (split_part(license,'/',1)<>actor::text OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='worker-documents' AND name=license))) THEN
   RAISE EXCEPTION 'Upload identity documents to your private document folder' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(ARRAY(SELECT jsonb_array_elements_text(p_data->'type_of_work'))||ARRAY(SELECT jsonb_array_elements_text(p_data->'skills'))) x WHERE length(trim(x)) NOT BETWEEN 1 AND 100) THEN
   RAISE EXCEPTION 'Invalid work or skill entries' USING ERRCODE='22023'; END IF;
 IF p_id IS NULL THEN
   INSERT INTO worker_profiles(user_id,full_name,phone_number,worker_role,experience_years,address,public_area,latitude,longitude,type_of_work,wage_rate,wage_type,govt_id_url,driving_license_url,license_class,skills,availability_status,accepting_requests,request_id,request_payload)
   VALUES(actor,trim(p_data->>'full_name'),p_data->>'phone_number',(p_data->>'worker_role')::worker_role,(p_data->>'experience_years')::numeric,
     trim(p_data->>'address'),trim(p_data->>'public_area'),(p_data->>'latitude')::double precision,(p_data->>'longitude')::double precision,
     ARRAY(SELECT jsonb_array_elements_text(p_data->'type_of_work')),(p_data->>'wage_rate')::numeric,(p_data->>'wage_type')::wage_type,govt,license,p_data->>'license_class',
     ARRAY(SELECT jsonb_array_elements_text(p_data->'skills')),coalesce((p_data->>'availability_status')::boolean,true),coalesce((p_data->>'availability_status')::boolean,true),(p_data->>'request_id')::uuid,p_data) RETURNING * INTO row;
 ELSE
   UPDATE worker_profiles SET full_name=trim(p_data->>'full_name'),phone_number=p_data->>'phone_number',worker_role=(p_data->>'worker_role')::worker_role,
     experience_years=(p_data->>'experience_years')::numeric,address=trim(p_data->>'address'),public_area=trim(p_data->>'public_area'),
     latitude=(p_data->>'latitude')::double precision,longitude=(p_data->>'longitude')::double precision,type_of_work=ARRAY(SELECT jsonb_array_elements_text(p_data->'type_of_work')),
     wage_rate=(p_data->>'wage_rate')::numeric,wage_type=(p_data->>'wage_type')::wage_type,govt_id_url=govt,driving_license_url=license,license_class=p_data->>'license_class',
     skills=ARRAY(SELECT jsonb_array_elements_text(p_data->'skills')),accepting_requests=coalesce((p_data->>'availability_status')::boolean,true),
     availability_status=coalesce((p_data->>'availability_status')::boolean,true) AND NOT EXISTS(SELECT 1 FROM worker_hires WHERE worker_id=p_id AND (status='ACTIVE' AND end_date>now() OR status='PENDING' AND request_expires_at>now())),is_verified=false,verified_by=NULL,verified_at=NULL,updated_at=now()
   WHERE id=p_id RETURNING * INTO row;
 END IF;
 RETURN to_jsonb(row)-'request_payload';
END $$;

CREATE FUNCTION search_workers(p_lat double precision,p_lng double precision,p_radius integer DEFAULT 25,p_role text DEFAULT '',p_wage text DEFAULT '',p_verified text DEFAULT '',p_query text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM app_private.worker_actor();
 IF p_lat IS NULL OR p_lng IS NULL OR p_lat NOT BETWEEN -90 AND 90 OR p_lng NOT BETWEEN -180 AND 180 OR p_radius NOT IN(5,10,25,50) OR p_radius IS NULL OR
    p_role IS NULL OR p_wage IS NULL OR p_verified IS NULL OR p_query IS NULL OR length(p_query)>100 OR p_verified NOT IN('','true','false') OR
    (p_role<>'' AND p_role NOT IN('LABOUR','HEAVY_DRIVER','DRILLER','RIG_OPERATOR','MECHANIC','HELPER','OTHER')) OR (p_wage<>'' AND p_wage NOT IN('DAILY_WAGE','MONTHLY_SALARY')) THEN
   RAISE EXCEPTION 'Invalid workforce filters' USING ERRCODE='22023'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY distance_km,id),'[]') FROM (
   SELECT * FROM (
     SELECT w.id,w.full_name,w.worker_role,w.experience_years,w.public_area,w.type_of_work,w.wage_rate,w.wage_type,w.is_verified,w.skills,w.created_at,
       w.user_id=auth.uid() AS is_managed,
       6371*2*asin(sqrt(least(1.0,greatest(0.0,power(sin(radians(w.latitude-p_lat)/2),2)+cos(radians(p_lat))*cos(radians(w.latitude))*power(sin(radians(w.longitude-p_lng)/2),2))))) AS distance_km
     FROM worker_profiles w WHERE accepting_requests AND (p_role='' OR w.worker_role::text=p_role) AND (p_wage='' OR w.wage_type::text=p_wage) AND
       (p_verified='' OR w.is_verified=(p_verified='true')) AND (p_query='' OR strpos(lower(w.full_name||' '||array_to_string(w.skills,' ')||' '||array_to_string(w.type_of_work,' ')),lower(p_query))>0)
       AND NOT EXISTS(SELECT 1 FROM worker_hires h WHERE h.worker_id=w.id AND (h.status='ACTIVE' AND h.end_date>now() OR h.status='PENDING' AND h.request_expires_at>now()))
   ) workers WHERE distance_km<=p_radius ORDER BY distance_km,id LIMIT 100
 ) x);
END $$;

CREATE FUNCTION hire_worker(p_worker uuid,p_start timestamptz,p_end timestamptz,p_wage numeric,p_wage_type wage_type,p_site text,p_machine text,p_request uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid:=app_private.worker_actor(); row worker_hires; worker worker_profiles; employer users;
BEGIN
 SELECT * INTO employer FROM users WHERE id=actor FOR UPDATE;
 IF employer.role NOT IN('customer','owner') THEN RAISE EXCEPTION 'Customer or owner account required' USING ERRCODE='42501'; END IF;
 IF p_request IS NULL OR p_worker IS NULL OR p_start IS NULL OR p_end IS NULL OR p_start<now()-interval '24 hours' OR p_start>now()+interval '2 years' OR
    p_end<=p_start OR p_end>p_start+interval '366 days' OR p_wage IS NULL OR p_wage NOT BETWEEN 1 AND 1000000 OR p_wage<>round(p_wage,2) OR p_wage_type IS NULL OR
    length(trim(coalesce(p_site,''))) NOT BETWEEN 5 AND 500 OR length(coalesce(p_machine,''))>200 THEN RAISE EXCEPTION 'Invalid hiring agreement' USING ERRCODE='22023'; END IF;
 SELECT * INTO row FROM worker_hires WHERE employer_id=actor AND request_id=p_request;
 IF FOUND THEN
   IF row.worker_id<>p_worker OR row.start_date<>p_start OR row.end_date<>p_end OR row.agreed_wage<>p_wage OR row.wage_type<>p_wage_type OR row.site_location<>p_site OR coalesce(row.machine_description,'')<>coalesce(p_machine,'') THEN
     RAISE EXCEPTION 'Request ID belongs to different hire details' USING ERRCODE='22023'; END IF;
   RETURN to_jsonb(row);
 END IF;
 SELECT * INTO worker FROM worker_profiles WHERE id=p_worker FOR UPDATE;
 IF worker.id IS NULL OR NOT worker.accepting_requests OR worker.user_id=actor THEN RAISE EXCEPTION 'Worker is unavailable or belongs to your own account' USING ERRCODE='22023'; END IF;
 -- A pending request temporarily reserves the worker. Expired requests do not block a new one.
 UPDATE worker_hires SET status='CANCELLED',updated_at=now() WHERE worker_id=p_worker AND status='PENDING' AND request_expires_at<=now();
 IF EXISTS(SELECT 1 FROM worker_hires WHERE worker_id=p_worker AND (status='PENDING' AND request_expires_at>now() OR status='ACTIVE' AND start_date<p_end AND end_date>p_start)) THEN
   RAISE EXCEPTION 'Worker is already reserved for this period' USING ERRCODE='22023'; END IF;
 INSERT INTO worker_hires(worker_id,employer_id,employer_type,start_date,end_date,agreed_wage,wage_type,site_location,machine_description,request_id)
 VALUES(p_worker,actor,upper(employer.role::text)::worker_employer_type,p_start,p_end,p_wage,p_wage_type,p_site,p_machine,p_request) RETURNING * INTO row;
 UPDATE worker_profiles SET availability_status=false WHERE id=p_worker;
 RETURN to_jsonb(row);
END $$;

CREATE FUNCTION my_workforce_records() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid:=app_private.worker_actor();
BEGIN
 RETURN jsonb_build_object('profiles',(SELECT coalesce(jsonb_agg((to_jsonb(w)-'request_payload')||jsonb_build_object('availability_status',w.accepting_requests AND NOT EXISTS(SELECT 1 FROM worker_hires WHERE worker_id=w.id AND (status='ACTIVE' AND end_date>now() OR status='PENDING' AND request_expires_at>now()))) ORDER BY created_at DESC),'[]') FROM worker_profiles w WHERE user_id=actor),
   'hires',(SELECT coalesce(jsonb_agg(to_jsonb(h)||jsonb_build_object('worker_name',w.full_name,'is_manager',w.user_id=actor,
     'status',CASE WHEN h.status='PENDING' AND h.request_expires_at<=now() THEN 'CANCELLED' ELSE h.status::text END,
     'phone_number',CASE WHEN h.status='ACTIVE' OR w.user_id=actor THEN w.phone_number END) ORDER BY h.created_at DESC),'[]')
     FROM worker_hires h JOIN worker_profiles w ON w.id=h.worker_id WHERE h.employer_id=actor OR w.user_id=actor));
END $$;

CREATE FUNCTION respond_worker_hire(p_id uuid,p_action text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid:=app_private.worker_actor(); row worker_hires; worker worker_profiles; worker_id uuid;
BEGIN
 SELECT h.worker_id INTO worker_id FROM worker_hires h WHERE id=p_id;
 SELECT * INTO worker FROM worker_profiles WHERE id=worker_id FOR UPDATE;
 SELECT * INTO row FROM worker_hires WHERE id=p_id FOR UPDATE;
 IF row.id IS NULL OR actor NOT IN(row.employer_id,worker.user_id) THEN RAISE EXCEPTION 'Hiring party required' USING ERRCODE='42501'; END IF;
 IF p_action='accept' THEN
   IF actor<>worker.user_id OR row.status<>'PENDING' OR row.request_expires_at<=now() OR row.end_date<=now() OR NOT worker.accepting_requests THEN RAISE EXCEPTION 'Only the worker manager can accept an active request' USING ERRCODE='22023'; END IF;
   IF EXISTS(SELECT 1 FROM worker_hires WHERE worker_hires.worker_id=worker.id AND id<>row.id AND status='ACTIVE' AND start_date<row.end_date AND end_date>row.start_date) THEN
     RAISE EXCEPTION 'Worker is already reserved for this period' USING ERRCODE='22023'; END IF;
   UPDATE worker_hires SET status='ACTIVE',updated_at=now() WHERE id=row.id RETURNING * INTO row;
 ELSIF p_action='cancel' THEN
   IF row.status NOT IN('PENDING','ACTIVE') THEN RAISE EXCEPTION 'Hire is no longer active' USING ERRCODE='22023'; END IF;
   UPDATE worker_hires SET status='CANCELLED',updated_at=now() WHERE id=row.id RETURNING * INTO row;
 ELSIF p_action='complete' THEN
   IF actor<>row.employer_id OR row.status<>'ACTIVE' OR row.end_date>now() THEN RAISE EXCEPTION 'Employer can complete a hire after its end date' USING ERRCODE='22023'; END IF;
   UPDATE worker_hires SET status='COMPLETED',updated_at=now() WHERE id=row.id RETURNING * INTO row;
 ELSE RAISE EXCEPTION 'Invalid hire action' USING ERRCODE='22023'; END IF;
 UPDATE worker_profiles SET availability_status=accepting_requests AND NOT EXISTS(SELECT 1 FROM worker_hires WHERE worker_hires.worker_id=worker.id AND (status='ACTIVE' AND end_date>now() OR status='PENDING' AND request_expires_at>now())) WHERE id=worker.id;
 RETURN to_jsonb(row);
END $$;

CREATE FUNCTION review_worker_profile(p_id uuid,p_verified boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE row worker_profiles;
BEGIN
 IF NOT app_private.worker_admin() THEN RAISE EXCEPTION 'Admin review required' USING ERRCODE='42501'; END IF;
 UPDATE worker_profiles SET is_verified=p_verified,verified_by=CASE WHEN p_verified THEN auth.uid() END,verified_at=CASE WHEN p_verified THEN now() END,updated_at=now() WHERE id=p_id RETURNING * INTO row;
 IF row.id IS NULL OR p_verified IS NULL THEN RAISE EXCEPTION 'Worker not found' USING ERRCODE='22023'; END IF;
 RETURN jsonb_build_object('id',row.id,'is_verified',row.is_verified);
END $$;
REVOKE ALL ON FUNCTION save_worker_profile(jsonb,uuid),search_workers(double precision,double precision,integer,text,text,text,text),hire_worker(uuid,timestamptz,timestamptz,numeric,wage_type,text,text,uuid),my_workforce_records(),respond_worker_hire(uuid,text),review_worker_profile(uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION save_worker_profile(jsonb,uuid),search_workers(double precision,double precision,integer,text,text,text,text),hire_worker(uuid,timestamptz,timestamptz,numeric,wage_type,text,text,uuid),my_workforce_records(),respond_worker_hire(uuid,text),review_worker_profile(uuid,boolean) TO authenticated;
COMMIT;
