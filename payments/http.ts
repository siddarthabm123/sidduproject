import { timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { authenticatedDatabase, ServiceError } from '../server-supabase.js';
import { configuredGateway } from './gateway.js';
import { EscrowService, PaymentError, processGatewayEvent, runPaymentWorker } from './service.js';
import type { PaymentDatabase } from './service.js';
import type { PaymentGateway } from './gateway.js';
import { transactionalPaymentDatabase } from './transaction.js';

type Request = {method?:string;headers:Record<string,unknown>;body?:any;rawBody?:Buffer;[Symbol.asyncIterator]?:()=>AsyncIterator<Buffer>};
type Response = {setHeader(name:string,value:string):void;status(code:number):Response;json(value:unknown):unknown};
export function privilegedPaymentDatabase() {
  const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw new PaymentError('Privileged payment database is not configured.',503);
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
async function rawBody(req:Request) {
  if(req.rawBody)return req.rawBody;
  if(Buffer.isBuffer(req.body))return req.body;
  if(typeof req.body==='string')return Buffer.from(req.body);
  if(!req[Symbol.asyncIterator])throw new PaymentError('Raw webhook body is required.',400);
  const chunks:Buffer[]=[];let size=0;
  for await(const chunk of req as AsyncIterable<Buffer>) {size+=chunk.length;if(size>65536)throw new PaymentError('Webhook body too large.',413);chunks.push(chunk);}
  return Buffer.concat(chunks);
}
type Dependencies={authenticate:(req:Request)=>Promise<PaymentDatabase>;privileged:()=>PaymentDatabase;gateway:()=>PaymentGateway};
const dependencies:Dependencies={authenticate:authenticatedDatabase,privileged:privilegedPaymentDatabase,gateway:configuredGateway};
export function paymentHandler(operation:'lock'|'release'|'refund'|'inspect'|'sign-off'|'factor'|'webhook'|'worker',deps:Dependencies=dependencies) {
  return async(req:Request,res:Response)=>{
    res.setHeader('Cache-Control','no-store');
    if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed.'})}
    if(process.env.PAYMENTS_ENABLED!=='true')return res.status(503).json({error:'Payments are not enabled. No funds have been moved.'});
    try {
      if(operation==='webhook') {
        let event;const gateway=deps.gateway();
        try{const raw=await rawBody(req);if(raw.length>65536)throw new PaymentError('Webhook body too large.',413);event=gateway.verifyWebhook(raw,String(req.headers['stripe-signature']||''));}
        catch(e){if(e instanceof PaymentError)throw e;throw new PaymentError('Invalid webhook signature.',400)}
        return res.status(200).json(await processGatewayEvent(event,gateway,deps.privileged()));
      }
      if(operation==='worker') {
        const secret=process.env.PAYMENT_WORKER_SECRET||'',actual=String(req.headers.authorization||'');
        if(secret.length<32)throw new PaymentError('Payment worker authentication is not configured.',503);
        const expected=Buffer.from(`Bearer ${secret}`),provided=Buffer.from(actual);
        if(expected.length!==provided.length||!timingSafeEqual(expected,provided))throw new PaymentError('Worker authentication required.',401);
        return res.status(200).json(await runPaymentWorker(transactionalPaymentDatabase(deps.privileged()),deps.gateway()));
      }
      let database;try{database=await deps.authenticate(req)}catch(e){if(e instanceof ServiceError)throw new PaymentError(e.message,e.status);throw new PaymentError('Authentication required.',401)}
      const service=new EscrowService(database,deps.privileged,deps.gateway),body=req.body||{};
      const result=operation==='lock'?await service.lock(body,req.headers['idempotency-key']):operation==='release'?await service.release(body.booking_id):
        operation==='refund'?await service.refund(body.booking_id):operation==='inspect'?await service.inspect(body):operation==='sign-off'?await service.signOff(body.inspection_id):
        await service.factor(body.invoice_id,req.headers['idempotency-key']);
      return res.status(200).json({data:result});
    }catch(e){return res.status(e instanceof PaymentError?e.status:503).json({error:e instanceof PaymentError?e.message:'Payment service unavailable. No successful transfer is being claimed.'})}
  };
}
