// Lightweight configuration: importing this must not initialise the auth SDK.
export const supabaseUrl=import.meta.env.VITE_SUPABASE_URL as string|undefined;
export const supabaseAnonKey=import.meta.env.VITE_SUPABASE_ANON_KEY as string|undefined;
export const isSupabaseConfigured=Boolean(import.meta.env.VITE_ENABLE_SUPABASE==='true'&&supabaseUrl&&supabaseAnonKey);
export const supabaseConnectionLabel=()=>isSupabaseConfigured?'Supabase configured':'Demo mode (not connected)';
