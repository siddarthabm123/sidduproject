import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { authenticatedDatabase, ServiceError } from '../server-supabase';
import discover from '../api/discover-providers';
import recommend from '../api/recommend-vehicles';
import { LocalizationProvider, UiText, translatePhrase } from '../localization';
import { hiringEstimate } from '../workforce/dates';
import workerApi from '../api/workers';
import fuelApi from '../api/fuel';
import ts from 'typescript';

test('API dispatchers reject inherited object keys as unknown routes',async()=>{
 for(const handler of [workerApi,fuelApi])for(const route of ['__proto__','constructor','toString']){let status=200;const res={setHeader(){},status(n:number){status=n;return res},json(v:unknown){return v}};await handler({method:'POST',headers:{},query:{route}},res);assert.equal(status,404)}
});

test('authentication distinguishes invalid sessions, throttling and service outages; discovery uses truthful status codes',async()=>{
 const keys=['SUPABASE_URL','SUPABASE_ANON_KEY','GOOGLE_PLACES_API_KEY','GEMINI_API_KEY'],before=Object.fromEntries(keys.map(k=>[k,process.env[k]])),original=globalThis.fetch;
 process.env.SUPABASE_URL='https://database.example.test';process.env.SUPABASE_ANON_KEY='test-public-key';process.env.GOOGLE_PLACES_API_KEY='test-places';process.env.GEMINI_API_KEY='test-model';
 const request={method:'POST',headers:{authorization:'Bearer test'},body:{category:'Excavator',latitude:12.97,longitude:77.6}};
 const response=()=>{const state={status:200,body:{} as any,headers:{} as Record<string,string>};const res={status(n:number){state.status=n;return res},json(v:unknown){state.body=v;return v},setHeader(k:string,v:string){state.headers[k]=v}};return{state,res}};
 try{
   for(const [http,status] of [[401,401],[403,401],[429,429],[500,503]]){globalThis.fetch=async()=>new Response('{}',{status:http});await assert.rejects(authenticatedDatabase(request),(e:unknown)=>e instanceof ServiceError&&e.status===status);const {state,res}=response();await discover(request,res);assert.equal(state.status,status);if(status===429)assert.equal(state.headers['Retry-After'],'60');}
   globalThis.fetch=async()=>{throw Error('network failed')};await assert.rejects(authenticatedDatabase(request),(e:unknown)=>e instanceof ServiceError&&e.status===503);
   const makeFetch=(quota:boolean,status:number)=>async(input:any)=>{const url=String(input);if(url.endsWith('/auth/v1/user'))return Response.json({id:randomUUID()});if(url.includes('claim_provider_request'))return Response.json(quota);return new Response('{}',{status})};
   globalThis.fetch=makeFetch(false,200);let result=response();await discover(request,result.res);assert.equal(result.state.status,429);
   globalThis.fetch=makeFetch(true,500);result=response();await discover(request,result.res);assert.equal(result.state.status,503);
   result=response();await recommend({...request,body:{candidates:[{id:'one',title:'Test excavator',category:'Excavator',distanceKm:2,rating:4,availability:'ready',verified:true}]}},result.res);assert.equal(result.state.status,503);assert.equal(result.state.body.recommendations[0].id,'one');
   result=response();await discover({...request,body:{latitude:null,longitude:77}},result.res);assert.equal(result.state.status,400);
 }finally{globalThis.fetch=original;for(const k of keys){if(before[k]===undefined)delete process.env[k];else process.env[k]=before[k]}}
});

