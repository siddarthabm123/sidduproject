import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useLocation } from 'wouter';
import { ArrowRight, Check, Download, Plus, RefreshCw, Search, Truck, X } from 'lucide-react';
import { supabase } from './supabase';
import { bookingRequestKey, positiveNumber, saveAndRefresh, unitCount } from './marketplace-domain';
import { interfaceText } from './interface-translations';
import './marketplace.css';

type Equipment = { id:string; owner_id:string; owner_name:string; title:string; category:string; sector:string; current_address:string; pricing_unit:string; base_rate_paise:number; available_units:number; image_url:string; is_verified:boolean; rating:number|null; review_count:number; status:string };
type Job = { id:string; public_code:string; owner_name:string; customer_name:string; equipment_title:string; requested_date:string; job_address:string|null; instructions:string|null; equipment_units:number; quantity:number; billing_unit:string; total_cost_paise:number; amount_paid_paise:number; status:string; accepted_at:string|null; completion_requested_at:string|null; owner_phone:string|null; customer_phone:string|null; reservation_start:string; reservation_end:string; request_expires_at:string|null; cancellation_reason:string|null; dispute_status:string|null; dispute_reason:string|null };
type Auction = { id:string; customer_id:string; title:string; description:string; job_address:string|null; job_area:string; duration_days:number; requested_date:string; ceiling_paise:number; status:string; expires_at:string };
type Bid = { id:string; auction_id:string; owner_id:string; equipment_id:string; amount_paise:number; eta_minutes:number };
type Profile = { id:string; role:'customer'|'owner'; full_name:string; workspace_name:string; phone:string; service_area:string; address:string; wallets:{available_balance_paise:number;upi_id:string;bank_name:string}[] };
const today = () => new Date().toLocaleDateString('en-CA');
const rupees = (paise:number) => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(paise/100);
const message = (error:unknown) => error instanceof Error ? error.message : typeof error==='object'&&error&&'message' in error ? String(error.message) : 'Request failed. Please retry.';

