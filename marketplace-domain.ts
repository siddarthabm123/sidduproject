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
