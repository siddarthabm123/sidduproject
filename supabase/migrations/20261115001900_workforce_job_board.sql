BEGIN;
CREATE TABLE workforce_posts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),author_id uuid NOT NULL REFERENCES users(id),author_role text NOT NULL CHECK(author_role IN('customer','owner')),
 title text NOT NULL CHECK(length(trim(title)) BETWEEN 5 AND 140),worker_role worker_role NOT NULL,headcount integer NOT NULL CHECK(headcount BETWEEN 1 AND 100),
 filled_count integer NOT NULL DEFAULT 0 CHECK(filled_count BETWEEN 0 AND headcount),wage_rate numeric(12,2) NOT NULL CHECK(wage_rate BETWEEN 1 AND 1000000),wage_type wage_type NOT NULL,
 start_date date NOT NULL,end_date date NOT NULL CHECK(end_date>=start_date AND end_date<=start_date+365),
 site_location text NOT NULL CHECK(length(trim(site_location)) BETWEEN 5 AND 500),site_latitude double precision NOT NULL CHECK(site_latitude BETWEEN -90 AND 90),site_longitude double precision NOT NULL CHECK(site_longitude BETWEEN -180 AND 180),
 description text NOT NULL CHECK(length(trim(description)) BETWEEN 10 AND 2000),status text NOT NULL DEFAULT 'OPEN' CHECK(status IN('OPEN','FILLED','CLOSED')),
 request_id uuid NOT NULL,request_payload jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(author_id,request_id)
);
CREATE TABLE workforce_applications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),post_id uuid NOT NULL REFERENCES workforce_posts(id),applicant_id uuid NOT NULL REFERENCES users(id),
 worker_ids uuid[] NOT NULL CHECK(cardinality(worker_ids) BETWEEN 1 AND 100),worker_names text[] NOT NULL,
 offered_wage numeric(12,2) NOT NULL CHECK(offered_wage BETWEEN 1 AND 1000000),note text NOT NULL DEFAULT '' CHECK(length(note)<=500),
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN('PENDING','ACCEPTED','DECLINED','WITHDRAWN')),
 request_id uuid NOT NULL,request_payload jsonb NOT NULL,hire_ids uuid[] NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(post_id,applicant_id),UNIQUE(applicant_id,request_id)
);
CREATE INDEX workforce_posts_open ON workforce_posts(author_role,status,end_date);
CREATE INDEX workforce_applications_inbox ON workforce_applications(post_id,status);
ALTER TABLE workforce_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workforce_applications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON workforce_posts,workforce_applications FROM PUBLIC,anon,authenticated;

CREATE FUNCTION workforce_board() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid:=app_private.worker_actor();
BEGIN
 RETURN jsonb_build_object('actor_id',actor,'posts',coalesce((SELECT jsonb_agg(to_jsonb(p)-'request_payload'-'request_id'||jsonb_build_object('author_name',u.full_name) ORDER BY p.created_at DESC) FROM workforce_posts p JOIN users u ON u.id=p.author_id WHERE p.author_id=actor OR p.status='OPEN' AND p.end_date>=current_date OR EXISTS(SELECT 1 FROM workforce_applications a WHERE a.post_id=p.id AND a.applicant_id=actor)),'[]'::jsonb),
 'applications',coalesce((SELECT jsonb_agg(to_jsonb(a)-'request_payload'||jsonb_build_object('applicant_name',u.full_name) ORDER BY a.created_at DESC) FROM workforce_applications a JOIN workforce_posts p ON p.id=a.post_id JOIN users u ON u.id=a.applicant_id WHERE p.author_id=actor OR a.applicant_id=actor),'[]'::jsonb));
END $$;

