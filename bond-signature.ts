import { createHmac, timingSafeEqual } from 'node:crypto';
import { deflateRawSync, inflateRawSync } from 'node:zlib';
import { paymentSummary } from './marketplace-domain.js';

export type BondPayload = {
  bookingId:string; dateGenerated:string; ownerName:string; ownerContact:string;
  customerName:string; customerContact:string; serviceDescription:string; completionDate:string;
  totalAmount:number; amountPaid:number; remainingAmount:number; dueDate:string;
  customerIpAddress:string; acceptanceTimestamp:string; mode?:'live'|'demo';
};
function secret(){return process.env.BOND_PDF_SECRET?.trim()||null}
function publicRecord(payload:BondPayload):BondPayload {
  return {...payload,mode:payload.mode||'live',ownerContact:'Not publicly shared',customerContact:'Not publicly shared',customerIpAddress:'Not publicly shared'};
}
export function signBond(payload:BondPayload) {
  const key=secret();if(!key)throw new Error('Bond signing is not configured.');
  const compressed=deflateRawSync(Buffer.from(JSON.stringify(publicRecord(payload))));
  const body=`v2.${compressed.toString('base64url')}`;
  return `${body}.${createHmac('sha256',key).update(body).digest('base64url')}`;
}
export function verifyBondToken(token:string):BondPayload|null {
  // Old v1 documents were based on arbitrary client data and cannot prove a booking.
  const key=secret();if(!key||token.length>8000)return null;
  const [version,body,signature,...extra]=token.split('.');if(version!=='v2'||!body||!signature||extra.length)return null;
  const expected=createHmac('sha256',key).update(`${version}.${body}`).digest();
  const actual=Buffer.from(signature,'base64url');if(expected.length!==actual.length||!timingSafeEqual(expected,actual))return null;
  try{
    const record=JSON.parse(inflateRawSync(Buffer.from(body,'base64url'),{maxOutputLength:16000}).toString('utf8')) as BondPayload;
    const amounts=paymentSummary(record.totalAmount,record.amountPaid);
    if(typeof record.bookingId!=='string'||!record.bookingId.trim()||record.bookingId.length>80||typeof record.serviceDescription!=='string'||!['live','demo'].includes(record.mode||'')||!Number.isFinite(record.remainingAmount)||Math.abs(amounts.remaining-record.remainingAmount)>.01)return null;
    return publicRecord(record);
  }catch{return null}
}
