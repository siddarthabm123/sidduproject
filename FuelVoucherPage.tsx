import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { Check, Ticket } from 'lucide-react';
import { fuelRequest } from './fuel/client';
import { effectiveStatus, rupees, savings, validQuantity } from './fuel/domain';
import { fuelText } from './fuel/labels';
import type { FuelLanguage } from './fuel/labels';
import type { PublicFuelVoucher } from './fuel/types';
import './fuel.css';

export default function FuelVoucherPage({id,language}:{id:string;language:FuelLanguage}) {
  const t=(text:string)=>fuelText(text,language);const params=new URLSearchParams(window.location.search);const demo=params.get('demo')==='1';const token=params.get('token')||'';
  const [voucher,setVoucher]=useState<PublicFuelVoucher|null>(null);const [error,setError]=useState('');const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [quantity,setQuantity]=useState('');
  const [clock,setClock]=useState(Date.now());
  useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),10000);return()=>clearInterval(timer)},[]);
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError('');
    if(demo){
      try{
        const v=JSON.parse(params.get('details')||'{}');
        if(typeof v.bunk_name!=='string'||v.bunk_name.length>120||typeof v.bunk_address!=='string'||v.bunk_address.length>500||!validQuantity(v.quantity_litres)||!Number.isFinite(v.discount_rate)||v.discount_rate<=0||v.discount_rate>10||!['DIESEL','PETROL'].includes(v.fuel_type)||!/^[A-F0-9]{8}$/.test(v.voucher_code)||!Number.isFinite(new Date(v.expires_at).getTime()))throw new Error();
        setVoucher({...v,id,bunk_id:'demo',estimated_savings:savings(v.quantity_litres,v.discount_rate),status:'GENERATED'});
      }catch{setError('Voucher not found')}
      setLoading(false);return;
    }
    fuelRequest<{voucher:PublicFuelVoucher}>(`vouchers/verify?${new URLSearchParams({id,token})}`,{public:true,signal:controller.signal}).then(data=>{setVoucher(data.voucher);setQuantity(String(data.voucher.quantity_litres))}).catch(e=>{if(!controller.signal.aborted)setError(e.message)}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});
    return()=>controller.abort();
  },[id,demo,token]);
  const status=voucher?effectiveStatus(voucher.status,voucher.expires_at,clock):'';
  return <main className="fuel-public fuel-hub" data-localized><Link href="/" className="fuel-public-logo">RigDesk</Link><h1><Ticket size={26}/>{t('Fuel voucher')}</h1>
    {demo&&<p className="fuel-demo">{t('Demo voucher - not valid at a pump')}</p>}
    {loading&&<p role="status">{t('Loading fuel stations')}</p>}{error&&<p role="alert" className="fuel-error">{t(error)}</p>}
    {voucher&&<><h2>{voucher.bunk_name}</h2><p>{voucher.bunk_address}</p><code className="fuel-public-code">{voucher.voucher_code}</code><p className="fuel-discount">{t(status)}</p>
      <dl><dt>{t('Available fuels')}</dt><dd>{t(voucher.fuel_type==='DIESEL'?'Diesel':'Petrol')}</dd><dt>{t('Quantity (litres)')}</dt><dd>{voucher.quantity_litres} L</dd><dt>{t('Discount per litre')}</dt><dd>{rupees(voucher.discount_rate)}</dd><dt>{t('Estimated savings')}</dt><dd>{rupees(voucher.estimated_savings)}</dd><dt>{t('Expires')}</dt><dd>{new Date(voucher.expires_at).toLocaleString()}</dd></dl>
      {!demo&&status==='GENERATED'&&<form onSubmit={async event=>{event.preventDefault();if(busy)return;setBusy(true);setError('');try{
        await fuelRequest('vouchers/redeem',{body:{id,token,quantity_litres:Number(quantity)}});setVoucher({...voucher,status:'REDEEMED'});
      }catch(e){setError(e instanceof Error?e.message:'Invalid fuel request')}finally{setBusy(false)}}}>
        <p>{t('Assigned pump staff only')}</p><label>{t('Actual quantity (litres)')}<input type="number" min="1" max={voucher.quantity_litres} step="0.01" required value={quantity} disabled={busy} onChange={e=>setQuantity(e.target.value)}/></label><button className="fuel-button" disabled={busy}><Check size={17}/>{t('Redeem voucher')}</button>
      </form>}
    </>}
  </main>;
}
