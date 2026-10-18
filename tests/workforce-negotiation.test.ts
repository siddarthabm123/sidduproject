import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { hireResponseSchema, hireWorkerSchema } from '../workforce/validation';
import { demoNegotiations, demoWorkers } from '../workforce/demo';
import { incomingOffer, respondDemoHire } from '../workforce/negotiation';
import { workerText } from '../workforce/labels';

test('site coordinates and counter-offers are validated',()=>{
  const input={id:randomUUID(),action:'counter',amount:1100,expected_version:1};
  assert.ok(hireResponseSchema.safeParse(input).success);
  for(const invalid of [{amount:NaN},{amount:0},{amount:1100.001},{expected_version:0},{amount:undefined},{expected_version:undefined}])assert.equal(hireResponseSchema.safeParse({...input,...invalid}).success,false);
  const hire={worker_id:randomUUID(),start_date:'2027-01-01T00:00:00Z',end_date:'2027-01-02T00:00:00Z',agreed_wage:1000,wage_type:'DAILY_WAGE',site_location:'Test project site',request_id:randomUUID(),site_latitude:12.97,site_longitude:77.6};
  assert.ok(hireWorkerSchema.safeParse(hire).success);
  for(const invalid of [{site_latitude:91},{site_longitude:-181},{site_longitude:null}])assert.equal(hireWorkerSchema.safeParse({...hire,...invalid}).success,false);
});

test('customer and owner demo examples support negotiation without changing worker expectations',()=>{
  const examples=demoNegotiations();assert.equal(examples.length,4);
  for(const role of ['customer','owner']){
    const actor=`demo-${role}`;
    const inbox=examples.filter(h=>h.employer_id===actor||demoWorkers.find(w=>w.id===h.worker_id)?.user_id===actor);
    assert.equal(inbox.length,4);
    assert.ok(inbox.some(h=>incomingOffer(h,demoWorkers.find(w=>w.id===h.worker_id)?.user_id===actor)));
  }
  const h=examples[0],manager=demoWorkers[0].user_id;
  assert.throws(()=>respondDemoHire(h,manager,manager,'accept',2),/other party/);
  assert.throws(()=>respondDemoHire(h,h.employer_id,manager,'accept',1),/Offer changed/);
  const counter=respondDemoHire(h,h.employer_id,manager,'counter',2,1050);
  assert.equal(counter.expected_wage,1200);assert.equal(counter.initial_offer,1000);assert.equal(counter.agreed_wage,1050);
  const accepted=respondDemoHire(counter,manager,manager,'accept',3);assert.equal(accepted.status,'ACTIVE');
  assert.equal(accepted.offer_history?.length,4);
});

