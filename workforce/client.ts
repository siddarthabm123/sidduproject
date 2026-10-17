import { supabase } from '../supabase';
import { documentFileSchema, documentSignature } from './validation';
export async function workerRequest<T>(route:string,body?:unknown,signal?:AbortSignal):Promise<T>{
  if(!supabase)throw new Error('Workforce service is unavailable. Check database setup.');
  const {data,error}=await supabase.auth.getSession();if(error||!data.session)throw new Error('Authentication required');
  const response=await fetch(`/api/v1/workers/${route}`,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${data.session.access_token}`,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),signal});
  const result=await response.json().catch(()=>({error:'Workforce service is unavailable. Check database setup.'}));
  if(!response.ok)throw new Error(result.error||'Workforce service is unavailable. Check database setup.');return result;
}
export async function uploadWorkerDocument(file:File):Promise<string>{
  documentFileSchema.parse(file);
  if(!documentSignature(new Uint8Array(await file.slice(0,8).arrayBuffer()),file.type))throw new Error('Invalid document file. Use PDF, PNG or JPEG (up to 5 MB).');
  if(!supabase)throw new Error('Workforce service is unavailable. Check database setup.');
  const {data,error}=await supabase.auth.getUser();if(error||!data.user)throw new Error('Authentication required');
  const extension=file.type==='application/pdf'?'pdf':file.type==='image/png'?'png':'jpg';
  const path=`${data.user.id}/${crypto.randomUUID()}.${extension}`;
  const result=await supabase.storage.from('worker-documents').upload(path,file,{contentType:file.type,upsert:false});
  if(result.error)throw new Error('Document upload failed. Please retry.');return path;
}
