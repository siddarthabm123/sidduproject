import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import Stripe from 'stripe';
import { StripeGateway } from '../payments/gateway';
import type { PaymentGateway, CapturedIntent, PaymentJob } from '../payments/gateway';
import { EscrowService, processGatewayEvent, runPaymentWorker } from '../payments/service';
import type { PaymentDatabase } from '../payments/service';
import { paymentHandler } from '../payments/http';

const contractor='10000000-0000-0000-0000-000000000001',vendor='20000000-0000-0000-0000-000000000001',other='10000000-0000-0000-0000-000000000002';
test('payment worker refuses a database without a submission lock',async()=>{
  let calls=0;
  await assert.rejects(runPaymentWorker({rpc:async()=>{calls++;return {data:[],error:null}}},new MockGateway()),/Transactional payment submission/);
  assert.equal(calls,0);
});
class MockGateway implements PaymentGateway {
  intents=new Map<string,CapturedIntent>();submissions=new Map<string,string>();calls:string[]=[];failAfterTransfer=false;
  async retrieveIntent(id:string){const value=this.intents.get(id);if(!value)throw new Error('Intent not found');return value}
  verifyWebhook(raw:Buffer,signature:string){if(signature!=='test-valid')throw new Error('Invalid signature');return JSON.parse(raw.toString())}
  async submitJob(job:PaymentJob){
    this.calls.push(job.id);
    const id=this.submissions.get(job.id)||`${job.kind==='PAYOUT'?'tr':'re'}_${job.id.replaceAll('-','')}`;
    this.submissions.set(job.id,id);
    if(this.failAfterTransfer){this.failAfterTransfer=false;throw new Error('Response lost after provider accepted payment')}
    return id;
  }
}

