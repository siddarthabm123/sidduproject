import { paymentHandler } from '../payments/http.js';

// Preserve the signed webhook bytes; parse ordinary requests ourselves.
export const config = { api: { bodyParser: false } };
const operations = {
  'payments/escrow/lock': 'lock',
  'payments/escrow/release': 'release',
  'payments/escrow/refund': 'refund',
  'payments/factoring/request': 'factor',
  'payments/webhook': 'webhook',
  'payments/worker': 'worker',
  'inspections/post-return': 'inspect',
  'inspections/sign-off': 'sign-off',
} as const;

export default async function handler(req: Parameters<ReturnType<typeof paymentHandler>>[0] & { query: Record<string, unknown> }, res: Parameters<ReturnType<typeof paymentHandler>>[1]) {
  res.setHeader('Cache-Control', 'no-store');
  const route = String(req.query.route || '');
  if (!Object.hasOwn(operations, route)) return res.status(404).json({ error: 'Payment endpoint not found.' });
  const operation = operations[route as keyof typeof operations];
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  if (process.env.PAYMENTS_ENABLED !== 'true') return paymentHandler(operation)(req, res);
  if (operation !== 'webhook') {
    try {
      let bytes = req.rawBody;
      if (!bytes && req[Symbol.asyncIterator]) {
        const chunks: Buffer[] = []; let size = 0;
        for await (const chunk of req as AsyncIterable<Buffer>) {
          size += chunk.length;
          if (size > 65536) return res.status(413).json({ error: 'Request too large.' });
          chunks.push(chunk);
        }
        bytes = Buffer.concat(chunks);
      }
      if (bytes) {
        if (bytes.length > 65536) return res.status(413).json({ error: 'Request too large.' });
        req.body = bytes.length ? JSON.parse(bytes.toString('utf8')) : {};
      }
      if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) return res.status(400).json({ error: 'Invalid JSON request.' });
    } catch {
      return res.status(400).json({ error: 'Invalid JSON request.' });
    }
  }
  return paymentHandler(operation)(req, res);
}
