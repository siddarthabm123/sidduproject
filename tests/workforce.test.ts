import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { documentFileSchema, documentSignature, hireWorkerSchema, workerProfileSchema } from '../workforce/validation';
import workerHandler from '../api/workers';
import { workerText } from '../workforce/labels';

test('Zod validates workforce forms, rates, private document paths and hire dates',()=>{
 const profile={full_name:'Worker Test',phone_number:'+919876543210',address:'Private street address',public_area:'Bengaluru',worker_role:'HEAVY_DRIVER',latitude:12.97,longitude:77.6,experience_years:5,type_of_work:['Excavator 20T'],skills:['Hydraulics'],wage_rate:1000,wage_type:'DAILY_WAGE',consent:true,request_id:randomUUID(),govt_id_url:`${randomUUID()}/${randomUUID()}.pdf`,driving_license_url:`${randomUUID()}/${randomUUID()}.pdf`,license_class:'HMV'};
 assert.equal(workerProfileSchema.safeParse(profile).success,true);
 for(const invalid of [{phone_number:'123'},{latitude:91},{experience_years:61},{wage_rate:NaN},{wage_rate:800.001},{consent:false},{govt_id_url:'https://example.com/public-aadhaar.pdf'},{license_class:''},{driving_license_url:null}])assert.equal(workerProfileSchema.safeParse({...profile,...invalid}).success,false);
 const hire={worker_id:randomUUID(),start_date:'2027-01-01T00:00:00Z',end_date:'2027-01-02T00:00:00Z',agreed_wage:800,wage_type:'DAILY_WAGE',site_location:'Project site address',request_id:randomUUID()};
 assert.equal(hireWorkerSchema.safeParse(hire).success,true);assert.equal(hireWorkerSchema.safeParse({...hire,end_date:hire.start_date}).success,false);
 assert.equal(documentFileSchema.safeParse({size:5242881,type:'image/png'}).success,false);assert.equal(documentFileSchema.safeParse({size:100,type:'image/svg+xml'}).success,false);
 assert.equal(documentSignature(new Uint8Array([37,80,68,70,45]),'application/pdf'),true);assert.equal(documentSignature(new Uint8Array([60,115,99,114,105,112,116]),'application/pdf'),false);
 assert.notEqual(workerText('Recruit Skilled Workers','kn'),'Recruit Skilled Workers');
});
test('worker endpoints require authentication and correct methods',async()=>{
 const invoke=async(method:string,route:string)=>{let code=0;const res={status(n:number){code=n;return this},json(_v:unknown){},setHeader(_k:string,_v:string){}};await workerHandler({method,headers:{},query:{route}},res);return code};
 assert.equal(await invoke('GET','profile'),405);assert.equal(await invoke('GET','missing'),404);
 for(const route of ['search','records'])assert.equal(await invoke('GET',route),401);
 for(const route of ['profile','hire','respond','review'])assert.equal(await invoke('POST',route),401);
});
test('workforce PostgreSQL profile privacy, review and hiring lifecycle',async t=>{
 const db=new PGlite({extensions:{pgcrypto}});const manager=randomUUID(),customer=randomUUID(),owner=randomUUID(),admin=randomUUID(),stranger=randomUUID();
 const govt=`${manager}/${randomUUID()}.pdf`,license=`${manager}/${randomUUID()}.pdf`;
 const payload={full_name:'Operator Test',phone_number:'+919876543210',worker_role:'HEAVY_DRIVER',experience_years:5,address:'Private home address',public_area:'Bengaluru',latitude:12.97,longitude:77.6,type_of_work:['Excavator 20T'],wage_rate:1200,wage_type:'DAILY_WAGE',govt_id_url:govt,driving_license_url:license,license_class:'HMV',skills:['Hydraulics'],consent:true,request_id:randomUUID(),availability_status:true,is_verified:true};
 const login=async(id:string,role='authenticated')=>{await db.exec('RESET ROLE');await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`,[id]);await db.exec(`SET ROLE ${role}`)};
 const root=()=>db.exec('RESET ROLE');
 const search=async()=>(await db.query<any>(`SELECT search_workers(12.97,77.6,25,'','','','') AS rows`)).rows[0].rows;
 let worker:any;let hire:any;
 const request=async(key=randomUUID(),wage=1200)=>(await db.query<any>(`SELECT hire_worker($1,date_trunc('day',now())+interval '1 day',date_trunc('day',now())+interval '3 days',$2,'DAILY_WAGE','Private project gate','Excavator 20T',$3) AS h`,[worker.id,wage,key])).rows[0].h;
 try{
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;CREATE SCHEMA app_private;CREATE SCHEMA storage;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text,name text);ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT USAGE ON SCHEMA auth,storage TO authenticated,anon;GRANT SELECT,INSERT ON storage.objects TO authenticated;`);
  await db.exec(await readFile(new URL('../20260920000100_riglogix_core.sql',import.meta.url),'utf8'));
  await db.exec('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon,authenticated; ALTER DEFAULT PRIVILEGES IN SCHEMA app_private GRANT EXECUTE ON FUNCTIONS TO anon,authenticated;');
  await db.exec(await readFile(new URL('../supabase/migrations/20261012001300_workforce.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261017001400_explicit_rpc_permissions.sql',import.meta.url),'utf8'));
  assert.equal((await db.query<any>(`SELECT has_function_privilege('anon','search_workers(double precision,double precision,integer,text,text,text,text)','EXECUTE') AS allowed`)).rows[0].allowed,false);
  assert.equal((await db.query<any>(`SELECT has_function_privilege('authenticated','app_private.worker_admin()','EXECUTE') AS allowed`)).rows[0].allowed,true);
  for(const [id,role] of [[manager,'owner'],[customer,'customer'],[owner,'owner'],[admin,'admin'],[stranger,'customer']])await db.query(`INSERT INTO users(id,role,full_name,workspace_name,email) VALUES($1::uuid,$2::user_role,$2::text,$2::text,$1::text||'@test.local')`,[id,role]);
  await login(manager);await db.query(`INSERT INTO storage.objects(bucket_id,name) VALUES('worker-documents',$1),('worker-documents',$2)`,[govt,license]);
  await t.test('private uploads and profile registration cannot forge verification or repeat records',async()=>{
   await assert.rejects(db.query(`INSERT INTO storage.objects(bucket_id,name) VALUES('worker-documents',$1)`,[`${customer}/other.pdf`]),/row-level security/);
   await assert.rejects(db.query('SELECT save_worker_profile($1)',[{...payload,consent:false}]),/consent/);
   await assert.rejects(db.query('SELECT save_worker_profile($1)',[{...payload,govt_id_url:`${customer}/other.pdf`}]),/private document/);
   worker=(await db.query<any>('SELECT save_worker_profile($1) AS p',[payload])).rows[0].p;
   assert.equal(worker.is_verified,false);assert.equal((await db.query<any>('SELECT save_worker_profile($1) AS p',[payload])).rows[0].p.id,worker.id);
   await assert.rejects(db.query('SELECT save_worker_profile($1)',[{...payload,full_name:'Changed worker'}]),/different profile/);
   await login(stranger);assert.equal((await db.query('SELECT * FROM storage.objects')).rows.length,0);
   await assert.rejects(db.query('SELECT * FROM worker_profiles'),/permission denied/);
   await assert.rejects(db.query('SELECT save_worker_profile($1,$2)',[{...payload,request_id:randomUUID()},worker.id]),/profile manager/);
  });
  await t.test('search redacts contacts, street addresses, coordinates and identity documents',async()=>{
   await login(customer);const rows=await search();assert.equal(rows.length,1);assert.equal(rows[0].public_area,'Bengaluru');
   for(const key of ['phone_number','address','latitude','longitude','govt_id_url','driving_license_url','user_id','request_payload'])assert.equal(key in rows[0],false);
   await assert.rejects(db.query(`SELECT search_workers(100,77.6,25,'','','','')`),/Invalid/);
   await login('','anon');await assert.rejects(db.query(`SELECT search_workers(12.97,77.6,25,'','','','')`),/permission denied/);
  });
  await t.test('only admin review can verify; manager edits reset review',async()=>{
   await login(manager);await assert.rejects(db.query('SELECT review_worker_profile($1,true)',[worker.id]),/Admin/);
   await login(admin);await db.query('SELECT review_worker_profile($1,true)',[worker.id]);
   await login(customer);assert.equal((await search())[0].is_verified,true);
   await login(manager);await db.query('SELECT save_worker_profile($1,$2)',[{...payload,request_id:randomUUID(),wage_rate:1250},worker.id]);
   await login(customer);assert.equal((await search())[0].is_verified,false);
  });
  await t.test('hire requests are idempotent, reserve availability and block competing employers',async()=>{
   await login(manager);await assert.rejects(request(),/own account/);
   await login(customer);const key=randomUUID();hire=await request(key);
   assert.equal(hire.status,'PENDING');assert.equal(hire.employer_type,'CUSTOMER');assert.equal((await request(key)).id,hire.id);
   await assert.rejects(request(key,999),/different hire/);
   assert.equal((await search()).length,0);
   const records=(await db.query<any>('SELECT my_workforce_records() AS r')).rows[0].r;assert.equal(records.hires[0].phone_number,null);
   await login(owner);await assert.rejects(request(),/reserved/);
   await root();assert.equal((await db.query<any>('SELECT availability_status FROM worker_profiles WHERE id=$1',[worker.id])).rows[0].availability_status,false);
  });
  await t.test('only worker manager accepts; contact opens after acceptance, cancellation restores availability',async()=>{
   await login(customer);await assert.rejects(db.query(`SELECT respond_worker_hire($1,'accept')`,[hire.id]),/manager/);
   await login(stranger);await assert.rejects(db.query(`SELECT respond_worker_hire($1,'cancel')`,[hire.id]),/party/);
   await login(manager);const row=(await db.query<any>(`SELECT respond_worker_hire($1,'accept') AS h`,[hire.id])).rows[0].h;assert.equal(row.status,'ACTIVE');
   await login(customer);assert.equal((await db.query<any>('SELECT my_workforce_records() AS r')).rows[0].r.hires[0].phone_number,payload.phone_number);
   await assert.rejects(db.query(`SELECT respond_worker_hire($1,'complete')`,[hire.id]),/end date/);
   await db.query(`SELECT respond_worker_hire($1,'cancel')`,[hire.id]);assert.equal((await search()).length,1);
  });
  await t.test('expired pending requests stop reserving workers and owners can hire too',async()=>{
   await login(customer);const stale=await request();await root();await db.query(`UPDATE worker_hires SET request_expires_at=now()-interval '1 hour' WHERE id=$1`,[stale.id]);
   await login(manager);await assert.rejects(db.query(`SELECT respond_worker_hire($1,'accept')`,[stale.id]),/active request/);
   await login(owner);assert.equal((await search()).length,1);const row=await request();assert.equal(row.employer_type,'OWNER');
  });
  await t.test('same-day Indian time-zone hires work and only employer can complete an ended hire',async()=>{
   await login(manager);const profile=(await db.query<any>('SELECT save_worker_profile($1) AS p',[{...payload,request_id:randomUUID(),full_name:'Today worker'}])).rows[0].p;
   await login(customer);const row=(await db.query<any>(`SELECT hire_worker($1,date_trunc('day',now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata',now()+interval '1 day',800,'DAILY_WAGE','Test local day site','',$2) AS h`,[profile.id,randomUUID()])).rows[0].h;
   assert.equal(row.status,'PENDING');
   await root();await db.query(`UPDATE worker_hires SET status='ACTIVE',start_date=now()-interval '2 days',end_date=now()-interval '1 hour' WHERE id=$1`,[row.id]);
   await login(manager);await assert.rejects(db.query(`SELECT respond_worker_hire($1,'complete')`,[row.id]),/Employer/);
   await login(customer);assert.equal((await db.query<any>(`SELECT respond_worker_hire($1,'complete') AS h`,[row.id])).rows[0].h.status,'COMPLETED');
   assert.ok((await search()).some((p:any)=>p.id===profile.id));
  });
 }finally{await db.close()}
});
