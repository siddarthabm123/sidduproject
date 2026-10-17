import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Fuel, LocateFixed, MapPin, Plus, Printer, RefreshCw, Ticket } from 'lucide-react';
import QRCode from 'qrcode';
import FuelBunkMap, { FuelBrand } from './FuelBunkMap';
import { FuelModal } from './fuel/FuelModal';
import { fuelRequest } from './fuel/client';
import { demoBunks, demoContext } from './fuel/demo';
import { effectiveStatus, nearbyBunks, radii, rupees, savings, validQuantity } from './fuel/domain';
import { fuelText } from './fuel/labels';
import type { FuelLanguage } from './fuel/labels';
import type { BunkRegistration, FuelBunk, FuelCenter, FuelContext, FuelType, FuelVoucher, NearbyFuelResponse, VoucherResponse } from './fuel/types';
import './fuel.css';

const fallback:FuelCenter={id:'default',label:'Map center',latitude:12.97,longitude:77.6};
const emptyContext:FuelContext={can_register:false,can_offer_discounts:false,can_generate:false,equipment:[],centers:[]};
const demoKey='rigdesk-fuel-demo-vouchers-v1';
function savedDemoVouchers():FuelVoucher[]{
  try{const parsed=JSON.parse(localStorage.getItem(demoKey)||'[]');return Array.isArray(parsed)?parsed.filter(v=>v?.demo===true&&typeof v.id==='string'&&typeof v.expires_at==='string'&&Number.isFinite(v.quantity_litres)&&Number.isFinite(v.discount_rate)).slice(0,100):[]}catch{return []}
}
export function voucherLink(v:FuelVoucher):string {
  const url=new URL(`/fuel/voucher/${encodeURIComponent(v.id)}`,window.location.origin);
  if(v.demo){
    url.searchParams.set('demo','1');
    url.searchParams.set('details',JSON.stringify({bunk_name:v.bunk_name,bunk_address:v.bunk_address,fuel_type:v.fuel_type,quantity_litres:v.quantity_litres,discount_rate:v.discount_rate,voucher_code:v.voucher_code,expires_at:v.expires_at}));
  }else url.searchParams.set('token',v.verification_token);
  return url.toString();
}
export default function FuelHubPage({demo,language}:{demo:boolean;language:FuelLanguage}) {
  const t=(text:string)=>fuelText(text,language);
  const [context,setContext]=useState<FuelContext>(demo?demoContext:emptyContext);
  const [center,setCenter]=useState<FuelCenter>(demo?demoContext.centers[0]:fallback);
  const [radius,setRadius]=useState<number>(10);const [fuel,setFuel]=useState<FuelType>('diesel');const [partners,setPartners]=useState(false);
  const [bunks,setBunks]=useState<FuelBunk[]>([]);const [samples,setSamples]=useState(demoBunks);
  const [vouchers,setVouchers]=useState<FuelVoucher[]>(demo?savedDemoVouchers:[]);
  const [selected,setSelected]=useState<string|null>(null);const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');const [notice,setNotice]=useState('');const [refresh,setRefresh]=useState(0);
  const [registration,setRegistration]=useState(false);const [registerPin,setRegisterPin]=useState<{latitude:number;longitude:number}|null>(null);
  const [generate,setGenerate]=useState<FuelBunk|null>(null);const [quantity,setQuantity]=useState('100');const [equipment,setEquipment]=useState('');
  const [busy,setBusy]=useState(false);const [formError,setFormError]=useState('');const [gpsBusy,setGpsBusy]=useState(false);
  const [qrImages,setQrImages]=useState<Record<string,string>>({});const [printVoucher,setPrintVoucher]=useState<FuelVoucher|null>(null);
  const [clock,setClock]=useState(Date.now());const request=useRef<{payload:string;id:string}|null>(null);
  const generating=useRef(false);const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[]);
  useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),30000);return()=>clearInterval(timer)},[]);
  useEffect(()=>{
    if(demo)return;
    const controller=new AbortController();
    fuelRequest<{context:FuelContext}>('context',{signal:controller.signal}).then(({context:next})=>{setContext(next);setCenter(next.centers[0]||fallback)}).catch(e=>{if(!controller.signal.aborted)setError(e.message)});
    return()=>controller.abort();
  },[demo]);
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError('');
    if(demo){setBunks(nearbyBunks(samples,center.latitude,center.longitude,radius,fuel,partners));setLoading(false);return}
    const params=new URLSearchParams({latitude:String(center.latitude),longitude:String(center.longitude),radius_km:String(radius),fuel_type:fuel,partner_only:String(partners)});
    fuelRequest<NearbyFuelResponse>(`bunks/nearby?${params}`,{signal:controller.signal}).then(data=>setBunks(data.bunks)).catch(e=>{if(!controller.signal.aborted){setBunks([]);setError(e.message)}}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});
    return()=>controller.abort();
  },[demo,samples,center,radius,fuel,partners,refresh]);
  useEffect(()=>{
    if(demo)return;
    const controller=new AbortController();
    fuelRequest<{vouchers:FuelVoucher[]}>('vouchers',{signal:controller.signal}).then(data=>setVouchers(data.vouchers)).catch(e=>{if(!controller.signal.aborted)setError(e.message)});
    return()=>controller.abort();
  },[demo,refresh]);
  useEffect(()=>{
    let cancelled=false;
    Promise.all(vouchers.filter(v=>effectiveStatus(v.status,v.expires_at,clock)==='GENERATED').map(async v=>[v.id,await QRCode.toDataURL(voucherLink(v),{width:280,margin:4,errorCorrectionLevel:'M'})] as const))
      .then(entries=>{if(!cancelled)setQrImages(Object.fromEntries(entries))}).catch(()=>{if(!cancelled)setError('QR code could not be generated')});
    return()=>{cancelled=true};
  },[vouchers]);
  const active=vouchers.filter(v=>effectiveStatus(v.status,v.expires_at,clock)==='GENERATED');
  const openGenerate=(bunk:FuelBunk)=>{request.current=null;setGenerate(bunk);setFormError('');setNotice('')};
  const saveVoucher=async(event:FormEvent)=>{
    event.preventDefault();if(!generate||generating.current)return;
    const litres=Number(quantity);if(!validQuantity(litres)){setFormError('Enter a quantity from 1 to 2,000 litres (up to two decimal places).');return}
    generating.current=true;setBusy(true);setFormError('');
    const payload=JSON.stringify({bunk_id:generate.id,fuel_type:fuel.toUpperCase(),quantity_litres:litres,equipment_id:equipment||null});
    if(request.current?.payload!==payload)request.current={payload,id:crypto.randomUUID()};
    try{
      let voucher:FuelVoucher;
      if(demo){
        if(active.length>=10)throw new Error('Active voucher limit reached');
        const code=Array.from(crypto.getRandomValues(new Uint8Array(4)),x=>x.toString(16).padStart(2,'0')).join('').toUpperCase();
        voucher={id:crypto.randomUUID(),owner_id:'demo-owner',bunk_id:generate.id,bunk_name:generate.name,bunk_address:generate.address,equipment_id:equipment||null,
          fuel_type:fuel==='diesel'?'DIESEL':'PETROL',quantity_litres:litres,discount_rate:generate.discount_per_litre,estimated_savings:savings(litres,generate.discount_per_litre),
          voucher_code:code,verification_token:crypto.randomUUID(),request_id:request.current.id,status:'GENERATED',expires_at:new Date(Date.now()+86400000).toISOString(),created_at:new Date().toISOString(),demo:true};
        const next=[voucher,...vouchers].slice(0,100);localStorage.setItem(demoKey,JSON.stringify(next));setVouchers(next);
      }else{
        const result=await fuelRequest<VoucherResponse>('vouchers/generate',{body:{...JSON.parse(payload),request_id:request.current.id}});
        voucher={...result.voucher,bunk_name:generate.name,bunk_address:generate.address};
        setVouchers(previous=>[voucher,...previous.filter(v=>v.id!==voucher.id)]);
      }
      setGenerate(null);setNotice('Voucher created');
    }catch(e){setFormError(e instanceof Error?e.message:'Fuel service is unavailable. Please retry later.')}
    finally{generating.current=false;setBusy(false)}
  };
  const saveBunk=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();if(!registerPin||generating.current)return;
    const values=new FormData(event.currentTarget);const isPartner=values.get('partner')==='on';
    const data:BunkRegistration={...registerPin,name:String(values.get('name')||''),brand:String(values.get('brand')||''),address:String(values.get('address')||''),
      contact_phone:String(values.get('phone')||''),is_partner:isPartner,discount_per_litre:isPartner?Number(values.get('rate')):0,
      fuel_types_available:values.getAll('fuels') as FuelType[]};
    if(!data.fuel_types_available.length){setFormError('Choose at least one fuel');return}
    generating.current=true;setBusy(true);setFormError('');
    try{
      if(demo)setSamples(previous=>[...previous,{...data,id:crypto.randomUUID(),created_at:new Date().toISOString(),distance_km:0}]);
      else await fuelRequest('bunks',{body:data});
      setRegisterPin(null);setRegistration(false);setRefresh(n=>n+1);setNotice('Fuel bunk registered');
    }catch(e){setFormError(e instanceof Error?e.message:'Fuel service is unavailable. Please retry later.')}
    finally{generating.current=false;setBusy(false)}
  };
  const locate=()=>{
    setGpsBusy(true);
    const failed=()=>{if(mounted.current){setGpsBusy(false);setError('GPS unavailable. Choose a saved location or the map center.')}};
    if(!navigator.geolocation){failed();return}
    navigator.geolocation.getCurrentPosition(position=>{if(mounted.current){setCenter({id:'gps',label:'GPS',latitude:position.coords.latitude,longitude:position.coords.longitude});setGpsBusy(false);setSelected(null)}},failed,{timeout:12000,maximumAge:60000,enableHighAccuracy:true});
  };
  const print=(voucher:FuelVoucher)=>{setPrintVoucher(voucher);requestAnimationFrame(()=>requestAnimationFrame(()=>window.print()))};
  return <div className="fuel-hub" data-localized>
    <div className="fuel-page-heading"><div><span className="fuel-eyebrow">RIGDESK / {t('Fuel hub')}</span><h1>{t('Fuel Bunks & Partner Discounts')}</h1></div>
      <button className="fuel-icon" title={t('Refresh')} aria-label={t('Refresh')} onClick={()=>setRefresh(n=>n+1)}><RefreshCw size={19}/></button></div>
    {demo&&<div className="fuel-demo" role="note">{t('Demo only. Sample pumps and discounts are fictional. Vouchers cannot be redeemed.')}</div>}
    <div className="fuel-filters">
      <label>{t('Location')}<select value={center.id} onChange={e=>{const next=[fallback,...context.centers].find(c=>c.id===e.target.value);if(next){setCenter(next);setSelected(null)}}}>
        <option value="default">{t('Map center')}</option>{context.centers.map(c=><option key={c.id} value={c.id}>{t(c.label)}</option>)}{center.id==='gps'&&<option value="gps">GPS</option>}
      </select></label>
      <button className="fuel-button secondary" onClick={locate} disabled={gpsBusy}><LocateFixed size={17}/>{t('Use GPS')}</button>
      <label className="fuel-radius">{t('Search radius')} <strong>{radius} {t('km')}</strong><input aria-label={t('Search radius')} type="range" min="0" max="2" step="1" value={radii.indexOf(radius as 5)} onChange={e=>setRadius(radii[Number(e.target.value)])}/><span>5 / 10 / 25 {t('km')}</span></label>
      <div className="fuel-segment" role="group" aria-label={t('Available fuels')}>{(['diesel','petrol'] as FuelType[]).map(f=><button type="button" key={f} aria-pressed={fuel===f} className={fuel===f?'active':''} onClick={()=>setFuel(f)}><Fuel size={15}/>{t(f==='diesel'?'Diesel':'Petrol')}</button>)}</div>
      <label className="fuel-check"><input type="checkbox" checked={partners} onChange={e=>setPartners(e.target.checked)}/>{t('Partner only')}</label>
    </div>
    {error&&<div className="fuel-error" role="alert">{t(error)}</div>}{notice&&<p className="fuel-success" role="status">{t(notice)}</p>}
    <div className="fuel-section-head"><h2>{t('Nearby fuel bunks')} <span>{bunks.length}</span></h2>
      {context.can_register&&<button className="fuel-button secondary" aria-pressed={registration} onClick={()=>{setRegistration(!registration);setFormError('')}}><Plus size={17}/>{t(registration?'Cancel':'Register New Fuel Bunk')}</button>}</div>
    <div className="fuel-split">
      <FuelBunkMap center={center} bunks={bunks} selected={selected} registration={registration} language={language} canGenerate={context.can_generate} onSelect={setSelected} onGenerate={openGenerate} onRegister={(latitude,longitude)=>{setRegisterPin({latitude,longitude});setFormError('')}}/>
      <div className="fuel-station-list" aria-busy={loading}>{loading?<p className="fuel-empty" role="status">{t('Loading fuel stations')}</p>:!bunks.length?<p className="fuel-empty">{t('No stations in this radius')}</p>:bunks.map(bunk=><article key={bunk.id} className={`fuel-station ${selected===bunk.id?'selected':''}`}>
        <div className="fuel-station-head"><FuelBrand brand={bunk.brand}/><div><button className="fuel-station-name" onClick={()=>setSelected(bunk.id)}>{bunk.name}</button><p>{bunk.brand} · {bunk.distance_km.toFixed(1)} {t('km')}</p></div></div>
        <p className="fuel-address"><MapPin size={14}/>{bunk.address}</p>
        <div className="fuel-station-meta"><span>{bunk.fuel_types_available.map(f=>t(f==='diesel'?'Diesel':'Petrol')).join(' / ')}</span>{bunk.is_partner?<span className="fuel-discount">{t('Save')} {rupees(bunk.discount_per_litre)}/L</span>:<span>{t('Standard pump')}</span>}</div>
        {bunk.contact_phone&&<a href={`tel:${bunk.contact_phone.replace(/[^+\d]/g,'')}`} className="fuel-phone">{bunk.contact_phone}</a>}
        {bunk.is_partner&&context.can_generate&&<button className="fuel-button" onClick={()=>openGenerate(bunk)}><Ticket size={17}/>{t('Generate Discount Voucher')}</button>}
      </article>)}</div>
    </div>
    <section className="fuel-vouchers"><div className="fuel-section-head"><h2>{t('Active fuel vouchers')} <span>{active.length}</span></h2></div>
      {!active.length?<p className="fuel-empty">{t('No active vouchers')}</p>:<div className="fuel-voucher-grid">{active.map(v=><article className="fuel-voucher" key={v.id}>
        <div className="fuel-voucher-heading"><Ticket size={19}/><strong>{v.bunk_name}</strong><span className="fuel-discount">{t('GENERATED')}</span></div>
        {v.demo&&<p className="fuel-demo-stamp">{t('Demo voucher - not valid at a pump')}</p>}
        <div className="fuel-voucher-body">{qrImages[v.id]?<a href={voucherLink(v)} aria-label={t('Verify voucher')}><img src={qrImages[v.id]} alt={t('Verify voucher')} width="140" height="140"/></a>:<div className="fuel-qr-placeholder" aria-busy="true"/>}
          <div><code>{v.voucher_code}</code><p>{t(v.fuel_type==='DIESEL'?'Diesel':'Petrol')} · {v.quantity_litres} L</p><p>{t('Save')} {rupees(v.discount_rate)}/L</p><strong>{t('Estimated savings')}: {rupees(v.estimated_savings)}</strong></div></div>
        <p className="fuel-expiry">{t('Expires')}: {new Date(v.expires_at).toLocaleString(language==='kn'?'kn-IN':language==='hi'?'hi-IN':'en-IN')}</p>
        <button className="fuel-button secondary" disabled={!qrImages[v.id]} onClick={()=>print(v)}><Printer size={16}/>{t('Print voucher')}</button>
      </article>)}</div>}
    </section>
    {generate&&<FuelModal title={t('Generate Discount Voucher')} onClose={()=>setGenerate(null)} busy={busy}><form onSubmit={saveVoucher}>
      <div className="fuel-dialog-body"><strong>{generate.name}</strong><p>{t('Save')} {rupees(generate.discount_per_litre)} {t('per litre')} · {t(fuel==='diesel'?'Diesel':'Petrol')}</p>
        {demo&&<p className="fuel-demo-stamp">{t('Demo voucher - not valid at a pump')}</p>}
        <label>{t('Quantity (litres)')}<input autoFocus type="number" min="1" max="2000" step="0.01" required value={quantity} onChange={e=>setQuantity(e.target.value)} disabled={busy}/></label>
        <label>{t('Equipment')}<select value={equipment} onChange={e=>setEquipment(e.target.value)} disabled={busy}><option value="">{t('No equipment selected')}</option>{context.equipment.map(e=><option key={e.id} value={e.id}>{e.title}</option>)}</select></label>
        <div className="fuel-total"><span>{t('Estimated savings')}</span><strong>{rupees(validQuantity(Number(quantity))?savings(Number(quantity),generate.discount_per_litre):0)}</strong></div>
        {formError&&<p className="fuel-error" role="alert">{t(formError)}</p>}</div>
      <footer><button type="button" className="fuel-button secondary" onClick={()=>setGenerate(null)} disabled={busy}>{t('Cancel')}</button><button className="fuel-button" disabled={busy}><Ticket size={17}/>{t(busy?'Generating':'Generate voucher')}</button></footer>
    </form></FuelModal>}
    {registerPin&&<FuelModal title={t('Register New Fuel Bunk')} onClose={()=>setRegisterPin(null)} busy={busy}><form onSubmit={saveBunk}><div className="fuel-dialog-body">
      {demo&&<p className="fuel-demo-stamp">{t('Demo only. Sample pumps and discounts are fictional. Vouchers cannot be redeemed.')}</p>}
      <div className="fuel-form-grid"><label>{t('Latitude')}<input readOnly value={registerPin.latitude.toFixed(6)}/></label><label>{t('Longitude')}<input readOnly value={registerPin.longitude.toFixed(6)}/></label></div>
      <label>{t('Name')}<input name="name" autoFocus required minLength={2} maxLength={120} disabled={busy}/></label>
      <label>{t('Brand')}<select name="brand" disabled={busy}>{['BPCL','HPCL','Shell','IndianOil','Independent'].map(b=><option key={b}>{b}</option>)}</select></label>
      <label>{t('Address')}<textarea name="address" required minLength={5} maxLength={500} disabled={busy}/></label>
      <label>{t('Contact phone')}<input name="phone" type="tel" maxLength={25} disabled={busy}/></label>
      <fieldset><legend>{t('Available fuels')}</legend>{(['diesel','petrol'] as FuelType[]).map(f=><label key={f} className="fuel-check"><input type="checkbox" name="fuels" value={f} defaultChecked={f==='diesel'} disabled={busy}/>{t(f==='diesel'?'Diesel':'Petrol')}</label>)}</fieldset>
      <label className="fuel-check"><input type="checkbox" name="partner" disabled={busy||!context.can_offer_discounts}/>{t('Partner')}</label>
      <label>{t('Discount per litre')}<input type="number" name="rate" defaultValue="1" min="0.01" max="10" step="0.01" disabled={busy||!context.can_offer_discounts}/></label>
      {formError&&<p className="fuel-error" role="alert">{t(formError)}</p>}</div><footer><button type="button" className="fuel-button secondary" onClick={()=>setRegisterPin(null)} disabled={busy}>{t('Cancel')}</button><button className="fuel-button" disabled={busy}><Plus size={17}/>{t(busy?'Saving':'Register')}</button></footer></form></FuelModal>}
    {printVoucher&&<section className="fuel-print-sheet"><h1>RigDesk</h1><h2>{t('Fuel voucher')}</h2>{printVoucher.demo&&<p>{t('Demo voucher - not valid at a pump')}</p>}
      <img src={qrImages[printVoucher.id]} width="240" height="240" alt={t('Verify voucher')}/><code>{printVoucher.voucher_code}</code><h3>{printVoucher.bunk_name}</h3><p>{printVoucher.bunk_address}</p>
      <p>{t(printVoucher.fuel_type==='DIESEL'?'Diesel':'Petrol')}: {printVoucher.quantity_litres} L</p><p>{t('Save')} {rupees(printVoucher.discount_rate)}/L</p><strong>{t('Estimated savings')}: {rupees(printVoucher.estimated_savings)}</strong><p>{t('Expires')}: {new Date(printVoucher.expires_at).toLocaleString()}</p>
    </section>}
  </div>;
}