CREATE FUNCTION post_workforce_job(p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid:=app_private.worker_actor(); actor_role text; row workforce_posts;
BEGIN
 SELECT role::text INTO actor_role FROM users WHERE id=actor FOR UPDATE;
 IF actor_role NOT IN('owner','customer') THEN RAISE EXCEPTION 'A customer or owner account is required' USING ERRCODE='42501'; END IF;
 SELECT * INTO row FROM workforce_posts WHERE author_id=actor AND request_id=(p_data->>'request_id')::uuid;
 IF FOUND THEN
  IF row.request_payload<>p_data THEN RAISE EXCEPTION 'Request ID belongs to different job details' USING ERRCODE='22023'; END IF; RETURN to_jsonb(row)-'request_payload';
 END IF;
 IF (p_data->>'start_date')::date<(now() AT TIME ZONE 'Asia/Kolkata')::date OR (p_data->>'wage_rate')::numeric<>round((p_data->>'wage_rate')::numeric,2) THEN RAISE EXCEPTION 'Check job dates and wage' USING ERRCODE='22023'; END IF;
 INSERT INTO workforce_posts(author_id,author_role,title,worker_role,headcount,wage_rate,wage_type,start_date,end_date,site_location,site_latitude,site_longitude,description,request_id,request_payload)
 VALUES(actor,actor_role,p_data->>'title',(p_data->>'worker_role')::worker_role,(p_data->>'headcount')::integer,(p_data->>'wage_rate')::numeric,(p_data->>'wage_type')::wage_type,(p_data->>'start_date')::date,(p_data->>'end_date')::date,p_data->>'site_location',(p_data->>'site_latitude')::double precision,(p_data->>'site_longitude')::double precision,p_data->>'description',(p_data->>'request_id')::uuid,p_data) RETURNING * INTO row;
 RETURN to_jsonb(row)-'request_payload';
END $$;

CREATE FUNCTION apply_workforce_job(p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid:=app_private.worker_actor(); actor_role text; post workforce_posts; row workforce_applications; ids uuid[]; names text[]:='{}'; worker worker_profiles; target uuid;
BEGIN
 SELECT role::text INTO actor_role FROM users WHERE id=actor FOR UPDATE;
 SELECT * INTO row FROM workforce_applications WHERE applicant_id=actor AND request_id=(p_data->>'request_id')::uuid;
 IF FOUND THEN IF row.request_payload<>p_data THEN RAISE EXCEPTION 'Request ID belongs to different application details' USING ERRCODE='22023'; END IF; RETURN to_jsonb(row)-'request_payload'; END IF;
 SELECT * INTO post FROM workforce_posts WHERE id=(p_data->>'post_id')::uuid FOR UPDATE;
 IF post.id IS NULL OR actor_role NOT IN('customer','owner') OR post.author_role=actor_role OR post.author_id=actor THEN RAISE EXCEPTION 'Apply to a job posted by the other account role' USING ERRCODE='42501'; END IF;
 IF post.status<>'OPEN' OR post.end_date<(now() AT TIME ZONE 'Asia/Kolkata')::date THEN RAISE EXCEPTION 'Job is no longer open' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM workforce_applications WHERE post_id=post.id AND applicant_id=actor) THEN RAISE EXCEPTION 'An application already exists for this job' USING ERRCODE='22023'; END IF;
 SELECT array_agg(value::uuid ORDER BY value::uuid) INTO ids FROM jsonb_array_elements_text(p_data->'worker_ids');
 IF coalesce(cardinality(ids),0) NOT BETWEEN 1 AND post.headcount-post.filled_count OR cardinality(ids)<>(SELECT count(DISTINCT x) FROM unnest(ids) x) THEN RAISE EXCEPTION 'Choose distinct workers within the remaining headcount' USING ERRCODE='22023'; END IF;
 IF (p_data->>'offered_wage')::numeric NOT BETWEEN 1 AND 1000000 OR (p_data->>'offered_wage')::numeric<>round((p_data->>'offered_wage')::numeric,2) THEN RAISE EXCEPTION 'Invalid application wage' USING ERRCODE='22023'; END IF;
 FOREACH target IN ARRAY ids LOOP
  SELECT * INTO worker FROM worker_profiles WHERE id=target FOR UPDATE;
  IF worker.id IS NULL OR worker.user_id<>actor THEN RAISE EXCEPTION 'Choose your own managed worker profiles' USING ERRCODE='42501'; END IF;
  IF NOT worker.is_verified OR NOT worker.accepting_requests OR worker.worker_role<>post.worker_role OR worker.wage_type<>post.wage_type OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='worker-documents' AND name=worker.govt_id_url) OR (worker.worker_role='HEAVY_DRIVER' AND (coalesce(trim(worker.license_class),'')='' OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='worker-documents' AND name=worker.driving_license_url))) THEN RAISE EXCEPTION 'Each worker needs reviewed identity documents, a matching role and wage type, and a commercial license for heavy driving' USING ERRCODE='22023'; END IF;
  names:=array_append(names,worker.full_name);
 END LOOP;
 INSERT INTO workforce_applications(post_id,applicant_id,worker_ids,worker_names,offered_wage,note,request_id,request_payload) VALUES(post.id,actor,ids,names,(p_data->>'offered_wage')::numeric,coalesce(p_data->>'note',''),(p_data->>'request_id')::uuid,p_data) RETURNING * INTO row;
 RETURN to_jsonb(row)-'request_payload';
