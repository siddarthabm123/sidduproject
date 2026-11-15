import { createClient } from '@supabase/supabase-js';
import { supabaseUrl,supabaseAnonKey,isSupabaseConfigured } from './supabase-config';
import {timedFetch} from './request-timeout';
export {isSupabaseConfigured,supabaseConnectionLabel} from './supabase-config';

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      global:{fetch:(input,options)=>timedFetch(input,options,options?.body instanceof Blob||options?.body instanceof FormData?60000:12000)},
    })
  : null;

let recoverySession=false;
supabase?.auth.onAuthStateChange((event)=>{
  if(event==='PASSWORD_RECOVERY')recoverySession=true;
  if(event==='SIGNED_OUT')recoverySession=false;
});
export const hasRecoverySession=()=>recoverySession;
