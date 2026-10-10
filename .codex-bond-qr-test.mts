import fs from 'node:fs/promises';
import path from 'node:path';
import handler from './bond-pdf.ts';

const output = path.resolve('output/pdf/riglogix-qr-scan-test.pdf');
await fs.mkdir(path.dirname(output), { recursive: true });

const res = {
  setHeader() {},
  status() { return this; },
  async send(value: Buffer) { await fs.writeFile(output, value); return this; },
  json(value: unknown) { throw new Error(JSON.stringify(value)); },
};

await handler({
  method: 'POST',
  headers: { 'x-forwarded-for': '203.0.113.24' },
  body: {
    bookingId: 'BOND-QR-SCAN-2026-001',
    dateGenerated: '26/09/2026, 10:30',
    ownerName: 'RigLogix verified owner',
    ownerContact: 'Verified contact held by RigLogix',
    customerName: 'Test Customer',
    customerContact: 'customer@example.com',
    serviceDescription: 'Borewell rig; 300 feet drilling; site: Whitefield, Bengaluru; payment status: Deposit locked.',
    completionDate: 'Completion pending',
    totalAmount: 23500,
    amountPaid: 2500,
    remainingAmount: 21000,
    dueDate: '03/10/2026',
    customerIpAddress: 'Captured by secure API',
    acceptanceTimestamp: '2026-09-26T10:30:00.000Z',
  },
}, res);

console.log(output);
