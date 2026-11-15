import { supabase } from '../supabase';
export async function discoverProviders<T>(body:unknown,signal?:AbortSignal):Promise<T>{
  if(!supabase)throw new Error('Please sign in to search Google businesses.');
  const {data,error}=await supabase.auth.getSession();
  if(error||!data.session)throw new Error('Please sign in to search Google businesses.');
  const response=await fetch('/api/discover-providers',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session.access_token}`},body:JSON.stringify(body),signal});
  const result=await response.json().catch(()=>({error:'Provider discovery is temporarily unavailable.'}));
  if(!response.ok)throw new Error(result.error||'Provider discovery is temporarily unavailable.');
  return result;
}