test('PostgreSQL hiring negotiations enforce ownership, turn, version, immutable expectations and reservations',async()=>{
  const db=new PGlite({extensions:{pgcrypto}}),manager=randomUUID(),customer=randomUUID(),owner=randomUUID();
  const login=async(id:string)=>{await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('SET ROLE authenticated')};
  const root=()=>db.exec('RESET ROLE');
  try{
    await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;CREATE SCHEMA app_private;CREATE SCHEMA storage;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text,name text);ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
      GRANT USAGE ON SCHEMA auth,storage TO authenticated,anon;GRANT SELECT,INSERT ON storage.objects TO authenticated;`);
    await db.exec(await readFile(new URL('../20260920000100_riglogix_core.sql',import.meta.url),'utf8'));
    await db.exec('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon,authenticated;ALTER DEFAULT PRIVILEGES IN SCHEMA app_private GRANT EXECUTE ON FUNCTIONS TO anon,authenticated;');
    for(const name of ['20261012001300_workforce.sql','20261017001400_explicit_rpc_permissions.sql','20261018001800_worker_wage_negotiation.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
    for(const [id,role] of [[manager,'owner'],[customer,'customer'],[owner,'owner']])await db.query(`INSERT INTO users(id,role,full_name,workspace_name,email) VALUES($1::uuid,$2::user_role,$2::text,$2::text,$1::text||'@test.local')`,[id,role]);
    assert.equal((await db.query<any>("SELECT has_function_privilege('authenticated','app_private.respond_worker_hire(uuid,text)','EXECUTE') AS allowed")).rows[0].allowed,false);
    assert.equal((await db.query<any>("SELECT has_function_privilege('anon','public.respond_worker_hire(uuid,text,numeric,integer,text)','EXECUTE') AS allowed")).rows[0].allowed,false);
    const document=`${manager}/${randomUUID()}.pdf`;await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('worker-documents',$1)",[document]);
    await login(manager);
    const worker=(await db.query<any>('SELECT save_worker_profile($1) AS w',[{full_name:'Test operator',phone_number:'+919876543210',worker_role:'RIG_OPERATOR',experience_years:5,address:'Test private address',public_area:'Bengaluru',latitude:12.97,longitude:77.6,type_of_work:['Rig drilling'],skills:[],wage_rate:1200,wage_type:'DAILY_WAGE',govt_id_url:document,consent:true,request_id:randomUUID(),availability_status:true}])).rows[0].w;
    const requestId=randomUUID();
    const request=async(key=requestId,amount=1000,lat:number|null=12.97,lng:number|null=77.6)=>(await db.query<any>("SELECT hire_worker($1,date_trunc('day',now())+interval '1 day',date_trunc('day',now())+interval '3 days',$2,'DAILY_WAGE','Private project gate','Rig drilling',$3,$4,$5) AS h",[worker.id,amount,key,lat,lng])).rows[0].h;
    const respond=async(id:string,action:string,amount:number|null,version:number)=>(await db.query<any>('SELECT respond_worker_hire($1,$2,$3,$4) AS h',[id,action,amount,version])).rows[0].h;
    await login(customer);await assert.rejects(request(randomUUID(),1000,91,77.6),/coordinates/);await assert.rejects(request(randomUUID(),1000,12,null),/coordinates/);
    const hire=await request();assert.equal(hire.expected_wage,1200);assert.equal(hire.initial_offer,1000);assert.equal(hire.site_latitude,12.97);
    await assert.rejects(respond(hire.id,'accept',null,1),/other party/);
    assert.equal((await db.query<any>('SELECT my_workforce_records() AS r')).rows[0].r.hires[0].phone_number,null);
    await login(owner);await assert.rejects(respond(hire.id,'counter',1050,1),/Hiring party/);await assert.rejects(request(randomUUID()),/reserved/);
    await login(manager);await assert.rejects(respond(hire.id,'counter',900,1),/must be higher/);await assert.rejects(respond(hire.id,'counter',1100,2),/Offer changed/);
    const counter=await respond(hire.id,'counter',1100,1);assert.equal(counter.offer_version,2);assert.equal(counter.request_expires_at,hire.request_expires_at);
    await assert.rejects(respond(hire.id,'accept',null,2),/other party/);
    await login(customer);assert.equal((await request()).agreed_wage,1100);await assert.rejects(request(requestId,1000,13,77),/different hire details/);
    await assert.rejects(respond(hire.id,'accept',null,1),/Offer changed/);
    await db.query('SELECT respond_worker_hire($1,$2,$3,$4)',[hire.id,'counter',1050,2]);
    await login(manager);await assert.rejects(respond(hire.id,'accept',null,2),/Offer changed/);
    const accepted=await respond(hire.id,'accept',null,3);assert.equal(accepted.status,'ACTIVE');assert.equal(accepted.agreed_wage,1050);assert.equal(accepted.expected_wage,1200);assert.equal(accepted.initial_offer,1000);assert.equal(accepted.offer_history.length,4);
    await login(customer);assert.equal((await db.query<any>('SELECT my_workforce_records() AS r')).rows[0].r.hires[0].phone_number,'+919876543210');
    await assert.rejects(respond(hire.id,'counter',1200,3),/pending request/);await respond(hire.id,'cancel',null,3);
    await login(owner);const next=await request(randomUUID());assert.equal(next.employer_type,'OWNER');
    await login(manager);await respond(next.id,'counter',1150,1);await login(owner);const declined=await respond(next.id,'decline',null,2);assert.equal(declined.status,'CANCELLED');
    await root();assert.equal((await db.query<any>('SELECT availability_status FROM worker_profiles WHERE id=$1',[worker.id])).rows[0].availability_status,true);
    await login(owner);const expired=await request(randomUUID());await root();await db.query("UPDATE worker_hires SET request_expires_at=now()-interval '1 minute' WHERE id=$1",[expired.id]);
    await login(manager);await assert.rejects(respond(expired.id,'counter',1100,1),/pending request/);
    await login(customer);assert.deepEqual((await db.query<any>('SELECT my_workforce_records() AS r')).rows[0].r.hires.filter((h:any)=>h.id===next.id),[]);
  }finally{await db.close()}
});

test('new hiring controls have Hindi and Kannada labels',async()=>{
  const source=(await Promise.all(['WorkerHireCard.tsx','WorkerSiteMap.tsx'].map(file=>readFile(new URL('../'+file,import.meta.url),'utf8')))).join('\n');
  const labels=[...source.matchAll(/\bt\('([^']+)'/g)].map(m=>m[1]);
  for(const language of ['hi','kn'] as const)for(const label of labels)assert.notEqual(workerText(label,language),label,`${language}: ${label}`);
});
