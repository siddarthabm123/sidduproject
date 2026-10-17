import Stripe from 'stripe';

export type CapturedIntent = {
  id:string; status:string; amount:number; currency:string; customer:string|null; metadata:Record<string,string>;
};
export type PaymentJob = {
  id:string; kind:'PAYOUT'|'REFUND'; amount:number; currency:string; destination:string|null;
  payment_intent_id:string|null; lease_token:string; attempts:number; first_attempt_at:string;
};
export type GatewayEvent = { id:string; type:string; object:Record<string,any> };
export interface PaymentGateway {
  retrieveIntent(id:string):Promise<CapturedIntent>;
  verifyWebhook(raw:Buffer,signature:string):GatewayEvent;
  submitJob(job:PaymentJob):Promise<string>;
}

export class StripeGateway implements PaymentGateway {
  private readonly client:Stripe;
  constructor(key:string,private readonly webhookSecret:string) {
    this.client=new Stripe(key,{timeout:10000,maxNetworkRetries:2});
  }
  async retrieveIntent(id:string):Promise<CapturedIntent> {
    const intent=await this.client.paymentIntents.retrieve(id);
    return {id:intent.id,status:intent.status,amount:intent.amount_received,currency:intent.currency,
      customer:typeof intent.customer==='string'?intent.customer:intent.customer?.id||null,metadata:intent.metadata};
  }
  verifyWebhook(raw:Buffer,signature:string):GatewayEvent {
    if(!this.webhookSecret)throw new Error('Webhook signing is not configured.');
    const event=this.client.webhooks.constructEvent(raw,signature,this.webhookSecret,300);
    if(event.livemode!==(process.env.PAYMENTS_LIVE_MODE==='true'))throw new Error('Gateway mode mismatch.');
    if(event.account)throw new Error('Platform payment event required.');
    return {id:event.id,type:event.type,object:event.data.object as unknown as Record<string,any>};
  }
  async submitJob(job:PaymentJob) {
    // Stripe may discard an idempotency key after 24 hours. Ambiguous old attempts need reconciliation, not a second payment.
    if(job.attempts>1&&Date.now()-Date.parse(job.first_attempt_at)>23*3600000)throw new Error('Payment requires provider reconciliation before retry.');
    const options={idempotencyKey:`rigdesk-${job.kind.toLowerCase()}-${job.id}`};
    if(job.kind==='PAYOUT') {
      if(!job.destination)throw new Error('Verified vendor payout destination required.');
      const transfer=await this.client.transfers.create({amount:job.amount,currency:job.currency,destination:job.destination,
        transfer_group:`rigdesk-${job.id}`,metadata:{rigdesk_job_id:job.id}},options);
      return transfer.id;
    }
    if(!job.payment_intent_id)throw new Error('Captured payment intent required for refund.');
    const refund=await this.client.refunds.create({payment_intent:job.payment_intent_id,amount:job.amount,metadata:{rigdesk_job_id:job.id}},options);
    return refund.id;
  }
}

export function configuredGateway():PaymentGateway {
  const key=process.env.STRIPE_SECRET_KEY;
  if(!key)throw new Error('Payment gateway is not configured.');
  if((key.startsWith('sk_live_'))!==(process.env.PAYMENTS_LIVE_MODE==='true'))throw new Error('Gateway mode mismatch.');
  return new StripeGateway(key,process.env.STRIPE_WEBHOOK_SECRET||'');
}