export default function RealWorkspace({ shell, onInvalidSession }: {shell:(children:ReactNode)=>ReactNode;onInvalidSession:()=>void}) {
  const [location,setLocation] = useLocation();
  const [profile,setProfile] = useState<Profile|null>(null);
  const [equipment,setEquipment] = useState<Equipment[]>([]);
  const [jobs,setJobs] = useState<Job[]>([]);
  const [auctions,setAuctions] = useState<Auction[]>([]);
  const [bids,setBids] = useState<Bid[]>([]);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const busyRef=useRef(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [query,setQuery] = useState('');
  const [category,setCategory] = useState('All');
  const [selected,setSelected] = useState<Record<string,number>>({});
  const [bookingOpen,setBookingOpen] = useState(false);
  const [quantity,setQuantity] = useState(1);
  const [sort,setSort] = useState('price');
  const [coords,setCoords] = useState<{lat:number;lng:number}|null>(null);
  const [language,setLanguage] = useState(document.documentElement.lang || 'en');
  useEffect(()=>{const listener=(event:Event)=>setLanguage((event as CustomEvent<string>).detail);window.addEventListener('rigdesk-language',listener);return()=>window.removeEventListener('rigdesk-language',listener)},[]);
  const t=(text:string)=>liveText(text,language);

  const refresh = async () => {
    if (!supabase) { onInvalidSession(); return; }
    const auth = await supabase.auth.getUser();
    if (auth.error || !auth.data.user) { onInvalidSession(); return; }
    const user = await supabase.from('users').select('*, wallets(*)').eq('id',auth.data.user.id).single();
    if (user.error) throw user.error;
    if (!['customer','owner'].includes(user.data.role)) throw new Error('This workspace supports customer and owner accounts only.');
    setProfile(user.data);
    const results = await Promise.all([
      supabase.rpc('marketplace_equipment'), supabase.rpc('my_booking_records'),
      supabase.rpc('marketplace_auction_records'),
      supabase.from('marketplace_bids').select('*'),
    ]);
    for (const result of results) if (result.error) throw result.error;
    setEquipment(results[0].data || []); setJobs(results[1].data || []);
    setAuctions(results[2].data || []); setBids(results[3].data || []);
  };
  useEffect(()=>{
    let stopped=false;
    let inFlight=false;
    const load=async()=>{if(inFlight||stopped)return;inFlight=true;try{await refresh();if(!stopped)setError('')}catch(e){if(!stopped)setError(message(e))}finally{inFlight=false;if(!stopped)setLoading(false)}};
    void load();
    const interval=window.setInterval(load,30000);window.addEventListener('focus',load);
    return()=>{stopped=true;clearInterval(interval);window.removeEventListener('focus',load)};
  },[]);
  const run=async(action:()=>PromiseLike<{error:unknown}>,success:string)=>{
    if(busyRef.current)return false;busyRef.current=true;setBusy(true);setError('');setNotice('');
    try{
      const result=await saveAndRefresh(action,refresh);
      setNotice(success);
      if(result.refreshError)setError('Saved successfully. Refresh is temporarily unavailable.');
      return true;
    }catch(e){setError(message(e));return false}finally{busyRef.current=false;setBusy(false)};
  };
  const getGps=()=>{
    if(!navigator.geolocation){setError('Location permission unavailable. Enter coordinates manually.');return;}
    navigator.geolocation.getCurrentPosition(position=>setCoords({lat:position.coords.latitude,lng:position.coords.longitude}),()=>setError(t('Location permission unavailable. Enter coordinates manually.')),{timeout:15000});
  };
  const book=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();const form=new FormData(event.currentTarget);
    try{
      const items=Object.entries(selected).filter(([,units])=>units>0).map(([id,units])=>({equipment_id:id,units:unitCount(units,equipment.find(e=>e.id===id)?.available_units||0)}));
      if(!items.length)throw new Error(t('Select at least one equipment unit.'));
      const quantity=positiveNumber(form.get('quantity'),'Quantity',10000);
      if(!String(form.get('lat')||'').trim()||!String(form.get('lng')||'').trim())throw new Error('Enter valid coordinates.');
      const lat=Number(form.get('lat')),lng=Number(form.get('lng'));
      if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)throw new Error(t('Enter valid coordinates.'));
      const payload={p_items:items.sort((a,b)=>a.equipment_id.localeCompare(b.equipment_id)),p_date:form.get('date'),p_end_date:form.get('endDate')||null,p_address:form.get('address'),p_lat:lat,p_lng:lng,p_quantity:quantity,p_instructions:form.get('instructions')};
      const requestId=await bookingRequestKey(profile!.id,payload,sessionStorage);
      const saved=await run(()=>supabase!.rpc('request_equipment_booking',{...payload,p_request_id:requestId}),'Booking saved. The selected owners can now review it.');
      if(saved){sessionStorage.removeItem(`rigdesk-booking-request-${profile!.id}`);setBookingOpen(false);setSelected({});setQuantity(1);setLocation('/customer/bookings')}
    }catch(e){setError(message(e))}
  };
  const download=async(job:Job)=>{
    if(busyRef.current)return;busyRef.current=true;setBusy(true);setError('');
    try{
      const session=await supabase!.auth.getSession();if(!session.data.session)throw new Error(t('Please log in again.'));
      const response=await fetch('/api/generate-bond',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.data.session.access_token}`},body:JSON.stringify({bookingId:job.id})});
      if(!response.ok)throw new Error((await response.json()).error||t('Bond download failed.'));
      const url=URL.createObjectURL(await response.blob());const anchor=document.createElement('a');anchor.href=url;anchor.download=`RigDesk-Bond-${job.public_code}.pdf`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(e){setError(message(e))}finally{busyRef.current=false;setBusy(false)};
  };
  const formAction=(event:FormEvent<HTMLFormElement>,action:(form:FormData)=>PromiseLike<{error:unknown}>,success:string)=>{event.preventDefault();const form=new FormData(event.currentTarget);void run(()=>action(form),t(success))};
  const role=profile?.role||'customer';
  const ownFleet=equipment.filter(e=>e.owner_id===profile?.id);
  const section=location.split('/').pop()||'dashboard';
  const searchItems=equipment.filter(e=>e.is_verified&&e.status==='ready'&&(category==='All'||e.category===category)&&`${e.title} ${e.owner_name} ${e.category} ${e.current_address}`.toLowerCase().includes(query.toLowerCase()));
  const button=(text:string,onClick:()=>void,icon:ReactNode=<ArrowRight size={16}/>)=><button type="button" disabled={busy} className="market-button" onClick={onClick}>{icon}{t(text)}</button>;
  const field=(label:string,name:string,type='text',required=true)=><label>{t(label)}<input name={name} type={type} required={required} min={type==='date'?today():type==='number'?'0.01':undefined} step={type==='number'?'any':undefined}/></label>;
  return shell(<div className="real-marketplace" data-localized>
    <header className="market-heading"><div><p>{t(role==='owner'?'Owner workspace':'Customer workspace')}</p><h1>{t(({dashboard:'Overview',machinery:'Find equipment',radar:'Find equipment',fleet:'My fleet','equipment-radar':'My fleet',jobs:'My bookings',bookings:'My bookings',auctions:'Reverse auctions',account:'Account'} as Record<string,string>)[section]||'Overview')}</h1></div>{button('Refresh',()=>void run(async()=>{await refresh();return{error:null}},'Updated'),<RefreshCw size={16}/>)}</header>
    {loading&&<p role="status">{t('Loading your account...')}</p>}
    {error&&<div className="market-error" role="alert">{t('Unable to sync. Your saved records have not been deleted.')} {t(error)}</div>}
    {notice&&<div className="market-notice" role="status">{t(notice)}</div>}
    {!loading&&profile&&<>
      {section==='dashboard'&&<><div className="market-stats">{[[t('Active bookings'),jobs.filter(j=>!['completed','cancelled'].includes(j.status)).length],[t('Verified equipment'),equipment.filter(e=>e.is_verified).length],[t('Open auctions'),auctions.filter(a=>a.status==='OPEN'&&new Date(a.expires_at)>new Date()).length],[t('Paid amount'),rupees(jobs.reduce((sum,j)=>sum+j.amount_paid_paise,0))]].map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><h2>{t('Recent bookings')}</h2>{!jobs.length&&<p>{t('No bookings yet. Your new activities will appear here.')}</p>}{jobs.slice(0,5).map(j=><div className="market-row" key={j.id}><strong>{j.equipment_title}</strong><span>{t(j.status)}</span><span>{rupees(j.total_cost_paise)}</span></div>)}{button(role==='owner'?'My fleet':'Find equipment',()=>setLocation(role==='owner'?'/owner/fleet':'/customer/machinery'),<Search size={16}/>)}</>}
      {['machinery','radar'].includes(section)&&<><div className="market-toolbar"><label>{t('Search')}<input value={query} onChange={e=>setQuery(e.target.value)}/></label><label>{t('Category')}<select value={category} onChange={e=>setCategory(e.target.value)}><option value="All">{t('All')}</option>{[...new Set(equipment.map(e=>e.category))].map(c=><option key={c} value={c}>{t(c)}</option>)}</select></label>{button('Review selected units',()=>setBookingOpen(true),<Check size={16}/>)}</div><div className="market-grid">{searchItems.map(e=><article key={e.id}><img src={e.image_url||'/assets/heavy-excavator.jpg'} alt={e.title} onError={ev=>{ev.currentTarget.onerror=null;ev.currentTarget.src='/assets/heavy-excavator.jpg'}}/><h2>{e.title}</h2><p>{e.owner_name} · {e.current_address}</p><p>{rupees(e.base_rate_paise)} / {t(e.pricing_unit)}</p><p>{t('Fleet units')}: {e.available_units} · {t('Rating')}: {e.rating??t('No reviews')} ({e.review_count})</p><label>{t('Units to book')}<input type="number" min="0" max={e.available_units} step="1" value={selected[e.id]||0} onChange={ev=>setSelected({...selected,[e.id]:Number(ev.target.value)})}/></label><p>{t('Contact details are shared only after owner acceptance.')}</p></article>)}</div>{!searchItems.length&&<p>{t('No verified available equipment matches your search.')}</p>}</>}
      {['bookings','jobs'].includes(section)&&<><div className="market-grid">{jobs.map(j=><article key={j.id}><p>{j.public_code} · {t(j.status)}</p><h2>{j.equipment_title}</h2><p>{j.owner_name} · {j.customer_name}</p><p>{t('Booking period')}: {j.reservation_start} – {new Date(new Date(j.reservation_end+'T12:00:00').getTime()-86400000).toLocaleDateString(language+'-IN')}</p>{j.status==='pending'&&j.request_expires_at&&<p>{t('Request expires')}: {new Date(j.request_expires_at).toLocaleString(language+'-IN')}</p>}{j.cancellation_reason&&<p>{t(j.cancellation_reason)}</p>}{j.dispute_status==='OPEN'&&<p role="status">{t('Issue review pending')}: {j.dispute_reason}</p>}<p>{j.job_address||t('Location shared after acceptance')} · {j.requested_date.slice(0,10)} · {j.equipment_units} {t('units')}</p><p>{t('Total')}: {rupees(j.total_cost_paise)} · {t('Paid')}: {rupees(j.amount_paid_paise)}</p><p>{t('Payment settlement is not connected. Completion does not mean paid.')}</p>{j.instructions&&<p>{t('Instructions')}: {j.instructions}</p>}{j.accepted_at&&j.status!=='cancelled'?<p>{t('Contact')}: {(role==='owner'?j.customer_phone:j.owner_phone)||t('Not provided')}</p>:<p>{t('Contact details are shared only after owner acceptance.')}</p>}<div className="market-actions">{role==='owner'&&j.status==='pending'&&button('Accept booking',()=>void run(()=>supabase!.rpc('accept_booking',{p_booking_id:j.id}),t('Booking accepted. No payment has been collected.')))}{role==='owner'&&j.status==='pending'&&button('Decline booking',()=>void run(()=>supabase!.rpc('decline_booking',{p_booking_id:j.id}),'Booking declined.'))}{role==='owner'&&['confirmed','mobilizing','on_site','in_progress'].includes(j.status)&&!j.completion_requested_at&&button(j.status==='in_progress'?'Request completion':'Next milestone',()=>void run(()=>supabase!.rpc('advance_booking',{p_booking_id:j.id}),t('Milestone saved.')))}{role==='customer'&&j.completion_requested_at&&j.status==='in_progress'&&j.dispute_status!=='OPEN'&&button('Confirm completed work',()=>void run(()=>supabase!.rpc('complete_booking',{p_booking_id:j.id}),t('Work completed. Payment remains unsettled.')))}{role==='customer'&&['pending','confirmed'].includes(j.status)&&button('Cancel booking',()=>void run(()=>supabase!.rpc('cancel_booking',{p_booking_id:j.id}),t('Booking cancelled.')))}{j.accepted_at&&j.status!=='cancelled'&&button('Download bond',()=>void download(j),<Download size={16}/>)}</div>{['mobilizing','on_site','in_progress'].includes(j.status)&&!j.dispute_status&&<form onSubmit={event=>formAction(event,f=>supabase!.rpc('report_booking_issue',{p_booking_id:j.id,p_reason:f.get('reason')}),'Issue reported. Your booking remains reserved until review.')}><label>{t('Issue description')}<input name="reason" required minLength={10} maxLength={2000}/></label><button className="market-button" disabled={busy}>{t('Report issue')}</button></form>}{role==='customer'&&j.status==='completed'&&<form onSubmit={event=>formAction(event,f=>supabase!.rpc('review_booking',{p_booking:j.id,p_rating:Number(f.get('rating')),p_text:f.get('review')}),'Review saved.')}><label>{t('Rating')}<select name="rating">{[5,4,3,2,1].map(n=><option key={n}>{n}</option>)}</select></label>{field('Review','review')}<button disabled={busy} className="market-button">{t('Save review')}</button></form>}</article>)}</div>{!jobs.length&&<p>{t('No bookings yet. Your new activities will appear here.')}</p>}</>}
      {['fleet','equipment-radar'].includes(section)&&<><div className="market-grid">{ownFleet.map(e=><article key={e.id}><Truck size={24}/><h2>{e.title}</h2><p>{t('Fleet units')}: {e.available_units} · {t(e.status)}</p><p>{t(e.is_verified?'Verified':'Awaiting verification')}</p><p>{e.current_address} · {rupees(e.base_rate_paise)} / {t(e.pricing_unit)}</p></article>)}</div><h2>{t('Add equipment')}</h2><form className="market-form" onSubmit={event=>formAction(event,f=>{const rate=positiveNumber(f.get('rate'),'Rate',100000);const units=unitCount(f.get('units'),100);return supabase!.from('equipment').insert({owner_id:profile.id,title:f.get('title'),sector:f.get('sector'),category:f.get('category'),registration_number:f.get('registration'),capacity:f.get('capacity'),pricing_unit:f.get('unit'),base_rate_paise:Math.round(rate*100),available_units:units,telematics_id:`RD-${crypto.randomUUID()}`,current_address:f.get('address'),image_url:'/assets/heavy-excavator.jpg'})},'Equipment saved. Verification is required before customers can book it.')}>
        {field('Equipment name','title')}{field('Category','category')}{field('Sector','sector')}{field('Registration','registration')}{field('Capacity','capacity')}{field('Yard address','address')}{field('Fleet units','units','number')}{field('Rate in rupees','rate','number')}<label>{t('Billing unit')}<select name="unit">{['hour','foot','km','survey','project'].map(unit=><option key={unit} value={unit}>{t(unit)}</option>)}</select></label><button className="market-button" disabled={busy}><Plus size={16}/>{t('Add equipment')}</button></form></>}
      {section==='auctions'&&<><div className="market-toolbar"><label>{t('Sort bids')}<select value={sort} onChange={e=>setSort(e.target.value)}><option value="price">{t('Lowest price')}</option><option value="quality">{t('Highest rating')}</option><option value="reviews">{t('Most reviews')}</option><option value="speed">{t('Fastest arrival')}</option></select></label></div><div className="market-grid">{auctions.map(a=><article key={a.id}><h2>{a.title}</h2><p>{a.description}</p><p>{a.job_address||a.job_area||t('Location shared after acceptance')} · {a.requested_date} · {a.duration_days} {t('days')} · {t(a.status)}</p><p>{t('Ceiling')}: {rupees(a.ceiling_paise)}</p>{bids.filter(b=>b.auction_id===a.id).sort((a,b)=>{const ea=equipment.find(e=>e.id===a.equipment_id),eb=equipment.find(e=>e.id===b.equipment_id);return sort==='speed'?a.eta_minutes-b.eta_minutes:sort==='quality'?(eb?.rating||0)-(ea?.rating||0):sort==='reviews'?(eb?.review_count||0)-(ea?.review_count||0):a.amount_paise-b.amount_paise}).map(b=><div className="market-row" key={b.id}><span>{equipment.find(e=>e.id===b.equipment_id)?.owner_name||t('Owner')}<br/>{rupees(b.amount_paise)} · {b.eta_minutes} {t('minutes')} · {t('Rating')}: {equipment.find(e=>e.id===b.equipment_id)?.rating??t('No reviews')}</span>{profile.id===a.customer_id&&a.status==='OPEN'&&new Date(a.expires_at)>new Date()&&button('Select bid',()=>void run(()=>supabase!.rpc('award_marketplace_bid',{p_bid:b.id}),t('Booking saved. The selected owners can now review it.')))}</div>)}{role==='owner'&&a.status==='OPEN'&&new Date(a.expires_at)>new Date()&&<form onSubmit={event=>formAction(event,f=>supabase!.rpc('place_marketplace_bid',{p_auction:a.id,p_equipment:f.get('equipment'),p_amount:Math.round(positiveNumber(f.get('amount'),'Bid',a.ceiling_paise/100)*100),p_eta:Math.ceil(positiveNumber(f.get('eta'),'ETA',525600))}),'Bid saved.')}><label>{t('Equipment')}<select name="equipment" required>{ownFleet.filter(e=>e.is_verified&&e.status==='ready').map(e=><option key={e.id} value={e.id}>{e.title}</option>)}</select></label>{field('Bid in rupees','amount','number')}{field('Arrival in minutes','eta','number')}<button className="market-button" disabled={busy}>{t('Submit bid')}</button></form>}</article>)}</div>{role==='customer'&&<><h2>{t('Create auction')}</h2><form className="market-form" onSubmit={event=>formAction(event,f=>supabase!.from('marketplace_auctions').insert({customer_id:profile.id,title:f.get('title'),description:f.get('description'),public_description:f.get('publicDescription'),job_area:f.get('area'),job_address:f.get('address'),requested_date:f.get('date'),duration_days:unitCount(f.get('days'),366),ceiling_paise:Math.round(positiveNumber(f.get('ceiling'),'Ceiling',10000000)*100)}),'Auction saved.')}>
        {field('Title','title')}{field('Public work summary','publicDescription')}{field('Area or city','area')}{field('Private work instructions','description')}{field('Job address','address')}{field('Duration in days','days','number')}{field('Booking date','date','date')}{field('Ceiling in rupees','ceiling','number')}<button className="market-button" disabled={busy}><Plus size={16}/>{t('Create auction')}</button></form></>}</>}
      {section==='account'&&<><p>{t('Wallet balance')}: {rupees(profile.wallets?.[0]?.available_balance_paise||0)}</p><p>{t('Payments and recorded calling require connected providers. No funds or audio are transferred in this prototype.')}</p><form className="market-form" onSubmit={event=>formAction(event,async f=>{const result=await supabase!.from('users').update({full_name:f.get('name'),workspace_name:f.get('workspace'),phone:f.get('phone'),service_area:f.get('area'),address:f.get('address')}).eq('id',profile.id);if(result.error)return result;return supabase!.rpc('update_wallet_profile',{p_upi:f.get('upi'),p_bank:f.get('bank')})},'Profile saved.')}>
        {[[t('Name'),'name',profile.full_name],[t('Workspace'),'workspace',profile.workspace_name],[t('Phone'),'phone',profile.phone],[t('Service area'),'area',profile.service_area],[t('Address'),'address',profile.address],[t('UPI ID'),'upi',profile.wallets?.[0]?.upi_id],[t('Bank name'),'bank',profile.wallets?.[0]?.bank_name]].map(([label,name,value])=><label key={name}>{label}<input name={name} defaultValue={value||''} required/></label>)}<button disabled={busy} className="market-button"><Check size={16}/>{t('Save profile')}</button></form></>}
    </>}
    {bookingOpen&&<div className="market-modal"><form onSubmit={book}><header><h2>{t('Review selected units')}</h2><button type="button" title={t('Close')} aria-label={t('Close')} onClick={()=>setBookingOpen(false)}><X/></button></header><div className="market-modal-body">{Object.entries(selected).filter(([,n])=>n>0).map(([id,n])=><p key={id}>{equipment.find(e=>e.id===id)?.owner_name}: {n} {t('units')} · {equipment.find(e=>e.id===id)?.title}</p>)}{field('Booking date','date','date')}{field('Last booking day','endDate','date',false)}{field('Job address','address')}<label>{t('Quantity per unit')}<input name="quantity" required type="number" min="0.01" max="10000" step="0.01" value={quantity} onChange={event=>setQuantity(Number(event.target.value))}/></label><p>{t('Estimated total')}: {rupees(equipment.reduce((sum,e)=>sum+Math.round(e.base_rate_paise*(selected[e.id]||0)*quantity*1.035),0))}</p>{field('Instructions','instructions','text',false)}<p>{t('Each listing uses its displayed billing unit. Final totals are calculated by the database.')}</p>{button('Use GPS',getGps)}<label>{t('Latitude')}<input name="lat" required type="number" step="any" min="-90" max="90" key={`lat-${coords?.lat}`} defaultValue={coords?.lat}/></label><label>{t('Longitude')}<input name="lng" required type="number" step="any" min="-180" max="180" key={`lng-${coords?.lng}`} defaultValue={coords?.lng}/></label>{error&&<p role="alert" className="market-error">{t(error)}</p>}{notice&&<p role="status">{t(notice)}</p>}</div><footer><button className="market-button" disabled={busy}>{t(busy?'Saving...':'Send booking request')}</button>{button('My bookings',()=>{setBookingOpen(false);setSelected({});setLocation('/customer/bookings')})}</footer></form></div>}
  </div>);
}

export function liveText(text:string,language:string) {
  return interfaceText(text,language==='kn'?'kn':language==='hi'?'hi':'en')||text;
}
