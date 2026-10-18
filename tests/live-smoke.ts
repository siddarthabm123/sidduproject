import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const base=process.env.RIGDESK_URL||'https://rigdesk-marketplace-rig-logi-x.vercel.app';
for(const path of ['/','/demo','/sign-in','/admin','/reset-password']) {
  const result=await fetch(base+path);assert.equal(result.status,200,path);console.log(`GET ${path}: 200`);
}
for(const path of ['/api/v1/fuel/bunks/nearby','/api/v1/workers/records']) {
  const result=await fetch(base+path);assert.equal(result.status,401,path);console.log(`Unauthenticated ${path}: 401`);
}
const payment=await fetch(base+'/api/v1/payments/escrow/lock',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
assert.equal(payment.status,503);console.log('Real payments remain disabled: 503');
const response=await fetch(base+'/api/generate-bond',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
  mode:'demo',bookingId:'RD-LIVE-QR-QA',dateGenerated:new Date().toISOString(),acceptanceTimestamp:new Date().toISOString(),
  serviceDescription:'Demo fixture: excavator, 2 units, 8 hours per unit',totalAmount:1656,amountPaid:0,remainingAmount:1656,
  completionDate:'Completion pending',dueDate:'Not agreed',
})});
assert.equal(response.status,200,await response.clone().text());assert.match(response.headers.get('content-type')||'',/pdf/);
await mkdir('tmp/pdfs',{recursive:true});await writeFile('tmp/pdfs/rigdesk-live-bond.pdf',Buffer.from(await response.arrayBuffer()));
console.log('Generated demo-only live QR fixture: tmp/pdfs/rigdesk-live-bond.pdf');