test('React localization switches text without DOM mutation and preserves user-entered names',async()=>{
 const render=(language:'en'|'kn'|'hi')=>renderToStaticMarkup(createElement(LocalizationProvider,{language,children:createElement(UiText,{text:' Find equipment '})}));
 assert.match(render('en'),/Find equipment/);assert.doesNotMatch(render('kn'),/Find equipment/);assert.doesNotMatch(render('hi'),/Find equipment/);assert.match(render('kn'),/^ /);
 assert.equal(translatePhrase('Acme Equipment 42','kn'),'Acme Equipment 42');assert.match(translatePhrase('Good morning, Test User.','kn'),/Test User/);
 const source=await readFile(new URL('../App.tsx',import.meta.url),'utf8');assert.doesNotMatch(source,/MutationObserver|createTreeWalker|nodeValue/);assert.match(source,/<NotificationInbox/);
 const parsed=ts.createSourceFile('App.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const check=(node:ts.Node)=>{if(ts.isJsxElement(node)&&node.openingElement.tagName.getText(parsed)==='option')assert.ok(node.openingElement.attributes.properties.some(p=>ts.isJsxAttribute(p)&&p.name.getText(parsed)==='value'),'Translated options must preserve their canonical values');ts.forEachChild(node,check)};check(parsed);
 for(const word of ['Notifications','New booking request','Wage offer updated','Estimated wage subtotal','Available for selected dates','Offline. Reconnect before submitting changes.'])for(const language of ['hi','kn'] as const)assert.notEqual(translatePhrase(word,language),word);
});

test('daily hiring subtotal uses inclusive calendar dates and does not invent monthly proration',()=>{
 assert.deepEqual(hiringEstimate('2026-10-19','2026-10-21',1050.25,'DAILY_WAGE'),{days:3,total:3150.75});
 assert.equal(hiringEstimate('2026-10-19','2026-10-21',28000,'MONTHLY_SALARY'),null);
 for(const [start,end,rate] of [['2026-02-30','2026-03-01',100],['2026-10-21','2026-10-19',100],['2026-10-19','2026-10-19',NaN]] as const)assert.equal(hiringEstimate(start,end,rate,'DAILY_WAGE'),null);
});

test('notification recipients, read states, availability and provider quotas remain database-owned',async()=>{
 const db=new PGlite({extensions:{pgcrypto}}),customer=randomUUID(),owner=randomUUID(),other=randomUUID(),machine=randomUUID();
 const root=()=>db.exec("RESET ROLE;SELECT set_config('request.jwt.claim.sub','',false)");
 const login=async(id:string)=>{await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('SET ROLE authenticated')};
 try{
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;CREATE SCHEMA storage;
 CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{}');
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text,name text);ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
 GRANT USAGE ON SCHEMA auth,storage TO authenticated,anon;GRANT SELECT,INSERT ON storage.objects TO authenticated;
 ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon,authenticated;`);
 for(const file of ['20260920000100_riglogix_core.sql','20260920000200_riglogix_rls.sql','20260920000400_auth_wallet_booking_workflows.sql','20260920000500_lock_direct_financial_updates.sql','supabase/migrations/20260926000700_aadhaar_email_verification.sql','supabase/migrations/20260927000800_user_app_state.sql','supabase/migrations/20261008000900_secure_marketplace.sql','supabase/migrations/20261010001000_marketplace_reservations.sql','supabase/migrations/20261012001300_workforce.sql','supabase/migrations/20261017001400_explicit_rpc_permissions.sql','supabase/migrations/20261017001500_booking_quantities.sql','supabase/migrations/20261018001800_worker_wage_negotiation.sql','supabase/migrations/20261019001900_workspace_notifications.sql'])await db.exec(await readFile(new URL('../'+file,import.meta.url),'utf8'));
 for(const [id,role]of [[customer,'customer'],[owner,'owner'],[other,'customer']])await db.query('INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)',[id,`${id}@test.local`,{role,full_name:role,workspace_name:role}]);
 await db.query("INSERT INTO equipment(id,owner_id,title,sector,category,pricing_unit,base_rate_paise,available_units,is_verified,telematics_id) VALUES($1,$2,'Test machine','Construction','Excavator','hour',10000,3,true,'Test')",[machine,owner]);
 await login(customer);const job=(await db.query<any>("SELECT request_equipment_booking($1,current_date+1,'Private site gate',12,77,8) AS j",[[{equipment_id:machine,units:2}]])).rows[0].j[0];
 assert.equal((await db.query('SELECT * FROM workspace_notifications')).rows.length,0);
 await login(owner);let inbox=(await db.query<any>('SELECT * FROM workspace_notifications')).rows;assert.equal(inbox.length,1);assert.equal(inbox[0].title_key,'New booking request');assert.ok(!JSON.stringify(inbox).includes('Private site'));
 const note=inbox[0].id;
 await assert.rejects(db.query("INSERT INTO workspace_notifications(recipient_id,event_key,title_key,record_id,target_path) VALUES($1,'fake','Fake',$2,'/owner/jobs')",[customer,job.id]),/permission denied/);
 await assert.rejects(db.query('UPDATE workspace_notifications SET read_at=now()'),/permission denied/);
 await db.query('SELECT mark_workspace_notifications_read($1)',[[note]]);await db.query('SELECT mark_workspace_notifications_read($1)',[[note]]);assert.ok((await db.query<any>('SELECT read_at FROM workspace_notifications')).rows[0].read_at);
 await login(other);assert.equal((await db.query('SELECT * FROM workspace_notifications')).rows.length,0);await db.query('SELECT mark_workspace_notifications_read($1)',[[note]]);
 const available=(await db.query<any>('SELECT marketplace_availability(current_date+1,current_date+2) AS v')).rows[0].v;assert.equal(available[0].remaining_units,1);assert.ok(!JSON.stringify(available).includes(customer));
 for(let i=0;i<10;i++)assert.equal((await db.query<any>("SELECT claim_provider_request('places') AS ok")).rows[0].ok,true);assert.equal((await db.query<any>("SELECT claim_provider_request('places') AS ok")).rows[0].ok,false);
 await assert.rejects(db.query('DELETE FROM provider_request_limits'),/permission denied/);await assert.rejects(db.query("SELECT claim_provider_request('unlimited')"),/Invalid provider/);
 await login(owner);await db.query('SELECT accept_booking($1)',[job.id]);await login(customer);assert.equal((await db.query<any>('SELECT title_key FROM workspace_notifications')).rows[0].title_key,'Booking status updated');
 await root();const worker=randomUUID();await db.query(`INSERT INTO worker_profiles(id,user_id,full_name,phone_number,worker_role,experience_years,address,public_area,latitude,longitude,type_of_work,wage_rate,wage_type,govt_id_url,request_id,request_payload) VALUES($1,$2,'Test worker','9999999999','HELPER',2,'Private home address','Test area',12,77,'{Support}',800,'DAILY_WAGE','private-file',$3,'{}')`,[worker,owner,randomUUID()]);
 await login(customer);const hire=(await db.query<any>("SELECT hire_worker($1,now()+interval '1 day',now()+interval '3 days',700,'DAILY_WAGE','Private worksite','',$2) AS h",[worker,randomUUID()])).rows[0].h;
 await login(owner);inbox=(await db.query<any>('SELECT * FROM workspace_notifications')).rows;assert.ok(inbox.some(n=>n.title_key==='New hiring request'));await db.query("SELECT respond_worker_hire($1,'counter',750,1)",[hire.id]);
 await login(customer);inbox=(await db.query<any>('SELECT * FROM workspace_notifications')).rows;assert.ok(inbox.some(n=>n.title_key==='Wage offer updated'));
 await root();for(const name of ['mark_workspace_notifications_read(uuid[])','marketplace_availability(date,date)','claim_provider_request(text)'])assert.equal((await db.query<any>("SELECT has_function_privilege('anon',$1,'EXECUTE') AS allowed",[name])).rows[0].allowed,false);
 await db.exec(await readFile(new URL('../supabase/migrations/20261019002000_booking_work_entries.sql',import.meta.url),'utf8'));
 await db.query("UPDATE bookings SET status='on_site',reservation_start=current_date,reservation_end=current_date+1 WHERE id=$1",[job.id]);
 const workKey=randomUUID(),record=()=>db.query<any>("SELECT record_booking_work($1,current_date,8,'Test excavation and clearing',$2,1200,1208) AS w",[job.id,workKey]);
 await login(customer);await assert.rejects(record(),/Assigned equipment owner/);
 await login(owner);const entry=(await record()).rows[0].w;assert.equal((await record()).rows[0].w.id,entry.id);
 await assert.rejects(db.query("SELECT record_booking_work($1,current_date,9,'Test excavation and clearing',$2,1200,1208)",[job.id,workKey]),/different work details/);
 await assert.rejects(db.query("SELECT record_booking_work($1,current_date,20,'Too many work hours test',$2)",[job.id,randomUUID()]),/24 hours/);
 await assert.rejects(db.query("SELECT review_booking_work($1,true,'')",[entry.id]),/Booking customer/);
 await assert.rejects(db.query("UPDATE booking_work_entries SET status='APPROVED' WHERE id=$1",[entry.id]),/permission denied/);
 await login(other);assert.equal((await db.query('SELECT * FROM booking_work_entries')).rows.length,0);await assert.rejects(db.query('SELECT review_booking_work($1,true)',[entry.id]),/Booking customer/);
 await login(customer);assert.equal((await db.query<any>('SELECT review_booking_work($1,true) AS w',[entry.id])).rows[0].w.status,'APPROVED');await db.query('SELECT review_booking_work($1,true)',[entry.id]);await assert.rejects(db.query("SELECT review_booking_work($1,false,'Changed mind')",[entry.id]),/already been reviewed/);
 await login(owner);const correction=(await db.query<any>("SELECT record_booking_work($1,current_date,16,'Second work shift details',$2) AS w",[job.id,randomUUID()])).rows[0].w;
 await login(customer);await assert.rejects(db.query("SELECT review_booking_work($1,false,'')",[correction.id]),/reason/);await db.query("SELECT review_booking_work($1,false,'Wrong hours recorded')",[correction.id]);
 assert.equal((await db.query<any>('SELECT status,amount_paid_paise FROM bookings WHERE id=$1',[job.id])).rows[0].amount_paid_paise,0);
 await root();for(const name of ['record_booking_work(uuid,date,numeric,text,uuid,numeric,numeric)','review_booking_work(uuid,boolean,text)'])assert.equal((await db.query<any>("SELECT has_function_privilege('anon',$1,'EXECUTE') AS allowed",[name])).rows[0].allowed,false);
 }finally{await db.close()}
});
