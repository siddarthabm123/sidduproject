import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { workforcePostSchema,workforceApplicationSchema } from '../workforce/validation';
import { demoBoard,acceptDemoApplication,eligibleForJob } from '../workforce/board-demo';
import { demoWorkers } from '../workforce/demo';
import workerHandler from '../api/workers';

test('demo customer crew bids reach the owner and become agreements without exceeding headcount',()=>{
 const board=demoBoard(),app=board.applications[0],post=board.posts.find(p=>p.id===app.post_id)!;
 assert.equal(post.author_role,'owner');assert.equal(app.applicant_id,'demo-customer');
 const next=acceptDemoApplication(board,app.id,'demo-owner',demoWorkers,[]);
 assert.equal(next.board.applications[0].status,'ACCEPTED');assert.equal(next.board.posts[0].filled_count,2);assert.equal(next.hires.length,2);assert.equal(next.hires[0].employer_id,'demo-owner');assert.equal(next.hires[0].status,'ACTIVE');
 assert.throws(()=>acceptDemoApplication(board,app.id,'demo-customer',demoWorkers,[]),/Only the job author/);
 const altered=demoWorkers.map(w=>app.worker_ids.includes(w.id)?{...w,is_verified:false}:w);
 assert.throws(()=>acceptDemoApplication(board,app.id,'demo-owner',altered,[]),/documents or eligibility/);
 assert.ok(!eligibleForJob({...demoWorkers[7],govt_id_url:''},post));
 assert.throws(()=>acceptDemoApplication({...board,posts:board.posts.map(p=>({...p,filled_count:p.headcount}))},app.id,'demo-owner',demoWorkers,[]),/places changed/);
});

test('all new workforce endpoints require a session before exposing jobs or accepting applications',async()=>{
 for(const [route,method] of [['jobs','GET'],['job-post','POST'],['apply','POST'],['application-response','POST']]){
  let code=0;const response={status(n:number){code=n;return this},json(_v:unknown){},setHeader(_k:string,_v:string){}};
  await workerHandler({method,headers:{},query:{route}},response);assert.equal(code,401);
 }
});

test('job posts require headcount, money, dates and application crews cannot contain duplicate workers',()=>{
 const post={request_id:randomUUID(),title:'Excavator crew needed',worker_role:'RIG_OPERATOR',headcount:2,wage_rate:1500,wage_type:'DAILY_WAGE',start_date:'2027-01-01',end_date:'2027-01-02',site_location:'Project site gate',site_latitude:12.97,site_longitude:77.6,description:'Two experienced operators for the day shift.'};
 assert.ok(workforcePostSchema.safeParse(post).success);
 for(const invalid of [{headcount:0},{headcount:1.5},{wage_rate:1500.001},{end_date:'2026-12-31'},{site_latitude:95}])assert.equal(workforcePostSchema.safeParse({...post,...invalid}).success,false);
 const worker=randomUUID();assert.equal(workforceApplicationSchema.safeParse({post_id:randomUUID(),worker_ids:[worker,worker],offered_wage:1200,request_id:randomUUID()}).success,false);
});

