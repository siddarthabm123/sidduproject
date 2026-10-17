import type { PaymentGateway, PaymentJob, GatewayEvent } from './gateway.js';

export type PaymentEscrow = {
  id:string;booking_id:string;contractor_id:string;vendor_id:string;locked_amount:number;
  status:'HOLDING'|'RELEASED'|'REFUNDED'|'DISPUTED';payout_due_date:string|null;created_at:string;
  commission_amount:number;payout_amount:number;release_requested_at:string|null;
};
export interface PaymentDatabase {
  rpc(name:string,args:Record<string,unknown>):PromiseLike<{data:any;error:unknown}>;
}
export class PaymentError extends Error {
  constructor(message:string,readonly status=409){super(message)}
}
export async function rpc(database:PaymentDatabase,name:string,args:Record<string,unknown>) {
  const result=await database.rpc(name,args);
  if(result.error)throw new PaymentError(typeof result.error==='object'&&result.error&&'message' in result.error?String(result.error.message):'Payment operation failed.');
  return result.data;
}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function uuidValue(value:unknown,label:string) {
  if(typeof value!=='string'||!uuid.test(value))throw new PaymentError(`${label} must be a UUID.`,400);
  return value;
}
function amountValue(value:unknown) {
  if(!Number.isSafeInteger(value)||Number(value)<=0||Number(value)>2147483647)throw new PaymentError('Invalid captured amount.',400);
  return Number(value);
}

export class EscrowService {
  constructor(private readonly database:PaymentDatabase,private readonly privileged:()=>PaymentDatabase,private readonly gateway:()=>PaymentGateway){}
  async lock(input:{booking_id:unknown;source:unknown;payment_intent_id?:unknown},requestId:unknown) {
    const booking=uuidValue(input.booking_id,'booking_id'),request=uuidValue(requestId,'Idempotency-Key');
    if(input.source==='balance')return rpc(this.database,'escrow_lock_balance',{p_booking:booking,p_request:request});
    if(input.source!=='card'||typeof input.payment_intent_id!=='string'||!/^pi_[a-zA-Z0-9]{1,180}$/.test(input.payment_intent_id))throw new PaymentError('Choose balance or a valid card payment intent.',400);
    const quote=await rpc(this.database,'escrow_quote',{p_booking:booking});
    const intent=await this.gateway().retrieveIntent(input.payment_intent_id);
    if(intent.status!=='succeeded')throw new PaymentError('Payment has not been captured. Booking remains unconfirmed.');
    if(!quote.customer_reference||intent.customer!==quote.customer_reference||intent.metadata.booking_id!==booking||intent.metadata.contractor_id!==quote.contractor_id||intent.metadata.purpose!=='escrow')throw new PaymentError('Payment intent does not belong to this contractor and booking.',403);
    const event={type:'CARD_CAPTURED',payment_intent_id:intent.id,booking_id:booking,contractor_id:quote.contractor_id,
      customer_reference:intent.customer,amount:amountValue(intent.amount),currency:intent.currency,request_id:uuidValue(intent.metadata.request_id,'payment request_id')};
    if(event.request_id!==request)throw new PaymentError('Idempotency-Key must match the server-created payment metadata.',400);
    const outcome=await rpc(this.privileged(),'apply_payment_event',{p_event_id:`capture:${intent.id}`,p_event:event});
    if(outcome.refund_pending||outcome.receipt_status==='REFUND_PENDING'||outcome.receipt_status==='REFUNDED')throw new PaymentError('The capture could not fund this booking. Refund reconciliation is scheduled.');
    return rpc(this.database,'escrow_get',{p_booking:booking});
  }
  release(booking:unknown){return rpc(this.database,'escrow_release',{p_booking:uuidValue(booking,'booking_id')})}
  refund(booking:unknown){return rpc(this.database,'escrow_refund',{p_booking:uuidValue(booking,'booking_id')})}
  inspect(input:{booking_id:unknown;damage_flag:unknown;notes:unknown}) {
    if(typeof input.damage_flag!=='boolean'||typeof input.notes!=='string'||input.notes.trim().length<3||input.notes.length>2000)throw new PaymentError('An inspection damage flag and notes are required.',400);
    return rpc(this.database,'record_post_return_inspection',{p_booking:uuidValue(input.booking_id,'booking_id'),p_damage:input.damage_flag,p_notes:input.notes});
  }
  signOff(inspection:unknown){return rpc(this.database,'sign_off_post_return',{p_inspection:uuidValue(inspection,'inspection_id')})}
  factor(invoice:unknown,request:unknown){return rpc(this.database,'request_invoice_factoring',{p_invoice:uuidValue(invoice,'invoice_id'),p_request:uuidValue(request,'Idempotency-Key')})}
}

