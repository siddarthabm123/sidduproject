import { createClient } from '@supabase/supabase-js';

export class ServiceError extends Error {
  constructor(message:string, public status:number, public retryAfter?:number) { super(message); }
}
export const serviceStatus=(error:unknown)=>error instanceof ServiceError?error.status:503;

export function serverDatabase(accessToken?: string) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Database connection is not configured.');
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
  });
}

export async function authenticatedDatabase(req: { headers: Record<string, unknown> }) {
  const header = String(req.headers.authorization || '');
  const match = /^Bearer ([^\s]+)$/.exec(header);
  if (!match) throw new ServiceError('Authentication required.',401);
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Database connection is not configured.');
  let response:Response;
  try { response = await fetch(`${url.replace(/\/$/, '')}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${match[1]}` },
    signal: AbortSignal.timeout(10000),
  }); } catch { throw new ServiceError('Authentication service is temporarily unavailable. Please retry.',503); }
  if (response.status===401||response.status===403) throw new ServiceError('Your session has expired. Please log in again.',401);
  if (response.status===429) throw new ServiceError('Too many requests. Please retry later.',429,60);
  if (!response.ok) throw new ServiceError('Authentication service is temporarily unavailable. Please retry.',503);
  const user = await response.json() as { id?: unknown };
  if (typeof user.id !== 'string') throw new ServiceError('Authentication service is temporarily unavailable. Please retry.',503);
  const database = serverDatabase(match[1]);
  return database;
}
