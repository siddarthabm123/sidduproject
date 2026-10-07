import { createHmac, timingSafeEqual } from 'node:crypto';
import { deflateRawSync, inflateRawSync } from 'node:zlib';

export type BondPayload = {
  bookingId: string;
  dateGenerated: string;
  ownerName: string;
  ownerContact: string;
  customerName: string;
  customerContact: string;
  serviceDescription: string;
  completionDate: string;
  totalAmount: number;
  amountPaid: number;
  remainingAmount: number;
  dueDate: string;
  customerIpAddress: string;
  acceptanceTimestamp: string;
};

function secret() {
  const value = process.env.BOND_PDF_SECRET?.trim();
  return value || null;
}

type CompactBond = {
  i: string; g: string; o: string; c: string; s: string; x: string;
  t: number; p: number; r: number; d: string; a: string;
};

function publicRecord(payload: BondPayload): BondPayload {
  return {
    ...payload,
    ownerContact: 'Verified contact held by RigDesk',
    customerContact: 'Not publicly shared',
    customerIpAddress: 'Not publicly shared',
  };
}

function compact(payload: BondPayload): CompactBond {
  const record = publicRecord(payload);
  return {
    i: record.bookingId, g: record.dateGenerated, o: record.ownerName,
    c: record.customerName, s: record.serviceDescription, x: record.completionDate,
    t: record.totalAmount, p: record.amountPaid, r: record.remainingAmount,
    d: record.dueDate, a: record.acceptanceTimestamp,
  };
}

function expand(record: CompactBond): BondPayload {
  return {
    bookingId: record.i, dateGenerated: record.g, ownerName: record.o,
    ownerContact: 'Verified contact held by RigDesk', customerName: record.c,
    customerContact: 'Not publicly shared', serviceDescription: record.s,
    completionDate: record.x, totalAmount: record.t, amountPaid: record.p,
    remainingAmount: record.r, dueDate: record.d,
    customerIpAddress: 'Not publicly shared', acceptanceTimestamp: record.a,
  };
}

function safeCompare(body: string, signature: string) {
  const signingSecret = secret();
  if (!signingSecret) return false;
  const expected = createHmac('sha256', signingSecret).update(body).digest();
  let supplied: Buffer;
  try {
    supplied = Buffer.from(signature, 'base64url');
  } catch {
    return false;
  }
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

export function signBond(payload: BondPayload) {
  const signingSecret = secret();
  if (!signingSecret) throw new Error('Bond signing is unavailable until BOND_PDF_SECRET is configured.');
  // A compact, compressed public record keeps the printed QR easy to scan.
  // Private contact and network data remain in the PDF, outside the QR payload.
  const compressed = deflateRawSync(Buffer.from(JSON.stringify(compact(payload)), 'utf8'), { level: 9 });
  const body = `v1.${compressed.toString('base64url')}`;
  const signature = createHmac('sha256', signingSecret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

export function verifyBondToken(token: string): BondPayload | null {
  const segments = token.split('.');
  if (segments.length === 3 && segments[0] === 'v1') {
    const [, body, signature] = segments;
    if (!body || !signature || !safeCompare(`v1.${body}`, signature)) return null;
    try {
      const value = inflateRawSync(Buffer.from(body, 'base64url')).toString('utf8');
      return expand(JSON.parse(value) as CompactBond);
    } catch {
      return null;
    }
  }

  // Continue verifying bonds generated before the compact QR format was released.
  const [body, signature, ...extra] = segments;
  if (!body || !signature || extra.length || !safeCompare(body, signature)) return null;
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as BondPayload;
  } catch {
    return null;
  }
}
