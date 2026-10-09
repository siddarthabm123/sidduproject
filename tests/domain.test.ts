import assert from 'node:assert/strict';
import test from 'node:test';
import { etaMinutes, paymentSummary, unitCount, validateBid } from '../marketplace-domain';
import { signBond, verifyBondToken } from '../bond-signature';
import type { BondPayload } from '../bond-signature';
import generateBond, { validateBond } from '../bond-pdf';
import verifyBond from '../api/verify-bond';

process.env.BOND_PDF_SECRET='test-only-key-not-for-production';
const bond:BondPayload={bookingId:'RD-TEST',dateGenerated:'2026-10-08',ownerName:'Test owner',ownerContact:'private',customerName:'Test customer',customerContact:'private',serviceDescription:'Excavator; 2 units; 8 hours',completionDate:'Completion pending',totalAmount:10000,amountPaid:0,remainingAmount:10000,dueDate:'2026-10-16',customerIpAddress:'private',acceptanceTimestamp:'2026-10-08',mode:'demo'};
function response(){return {code:200,headers:{} as Record<string,string>,body:undefined as any,setHeader(name:string,value:string){this.headers[name]=value},status(code:number){this.code=code;return this},json(value:any){this.body=value;return this},send(value:any){this.body=value;return this}}}
test('bids must be positive, finite, within ceiling and open',()=>{
  for(const amount of [-1,0,NaN,Infinity,10001])assert.throws(()=>validateBid(amount,10000,'OPEN'));
  assert.throws(()=>validateBid(1,10000,'AWARDED'));assert.equal(validateBid(9999,10000,'OPEN'),9999);
});
test('arrival sorting normalizes mixed days, hours and minutes',()=>{
  assert.equal(etaMinutes('2 days'),2880);assert.equal(etaMinutes('3 hrs'),180);assert.equal(etaMinutes('1h 18m'),78);assert.equal(etaMinutes('unknown'),Infinity);
});
test('unit allocations reject fractions and unavailable capacity',()=>{
  assert.equal(unitCount(3,3),3);for(const units of [0,-1,1.5,4,NaN])assert.throws(()=>unitCount(units,3));
});
test('wallet hold is not payment; financial totals are exact',()=>{
  assert.deepEqual(paymentSummary(10000),{total:10000,paid:0,remaining:10000});assert.throws(()=>paymentSummary(100,101));
  assert.throws(()=>validateBond({...bond,remainingAmount:9999}));
});
test('signed v2 records reject tampering and redact private contacts',()=>{
  const token=signBond(bond);const record=verifyBondToken(token)!;assert.equal(record.mode,'demo');assert.equal(record.ownerContact,'Not publicly shared');
  assert.equal(verifyBondToken(token.slice(0,-5)+'AAAAA'),null);assert.equal(verifyBondToken('v1.fake.fake'),null);assert.equal(verifyBondToken('x'.repeat(8001)),null);
  assert.equal(verifyBondToken(signBond({...bond,remainingAmount:NaN})),null);
});
test('a QR cannot verify a different paper reference',async()=>{
  const res=response();await verifyBond({method:'GET',query:{token:signBond(bond),reference:'different'}},res);assert.equal(res.code,400);
});
test('demo records never return original-booking verification',async()=>{
  const res=response();await verifyBond({method:'GET',query:{token:signBond(bond),reference:bond.bookingId}},res);assert.equal(res.code,200);assert.equal(res.body.verified,false);assert.equal(res.body.demo,true);
});
test('arbitrary client financials cannot obtain a live signed bond without authentication',async()=>{
  const res=response();await generateBond({method:'POST',headers:{},body:{...bond,mode:'live'}},res);assert.equal(res.code,401);assert.match(res.body.error,/Authentication/);
});
test('demo PDF is one page with a prominent demo notice',async()=>{
  const res=response();await generateBond({method:'POST',headers:{},body:bond},res);assert.equal(res.code,200);assert.equal(res.headers['Content-Type'],'application/pdf');
  assert.match(res.body.toString('latin1'),/\/Count 1\b/);
});
