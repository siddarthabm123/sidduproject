import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import fuelHandler from '../api/fuel';
import { coordinates, distanceKm, effectiveStatus, nearbyBunks, savings, validQuantity } from '../fuel/domain';
import { demoBunks } from '../fuel/demo';
import { fuelText } from '../fuel/labels';

test('voucher print sheet is portalled outside the hidden dashboard and waits for the QR',async()=>{
  const css=await readFile(new URL('../fuel.css',import.meta.url),'utf8');
  const source=await readFile(new URL('../FuelHubPage.tsx',import.meta.url),'utf8');
  assert.ok(!css.includes('visibility:hidden!important'));
  assert.ok(css.includes('body:has(>.fuel-print-sheet)>:not(.fuel-print-sheet){display:none!important}'));
  assert.match(source,/createPortal\(<section ref=\{printSheet\}/);
  assert.match(source,/<\/section>,document\.body\)/);
  assert.match(source,/image\?\.decode\(\)/);
  assert.match(source,/addEventListener\('afterprint',finished\)/);
});

test('fuel distance, filter, currency and quantity domain rules',()=>{
  assert.equal(coordinates(91,77),false);assert.equal(coordinates(NaN,77),false);assert.equal(coordinates(12,Infinity),false);
  assert.equal(distanceKm(12.97,77.6,12.97,77.6),0);
  assert.ok(distanceKm(0,179.9,0,-179.9)<23);
  assert.equal(savings(125.25,0.5),62.63);assert.equal(savings(100,1),100);
  for(const n of [0,-1,2001,Infinity,NaN,1.001])assert.equal(validQuantity(n),false);
  assert.equal(validQuantity(2000),true);assert.equal(validQuantity(1.01),true);
  const filtered=nearbyBunks(demoBunks,12.97,77.6,5,'petrol',true);
  assert.equal(filtered.length,1);assert.equal(filtered[0].id,'demo-1');
  const all=nearbyBunks(demoBunks,12.97,77.6,25,'diesel',false);
  assert.equal(all.length,5);assert.ok(all.every((v,i)=>!i||v.distance_km>=all[i-1].distance_km));
  assert.equal(effectiveStatus('GENERATED','2020-01-01',Date.now()),'EXPIRED');
  assert.equal(effectiveStatus('REDEEMED','2020-01-01',Date.now()),'REDEEMED');
  assert.notEqual(fuelText('Generate Discount Voucher','kn'),'Generate Discount Voucher');
  assert.notEqual(fuelText('Fuel Bunks & Partner Discounts','hi'),'Fuel Bunks & Partner Discounts');
});

test('fuel HTTP endpoints reject unknown routes, wrong methods and unauthenticated access',async()=>{
  const invoke=async(method:string,route:string)=>{
    let code=0;let result:any;const headers:Record<string,string>={};
    const res={status(n:number){code=n;return this},json(v:unknown){result=v},setHeader(k:string,v:string){headers[k]=v}};
    await fuelHandler({method,query:{route},headers:{}},res);return {code,result,headers};
  };
  assert.equal((await invoke('GET','unknown')).code,404);
  const wrong=await invoke('GET','vouchers/generate');assert.equal(wrong.code,405);assert.equal(wrong.headers.Allow,'POST');
  for(const route of ['bunks/nearby','context','vouchers'])assert.equal((await invoke('GET',route)).code,401);
  for(const route of ['bunks','vouchers/generate','vouchers/redeem'])assert.equal((await invoke('POST',route)).code,401);
});

