import type { WorkerHire, WorkerProfile } from './workforce/types';

export type Notice = {id:string;title_key:string;target_path:string;record_id:string;created_at:string;read_at:string|null;hire?:WorkerHire;isManager?:boolean};
export const notificationPaths=new Set(['/customer/bookings','/owner/jobs','/dashboard/customer/hire-workers','/dashboard/owner/workforce']);

export function demoNotices(hires:WorkerHire[],profiles:Pick<WorkerProfile,'id'|'user_id'>[],role:'customer'|'owner',read:Set<string>):Notice[]{
 const actor=`demo-${role}`;
 return hires.filter(h=>h&&typeof h.id==='string'&&typeof h.worker_id==='string'&&['PENDING','ACTIVE','COMPLETED','CANCELLED'].includes(h.status)&&Number.isFinite(h.agreed_wage)&&(h.employer_id===actor||profiles.some(p=>p&&p.id===h.worker_id&&p.user_id===actor))).map(h=>{
   const last=Array.isArray(h.offer_history)?h.offer_history.at(-1):undefined,id=`${h.id}:${h.offer_version||1}:${h.status}`;
   return {id,title_key:'Hiring update',record_id:h.id,target_path:role==='owner'?'/dashboard/owner/workforce':'/dashboard/customer/hire-workers',created_at:last?.created_at||h.created_at,read_at:read.has(id)?h.created_at:null,hire:h,isManager:h.employer_id!==actor};
 }).filter(n=>Number.isFinite(Date.parse(n.created_at))).sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)).slice(0,20);
}

export function noticeCopy(n:Notice,now=Date.now()):{title:string;body:string;action:string}{
 const h=n.hire;
 if(h){
   if(h.status==='COMPLETED')return {title:'Hiring completed',body:'This hiring agreement is completed. You can review the agreed wage and offer history.',action:'View hiring agreement'};
   if(h.status==='CANCELLED')return {title:Array.isArray(h.offer_history)&&h.offer_history.at(-1)?.action==='DECLINE'?'Hiring offer declined':'Hiring cancelled',body:'This request is closed. Review its offer history before arranging another worker.',action:'View hiring agreement'};
   if(h.status==='ACTIVE')return {title:'Hiring offer accepted',body:'The wage is agreed. Open the agreement to check the work dates and site.',action:'View hiring agreement'};
   if(Date.parse(h.request_expires_at)<=now||Date.parse(h.end_date)<=now)return {title:'Hiring request expired',body:'The response deadline or work period has passed. This request can no longer be accepted.',action:'View hiring agreement'};
   if((h.offer_by||'EMPLOYER')==='WORKER')return n.isManager
     ?{title:'Your worker counter-offer was sent',body:'Waiting for the employer to accept, decline or propose a lower wage.',action:'View offer history'}
     :{title:'Worker proposed a different wage',body:'Review the counter-offer. You can accept, decline or propose a lower wage.',action:'Review counter-offer'};
   return n.isManager
     ?{title:'New offer for your worker',body:'Review the offered wage and work dates. You can accept, decline or propose a higher wage.',action:'Review hiring request'}
     :{title:'Your hiring offer is awaiting a response',body:'The worker or their manager needs to respond. Contact is shared only after acceptance.',action:'View hiring request'};
 }
 const bodies:Record<string,string>={
   'New booking request':'A new equipment request needs review. Check the work dates, units and agreed price.',
   'Booking status updated':'The booking has moved to a new stage. Open it to check the current status.',
   'Completion approval requested':'The owner has requested job sign-off. Review the completed work before confirming.',
   'New hiring request':'A hiring request needs review. Check the offered wage, dates and site.',
   'Wage offer updated':'A wage offer has changed. Review the latest amount and who needs to respond.',
   'Hiring status updated':'The hiring request has changed. Open the agreement to check its current status.',
   'Booking issue updated':'A booking issue has changed. Review the issue and any required response.',
   'Work log approval requested':'The owner submitted a work record. Check the hours and meter readings before approving.',
   'Work log reviewed':'A submitted work record has been reviewed. Open the booking to see the decision.'
 };
 const hiring=n.target_path.includes('workforce')||n.target_path.includes('hire-workers');
 return {title:n.title_key,body:bodies[n.title_key]||'Open the related record to see this update and any action needed.',action:hiring?'View hiring agreement':'View booking'};
}