test('customer requirements and owner jobs exchange private applications and create scoped hiring agreements atomically',async()=>{
 const db=new PGlite({extensions:{pgcrypto}}),customer=randomUUID(),owner=randomUUID(),stranger=randomUUID(),admin=randomUUID();
 const login=async(id:string)=>{await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('SET ROLE authenticated')};
 const root=()=>db.exec('RESET ROLE');
 const job=(headcount=2)=>({request_id:randomUUID(),title:'Rig operators for borewell job',worker_role:'RIG_OPERATOR',headcount,wage_rate:1600,wage_type:'DAILY_WAGE',start_date:new Date(Date.now()+86400000).toISOString().slice(0,10),end_date:new Date(Date.now()+172800000).toISOString().slice(0,10),site_location:'Bengaluru project gate',site_latitude:12.97,site_longitude:77.6,description:'Experienced crew for drilling support work.'});
 const call=async(fn:string,payload:unknown)=>(await db.query<any>(`SELECT ${fn}($1) AS r`,[payload])).rows[0].r;
 const respond=async(id:string,action:string)=>(await db.query<any>('SELECT respond_workforce_application($1,$2) AS r',[id,action])).rows[0].r;
 const board=async()=>(await db.query<any>('SELECT workforce_board() AS r')).rows[0].r;
 try{
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;CREATE SCHEMA app_private;CREATE SCHEMA storage;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text,name text);ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
  GRANT USAGE ON SCHEMA auth,storage TO authenticated,anon;GRANT SELECT,INSERT ON storage.objects TO authenticated;`);
  await db.exec(await readFile(new URL('../20260920000100_riglogix_core.sql',import.meta.url),'utf8'));
  for(const name of ['20261012001300_workforce.sql','20261017001400_explicit_rpc_permissions.sql','20261018001800_worker_wage_negotiation.sql','20261115001900_workforce_job_board.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
  for(const [id,role] of [[customer,'customer'],[owner,'owner'],[stranger,'customer'],[admin,'admin']])await db.query(`INSERT INTO users(id,role,full_name,workspace_name,email) VALUES($1::uuid,$2::user_role,$2::text,$2::text,$1::text||'@test.local')`,[id,role]);
  const profile=async(manager:string,name:string,role='RIG_OPERATOR')=>{
   await root();const govt=`${manager}/${randomUUID()}.pdf`,license=`${manager}/${randomUUID()}.pdf`;await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('worker-documents',$1),('worker-documents',$2)",[govt,license]);await login(manager);
   return call('save_worker_profile',{request_id:randomUUID(),full_name:name,phone_number:'+919876543210',worker_role:role,experience_years:5,address:'Private worker address',public_area:'Bengaluru',latitude:12.97,longitude:77.6,type_of_work:['Rig work'],wage_rate:1500,wage_type:'DAILY_WAGE',govt_id_url:govt,driving_license_url:role==='HEAVY_DRIVER'?license:null,license_class:role==='HEAVY_DRIVER'?'HMV':null,skills:[],consent:true});
  };
  const a=await profile(customer,'Customer crew one'),b=await profile(customer,'Customer crew two'),c=await profile(owner,'Owner crew one');
  await login(owner);const payload=job(),post=await call('post_workforce_job',payload);assert.equal(post.author_role,'owner');assert.equal((await call('post_workforce_job',payload)).id,post.id);
  await assert.rejects(call('post_workforce_job',{...payload,headcount:3}),/different job/);
  await login(customer);const input={post_id:post.id,worker_ids:[a.id,b.id],offered_wage:1400,note:'Two operators with reviewed documents',request_id:randomUUID()};
  await assert.rejects(call('apply_workforce_job',input),/reviewed identity/);
  await login(admin);for(const id of [a.id,b.id,c.id])await db.query('SELECT review_worker_profile($1,true)',[id]);
  await login(customer);await assert.rejects(call('apply_workforce_job',{...input,worker_ids:[a.id,c.id]}),/own managed/);
  const app=await call('apply_workforce_job',input);assert.equal((await call('apply_workforce_job',input)).id,app.id);
  await assert.rejects(call('apply_workforce_job',{...input,offered_wage:1300}),/different application/);
  await login(stranger);assert.equal((await board()).applications.length,0);await assert.rejects(respond(app.id,'accept'),/Only the job author/);await assert.rejects(db.query('SELECT * FROM workforce_applications'),/permission denied/);
  await login(owner);const inbox=await board();assert.equal(inbox.applications[0].worker_names.length,2);assert.equal('request_payload' in inbox.applications[0],false);assert.ok(!JSON.stringify(inbox).includes('govt_id_url'));
  const accepted=await respond(app.id,'accept');assert.equal(accepted.hire_ids.length,2);assert.equal((await respond(app.id,'accept')).hire_ids.length,2);assert.equal((await board()).posts[0].filled_count,2);assert.equal((await board()).posts[0].status,'FILLED');
  const ownerRecords=(await db.query<any>('SELECT my_workforce_records() AS r')).rows[0].r;assert.equal(ownerRecords.hires.length,2);assert.ok(ownerRecords.hires.every((h:any)=>h.status==='ACTIVE'&&h.agreed_wage===1400));
  await login(customer);assert.equal((await db.query<any>('SELECT my_workforce_records() AS r')).rows[0].r.hires.length,2);
  const demand=await call('post_workforce_job',job(1));assert.equal(demand.author_role,'customer');await login(owner);const reply=await call('apply_workforce_job',{post_id:demand.id,worker_ids:[c.id],offered_wage:1500,request_id:randomUUID()});
  await login(customer);assert.equal((await respond(reply.id,'accept')).status,'ACCEPTED');
  // A crew application never creates a partial award if one worker becomes unavailable.
  const d=await profile(stranger,'Different crew one'),e=await profile(stranger,'Different crew two');await login(admin);for(const id of [d.id,e.id])await db.query('SELECT review_worker_profile($1,true)',[id]);
  await login(owner);const other=await call('post_workforce_job',job());await login(stranger);const crew=await call('apply_workforce_job',{post_id:other.id,worker_ids:[d.id,e.id],offered_wage:1400,request_id:randomUUID()});
  await root();await db.query('UPDATE worker_profiles SET is_verified=false WHERE id=$1',[e.id]);await login(owner);await assert.rejects(respond(crew.id,'accept'),/eligibility changed/);await root();assert.equal((await db.query<any>('SELECT count(*)::int AS n FROM worker_hires WHERE worker_id=$1',[d.id])).rows[0].n,0);
  assert.equal((await db.query<any>("SELECT has_function_privilege('anon','workforce_board()','EXECUTE') AS ok")).rows[0].ok,false);
 }finally{await db.close()}
});
