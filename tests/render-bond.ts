import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import handler from '../bond-pdf';

// Local fixture only: never represents a real customer or payment.
process.env.BOND_PDF_SECRET='test-only-key-not-for-production';
process.env.BOND_VERIFY_BASE_URL='http://127.0.0.1:5180/verify/';
const output=resolve('tmp/pdfs/rigdesk-bond-qa.pdf');
await mkdir(resolve('tmp/pdfs'),{recursive:true});
let status=200;
await handler({method:'POST',headers:{},body:{
  mode:'demo',bookingId:'RD-QR-QA-20261009',dateGenerated:'2026-10-09T09:00:00Z',
  ownerName:'Demo owner',ownerContact:'Not shared',customerName:'Demo customer',customerContact:'Not shared',
  serviceDescription:'Excavator; 3 units; 8 hours per unit; booking date 2026-10-10',
  completionDate:'Completion pending',totalAmount:74520,amountPaid:0,remainingAmount:74520,
  dueDate:'Not agreed',customerIpAddress:'Not shared',acceptanceTimestamp:'2026-10-09T09:00:00Z',
}},{
  setHeader(){},status(code:number){status=code;return this},
  json(value:unknown){throw new Error(`HTTP ${status}: ${JSON.stringify(value)}`)},
  async send(bytes:Buffer){await writeFile(output,bytes)},
});
console.log(output);
