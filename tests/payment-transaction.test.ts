import test from 'node:test';
import assert from 'node:assert/strict';
import { transactionalPaymentDatabase } from '../payments/transaction';
test('transactional adapter fails closed without configuration and forwards prototype RPC methods',async()=>{
  const previous=process.env.PAYMENT_DATABASE_URL;
  try{
    delete process.env.PAYMENT_DATABASE_URL;
    assert.throws(()=>transactionalPaymentDatabase({rpc:async()=>({data:[],error:null})}),/PAYMENT_DATABASE_URL/);
    process.env.PAYMENT_DATABASE_URL='postgresql://example:test@localhost/test';
    class Database {async rpc(name:string){return {data:name,error:null}}}
    const wrapped=transactionalPaymentDatabase(new Database());
    assert.equal((await wrapped.rpc('claim_payment_jobs',{})).data,'claim_payment_jobs');
    process.env.PAYMENT_DATABASE_URL='https://example.test';
    assert.throws(()=>transactionalPaymentDatabase(new Database()),/PostgreSQL/);
  }finally{if(previous===undefined)delete process.env.PAYMENT_DATABASE_URL;else process.env.PAYMENT_DATABASE_URL=previous}
});