async function fixture() {
  const db=new PGlite({extensions:{pgcrypto}});
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{}');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;`);
  for(const file of ['20260920000100_riglogix_core.sql','20260920000200_riglogix_rls.sql','20260920000400_auth_wallet_booking_workflows.sql','20260920000500_lock_direct_financial_updates.sql','supabase/migrations/20260926000700_aadhaar_email_verification.sql','supabase/migrations/20260927000800_user_app_state.sql','supabase/migrations/20261008000900_secure_marketplace.sql','supabase/migrations/20261010001000_marketplace_reservations.sql','supabase/migrations/20261012001100_payment_escrow.sql','supabase/migrations/20261017001400_explicit_rpc_permissions.sql']) {
    await db.exec(await readFile(new URL(`../${file}`,import.meta.url),'utf8'));
  }
  for(const [id,role] of [[contractor,'customer'],[vendor,'owner'],[other,'customer']])await db.query('INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)',[id,id+'@example.test',{role,full_name:role,workspace_name:role}]);
  await db.query(`INSERT INTO payment_accounts(user_id,customer_reference,vendor_destination,payout_enabled) VALUES($1,'cus_contractor',NULL,false),($2,NULL,'acct_vendor',true)`,[contractor,vendor]);
  const login=async(actor:string,role='authenticated')=>{await db.exec('RESET ROLE');await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`,[actor]);await db.exec(`SET ROLE ${role}`)};
  const admin=async()=>{await db.exec('RESET ROLE');await db.query(`SELECT set_config('request.jwt.claim.sub','',false)`)};
  const adapter=(actor:string,role='authenticated'):PaymentDatabase=>({rpc:async(name,args)=>{
    try{await login(actor,role);const values=Object.values(args),parameters=Object.keys(args).map((key,i)=>`${key}=>$${i+1}`).join(',');
      return {data:(await db.query<any>(`SELECT to_jsonb(public.${name}(${parameters})) AS value`,values)).rows[0].value,error:null};
    }catch(error){return {data:null,error}}
  }});
  const privileged=adapter('','service_role'),gateway=new MockGateway();
  await db.exec(await readFile(new URL('../supabase/migrations/20261017001600_payment_submission_guard.sql',import.meta.url),'utf8'));
  privileged.withSubmissionLock=async(_job,action)=>{await db.exec('BEGIN');try{const result=await action(privileged);await db.exec('COMMIT');return result}catch(error){await db.exec('ROLLBACK');throw error}};
  const service=(actor=contractor)=>new EscrowService(adapter(actor),()=>privileged,()=>gateway);
  const booking=async()=>{
    await admin();const machine=randomUUID();await db.query(`INSERT INTO equipment(id,owner_id,title,sector,category,pricing_unit,base_rate_paise,telematics_id,is_verified) VALUES($1,$2,'Excavator','Construction','Excavator','hour',10000,$3,true)`,[machine,vendor,machine]);
    await login(contractor);return (await db.query<any>(`SELECT request_equipment_booking($1,current_date+1,'Test private job site',12.97,77.6,8,'') AS jobs`,[[{equipment_id:machine,units:1}]])).rows[0].jobs[0];
  };
  const credit=async(amount=1000000)=>processGatewayEvent({id:`evt_${randomUUID()}`,type:'payment_intent.succeeded',object:{id:addIntent(amount,'balance')}},gateway,privileged);
  const addIntent=(amount:number,purpose:string,job?:string,request=randomUUID())=>{
    const id=`pi_${randomUUID().replaceAll('-','')}`;
    gateway.intents.set(id,{id,status:'succeeded',amount,currency:'inr',customer:'cus_contractor',metadata:{purpose,contractor_id:contractor,...(job?{booking_id:job,request_id:request}:{})}});
    return id;
  };
  const progress=async(job:string)=>{await login(vendor);for(let i=0;i<4;i++)await db.query('SELECT advance_booking($1)',[job])};
  const inspection=async(job:string,damage=false)=>{
    await progress(job);return service(vendor).inspect({booking_id:job,damage_flag:damage,notes:damage?'Damage to hydraulic assembly':'Returned without damage'});
  };
  const read=async(sql:string,values:unknown[]=[])=>{await admin();return (await db.query<any>(sql,values)).rows};
  return {db,login,admin,privileged,gateway,service,booking,credit,addIntent,inspection,read};
}

test('transactional escrow, inspection, webhook and factoring integration',async t=>{
  const f=await fixture();
  try {
    await t.test('only verified receipts credit balances; duplicate events/intents cannot credit twice',async()=>{
      const id=f.addIntent(1000000,'balance'),event={id:'evt_topup',type:'payment_intent.succeeded',object:{id}};
      await processGatewayEvent(event,f.gateway,f.privileged);await processGatewayEvent(event,f.gateway,f.privileged);
      await processGatewayEvent({...event,id:'evt_topup_duplicate_intent'},f.gateway,f.privileged);
      assert.equal((await f.read('SELECT available_amount FROM payment_balances WHERE contractor_id=$1',[contractor]))[0].available_amount,1000000);
      await f.login(contractor);await assert.rejects(f.db.query('UPDATE payment_balances SET available_amount=999999999'));
      await assert.rejects(f.db.query(`SELECT apply_payment_event('forged','{}')`),/permission denied/);
    });
    await t.test('balance lock is atomic and idempotent and rollback preserves an underfunded booking',async()=>{
      const job=await f.booking(),key=randomUUID(),before=(await f.read('SELECT available_amount FROM payment_balances'))[0].available_amount;
      const first=await f.service().lock({booking_id:job.id,source:'balance'},key);
      const duplicate=await f.service().lock({booking_id:job.id,source:'balance'},key);assert.equal(first.id,duplicate.id);
      assert.equal(first.status,'HOLDING');assert.equal(first.locked_amount,82800);
      assert.equal((await f.read('SELECT available_amount FROM payment_balances'))[0].available_amount,before-82800);
      assert.equal((await f.read('SELECT status FROM bookings WHERE id=$1',[job.id]))[0].status,'confirmed');
      await assert.rejects(f.service(other).lock({booking_id:job.id,source:'balance'},randomUUID()),/Contractor/);
      const underfunded=await f.booking();await f.admin();await f.db.query('UPDATE payment_balances SET available_amount=0 WHERE contractor_id=$1',[contractor]);
      await assert.rejects(f.service().lock({booking_id:underfunded.id,source:'balance'},randomUUID()),/Insufficient/);
      assert.equal((await f.read('SELECT status FROM bookings WHERE id=$1',[underfunded.id]))[0].status,'pending');
      assert.equal((await f.read('SELECT count(*)::integer AS count FROM payment_escrows WHERE booking_id=$1',[underfunded.id]))[0].count,0);
      await f.credit();
    });
    await t.test('captured card intent must match contractor, booking, amount, currency and request',async()=>{
      const job=await f.booking(),key=randomUUID(),id=f.addIntent(82800,'escrow',job.id,key);
      f.gateway.intents.get(id)!.status='requires_capture';
      await assert.rejects(f.service().lock({booking_id:job.id,source:'card',payment_intent_id:id},key),/not been captured/);
      f.gateway.intents.get(id)!.status='succeeded';f.gateway.intents.get(id)!.customer='cus_other';
      await assert.rejects(f.service().lock({booking_id:job.id,source:'card',payment_intent_id:id},key),/does not belong/);
      f.gateway.intents.get(id)!.customer='cus_contractor';
      f.gateway.intents.get(id)!.currency='usd';
      await assert.rejects(f.service().lock({booking_id:job.id,source:'card',payment_intent_id:id},key),/currency mismatch/);
      f.gateway.intents.get(id)!.currency='inr';
      const escrow=await f.service().lock({booking_id:job.id,source:'card',payment_intent_id:id},key);assert.equal(escrow.status,'HOLDING');
      await processGatewayEvent({id:'evt_card_replay',type:'payment_intent.succeeded',object:{id}},f.gateway,f.privileged);
      assert.equal((await f.read('SELECT count(*)::integer AS count FROM payment_escrows WHERE booking_id=$1',[job.id]))[0].count,1);
      const mismatch=await f.booking(),mismatchKey=randomUUID(),mismatchIntent=f.addIntent(100,'escrow',mismatch.id,mismatchKey);
      await assert.rejects(f.service().lock({booking_id:mismatch.id,source:'card',payment_intent_id:mismatchIntent},mismatchKey),/Refund/);
      assert.equal((await f.read('SELECT status FROM payment_receipts WHERE payment_intent_id=$1',[mismatchIntent]))[0].status,'REFUND_PENDING');
    });
    await t.test('damage-free sign-off queues exactly one 7.5% commission payout due within 48 hours',async()=>{
      const job=await f.booking();await f.service().lock({booking_id:job.id,source:'balance'},randomUUID());
      await assert.rejects(f.service().release(job.id),/signed-off/);
      const log=await f.inspection(job.id);await assert.rejects(f.service(vendor).signOff(log.id),/Contractor/);
      await f.service().signOff(log.id);await f.service().signOff(log.id);
      const escrow=await f.service().release(job.id);assert.equal(escrow.status,'HOLDING');assert.equal(escrow.commission_amount,6210);assert.equal(escrow.payout_amount,76590);
      assert.equal(Date.parse(escrow.payout_due_date)-Date.parse(escrow.release_requested_at),48*3600000);
      assert.equal((await f.read(`SELECT count(*)::integer AS count FROM payment_jobs WHERE escrow_id=$1 AND kind='PAYOUT'`,[escrow.id]))[0].count,1);
      f.gateway.failAfterTransfer=true;let result=await runPaymentWorker(f.privileged,f.gateway);assert.ok(result.failed>=1);
      await f.admin();await f.db.exec(`UPDATE payment_jobs SET available_at=now(),lease_until=now()-interval '1 minute' WHERE status IN('PENDING','PROCESSING')`);
      result=await runPaymentWorker(f.privileged,f.gateway);assert.ok(result.submitted>=1);
      const payout=(await f.read(`SELECT * FROM payment_jobs WHERE escrow_id=$1 AND kind='PAYOUT'`,[escrow.id]))[0];
      const event={id:'evt_vendor_transfer',type:'transfer.created',object:{id:payout.provider_reference,amount:payout.amount,currency:'inr',destination:'acct_vendor',metadata:{rigdesk_job_id:payout.id}}};
      await processGatewayEvent(event,f.gateway,f.privileged);await processGatewayEvent(event,f.gateway,f.privileged);
      assert.equal((await f.read('SELECT status FROM payment_escrows WHERE id=$1',[escrow.id]))[0].status,'RELEASED');
      assert.equal((await f.read(`SELECT sum(amount)::bigint AS total FROM payment_ledger WHERE escrow_id=$1 AND kind IN('COMMISSION','VENDOR_PAYOUT')`,[escrow.id]))[0].total,82800);
      const altered={...event,id:'evt_wrong_amount',object:{...event.object,amount:payout.amount+1}};
      await assert.rejects(processGatewayEvent(altered,f.gateway,f.privileged),/mismatch/);
    });
    await t.test('damage and ordinary booking issues freeze funds and prevent release',async()=>{
      const job=await f.booking();const escrow=await f.service().lock({booking_id:job.id,source:'balance'},randomUUID());
      const log=await f.inspection(job.id,true);await assert.rejects(f.service().signOff(log.id),/damage-free/);
      await assert.rejects(f.service().release(job.id),/signed-off/);
      assert.equal((await f.read('SELECT status FROM payment_escrows WHERE id=$1',[escrow.id]))[0].status,'DISPUTED');
      const another=await f.booking();const anotherEscrow=await f.service().lock({booking_id:another.id,source:'balance'},randomUUID());
      const clean=await f.inspection(another.id);await f.login(contractor);
      await f.db.query('SELECT report_booking_issue($1,$2)',[another.id,'Operator did not finish the scope']);
      assert.equal((await f.read('SELECT status FROM payment_escrows WHERE id=$1',[anotherEscrow.id]))[0].status,'DISPUTED');
      await assert.rejects(f.service().signOff(clean.id));
    });
    await t.test('a dispute committed after claim blocks submission and preserves reconciliation',async()=>{
      const job=await f.booking();const escrow=await f.service().lock({booking_id:job.id,source:'balance'},randomUUID());
      const log=await f.inspection(job.id);await f.service().signOff(log.id);
      const claimed=await f.privileged.rpc('claim_payment_jobs',{p_limit:10});
      const payout=claimed.data.find((j:any)=>j.escrow_id===escrow.id);assert.ok(payout);
      await f.login(contractor);await f.db.query(`SELECT report_booking_issue($1,'Customer disputes completed scope')`,[job.id]);
      const valid=await f.privileged.rpc('validate_payment_job',{p_job:payout.id,p_lease:payout.lease_token});assert.equal(valid.data,false);
      const record=(await f.read('SELECT * FROM payment_jobs WHERE id=$1',[payout.id]))[0];
      assert.equal(record.reconciliation_required,true);assert.equal(record.status,'PROCESSING');
      const before=f.gateway.calls.length;await runPaymentWorker(f.privileged,f.gateway);assert.equal(f.gateway.calls.length,before);
    });
    await t.test('pre-dispatch refunds are idempotent and card refunds wait for gateway confirmation',async()=>{
      const job=await f.booking(),key=randomUUID();await f.service().lock({booking_id:job.id,source:'balance'},key);
      const before=(await f.read('SELECT available_amount FROM payment_balances'))[0].available_amount;
      await f.service().refund(job.id);await f.service().refund(job.id);
      assert.equal((await f.read('SELECT available_amount FROM payment_balances'))[0].available_amount,before+82800);
      const cardJob=await f.booking(),cardKey=randomUUID(),id=f.addIntent(82800,'escrow',cardJob.id,cardKey);
      const cardEscrow=await f.service().lock({booking_id:cardJob.id,source:'card',payment_intent_id:id},cardKey);
      await f.service().refund(cardJob.id);await f.service().refund(cardJob.id);
      assert.equal((await f.read('SELECT status FROM payment_escrows WHERE id=$1',[cardEscrow.id]))[0].status,'HOLDING');
      await runPaymentWorker(f.privileged,f.gateway);
      const refund=(await f.read(`SELECT * FROM payment_jobs WHERE escrow_id=$1 AND kind='REFUND'`,[cardEscrow.id]))[0];
      await processGatewayEvent({id:'evt_refund',type:'refund.updated',object:{id:refund.provider_reference,status:'succeeded',amount:refund.amount,currency:'inr',payment_intent:id,metadata:{rigdesk_job_id:refund.id}}},f.gateway,f.privileged);
      assert.equal((await f.read('SELECT status FROM payment_escrows WHERE id=$1',[cardEscrow.id]))[0].status,'REFUNDED');
    });
    await t.test('factoring accepts only the vendor deferred receivable, never an escrow-funded invoice',async()=>{
      const job=await f.booking();await f.login(vendor);await f.db.query('SELECT accept_booking($1)',[job.id]);
      const log=await f.inspection(job.id);await f.service().signOff(log.id);
      const invoice=(await f.read('SELECT * FROM payment_invoices WHERE booking_id=$1',[job.id]))[0];
      await assert.rejects(f.service().factor(invoice.id,randomUUID()),/deferred invoice/);
      const first=await f.service(vendor).factor(invoice.id,randomUUID()),second=await f.service(vendor).factor(invoice.id,randomUUID());
      assert.equal(first.id,second.id);assert.equal(first.status,'REQUESTED');
      const funded=(await f.read('SELECT id FROM payment_invoices WHERE escrow_id IS NOT NULL LIMIT 1'))[0];
      await assert.rejects(f.service(vendor).factor(funded.id,randomUUID()),/deferred invoice/);
      await f.login(vendor);await assert.rejects(f.db.query(`UPDATE invoice_factoring_requests SET status='FUNDED'`));
    });
    await t.test('chargeback hooks cancel queued payouts; unrelated parties cannot read escrow records',async()=>{
      const job=await f.booking(),key=randomUUID(),id=f.addIntent(82800,'escrow',job.id,key);
      const escrow=await f.service().lock({booking_id:job.id,source:'card',payment_intent_id:id},key);
      const log=await f.inspection(job.id);await f.service().signOff(log.id);
      await processGatewayEvent({id:'evt_chargeback',type:'charge.dispute.created',object:{payment_intent:id}},f.gateway,f.privileged);
      assert.equal((await f.read('SELECT status FROM payment_escrows WHERE id=$1',[escrow.id]))[0].status,'DISPUTED');
      assert.equal((await f.read(`SELECT status FROM payment_jobs WHERE escrow_id=$1 AND kind='PAYOUT'`,[escrow.id]))[0].status,'CANCELLED');
      await f.login(other);assert.equal((await f.db.query('SELECT * FROM payment_escrows')).rows.length,0);
    });
    await t.test('balance top-up chargebacks freeze available credit and unsettled balance-funded escrow',async()=>{
      const id=f.addIntent(200000,'balance');await processGatewayEvent({id:'evt_disputed_topup',type:'payment_intent.succeeded',object:{id}},f.gateway,f.privileged);
      const job=await f.booking(),escrow=await f.service().lock({booking_id:job.id,source:'balance'},randomUUID());
      await processGatewayEvent({id:'evt_balance_chargeback',type:'charge.dispute.created',object:{payment_intent:id}},f.gateway,f.privileged);
      assert.equal((await f.read('SELECT frozen FROM payment_balances WHERE contractor_id=$1',[contractor]))[0].frozen,true);
      assert.equal((await f.read('SELECT status FROM payment_escrows WHERE id=$1',[escrow.id]))[0].status,'DISPUTED');
      const blocked=await f.booking();await assert.rejects(f.service().lock({booking_id:blocked.id,source:'balance'},randomUUID()),/Insufficient/);
    });
  } finally {await f.db.close()}
});

test('official Stripe verifier rejects tampered and stale raw-body signatures',()=>{
  const secret='whsec_test_fixture',raw=JSON.stringify({id:'evt_signature',type:'payment_intent.succeeded',livemode:false,data:{object:{id:'pi_fixture'}}});
  const client=new Stripe('sk_test_fixture'),gateway=new StripeGateway('sk_test_fixture',secret);
  process.env.PAYMENTS_LIVE_MODE='false';
  const signature=client.webhooks.generateTestHeaderString({payload:raw,secret});
  assert.equal(gateway.verifyWebhook(Buffer.from(raw),signature).id,'evt_signature');
  assert.throws(()=>gateway.verifyWebhook(Buffer.from(raw+' '),signature));
  const stale=client.webhooks.generateTestHeaderString({payload:raw,secret,timestamp:Math.floor(Date.now()/1000)-600});
  assert.throws(()=>gateway.verifyWebhook(Buffer.from(raw),stale));
  const accountEvent=JSON.stringify({...JSON.parse(raw),account:'acct_untrusted'});
  const accountSignature=client.webhooks.generateTestHeaderString({payload:accountEvent,secret});
  assert.throws(()=>gateway.verifyWebhook(Buffer.from(accountEvent),accountSignature),/Platform/);
});

test('HTTP handlers gate configuration, require authentication and reject forged webhooks',async()=>{
  const res=()=>({code:200,body:null as any,setHeader(){},status(code:number){this.code=code;return this},json(body:any){this.body=body;return this}});
  const gateway=new MockGateway(),database:PaymentDatabase={rpc:async()=>({data:null,error:null})};
  const deps={authenticate:async()=>{throw new Error('Invalid bearer')},privileged:()=>database,gateway:()=>gateway};
  process.env.PAYMENTS_ENABLED='false';let response=res();await paymentHandler('lock',deps)({method:'POST',headers:{},body:{}},response);assert.equal(response.code,503);
  process.env.PAYMENTS_ENABLED='true';response=res();await paymentHandler('lock',deps)({method:'POST',headers:{},body:{}},response);assert.equal(response.code,401);
  response=res();await paymentHandler('webhook',deps)({method:'POST',headers:{'stripe-signature':'forged'},rawBody:Buffer.from('{}')},response);assert.equal(response.code,400);
  response=res();await paymentHandler('worker',deps)({method:'POST',headers:{}},response);assert.ok([401,503].includes(response.code));
  delete process.env.PAYMENTS_ENABLED;
});
