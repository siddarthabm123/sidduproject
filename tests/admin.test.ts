import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

test('admin review is role checked, audited and cannot release funded disputes',async()=>{
  const db=new PGlite({extensions:{pgcrypto}});
  const admin=randomUUID(),owner=randomUUID(),customer=randomUUID(),machine=randomUUID();
  const login=async(id:string)=>{await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('SET ROLE authenticated')};
  try{
    await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;CREATE SCHEMA storage;
      CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{}');
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text,name text);ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
      GRANT USAGE ON SCHEMA auth,storage TO authenticated,anon;GRANT SELECT,INSERT ON storage.objects TO authenticated;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon,authenticated;`);
    for(const file of ['20260920000100_riglogix_core.sql','20260920000200_riglogix_rls.sql','20260920000400_auth_wallet_booking_workflows.sql','20260920000500_lock_direct_financial_updates.sql',
      'supabase/migrations/20260926000700_aadhaar_email_verification.sql','supabase/migrations/20260927000800_user_app_state.sql','supabase/migrations/20261008000900_secure_marketplace.sql','supabase/migrations/20261010001000_marketplace_reservations.sql',
      'supabase/migrations/20261012001100_payment_escrow.sql','supabase/migrations/20261012001200_fuel_hub.sql','supabase/migrations/20261012001300_workforce.sql','supabase/migrations/20261017001400_explicit_rpc_permissions.sql','supabase/migrations/20261017001500_booking_quantities.sql','supabase/migrations/20261017001600_payment_submission_guard.sql','supabase/migrations/20261018001700_admin_review.sql'])await db.exec(await readFile(new URL(`../${file}`,import.meta.url),'utf8'));
    for(const [id,role] of [[admin,'customer'],[owner,'owner'],[customer,'customer']])await db.query('INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)',[id,`${id}@test.local`,{role,full_name:role,workspace_name:role}]);
    await db.query("INSERT INTO platform_admins(user_id) VALUES($1)",[admin]);
    await db.query(`INSERT INTO equipment(id,owner_id,title,sector,category,pricing_unit,base_rate_paise,telematics_id) VALUES($1::uuid,$2,'Test excavator','Construction','Excavator','hour',10000,$1::text)`,[machine,owner]);
    for(const name of ['admin_review_queue()','admin_review_equipment(uuid,boolean,text)','admin_resolve_booking_issue(uuid,text)','admin_fuel_access(uuid,boolean,boolean,uuid,boolean)'])assert.equal((await db.query<any>("SELECT has_function_privilege('anon',$1,'EXECUTE') AS allowed",[name])).rows[0].allowed,false);
    await login(owner);await assert.rejects(db.query('SELECT admin_review_queue()'),/Admin review/);
    await assert.rejects(db.query('INSERT INTO platform_admins(user_id) VALUES($1)',[owner]),/permission denied/);
    await assert.rejects(db.query("SELECT admin_review_equipment($1,true,'Reviewed registration')",[machine]),/Admin review/);
    await login(admin);assert.equal((await db.query<any>('SELECT admin_access() AS allowed')).rows[0].allowed,true);
    assert.equal((await db.query<any>('SELECT role FROM users WHERE id=$1',[admin])).rows[0].role,'customer');
    await assert.rejects(db.query("SELECT admin_review_equipment($1,true,'')",[machine]),/reason/);
    await db.query("SELECT admin_review_equipment($1,true,'Reviewed registration and ownership')",[machine]);
    const queue=(await db.query<any>('SELECT admin_review_queue() AS q')).rows[0].q;assert.equal(queue.equipment[0].is_verified,true);
    await db.query('SELECT admin_fuel_access($1,true,true)',[owner]);
    await login(customer);const job=(await db.query<any>("SELECT request_equipment_booking($1,current_date+1,'Private site address',12,77,8) AS jobs",[[{equipment_id:machine,units:1}]])).rows[0].jobs[0];
    await db.exec('RESET ROLE');await db.query("INSERT INTO booking_disputes(booking_id,reporter_id,reason) VALUES($1,$2,'Disputed site instructions')",[job.id,customer]);
    await login(admin);await db.query("SELECT admin_resolve_booking_issue($1,'Both parties agreed to the revised site instructions')",[job.id]);
    await db.exec('RESET ROLE');assert.equal((await db.query<any>('SELECT status FROM booking_disputes WHERE booking_id=$1',[job.id])).rows[0].status,'RESOLVED');
    await db.query("UPDATE bookings SET amount_paid_paise=1 WHERE id=$1",[job.id]);
    await db.query("UPDATE booking_disputes SET status='OPEN' WHERE booking_id=$1",[job.id]);
    await login(admin);await assert.rejects(db.query("SELECT admin_resolve_booking_issue($1,'Do not release funded disputes through admin review')",[job.id]),/reconciliation/);
  }finally{await db.close()}
});