END $$;

CREATE FUNCTION respond_workforce_application(p_id uuid,p_action text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid:=app_private.worker_actor(); post workforce_posts; row workforce_applications; worker worker_profiles; target uuid; result jsonb; hires uuid[]:='{}';
BEGIN
 PERFORM 1 FROM users WHERE id=actor FOR UPDATE;
 SELECT * INTO post FROM workforce_posts WHERE id=(SELECT post_id FROM workforce_applications WHERE id=p_id) FOR UPDATE;
 SELECT * INTO row FROM workforce_applications WHERE id=p_id FOR UPDATE;
 IF row.id IS NULL OR p_action IS NULL OR (p_action IN('accept','decline') AND post.author_id<>actor) OR (p_action='withdraw' AND row.applicant_id<>actor) OR p_action NOT IN('accept','decline','withdraw') THEN RAISE EXCEPTION 'Only the job author can review; only the applicant can withdraw' USING ERRCODE='42501'; END IF;
 IF row.status=(CASE p_action WHEN 'accept' THEN 'ACCEPTED' WHEN 'decline' THEN 'DECLINED' ELSE 'WITHDRAWN' END) THEN RETURN to_jsonb(row)-'request_payload'; END IF;
 IF row.status<>'PENDING' THEN RAISE EXCEPTION 'Application is no longer pending' USING ERRCODE='22023'; END IF;
 IF p_action='accept' THEN
  IF post.status<>'OPEN' OR post.filled_count+cardinality(row.worker_ids)>post.headcount OR post.start_date<(now() AT TIME ZONE 'Asia/Kolkata')::date THEN RAISE EXCEPTION 'Job has no remaining places or its start date has passed' USING ERRCODE='22023'; END IF;
  FOREACH target IN ARRAY row.worker_ids LOOP
   SELECT * INTO worker FROM worker_profiles WHERE id=target FOR UPDATE;
   IF worker.id IS NULL OR worker.user_id<>row.applicant_id OR NOT worker.is_verified OR NOT worker.accepting_requests OR worker.worker_role<>post.worker_role OR worker.wage_type<>post.wage_type OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='worker-documents' AND name=worker.govt_id_url) OR (worker.worker_role='HEAVY_DRIVER' AND (coalesce(trim(worker.license_class),'')='' OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='worker-documents' AND name=worker.driving_license_url))) THEN RAISE EXCEPTION 'Worker documents or eligibility changed; review the application again' USING ERRCODE='22023'; END IF;
   result:=hire_worker(target,post.start_date::timestamp AT TIME ZONE 'Asia/Kolkata',(post.end_date+1)::timestamp AT TIME ZONE 'Asia/Kolkata',row.offered_wage,post.wage_type,post.site_location,post.title,gen_random_uuid(),post.site_latitude,post.site_longitude);
   UPDATE worker_hires SET status='ACTIVE',offer_by='WORKER',offer_history=jsonb_build_array(jsonb_build_object('version',1,'side','WORKER','action','OFFER','amount',row.offered_wage,'note',row.note,'created_at',row.created_at),jsonb_build_object('version',1,'side','EMPLOYER','action','ACCEPT','amount',row.offered_wage,'note','Job application accepted','created_at',now())) WHERE id=(result->>'id')::uuid;
   hires:=array_append(hires,(result->>'id')::uuid);
  END LOOP;
  UPDATE workforce_posts SET filled_count=filled_count+cardinality(row.worker_ids),status=CASE WHEN filled_count+cardinality(row.worker_ids)=headcount THEN 'FILLED' ELSE 'OPEN' END WHERE id=post.id;
 END IF;
 UPDATE workforce_applications SET status=CASE p_action WHEN 'accept' THEN 'ACCEPTED' WHEN 'decline' THEN 'DECLINED' ELSE 'WITHDRAWN' END,hire_ids=hires WHERE id=row.id RETURNING * INTO row;
 RETURN to_jsonb(row)-'request_payload';
END $$;
REVOKE ALL ON FUNCTION workforce_board(),post_workforce_job(jsonb),apply_workforce_job(jsonb),respond_workforce_application(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION workforce_board(),post_workforce_job(jsonb),apply_workforce_job(jsonb),respond_workforce_application(uuid,text) TO authenticated;
COMMIT;
