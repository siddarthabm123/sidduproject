import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const supabaseEnabled = import.meta.env.VITE_ENABLE_SUPABASE === 'true';

export const isSupabaseConfigured = Boolean(supabaseEnabled && supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

export function supabaseConnectionLabel() {
  return isSupabaseConfigured ? 'Supabase connected' : 'Local wallet active';
}
