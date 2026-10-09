import { createClient } from '@supabase/supabase-js';

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
  if (!match) throw new Error('Authentication required.');
  const database = serverDatabase(match[1]);
  const { data, error } = await database.auth.getUser(match[1]);
  if (error || !data.user) throw new Error('Your session has expired. Please log in again.');
  return database;
}
