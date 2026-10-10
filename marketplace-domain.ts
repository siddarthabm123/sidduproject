export function positiveNumber(value: unknown, label: string, maximum = 1_000_000) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0 || number > maximum) {
    throw new Error(`${label} must be a positive number no greater than ${maximum}.`);
  }
  return number;
}

export function unitCount(value: unknown, available: number) {
  const count = positiveNumber(value, 'Units', available);
  if (!Number.isInteger(count)) throw new Error('Units must be whole numbers.');
  return count;
}

export function etaMinutes(eta: string) {
  let minutes = 0;
  let matched = false;
  for (const match of eta.matchAll(/(\d+(?:\.\d+)?)\s*(days?|d|hours?|hrs?|h|minutes?|mins?|m)\b/gi)) {
    matched = true;
    const unit = match[2].toLowerCase();
    minutes += Number(match[1]) * (unit.startsWith('d') ? 1440 : unit.startsWith('h') ? 60 : 1);
  }
  return matched ? minutes : Number.POSITIVE_INFINITY;
}

export function validateBid(amount: unknown, ceiling: number, status: string) {
  if (status !== 'OPEN') throw new Error('This auction is no longer open.');
  const number = positiveNumber(amount, 'Bid', 10_000_000);
  if (number > ceiling) throw new Error('Bid exceeds the project ceiling.');
  return number;
}

export function paymentSummary(total: number, paid = 0) {
  if (!Number.isFinite(total) || total < 0 || !Number.isFinite(paid) || paid < 0 || paid > total) {
    throw new Error('Invalid payment amounts.');
  }
  return { total, paid, remaining: Math.round((total - paid) * 100) / 100 };
}

export async function saveAndRefresh(
  action: () => PromiseLike<{ error: unknown }>,
  refresh: () => Promise<unknown>,
) {
  const result = await action();
  if (result.error) throw result.error;
  try { await refresh(); return { saved: true, refreshError: null }; }
  catch (refreshError) { return { saved: true, refreshError }; }
}

export async function bookingRequestKey(customer: string, payload: unknown, storage: Pick<Storage,'getItem'|'setItem'>) {
  const fingerprint = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)))))
    .map(byte => byte.toString(16).padStart(2, '0')).join('');
  const storageKey = `rigdesk-booking-request-${customer}`;
  let previous: { fingerprint: string; key: string } | null = null;
  try { previous = JSON.parse(storage.getItem(storageKey) || 'null'); } catch { /* Ignore invalid local cache. */ }
  if (previous?.fingerprint === fingerprint && /^[0-9a-f-]{36}$/i.test(previous.key)) return previous.key;
  const key = crypto.randomUUID();
  storage.setItem(storageKey, JSON.stringify({ fingerprint, key }));
  return key;
}