test('PostgreSQL fuel hub permissions and voucher transaction lifecycle',async t=>{
  const db=new PGlite({extensions:{pgcrypto}});
  const owner=randomUUID(),other=randomUUID(),customer=randomUUID(),staff=randomUUID(),outsider=randomUUID(),admin=randomUUID();
  const bunk=randomUUID(),standard=randomUUID(),far=randomUUID(),machine=randomUUID(),foreignMachine=randomUUID();
  const login=async(id:string,role='authenticated')=>{await db.exec('RESET ROLE');await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`,[id]);await db.exec(`SET ROLE ${role}`)};
  const root=async()=>{await db.exec('RESET ROLE')};
  const generate=async(request=randomUUID(),quantity=100,station=bunk,equipment:string|null=null)=>(await db.query<any>(`SELECT generate_fuel_voucher($1,'DIESEL',$2,$3,$4) AS v`,[station,quantity,request,equipment])).rows[0].v;
  try{
    await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;CREATE SCHEMA app_private;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO anon,authenticated;`);
    await db.exec(await readFile(new URL('../20260920000100_riglogix_core.sql',import.meta.url),'utf8'));
    await db.exec('CREATE SCHEMA extensions; ALTER EXTENSION pgcrypto SET SCHEMA extensions;');
    await db.exec('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon,authenticated; ALTER DEFAULT PRIVILEGES IN SCHEMA app_private GRANT EXECUTE ON FUNCTIONS TO anon,authenticated;');
    await db.exec(await readFile(new URL('../supabase/migrations/20261012001200_fuel_hub.sql',import.meta.url),'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/20261017001400_explicit_rpc_permissions.sql',import.meta.url),'utf8'));
    const permissions=(await db.query<any>(`SELECT has_function_privilege('anon','fuel_hub_context()','EXECUTE') AS anonymous_context,has_function_privilege('authenticated','app_private.fuel_actor()','EXECUTE') AS direct_helper,has_function_privilege('anon','verify_fuel_voucher(uuid,uuid)','EXECUTE') AS public_qr`)).rows[0];
    assert.deepEqual(permissions,{anonymous_context:false,direct_helper:false,public_qr:true});
    for(const [id,role] of [[owner,'owner'],[other,'owner'],[customer,'customer'],[staff,'customer'],[outsider,'customer'],[admin,'admin']])await db.query(`INSERT INTO users(id,role,full_name,workspace_name,email) VALUES($1::uuid,$2::user_role,$2::text,$2::text,$1::text||'@test.local')`,[id,role]);
    for(const [id,partner,lat] of [[bunk,true,12.973],[standard,false,12.99],[far,true,13.5]])await db.query(`INSERT INTO fuel_bunks(id,name,brand,address,latitude,longitude,is_partner,discount_per_litre,fuel_types_available) VALUES($1,'Test fuel station','BPCL','Test station address',$2,77.6,$3,CASE WHEN $3 THEN 0.5 ELSE 0 END,ARRAY['diesel','petrol'])`,[id,lat,partner]);
    await db.query(`INSERT INTO fuel_bunk_staff(bunk_id,user_id) VALUES($1,$2)`,[bunk,staff]);
    for(const [id,user] of [[machine,owner],[foreignMachine,other]])await db.query(`INSERT INTO equipment(id,owner_id,title,sector,category,pricing_unit,base_rate_paise,telematics_id,current_lat,current_lng) VALUES($1::uuid,$2,'Excavator','Construction','Excavator','hour',10000,$1::text,12.97,77.6)`,[id,user]);
    await t.test('nearby stations are sorted, filtered and guarded',async()=>{
      await login(owner);
      const rows=(await db.query<any>(`SELECT fuel_bunks_nearby(12.97,77.6,5,'diesel',false) AS b`)).rows[0].b;
      assert.equal(rows.length,2);assert.equal(rows[0].id,bunk);assert.ok(rows[0].distance_km<rows[1].distance_km);
      assert.equal((await db.query<any>(`SELECT fuel_bunks_nearby(12.97,77.6,5,'petrol',true) AS b`)).rows[0].b.length,1);
      await assert.rejects(db.query(`SELECT fuel_bunks_nearby(91,77.6,5,'diesel',false)`),/Invalid/);
      await assert.rejects(db.query(`SELECT fuel_bunks_nearby(12.97,77.6,100,'diesel',false)`),/Invalid/);
      await login(customer);await assert.rejects(db.query(`SELECT fuel_hub_context()`),/not permitted/);
      await login('', 'anon');await assert.rejects(db.query(`SELECT fuel_bunks_nearby(12.97,77.6,5,'diesel',false)`),/permission denied/);
    });
    await t.test('only explicitly authorized partners can register and approve discounts',async()=>{
      const data={name:'Partner test pump',brand:'HPCL',address:'Partner test address',latitude:12.97,longitude:77.6,is_partner:true,discount_per_litre:1,fuel_types_available:['diesel'],contact_phone:''};
      await login(owner);await assert.rejects(db.query('SELECT register_fuel_bunk($1)',[data]),/permission required/);
      await assert.rejects(db.query(`INSERT INTO fuel_partner_access(user_id,can_register) VALUES($1,true)`,[owner]),/permission denied/);
      await root();await db.query(`INSERT INTO fuel_partner_access(user_id,can_register) VALUES($1,true)`,[owner]);
      await login(owner);await assert.rejects(db.query('SELECT register_fuel_bunk($1)',[data]),/permission required/);
      const row=(await db.query<any>('SELECT register_fuel_bunk($1) AS b',[{...data,is_partner:false}])).rows[0].b;
      assert.equal(row.discount_per_litre,0);
      await login(admin);assert.equal((await db.query<any>('SELECT register_fuel_bunk($1) AS b',[data])).rows[0].b.is_partner,true);
    });
    await t.test('voucher discounts are server-derived, idempotent and scoped to owned equipment',async()=>{
      await login(owner);const key=randomUUID();const row=await generate(key,125.25,bunk,machine);
      assert.match(row.voucher_code,/^[A-F0-9]{8}$/);assert.equal(row.estimated_savings,62.63);assert.equal(row.discount_rate,0.5);
      assert.equal((await generate(key,125.25,bunk,machine)).id,row.id);
      await assert.rejects(generate(key,100,bunk,machine),/different voucher/);
      await assert.rejects(generate(randomUUID(),100,bunk,foreignMachine),/own fleet/);
      await assert.rejects(generate(randomUUID(),100,standard),/unavailable/);
      await assert.rejects(generate(randomUUID(),0),/Invalid/);await assert.rejects(generate(randomUUID(),1.001),/Invalid/);
      await assert.rejects(db.query('UPDATE fuel_vouchers SET discount_rate=10'),/permission denied/);
      await login(other);const list=(await db.query<any>('SELECT my_fuel_vouchers() AS v')).rows[0].v;assert.equal(list.length,0);
      await assert.rejects(db.query('SELECT * FROM fuel_vouchers'),/permission denied/);
    });
    await t.test('QR verification works anonymously without exposing owner or equipment information',async()=>{
      await login(owner);const row=await generate();await login('','anon');
      const verify=(await db.query<any>('SELECT verify_fuel_voucher($1,$2) AS v',[row.id,row.verification_token])).rows[0].v;
      assert.equal(verify.voucher_code,row.voucher_code);assert.equal(verify.status,'GENERATED');
      for(const field of ['owner_id','equipment_id','verification_token','contact_phone','request_id'])assert.equal(field in verify,false);
      assert.equal((await db.query<any>('SELECT verify_fuel_voucher($1,$2) AS v',[row.id,randomUUID()])).rows[0].v,null);
    });
    await t.test('redemption is single-use, assigned-staff only and quantity constrained',async()=>{
      await login(owner);const row=await generate();
      await assert.rejects(db.query('SELECT redeem_fuel_voucher($1,$2,100)',[row.id,row.verification_token]),/Assigned/);
      await login(outsider);await assert.rejects(db.query('SELECT redeem_fuel_voucher($1,$2,100)',[row.id,row.verification_token]),/not permitted/);
      await root();await db.query(`INSERT INTO fuel_bunk_staff(bunk_id,user_id) VALUES($1,$2)`,[standard,outsider]);
      await login(outsider);await assert.rejects(db.query('SELECT redeem_fuel_voucher($1,$2,100)',[row.id,row.verification_token]),/Assigned/);
      await login(staff);await assert.rejects(db.query('SELECT redeem_fuel_voucher($1,$2,101)',[row.id,row.verification_token]),/Invalid/);
      const result=(await db.query<any>('SELECT redeem_fuel_voucher($1,$2,80) AS v',[row.id,row.verification_token])).rows[0].v;
      assert.equal(result.status,'REDEEMED');assert.equal(result.actual_savings,40);
      await assert.rejects(db.query('SELECT redeem_fuel_voucher($1,$2,80)',[row.id,row.verification_token]),/no longer active/);
    });
    await t.test('expired vouchers cannot be redeemed and equipment centers remain private',async()=>{
      await login(owner);const row=await generate();const context=(await db.query<any>('SELECT fuel_hub_context() AS c')).rows[0].c;
      assert.equal(context.equipment.length,1);assert.equal(context.centers.length,1);
      await root();await db.query(`UPDATE fuel_vouchers SET created_at=now()-interval '2 days',expires_at=now()-interval '1 hour' WHERE id=$1`,[row.id]);
      await login(staff);const result=(await db.query<any>('SELECT redeem_fuel_voucher($1,$2,50) AS v',[row.id,row.verification_token])).rows[0].v;
      assert.equal(result.status,'EXPIRED');
      await login(owner);const list=(await db.query<any>('SELECT my_fuel_vouchers() AS v')).rows[0].v;assert.equal(list.find((v:any)=>v.id===row.id).status,'EXPIRED');
    });
  }finally{await db.close()}
});
