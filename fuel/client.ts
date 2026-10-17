import { supabase } from '../supabase';
export async function fuelRequest<T>(route:string, options: { body?:unknown; signal?:AbortSignal; public?:boolean }={}):Promise<T> {
  const headers:Record<string,string>={};
  if(!options.public){
    if(!supabase)throw new Error('Fuel service is unavailable. Please retry later.');
    const {data,error}=await supabase.auth.getSession();
    if(error||!data.session)throw new Error('Authentication required');
    headers.Authorization=`Bearer ${data.session.access_token}`;
  }
  if(options.body!==undefined)headers['Content-Type']='application/json';
  const response=await fetch(`/api/v1/fuel/${route}`,{method:options.body===undefined?'GET':'POST',headers,
    body:options.body===undefined?undefined:JSON.stringify(options.body),signal:options.signal});
  const data=await response.json().catch(()=>({error:'Fuel service is unavailable. Please retry later.'}));
  if(!response.ok)throw new Error(data.error||'Fuel service is unavailable. Please retry later.');
  return data;
}
