import { demoWorkers } from './demo';
import { demoHires, demoHireKey } from './demo-storage';
import type { WorkerProfile, WorkerHire, WorkforceBoard, WorkforcePost, WorkforceApplication } from './types';
import type { WorkforceRole } from './routes';
import { localDate } from './dates';

const key='rigdesk-demo-workforce-board-v1';
export const eligibleForJob=(worker:WorkerProfile,post:WorkforcePost)=>worker.is_verified&&worker.availability_status&&(worker.accepting_requests??true)&&worker.worker_role===post.worker_role&&worker.wage_type===post.wage_type&&Boolean(worker.govt_id_url)&&(worker.worker_role!=='HEAVY_DRIVER'||Boolean(worker.driving_license_url&&worker.license_class));
export function demoBoard(now=new Date()):WorkforceBoard{
  const start=new Date(now);start.setDate(start.getDate()+2);const end=new Date(start);end.setDate(end.getDate()+2);
  const posts:WorkforcePost[]=[['owner','RIG_OPERATOR','Borewell rig operator crew',1600,3],['customer','HEAVY_DRIVER','JCB drivers for foundation work',1400,3]].map(([role,category,title,wage,count])=>({id:crypto.randomUUID(),author_id:`demo-${role}`,author_role:role as WorkforceRole,author_name:role==='owner'?'Mahesh (demo)':'Siddartha (demo)',title:String(title),worker_role:category as WorkerProfile['worker_role'],headcount:Number(count),filled_count:0,wage_rate:Number(wage),wage_type:'DAILY_WAGE',start_date:localDate(start),end_date:localDate(end),site_location:'Demo project site, Bengaluru',site_latitude:12.97,site_longitude:77.6,description:'Day shift work with a document-reviewed crew. Accommodation and travel to be agreed separately.',status:'OPEN',created_at:now.toISOString()}));
  const applications:WorkforceApplication[]=posts.map((p,i)=>{const crew=[demoWorkers[i===0?7:6],demoWorkers[i===0?9:8]],w=crew[0];return {id:crypto.randomUUID(),post_id:p.id,applicant_id:w.user_id,applicant_name:i===0?'Siddartha (demo)':'Mahesh (demo)',worker_ids:crew.map(w=>w.id),worker_names:crew.map(w=>w.full_name),offered_wage:i===0?1500:1300,note:'Demo application with two managed workers. Review the proposed wage.',status:'PENDING',request_id:crypto.randomUUID(),created_at:now.toISOString(),hire_ids:[]}});
  return {posts,applications};
}
export function loadDemoBoard():WorkforceBoard{
  const raw=localStorage.getItem(key);
  if(raw){
    try{
      const value=JSON.parse(raw);
      if(value&&Array.isArray(value.posts)&&Array.isArray(value.applications)){
        const posts=value.posts.filter((p:any)=>p&&typeof p.id==='string'&&typeof p.title==='string'&&typeof p.author_id==='string'&&['customer','owner'].includes(p.author_role)&&Number.isFinite(p.headcount)&&Number.isFinite(p.wage_rate)&&typeof p.description==='string');
        const applications=value.applications.filter((a:any)=>a&&typeof a.id==='string'&&typeof a.post_id==='string'&&typeof a.applicant_id==='string'&&Number.isFinite(a.offered_wage)&&[a.worker_ids,a.worker_names,a.hire_ids].every(v=>Array.isArray(v)&&v.every(x=>typeof x==='string')));
        return {posts,applications};
      }
    }catch{/* Preserve malformed saved input; show safe fixtures without overwriting it. */}
    return demoBoard();
  }
  const board=demoBoard();localStorage.setItem(key,JSON.stringify(board));return board;
}
export function saveDemoBoard(board:WorkforceBoard,hires?:WorkerHire[]){
  const previous=localStorage.getItem(demoHireKey);
  if(hires)localStorage.setItem(demoHireKey,JSON.stringify(hires));
  try{localStorage.setItem(key,JSON.stringify(board))}catch(error){if(hires){if(previous===null)localStorage.removeItem(demoHireKey);else localStorage.setItem(demoHireKey,previous)}throw error}
}
export function acceptDemoApplication(board:WorkforceBoard,id:string,actor:string,profiles:WorkerProfile[],current=demoHires()):{board:WorkforceBoard;hires:WorkerHire[]}{
 const application=board.applications.find(a=>a.id===id),post=board.posts.find(p=>p.id===application?.post_id);
 if(!application||!post||post.author_id!==actor)throw new Error('Only the job author can review applications');
 if(application.status!=='PENDING'||post.status!=='OPEN'||post.start_date<localDate()||post.filled_count+application.worker_ids.length>post.headcount)throw new Error('Application or available places changed. Refresh and retry.');
 const workers=application.worker_ids.map(id=>profiles.find(w=>w.id===id));
 if(workers.some(w=>!w||w.user_id!==application.applicant_id||!eligibleForJob(w,post)))throw new Error('Worker documents or eligibility changed; review the application again');
 const start=new Date(`${post.start_date}T00:00:00+05:30`).toISOString(),endDate=new Date(`${post.end_date}T00:00:00+05:30`);endDate.setUTCDate(endDate.getUTCDate()+1);const end=endDate.toISOString();
 if(current.some(h=>application.worker_ids.includes(h.worker_id)&&['PENDING','ACTIVE'].includes(h.status)&&(h.status==='ACTIVE'||Date.parse(h.request_expires_at)>Date.now())&&h.start_date<end&&h.end_date>start))throw new Error('Worker is already reserved for this period');
 const hires:WorkerHire[]=workers.map(w=>({id:crypto.randomUUID(),request_id:crypto.randomUUID(),worker_id:w!.id,worker_name:w!.full_name,employer_id:actor,employer_type:post.author_role==='owner'?'OWNER':'CUSTOMER',start_date:start,end_date:end,expected_wage:w!.wage_rate,initial_offer:application.offered_wage,agreed_wage:application.offered_wage,wage_type:post.wage_type,status:'ACTIVE',site_location:post.site_location,site_latitude:post.site_latitude,site_longitude:post.site_longitude,machine_description:post.title,created_at:new Date().toISOString(),request_expires_at:end,offer_by:'WORKER',offer_version:1,offer_history:[{version:1,side:'WORKER',action:'OFFER',amount:application.offered_wage,note:application.note,created_at:application.created_at},{version:1,side:'EMPLOYER',action:'ACCEPT',amount:application.offered_wage,note:'Job application accepted',created_at:new Date().toISOString()}],demo_example:true}));
 const filled=post.filled_count+hires.length;
 return {board:{posts:board.posts.map(p=>p.id===post.id?{...p,filled_count:filled,status:filled===p.headcount?'FILLED':'OPEN'}:p),applications:board.applications.map(a=>a.id===id?{...a,status:'ACCEPTED',hire_ids:hires.map(h=>h.id)}:a)},hires:[...hires,...current]};
}
