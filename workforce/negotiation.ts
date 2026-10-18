import type { HireAction, OfferSide, WorkerHire } from './types';

export const incomingOffer=(hire:WorkerHire,isManager:boolean)=>(hire.offer_by||'EMPLOYER')===(isManager?'EMPLOYER':'WORKER');

export function respondDemoHire(hire:WorkerHire,actor:string,manager:string,action:HireAction,version:number,amount?:number,note='',now=Date.now()):WorkerHire {
  if(actor!==hire.employer_id&&actor!==manager)throw new Error('Hiring party required');
  const side:OfferSide=actor===hire.employer_id?'EMPLOYER':'WORKER';
  if(note.length>500)throw new Error('Offer note is too long');
  if(['accept','decline','counter'].includes(action)){
    if(hire.status!=='PENDING'||Date.parse(hire.request_expires_at)<=now||Date.parse(hire.end_date)<=now)throw new Error('Only an active pending request can be negotiated');
    if((hire.offer_by||'EMPLOYER')===side)throw new Error('Wait for the other party to respond');
    if(version!==(hire.offer_version||1))throw new Error('Offer changed. Refresh before responding.');
  }
  const next={...hire,offer_version:hire.offer_version||1,offer_by:hire.offer_by||'EMPLOYER' as OfferSide};
  if(action==='counter'){
    if(amount===undefined||!Number.isFinite(amount)||amount<1||amount>1000000||Math.abs(amount*100-Math.round(amount*100))>1e-7)throw new Error('Invalid counter-offer amount');
    if(side==='WORKER'?amount<=hire.agreed_wage:amount>=hire.agreed_wage)throw new Error('Worker counters must be higher; employer counters must be lower');
    next.agreed_wage=amount;next.offer_by=side;next.offer_version++;
  }else if(action==='accept')next.status='ACTIVE';
  else if(action==='decline')next.status='CANCELLED';
  else if(action==='cancel'){
    if(!['PENDING','ACTIVE'].includes(hire.status))throw new Error('Hire is no longer active');next.status='CANCELLED';
  }else if(action==='complete'){
    if(actor!==hire.employer_id||hire.status!=='ACTIVE'||Date.parse(hire.end_date)>now)throw new Error('Employer can complete a hire after its end date');next.status='COMPLETED';
  }
  next.offer_history=[...(hire.offer_history||[]),{version:next.offer_version,side,action:action.toUpperCase(),amount:next.agreed_wage,note,created_at:new Date(now).toISOString()}];
  return next;
}
