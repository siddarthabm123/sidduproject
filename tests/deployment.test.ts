import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import paymentApi from '../api/payments';

function response() {
  const state = { status: 200, body: undefined as unknown, headers: {} as Record<string, string> };
  const res = {
    setHeader(name: string, value: string) { state.headers[name] = value; },
    status(code: number) { state.status = code; return res; },
    json(body: unknown) { state.body = body; return body; },
  };
  return { state, res };
}

test('payment dispatcher rejects unknown paths and incorrect methods', async () => {
  const missing = response();
  await paymentApi({ method: 'POST', headers: {}, query: { route: '__proto__' } }, missing.res);
  assert.equal(missing.state.status, 404);
  const wrongMethod = response();
  await paymentApi({ method: 'GET', headers: {}, query: { route: 'payments/escrow/lock' } }, wrongMethod.res);
  assert.equal(wrongMethod.state.status, 405);
  assert.equal(wrongMethod.state.headers.Allow, 'POST');
});

test('payment dispatcher keeps all published paths disabled without funding setup', async () => {
  const before = process.env.PAYMENTS_ENABLED;
  process.env.PAYMENTS_ENABLED = 'false';
  try {
    for (const route of ['payments/escrow/lock', 'payments/escrow/release', 'payments/escrow/refund', 'payments/factoring/request', 'payments/webhook', 'payments/worker', 'inspections/post-return', 'inspections/sign-off']) {
      const { state, res } = response();
      await paymentApi({ method: 'POST', headers: {}, query: { route } }, res);
      assert.equal(state.status, 503);
      assert.match(JSON.stringify(state.body), /No funds/);
    }
  } finally {
    if (before === undefined) delete process.env.PAYMENTS_ENABLED;
    else process.env.PAYMENTS_ENABLED = before;
  }
});

test('payment dispatcher rejects invalid or oversized JSON before authentication', async () => {
  const before = process.env.PAYMENTS_ENABLED;
  process.env.PAYMENTS_ENABLED = 'true';
  try {
    for (const [bytes, status] of [[Buffer.from('{'), 400], [Buffer.alloc(65537), 413], [Buffer.from('[]'), 400]] as const) {
      const { state, res } = response();
      await paymentApi({ method: 'POST', headers: {}, query: { route: 'payments/escrow/lock' }, rawBody: bytes }, res);
      assert.equal(state.status, status);
    }
  } finally {
    if (before === undefined) delete process.env.PAYMENTS_ENABLED;
    else process.env.PAYMENTS_ENABLED = before;
  }
});

test('Vercel dispatchers preserve public paths and stay within the twelve-function budget', async () => {
  async function count(directory: URL): Promise<number> {
    let total = 0;
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) total += await count(new URL(`${entry.name}/`, directory));
      else if (/\.(ts|js)$/.test(entry.name)) total += 1;
    }
    return total;
  }
  assert.ok(await count(new URL('../api/', import.meta.url)) <= 12);
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  for (const family of ['payments', 'inspections', 'fuel', 'workers']) {
    assert.ok(config.routes.some((r: { src?: string }) => r.src === `/api/v1/${family}/(.*)`));
  }
  assert.match(await readFile(new URL('../api/payments.ts', import.meta.url), 'utf8'), /bodyParser: false/);
});