export async function processGatewayEvent(event:GatewayEvent,gateway:PaymentGateway,database:PaymentDatabase) {
  const object=event.object;let normalized:Record<string,unknown>|undefined;
  if(event.type==='payment_intent.succeeded') {
    const intent=await gateway.retrieveIntent(String(object.id));
    if(intent.status!=='succeeded')throw new PaymentError('Captured payment is not confirmed.');
    if(!['escrow','balance'].includes(intent.metadata.purpose))return {ignored:true};
    normalized={type:intent.metadata.purpose==='balance'?'BALANCE_CREDIT':'CARD_CAPTURED',payment_intent_id:intent.id,
      contractor_id:uuidValue(intent.metadata.contractor_id,'contractor_id'),customer_reference:intent.customer,amount:amountValue(intent.amount),currency:intent.currency,
      ...(intent.metadata.purpose==='escrow'?{booking_id:uuidValue(intent.metadata.booking_id,'booking_id'),request_id:uuidValue(intent.metadata.request_id,'request_id')}:{})};
  } else if(event.type==='transfer.created') {
    if(!object.metadata?.rigdesk_job_id)return {ignored:true};
    normalized={type:'PAYOUT_SUCCEEDED',job_id:uuidValue(object.metadata.rigdesk_job_id,'job_id'),amount:amountValue(object.amount),currency:object.currency,
      provider_reference:object.id,destination:typeof object.destination==='string'?object.destination:object.destination?.id};
  } else if(event.type==='refund.updated'||event.type==='refund.created') {
    if(!object.metadata?.rigdesk_job_id||object.status!=='succeeded')return {ignored:true};
    normalized={type:'REFUND_SUCCEEDED',job_id:uuidValue(object.metadata.rigdesk_job_id,'job_id'),amount:amountValue(object.amount),currency:object.currency,
      provider_reference:object.id,payment_intent_id:typeof object.payment_intent==='string'?object.payment_intent:object.payment_intent?.id};
  } else if(event.type==='charge.dispute.created') {
    const intent=object.payment_intent;
    if(typeof intent!=='string')throw new PaymentError('Dispute payment reference missing.');
    normalized={type:'DISPUTE_OPENED',payment_intent_id:intent};
  } else return {ignored:true};
  return rpc(database,'apply_payment_event',{p_event_id:event.id,p_event:normalized});
}

export async function runPaymentWorker(database:PaymentDatabase,gateway:PaymentGateway) {
  const jobs:PaymentJob[]=await rpc(database,'claim_payment_jobs',{p_limit:10});
  let submitted=0,failed=0,blocked=0;
  for(const job of jobs) {
    if(!await rpc(database,'validate_payment_job',{p_job:job.id,p_lease:job.lease_token})){blocked++;continue;}
    try {
      const reference=await gateway.submitJob(job);
      await rpc(database,'finish_payment_job',{p_job:job.id,p_lease:job.lease_token,p_reference:reference,p_error:null});submitted++;
    } catch {
      await rpc(database,'finish_payment_job',{p_job:job.id,p_lease:job.lease_token,p_reference:null,p_error:'Provider submission failed; reconcile and retry with the same job ID.'});failed++;
    }
  }
  return {submitted,failed,blocked};
}
