import { createHash } from 'node:crypto';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { signBond } from './bond-signature.js';
import type { BondPayload } from './bond-signature.js';
import { authenticatedDatabase } from './server-supabase.js';
import { paymentSummary } from './marketplace-domain.js';

const text = (value:unknown,max=200) => String(value??'').trim().slice(0,max);
const money = (amount:number) => `INR ${amount.toLocaleString('en-IN',{maximumFractionDigits:2})}`;

export function validateBond(input:unknown):BondPayload {
  if(!input||typeof input!=='object')throw new Error('A booking record is required.');
  const value=input as BondPayload;
  const financial=paymentSummary(Number(value.totalAmount),Number(value.amountPaid));
  if(!Number.isFinite(Number(value.remainingAmount))||Math.abs(financial.remaining-Number(value.remainingAmount))>0.01)throw new Error('Payment totals do not match.');
  if(!text(value.bookingId)||!text(value.serviceDescription)||!text(value.acceptanceTimestamp))throw new Error('Incomplete booking record.');
  return {...value,bookingId:text(value.bookingId,80),serviceDescription:text(value.serviceDescription,400),mode:value.mode==='demo'?'demo':'live'};
}

export default async function handler(req:any,res:any) {
  res.setHeader('Cache-Control','private, no-store');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed.'})}
  try {
    const input=typeof req.body==='string'?JSON.parse(req.body):req.body;
    let bond:BondPayload;
    if(input?.mode==='demo') {
      bond=validateBond({...input,mode:'demo',ownerName:'Demo equipment owner',customerName:'Demo customer',
        ownerContact:'Not publicly shared',customerContact:'Not publicly shared',customerIpAddress:'Not publicly shared',
        amountPaid:0,remainingAmount:Number(input.totalAmount)});
    } else {
      const database=await authenticatedDatabase(req);
      const {data,error}=await database.rpc('bond_record',{p_booking:input?.bookingId});
      if(error||!data)throw new Error('An accepted booking belonging to your account is required.');
      // Never sign financials, identities or milestones supplied by the browser.
      bond=validateBond(data);
    }
    if(!process.env.BOND_PDF_SECRET?.trim())return res.status(503).json({error:'Bond signing is not configured.'});
    const token=signBond(bond);
    const base=process.env.BOND_VERIFY_BASE_URL||'https://rigdesk-marketplace-rig-logi-x.vercel.app/verify/';
    const url=`${base.replace(/\/$/,'')}/${encodeURIComponent(bond.bookingId)}?token=${encodeURIComponent(token)}`;
    const qr=await QRCode.toDataURL(url,{errorCorrectionLevel:'M',margin:4,width:640});
    const digest=createHash('sha256').update(token).digest('hex').toUpperCase();
    const doc=new jsPDF({unit:'mm',format:'a4',compress:true});
    const demo=bond.mode==='demo';
    doc.setTextColor(24,48,58);doc.setFont('helvetica','bold');doc.setFontSize(17);doc.text('RigDesk',16,23);
    doc.setFontSize(12);doc.text(demo?'DEMO BOOKING RECORD':'BOOKING & PAYMENT RECORD',16,33);
    doc.setFont('helvetica','normal');doc.setFontSize(8);
    doc.text(doc.splitTextToSize(`Reference: ${bond.bookingId}\nIssued: ${bond.dateGenerated}`,115),16,42);
    doc.addImage(qr,'PNG',138,12,56,56);doc.text('SCAN TO CHECK RECORD',166,73,{align:'center'});
    let y=86;
    const row=(label:string,value:unknown)=>{
      doc.setFont('helvetica','bold');doc.setFontSize(9);doc.text(label,16,y);
      doc.setFont('helvetica','normal');const lines=doc.splitTextToSize(text(value,400),116);doc.text(lines,78,y);y+=Math.max(7,lines.length*4+3);
    };
    const heading=(label:string)=>{doc.setFillColor(231,242,238);doc.rect(16,y-3,178,8,'F');doc.setFont('helvetica','bold');doc.text(label,19,y+2);y+=13};
    heading('PARTIES & BOOKING');
    row('Equipment owner',bond.ownerName);row('Customer reference',bond.customerName);row('Service',bond.serviceDescription);
    row('Owner accepted',bond.acceptanceTimestamp);row('Work completed',bond.completionDate);
    heading('PAYMENT SUMMARY');
    row('Agreed total',money(bond.totalAmount));row('Recorded payment',money(bond.amountPaid));row('Unsettled balance',money(bond.remainingAmount));row('Payment due',bond.dueDate);
    heading('RECORD INTEGRITY');
    doc.setFont('helvetica','normal');doc.setFontSize(8.5);
    const notice=demo?'DEMO ONLY. This document shows simulated activity. It is not an original booking, receipt, payment confirmation or enforceable agreement.':
      'This QR checks a database-issued booking summary and the current booking status. Compare every printed field with the verification page. A valid QR does not authenticate unrelated paper content, prove payment outside the recorded ledger or guarantee legal enforceability.';
    doc.text(doc.splitTextToSize(notice,178),16,y);y+=24;
    doc.setFontSize(7.5);doc.text(`Fingerprint: ${digest.slice(0,40)}`,16,y);y+=7;
    doc.text('Private contacts, exact site addresses and network details are not included in the public QR.',16,y);
    doc.setFont('helvetica','bold');doc.setFontSize(8);doc.text(demo?'RigDesk | DEMO - NOT VERIFIED BOOKING PROOF':'RigDesk | Database-issued record | One page',16,283);
    if(doc.getNumberOfPages()!==1||y>275)throw new Error('Record exceeds the one-page document limit.');
    res.setHeader('Content-Type','application/pdf');
    res.setHeader('Content-Disposition',`attachment; filename="RigDesk-Bond-${bond.bookingId.replace(/[^a-zA-Z0-9_-]/g,'_')}.pdf"`);
    return res.status(200).send(Buffer.from(doc.output('arraybuffer')));
  }catch(error){const detail=error instanceof Error?error.message:'Bond generation failed.';return res.status(/Authentication|session has expired/.test(detail)?401:400).json({error:detail})}
}
