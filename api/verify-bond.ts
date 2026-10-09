import { verifyBondToken } from '../bond-signature.js';
import { serverDatabase } from '../server-supabase.js';

export default async function handler(req:any,res:any) {
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed.'})}
  const bond=verifyBondToken(String(req.query?.token||''));
  if(!bond||String(req.query?.reference||'')!==bond.bookingId)return res.status(400).json({verified:false,error:'Invalid signature or mismatched document reference. Generate a new document for legacy bonds.'});
  if(bond.mode==='demo')return res.status(200).json({verified:false,demo:true,bond});
  try{
    const result=await serverDatabase().rpc('bond_status',{p_booking:bond.bookingId});
    if(result.error||!result.data)throw new Error('Booking record unavailable.');
    if(result.data==='cancelled')return res.status(409).json({verified:false,error:'This booking has been cancelled.'});
    return res.status(200).json({verified:true,bond:{...bond,currentStatus:result.data}});
  }catch{return res.status(503).json({verified:false,error:'The current database record could not be checked. Try again later.'})}
}
