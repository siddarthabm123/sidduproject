import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { bookingRequestKey, saveAndRefresh } from '../marketplace-domain';
import { interfaceText } from '../interface-translations';

const customer='10000000-0000-0000-0000-000000000001';
const owner='20000000-0000-0000-0000-000000000001';
const other='10000000-0000-0000-0000-000000000002';
async function fixture() {
  const db=new PGlite({extensions:{pgcrypto}});
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{}');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO anon,authenticated;`);
  for(const file of ['20260920000100_riglogix_core.sql','20260920000200_riglogix_rls.sql','20260920000400_auth_wallet_booking_workflows.sql','20260920000500_lock_direct_financial_updates.sql','supabase/migrations/20260926000700_aadhaar_email_verification.sql','supabase/migrations/20260927000800_user_app_state.sql','supabase/migrations/20261008000900_secure_marketplace.sql','supabase/migrations/20261010001000_marketplace_reservations.sql']) {
    await db.exec(await readFile(new URL(`../${file}`,import.meta.url),'utf8'));
  }
  for(const [id,role] of [[customer,'customer'],[owner,'owner'],[other,'customer']]) {
    await db.query('INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)',[id,id+'@example.test',{role,full_name:role,workspace_name:role}]);
  }
  const login=async(id:string)=>{await db.exec('RESET ROLE');await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`,[id]);await db.exec('SET ROLE authenticated')};
  const admin=async()=>{await db.exec('RESET ROLE');await db.query(`SELECT set_config('request.jwt.claim.sub','',false)`)};
  const machine=async(units=1)=>{
    await admin();const id=randomUUID();
    await db.query(`INSERT INTO equipment(id,owner_id,title,sector,category,pricing_unit,base_rate_paise,telematics_id,is_verified,available_units) VALUES($1::uuid,$2,'Excavator','Construction','Excavator','hour',10000,$1::text,true,$3)`,[id,owner,units]);
    return id;
  };
  const request=async(id:string,day=1,quantity=8,units=1,key=randomUUID(),endDay:number|null=null)=>(await db.query<any>(
    `SELECT request_equipment_booking($1,current_date+$2::integer,'Private gate address',12.97,77.6,$3,'Private instructions',$4,CASE WHEN $5::integer IS NULL THEN NULL ELSE current_date+$5::integer END) AS jobs`,
    [[{equipment_id:id,units}],day,quantity,key,endDay])).rows[0].jobs[0];
  return {db,login,admin,machine,request};
}

test('remaining marketplace database findings have regression coverage',async t=>{
  const f=await fixture();
  try {
    await t.test('hourly and explicit multi-day reservations reject overlaps, but allow adjacent periods',async()=>{
      const id=await f.machine();await f.login(customer);
      const job=await f.request(id,1,72);
      assert.equal((new Date(job.reservation_end).getTime()-new Date(job.reservation_start).getTime())/86400000,3);
      await f.login(other);await assert.rejects(f.request(id,2),/Not enough units/);
      await f.request(id,4);
      const second=await f.machine();await f.login(customer);await f.request(second,1,8,1,randomUUID(),3);
      await f.login(other);await assert.rejects(f.request(second,3),/Not enough units/);
    });
    await t.test('daily maximum load does not overcount disjoint reservations',async()=>{
      const id=await f.machine(3);await f.login(customer);
      await f.request(id,1,8,2);await f.request(id,2,8,2);
      await f.login(other);await f.request(id,1,8,1,randomUUID(),2);
      await assert.rejects(f.request(id,2),/Not enough units/);
    });
    await t.test('expired and declined requests release capacity and cannot be accepted',async()=>{
      const id=await f.machine();await f.login(customer);const job=await f.request(id);
      await f.admin();await f.db.query(`UPDATE bookings SET request_expires_at=now()-interval '1 minute' WHERE id=$1`,[job.id]);
      await f.login(owner);await assert.rejects(f.db.query('SELECT accept_booking($1)',[job.id]),/unexpired/);
      await f.login(other);const replacement=await f.request(id);
      await assert.rejects(f.db.query('SELECT decline_booking($1)',[replacement.id]));
      await f.login(owner);await f.db.query('SELECT decline_booking($1)',[replacement.id]);
      await f.login(customer);await f.request(id);
      const rows=(await f.db.query<any>('SELECT my_booking_records() AS jobs')).rows[0].jobs;
      assert.equal(rows.find((row:any)=>row.id===job.id).cancellation_reason,'Request expired');
    });
    await t.test('private auction details are hidden until assigned-owner acceptance',async()=>{
      const id=await f.machine();await f.login(customer);
      const auction=(await f.db.query<any>(`INSERT INTO marketplace_auctions(customer_id,title,description,public_description,job_area,job_address,requested_date,ceiling_paise,duration_days)
        VALUES($1,'Earthworks','Private access instructions','Public digging scope','Bengaluru','Private street and gate',current_date+10,100000,3) RETURNING id`,[customer])).rows[0].id;
      await f.login(other);assert.equal((await f.db.query('SELECT * FROM marketplace_auctions')).rows.length,0);
      let records=(await f.db.query<any>('SELECT marketplace_auction_records() AS auctions')).rows[0].auctions;
      assert.equal(records.find((a:any)=>a.id===auction).job_address,null);
      assert.equal(records.find((a:any)=>a.id===auction).description,'Public digging scope');
      await f.login(owner);await f.db.query('SELECT place_marketplace_bid($1,$2,80000,60)',[auction,id]);
      const bid=(await f.db.query<any>('SELECT id FROM marketplace_bids WHERE auction_id=$1',[auction])).rows[0].id;
      await f.login(customer);const awarded=(await f.db.query<any>('SELECT to_jsonb(award_marketplace_bid($1)) AS job',[bid])).rows[0].job;
      await f.login(owner);assert.equal((await f.db.query('SELECT * FROM marketplace_auctions')).rows.length,0);
      await f.db.query('SELECT accept_booking($1)',[awarded.id]);
      records=(await f.db.query<any>('SELECT marketplace_auction_records() AS auctions')).rows[0].auctions;
      assert.equal(records.find((a:any)=>a.id===auction).job_address,'Private street and gate');
      await f.login(other);await assert.rejects(f.request(id,11),/Not enough units/);
    });
    await t.test('dispatch and completion requests cannot be cancelled; issues block completion until reviewed',async()=>{
      const id=await f.machine();await f.login(customer);const job=await f.request(id);
      await f.login(owner);await f.db.query('SELECT accept_booking($1)',[job.id]);await f.db.query('SELECT advance_booking($1)',[job.id]);
      await f.login(customer);await assert.rejects(f.db.query('SELECT cancel_booking($1)',[job.id]),/issue review/);
      await f.login(owner);for(let i=0;i<3;i++)await f.db.query('SELECT advance_booking($1)',[job.id]);
      await f.login(other);await assert.rejects(f.db.query('SELECT report_booking_issue($1,$2)',[job.id,'Unrelated account issue']));
      await f.login(customer);await assert.rejects(f.db.query('SELECT cancel_booking($1)',[job.id]));
      await f.db.query('SELECT report_booking_issue($1,$2)',[job.id,'Work does not match the agreed scope']);
      await assert.rejects(f.db.query('SELECT complete_booking($1)',[job.id]),/resolution/);
      await f.admin();await f.db.query(`UPDATE booking_disputes SET status='RESOLVED' WHERE booking_id=$1`,[job.id]);
      await f.login(customer);await f.db.query('SELECT complete_booking($1)',[job.id]);
    });
    await t.test('equipment identity changes require re-verification, ordinary price edits do not',async()=>{
      const id=await f.machine();await f.login(owner);
      await f.db.query('UPDATE equipment SET base_rate_paise=20000 WHERE id=$1',[id]);
      assert.equal((await f.db.query<any>('SELECT is_verified FROM equipment WHERE id=$1',[id])).rows[0].is_verified,true);
      await f.db.query(`UPDATE equipment SET registration_number='NEW-REGISTRATION' WHERE id=$1`,[id]);
      assert.equal((await f.db.query<any>('SELECT is_verified FROM equipment WHERE id=$1',[id])).rows[0].is_verified,false);
      await assert.rejects(f.db.query('UPDATE equipment SET is_verified=true WHERE id=$1',[id]),/permission denied/);
      await f.login(customer);await assert.rejects(f.request(id),/unavailable/);
    });
    await t.test('same-account retries return original records and reject changed payloads',async()=>{
      const id=await f.machine(3);await f.login(customer);const key=randomUUID();
      const first=await f.request(id,1,8,1,key);const repeated=await f.request(id,1,8,1,key);
      assert.equal(first.id,repeated.id);
      assert.equal((await f.db.query<any>('SELECT count(*)::integer AS count FROM bookings WHERE equipment_id=$1',[id])).rows[0].count,1);
      await assert.rejects(f.request(id,1,9,1,key),/different booking details/);
      await f.login(other);const own=await f.request(id,1,8,1,key);assert.notEqual(own.id,first.id);
      await assert.rejects(f.request(id,1,8,1.5),/whole numbers/);
    });
  } finally { await f.db.close(); }
});

test('a committed save stays successful when refresh fails',async()=>{
  let saves=0;const failure=new Error('Offline');
  const result=await saveAndRefresh(async()=>{saves++;return {error:null}},async()=>{throw failure});
  assert.equal(result.saved,true);assert.equal(result.refreshError,failure);assert.equal(saves,1);
  await assert.rejects(saveAndRefresh(async()=>({error:failure}),async()=>{}),/Offline/);
});

test('browser retries reuse a request ID without storing private booking fields',async()=>{
  const values=new Map<string,string>();const storage={getItem:(key:string)=>values.get(key)||null,setItem:(key:string,value:string)=>{values.set(key,value)}};
  const payload={address:'Private street address',quantity:8};
  const first=await bookingRequestKey(customer,payload,storage);
  assert.equal(await bookingRequestKey(customer,payload,storage),first);
  assert.notEqual(await bookingRequestKey(customer,{...payload,quantity:9},storage),first);
  assert.ok(![...values.values()].join('').includes(payload.address));
});

test('real workspace static controls and messages have Hindi and Kannada translations',async()=>{
  const source=await readFile(new URL('../RealWorkspace.tsx',import.meta.url),'utf8');
  const labels=new Set([...source.matchAll(/\b(?:t|field|button)\('([^']+)'/g)].map(match=>match[1]));
  for(const label of ['Excavator','Borewell Rig','Tractor','Tipper','Motor Grader','Units must be whole numbers','Not enough units available in the selected period','Saved successfully. Refresh is temporarily unavailable.'])labels.add(label);
  for(const language of ['hi','kn'] as const)for(const label of labels)assert.ok(interfaceText(label,language),`${language}: missing ${label}`);
  assert.equal(interfaceText('Find equipment','en'),'Find equipment');
  assert.ok(!source.includes('key={language}'),'Language changes must not remount and erase forms');
});
