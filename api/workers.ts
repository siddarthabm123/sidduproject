import { authenticatedDatabase } from '../server-supabase.js';
import { hireWorkerSchema, workerProfileSchema } from '../workforce/validation.js';
import { workerRoles, wageTypes } from '../workforce/types.js';
import { coordinates } from '../fuel/domain.js';
interface Request{method?:string;headers:Record<string,unknown>;query:Record<string,unknown>;body?:unknown}
interface Response{status(n:number):Response;json(v:unknown):unknown;setHeader(k:string,v:string):unknown}
const methods:Record<string,string>={profile:'POST',search:'GET',hire:'POST',records:'GET',respond:'POST',review:'POST'};
export default async function handler(req:Request,res:Response){
 res.setHeader('Cache-Control','no-store');const route=String(req.query.route||'');
 if(!methods[route])return res.status(404).json({error:'Worker endpoint not found'});
 if(req.method!==methods[route]){res.setHeader('Allow',methods[route]);return res.status(405).json({error:'Method not allowed'})}
 try{
   const db=await authenticatedDatabase(req);let fn='';let args:Record<string,unknown>={};let key='';
   if(route==='profile'){const v=workerProfileSchema.parse(req.body);fn='save_worker_profile';key='profile';args={p_data:v,p_id:v.id??null}}
   if(route==='hire'){const v=hireWorkerSchema.parse(req.body);fn='hire_worker';key='hire';args={p_worker:v.worker_id,p_start:v.start_date,p_end:v.end_date,p_wage:v.agreed_wage,p_wage_type:v.wage_type,p_site:v.site_location,p_machine:v.machine_description,p_request:v.request_id}}
   if(route==='records'){fn='my_workforce_records';key='records'}
   if(route==='search'){
     const lat=Number(req.query.latitude),lng=Number(req.query.longitude),radius=Number(req.query.radius_km??25),role=String(req.query.role||''),wage=String(req.query.wage_type||''),verified=String(req.query.verified_status||''),query=String(req.query.q||'');
     if(req.query.latitude==null||req.query.longitude==null||String(req.query.latitude).trim()===''||String(req.query.longitude).trim()===''||!coordinates(lat,lng)||![5,10,25,50].includes(radius)||(role&&!workerRoles.includes(role as any))||(wage&&!wageTypes.includes(wage as any))||!['','true','false'].includes(verified)||query.length>100)throw new Error('Invalid workforce filters');
     fn='search_workers';key='workers';args={p_lat:lat,p_lng:lng,p_radius:radius,p_role:role,p_wage:wage,p_verified:verified,p_query:query};
   }
   if(route==='respond'||route==='review'){
     const v=req.body as Record<string,unknown>;
     if(!v||typeof v.id!=='string'||!/^[0-9a-f-]{36}$/i.test(v.id)|| (route==='respond'?!['accept','cancel','complete'].includes(String(v.action)):typeof v.is_verified!=='boolean'))throw new Error('Invalid workforce request');
     fn=route==='respond'?'respond_worker_hire':'review_worker_profile';key=route==='respond'?'hire':'review';args=route==='respond'?{p_id:v.id,p_action:v.action}:{p_id:v.id,p_verified:v.is_verified};
   }
   const {data,error}=await db.rpc(fn,args);
   if(error){if(['42501','28000','22023'].includes(error.code))return res.status(error.code==='42501'?403:error.code==='28000'?401:400).json({error:error.message});if(['23514','23502','22P02'].includes(error.code))return res.status(400).json({error:'Invalid workforce request'});return res.status(503).json({error:'Workforce service is unavailable. Check database setup.'})}
   return res.status(200).json({[key]:data});
 }catch(e){
   if(e&&typeof e==='object'&&'issues' in e)return res.status(400).json({error:'Invalid workforce request',fields:(e as any).issues.map((i:any)=>({path:i.path.join('.'),message:i.message}))});
   const message=e instanceof Error?e.message:'';const auth=/Authentication required|session has expired/.test(message);
   return res.status(auth?401:message.startsWith('Invalid workforce')?400:503).json({error:auth||message.startsWith('Invalid workforce')?message:'Workforce service is unavailable. Check database setup.'});
 }
}
