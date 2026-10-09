import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useLocation } from 'wouter';
import { ArrowRight, Check, Download, Plus, RefreshCw, Search, Truck, X } from 'lucide-react';
import { supabase } from './supabase';
import { positiveNumber, unitCount } from './marketplace-domain';
import './marketplace.css';

type Equipment = { id:string; owner_id:string; owner_name:string; title:string; category:string; sector:string; current_address:string; pricing_unit:string; base_rate_paise:number; available_units:number; image_url:string; is_verified:boolean; rating:number|null; review_count:number; status:string };
type Job = { id:string; public_code:string; owner_name:string; customer_name:string; equipment_title:string; requested_date:string; job_address:string; equipment_units:number; quantity:number; billing_unit:string; total_cost_paise:number; amount_paid_paise:number; status:string; accepted_at:string|null; completion_requested_at:string|null; owner_phone:string|null; customer_phone:string|null };
type Auction = { id:string; customer_id:string; title:string; description:string; job_address:string; requested_date:string; ceiling_paise:number; status:string; expires_at:string };
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
      supabase.from('marketplace_auctions').select('*').order('created_at',{ascending:false}),
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
    if(busy)return false;setBusy(true);setError('');setNotice('');
    try{const result=await action();if(result.error)throw result.error;setNotice(success);await refresh();return true}catch(e){setError(message(e));return false}finally{setBusy(false)};
  };
  const getGps=()=>{
    navigator.geolocation?.getCurrentPosition(position=>setCoords({lat:position.coords.latitude,lng:position.coords.longitude}),()=>setError(t('Location permission unavailable. Enter coordinates manually.')),{timeout:15000});
  };
  const book=(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();const form=new FormData(event.currentTarget);
    try{
      const items=Object.entries(selected).filter(([,units])=>units>0).map(([id,units])=>({equipment_id:id,units:unitCount(units,equipment.find(e=>e.id===id)?.available_units||0)}));
      if(!items.length)throw new Error(t('Select at least one equipment unit.'));
      const quantity=positiveNumber(form.get('quantity'),'Quantity',10000);
      const lat=Number(form.get('lat')),lng=Number(form.get('lng'));
      if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)throw new Error(t('Enter valid coordinates.'));
      void run(()=>supabase!.rpc('request_equipment_booking',{p_items:items,p_date:form.get('date'),p_address:form.get('address'),p_lat:lat,p_lng:lng,p_quantity:quantity,p_instructions:form.get('instructions')}),t('Booking saved. The selected owners can now review it.')).then(saved=>{if(saved){setBookingOpen(false);setSelected({});setQuantity(1);setLocation('/customer/bookings')}});
    }catch(e){setError(message(e))}
  };
  const download=async(job:Job)=>{
    setBusy(true);setError('');
    try{
      const session=await supabase!.auth.getSession();if(!session.data.session)throw new Error(t('Please log in again.'));
      const response=await fetch('/api/generate-bond',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.data.session.access_token}`},body:JSON.stringify({bookingId:job.id})});
      if(!response.ok)throw new Error((await response.json()).error||t('Bond download failed.'));
      const url=URL.createObjectURL(await response.blob());const anchor=document.createElement('a');anchor.href=url;anchor.download=`RigDesk-Bond-${job.public_code}.pdf`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(e){setError(message(e))}finally{setBusy(false)};
  };
  const formAction=(event:FormEvent<HTMLFormElement>,action:(form:FormData)=>PromiseLike<{error:unknown}>,success:string)=>{event.preventDefault();const form=new FormData(event.currentTarget);void run(()=>action(form),t(success))};
  const role=profile?.role||'customer';
  const ownFleet=equipment.filter(e=>e.owner_id===profile?.id);
  const section=location.split('/').pop()||'dashboard';
  const searchItems=equipment.filter(e=>e.is_verified&&e.status==='ready'&&(category==='All'||e.category===category)&&`${e.title} ${e.owner_name} ${e.category} ${e.current_address}`.toLowerCase().includes(query.toLowerCase()));
  const button=(text:string,onClick:()=>void,icon:ReactNode=<ArrowRight size={16}/>)=><button type="button" disabled={busy} className="market-button" onClick={onClick}>{icon}{t(text)}</button>;
  const field=(label:string,name:string,type='text',required=true)=><label>{t(label)}<input name={name} type={type} required={required} min={type==='date'?today():type==='number'?'0.01':undefined} step={type==='number'?'any':undefined}/></label>;
  return shell(<div className="real-marketplace" data-localized key={language}>
    <header className="market-heading"><div><p>{t(role==='owner'?'Owner workspace':'Customer workspace')}</p><h1>{t(({dashboard:'Overview',machinery:'Find equipment',radar:'Find equipment',fleet:'My fleet','equipment-radar':'My fleet',jobs:'My bookings',bookings:'My bookings',auctions:'Reverse auctions',account:'Account'} as Record<string,string>)[section]||'Overview')}</h1></div>{button('Refresh',()=>void run(async()=>{await refresh();return{error:null}},'Updated'),<RefreshCw size={16}/>)}</header>
    {loading&&<p role="status">{t('Loading your account...')}</p>}
    {error&&<div className="market-error" role="alert">{t('Unable to sync. Your saved records have not been deleted.')} {error}</div>}
    {notice&&<div className="market-notice" role="status">{notice}</div>}
    {!loading&&profile&&<>
      {section==='dashboard'&&<><div className="market-stats">{[[t('Active bookings'),jobs.filter(j=>!['completed','cancelled'].includes(j.status)).length],[t('Verified equipment'),equipment.filter(e=>e.is_verified).length],[t('Open auctions'),auctions.filter(a=>a.status==='OPEN'&&new Date(a.expires_at)>new Date()).length],[t('Paid amount'),rupees(jobs.reduce((sum,j)=>sum+j.amount_paid_paise,0))]].map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><h2>{t('Recent bookings')}</h2>{!jobs.length&&<p>{t('No bookings yet. Your new activities will appear here.')}</p>}{jobs.slice(0,5).map(j=><div className="market-row" key={j.id}><strong>{j.equipment_title}</strong><span>{t(j.status)}</span><span>{rupees(j.total_cost_paise)}</span></div>)}{button(role==='owner'?'My fleet':'Find equipment',()=>setLocation(role==='owner'?'/owner/fleet':'/customer/machinery'),<Search size={16}/>)}</>}
      {['machinery','radar'].includes(section)&&<><div className="market-toolbar"><label>{t('Search')}<input value={query} onChange={e=>setQuery(e.target.value)}/></label><label>{t('Category')}<select value={category} onChange={e=>setCategory(e.target.value)}><option value="All">{t('All')}</option>{[...new Set(equipment.map(e=>e.category))].map(c=><option key={c}>{c}</option>)}</select></label>{button('Review selected units',()=>setBookingOpen(true),<Check size={16}/>)}</div><div className="market-grid">{searchItems.map(e=><article key={e.id}><img src={e.image_url||'/assets/heavy-excavator.jpg'} alt={e.title} onError={ev=>{ev.currentTarget.onerror=null;ev.currentTarget.src='/assets/heavy-excavator.jpg'}}/><h2>{e.title}</h2><p>{e.owner_name} · {e.current_address}</p><p>{rupees(e.base_rate_paise)} / {t(e.pricing_unit)}</p><p>{t('Fleet units')}: {e.available_units} · {t('Rating')}: {e.rating??t('No reviews')} ({e.review_count})</p><label>{t('Units to book')}<input type="number" min="0" max={e.available_units} step="1" value={selected[e.id]||0} onChange={ev=>setSelected({...selected,[e.id]:Number(ev.target.value)})}/></label><p>{t('Contact details are shared only after owner acceptance.')}</p></article>)}</div>{!searchItems.length&&<p>{t('No verified available equipment matches your search.')}</p>}</>}
      {['bookings','jobs'].includes(section)&&<><div className="market-grid">{jobs.map(j=><article key={j.id}><p>{j.public_code} · {t(j.status)}</p><h2>{j.equipment_title}</h2><p>{j.owner_name} · {j.customer_name}</p><p>{j.job_address} · {j.requested_date.slice(0,10)} · {j.equipment_units} {t('units')}</p><p>{t('Total')}: {rupees(j.total_cost_paise)} · {t('Paid')}: {rupees(j.amount_paid_paise)}</p><p>{t('Payment settlement is not connected. Completion does not mean paid.')}</p>{j.accepted_at&&j.status!=='cancelled'?<p>{t('Contact')}: {role==='owner'?j.customer_phone:j.owner_phone||t('Not provided')}</p>:<p>{t('Contact details are shared only after owner acceptance.')}</p>}<div className="market-actions">{role==='owner'&&j.status==='pending'&&button('Accept booking',()=>void run(()=>supabase!.rpc('accept_booking',{p_booking_id:j.id}),t('Booking accepted. No payment has been collected.')))}{role==='owner'&&['confirmed','mobilizing','on_site','in_progress'].includes(j.status)&&!j.completion_requested_at&&button(j.status==='in_progress'?'Request completion':'Next milestone',()=>void run(()=>supabase!.rpc('advance_booking',{p_booking_id:j.id}),t('Milestone saved.')))}{role==='customer'&&j.completion_requested_at&&j.status==='in_progress'&&button('Confirm completed work',()=>void run(()=>supabase!.rpc('complete_booking',{p_booking_id:j.id}),t('Work completed. Payment remains unsettled.')))}{role==='customer'&&!['completed','cancelled'].includes(j.status)&&button('Cancel booking',()=>void run(()=>supabase!.rpc('cancel_booking',{p_booking_id:j.id}),t('Booking cancelled.')))}{j.accepted_at&&j.status!=='cancelled'&&button('Download bond',()=>void download(j),<Download size={16}/>)}</div>{role==='customer'&&j.status==='completed'&&<form onSubmit={event=>formAction(event,f=>supabase!.rpc('review_booking',{p_booking:j.id,p_rating:Number(f.get('rating')),p_text:f.get('review')}),'Review saved.')}><label>{t('Rating')}<select name="rating">{[5,4,3,2,1].map(n=><option key={n}>{n}</option>)}</select></label>{field('Review','review')}<button disabled={busy} className="market-button">{t('Save review')}</button></form>}</article>)}</div>{!jobs.length&&<p>{t('No bookings yet. Your new activities will appear here.')}</p>}</>}
      {['fleet','equipment-radar'].includes(section)&&<><div className="market-grid">{ownFleet.map(e=><article key={e.id}><Truck size={24}/><h2>{e.title}</h2><p>{t('Fleet units')}: {e.available_units} · {t(e.status)}</p><p>{t(e.is_verified?'Verified':'Awaiting verification')}</p><p>{e.current_address} · {rupees(e.base_rate_paise)} / {t(e.pricing_unit)}</p></article>)}</div><h2>{t('Add equipment')}</h2><form className="market-form" onSubmit={event=>formAction(event,f=>{const rate=positiveNumber(f.get('rate'),'Rate',100000);const units=unitCount(f.get('units'),100);return supabase!.from('equipment').insert({owner_id:profile.id,title:f.get('title'),sector:f.get('sector'),category:f.get('category'),registration_number:f.get('registration'),capacity:f.get('capacity'),pricing_unit:f.get('unit'),base_rate_paise:Math.round(rate*100),available_units:units,telematics_id:`RD-${crypto.randomUUID()}`,current_address:f.get('address'),image_url:'/assets/heavy-excavator.jpg'})},'Equipment saved. Verification is required before customers can book it.')}>
        {field('Equipment name','title')}{field('Category','category')}{field('Sector','sector')}{field('Registration','registration')}{field('Capacity','capacity')}{field('Yard address','address')}{field('Fleet units','units','number')}{field('Rate in rupees','rate','number')}<label>{t('Billing unit')}<select name="unit">{['hour','foot','km','survey','project'].map(unit=><option key={unit} value={unit}>{t(unit)}</option>)}</select></label><button className="market-button" disabled={busy}><Plus size={16}/>{t('Add equipment')}</button></form></>}
      {section==='auctions'&&<><div className="market-toolbar"><label>{t('Sort bids')}<select value={sort} onChange={e=>setSort(e.target.value)}><option value="price">{t('Lowest price')}</option><option value="quality">{t('Highest rating')}</option><option value="reviews">{t('Most reviews')}</option><option value="speed">{t('Fastest arrival')}</option></select></label></div><div className="market-grid">{auctions.map(a=><article key={a.id}><h2>{a.title}</h2><p>{a.description}</p><p>{a.job_address} · {a.requested_date} · {t(a.status)}</p><p>{t('Ceiling')}: {rupees(a.ceiling_paise)}</p>{bids.filter(b=>b.auction_id===a.id).sort((a,b)=>{const ea=equipment.find(e=>e.id===a.equipment_id),eb=equipment.find(e=>e.id===b.equipment_id);return sort==='speed'?a.eta_minutes-b.eta_minutes:sort==='quality'?(eb?.rating||0)-(ea?.rating||0):sort==='reviews'?(eb?.review_count||0)-(ea?.review_count||0):a.amount_paise-b.amount_paise}).map(b=><div className="market-row" key={b.id}><span>{equipment.find(e=>e.id===b.equipment_id)?.owner_name||t('Owner')}<br/>{rupees(b.amount_paise)} · {b.eta_minutes} {t('minutes')} · {t('Rating')}: {equipment.find(e=>e.id===b.equipment_id)?.rating??t('No reviews')}</span>{profile.id===a.customer_id&&a.status==='OPEN'&&button('Select bid',()=>void run(()=>supabase!.rpc('award_marketplace_bid',{p_bid:b.id}),t('Booking saved. The selected owners can now review it.')))}</div>)}{role==='owner'&&a.status==='OPEN'&&new Date(a.expires_at)>new Date()&&<form onSubmit={event=>formAction(event,f=>supabase!.rpc('place_marketplace_bid',{p_auction:a.id,p_equipment:f.get('equipment'),p_amount:Math.round(positiveNumber(f.get('amount'),'Bid',a.ceiling_paise/100)*100),p_eta:Math.ceil(positiveNumber(f.get('eta'),'ETA',525600))}),'Bid saved.')}><label>{t('Equipment')}<select name="equipment" required>{ownFleet.filter(e=>e.is_verified&&e.status==='ready').map(e=><option key={e.id} value={e.id}>{e.title}</option>)}</select></label>{field('Bid in rupees','amount','number')}{field('Arrival in minutes','eta','number')}<button className="market-button" disabled={busy}>{t('Submit bid')}</button></form>}</article>)}</div>{role==='customer'&&<><h2>{t('Create auction')}</h2><form className="market-form" onSubmit={event=>formAction(event,f=>supabase!.from('marketplace_auctions').insert({customer_id:profile.id,title:f.get('title'),description:f.get('description'),job_address:f.get('address'),requested_date:f.get('date'),ceiling_paise:Math.round(positiveNumber(f.get('ceiling'),'Ceiling',10000000)*100)}),'Auction saved.')}>
        {field('Title','title')}{field('Work description','description')}{field('Job address','address')}{field('Booking date','date','date')}{field('Ceiling in rupees','ceiling','number')}<button className="market-button" disabled={busy}><Plus size={16}/>{t('Create auction')}</button></form></>}</>}
      {section==='account'&&<><p>{t('Wallet balance')}: {rupees(profile.wallets?.[0]?.available_balance_paise||0)}</p><p>{t('Payments and recorded calling require connected providers. No funds or audio are transferred in this prototype.')}</p><form className="market-form" onSubmit={event=>formAction(event,async f=>{const result=await supabase!.from('users').update({full_name:f.get('name'),workspace_name:f.get('workspace'),phone:f.get('phone'),service_area:f.get('area'),address:f.get('address')}).eq('id',profile.id);if(result.error)return result;return supabase!.rpc('update_wallet_profile',{p_upi:f.get('upi'),p_bank:f.get('bank')})},'Profile saved.')}>
        {[[t('Name'),'name',profile.full_name],[t('Workspace'),'workspace',profile.workspace_name],[t('Phone'),'phone',profile.phone],[t('Service area'),'area',profile.service_area],[t('Address'),'address',profile.address],[t('UPI ID'),'upi',profile.wallets?.[0]?.upi_id],[t('Bank name'),'bank',profile.wallets?.[0]?.bank_name]].map(([label,name,value])=><label key={name}>{label}<input name={name} defaultValue={value||''} required/></label>)}<button disabled={busy} className="market-button"><Check size={16}/>{t('Save profile')}</button></form></>}
    </>}
    {bookingOpen&&<div className="market-modal"><form onSubmit={book}><header><h2>{t('Review selected units')}</h2><button type="button" title={t('Close')} onClick={()=>setBookingOpen(false)}><X/></button></header><div className="market-modal-body">{Object.entries(selected).filter(([,n])=>n>0).map(([id,n])=><p key={id}>{equipment.find(e=>e.id===id)?.owner_name}: {n} {t('units')} · {equipment.find(e=>e.id===id)?.title}</p>)}{field('Booking date','date','date')}{field('Job address','address')}<label>{t('Quantity per unit')}<input name="quantity" required type="number" min="0.01" max="10000" step="0.01" value={quantity} onChange={event=>setQuantity(Number(event.target.value))}/></label><p>{t('Estimated total')}: {rupees(equipment.reduce((sum,e)=>sum+Math.round(e.base_rate_paise*(selected[e.id]||0)*quantity*1.035),0))}</p>{field('Instructions','instructions','text',false)}<p>{t('Each listing uses its displayed billing unit. Final totals are calculated by the database.')}</p>{button('Use GPS',getGps)}<label>{t('Latitude')}<input name="lat" required type="number" step="any" min="-90" max="90" key={`lat-${coords?.lat}`} defaultValue={coords?.lat}/></label><label>{t('Longitude')}<input name="lng" required type="number" step="any" min="-180" max="180" key={`lng-${coords?.lng}`} defaultValue={coords?.lng}/></label>{error&&<p role="alert" className="market-error">{error}</p>}{notice&&<p role="status">{notice}</p>}</div><footer><button className="market-button" disabled={busy}>{t(busy?'Saving...':'Send booking request')}</button>{button('My bookings',()=>{setBookingOpen(false);setSelected({});setLocation('/customer/bookings')})}</footer></form></div>}
  </div>);
}

const translations:Record<string,[string,string]> = {
  'Owner workspace':['मालिक का कार्यक्षेत्र','ಮಾಲೀಕರ ಕಾರ್ಯಕ್ಷೇತ್ರ'],'Customer workspace':['ग्राहक का कार्यक्षेत्र','ಗ್ರಾಹಕರ ಕಾರ್ಯಕ್ಷೇತ್ರ'],
  'Overview':['सारांश','ಒಟ್ಟು ಮಾಹಿತಿ'],'Find equipment':['मशीन खोजें','ಯಂತ್ರ ಹುಡುಕಿ'],'My fleet':['मेरी मशीनें','ನನ್ನ ಯಂತ್ರಗಳು'],'My bookings':['मेरी बुकिंग','ನನ್ನ ಬುಕ್ಕಿಂಗ್‌ಗಳು'],
  'Reverse auctions':['प्रतिस्पर्धी बोली','ಸ್ಪರ್ಧಾತ್ಮಕ ಬಿಡ್‌ಗಳು'],'Account':['खाता','ಖಾತೆ'],'Refresh':['फिर लोड करें','ಮತ್ತೆ ಲೋಡ್ ಮಾಡಿ'],'Updated':['अपडेट हुआ','ನವೀಕರಿಸಲಾಗಿದೆ'],
  'Loading your account...':['आपका खाता लोड हो रहा है...','ನಿಮ್ಮ ಖಾತೆ ಲೋಡ್ ಆಗುತ್ತಿದೆ...'],'Unable to sync. Your saved records have not been deleted.':['डेटा लोड नहीं हुआ। आपके रिकॉर्ड सुरक्षित हैं।','ಮಾಹಿತಿ ಲೋಡ್ ಆಗಿಲ್ಲ. ನಿಮ್ಮ ದಾಖಲೆಗಳನ್ನು ಅಳಿಸಿಲ್ಲ.'],
  'Active bookings':['चालू बुकिंग','ಚಾಲ್ತಿಯ ಬುಕ್ಕಿಂಗ್‌ಗಳು'],'Verified equipment':['सत्यापित मशीनें','ಪರಿಶೀಲಿಸಿದ ಯಂತ್ರಗಳು'],'Open auctions':['खुली बोलियाँ','ತೆರೆದ ಹರಾಜುಗಳು'],'Paid amount':['भुगतान की गई राशि','ಪಾವತಿಸಿದ ಮೊತ್ತ'],'Recent bookings':['हाल की बुकिंग','ಇತ್ತೀಚಿನ ಬುಕ್ಕಿಂಗ್‌ಗಳು'],
  'No bookings yet. Your new activities will appear here.':['अभी कोई बुकिंग नहीं। नई गतिविधियाँ यहाँ दिखेंगी।','ಇನ್ನೂ ಬುಕ್ಕಿಂಗ್ ಇಲ್ಲ. ಹೊಸ ಚಟುವಟಿಕೆಗಳು ಇಲ್ಲಿ ಕಾಣುತ್ತವೆ.'],
  'Search':['खोजें','ಹುಡುಕಿ'],'Category':['प्रकार','ವಿಧ'],'All':['सभी','ಎಲ್ಲಾ'],'Review selected units':['चुनी मशीनें देखें','ಆಯ್ದ ಯಂತ್ರಗಳನ್ನು ನೋಡಿ'],
  'Fleet units':['कुल मशीनें','ಒಟ್ಟು ಯಂತ್ರಗಳು'],'Rating':['रेटिंग','ರೇಟಿಂಗ್'],'No reviews':['अभी कोई समीक्षा नहीं','ಇನ್ನೂ ವಿಮರ್ಶೆ ಇಲ್ಲ'],'Units to book':['कितनी मशीनें चाहिए','ಎಷ್ಟು ಯಂತ್ರಗಳು ಬೇಕು'],
  'Contact details are shared only after owner acceptance.':['मालिक की स्वीकृति के बाद ही संपर्क मिलेगा।','ಮಾಲೀಕರು ಒಪ್ಪಿದ ನಂತರವೇ ಸಂಪರ್ಕ ವಿವರ ಸಿಗುತ್ತದೆ.'],
  'No verified available equipment matches your search.':['इस खोज में उपलब्ध सत्यापित मशीन नहीं मिली।','ಹುಡುಕಾಟಕ್ಕೆ ಹೊಂದುವ ಪರಿಶೀಲಿಸಿದ ಯಂತ್ರ ಲಭ್ಯವಿಲ್ಲ.'],
  'units':['मशीनें','ಯಂತ್ರಗಳು'],'hour':['घंटा','ಗಂಟೆ'],'foot':['फुट','ಅಡಿ'],'km':['किमी','ಕಿಮೀ'],'survey':['सर्वे','ಸಮೀಕ್ಷೆ'],'project':['परियोजना','ಯೋಜನೆ'],
  'pending':['स्वीकृति बाकी','ಒಪ್ಪಿಗೆ ಬಾಕಿ'],'confirmed':['स्वीकृत','ಒಪ್ಪಲಾಗಿದೆ'],'mobilizing':['रवाना','ಹೊರಡುತ್ತಿದೆ'],'on_site':['कार्यस्थल पर','ಕೆಲಸದ ಸ್ಥಳದಲ್ಲಿ'],'in_progress':['काम जारी','ಕೆಲಸ ನಡೆಯುತ್ತಿದೆ'],'completed':['काम पूरा','ಕೆಲಸ ಮುಗಿದಿದೆ'],'cancelled':['रद्द','ರದ್ದು'],
  'Total':['कुल','ಒಟ್ಟು'],'Paid':['भुगतान हुआ','ಪಾವತಿಸಲಾಗಿದೆ'],'Contact':['संपर्क','ಸಂಪರ್ಕ'],'Not provided':['उपलब्ध नहीं','ಲಭ್ಯವಿಲ್ಲ'],
  'Payment settlement is not connected. Completion does not mean paid.':['भुगतान सेवा जुड़ी नहीं है। काम पूरा होना भुगतान नहीं है।','ಪಾವತಿ ಸೇವೆ ಸಂಪರ್ಕಗೊಂಡಿಲ್ಲ. ಕೆಲಸ ಮುಗಿದರೆ ಪಾವತಿ ಆಗಿದೆ ಎಂದಲ್ಲ.'],
  'Accept booking':['बुकिंग स्वीकार करें','ಬುಕ್ಕಿಂಗ್ ಒಪ್ಪಿಕೊಳ್ಳಿ'],'Next milestone':['अगला चरण','ಮುಂದಿನ ಹಂತ'],'Request completion':['काम पूरा होने की पुष्टि माँगें','ಕೆಲಸ ಮುಗಿದ ಬಗ್ಗೆ ಒಪ್ಪಿಗೆ ಕೇಳಿ'],'Confirm completed work':['काम पूरा होने की पुष्टि करें','ಕೆಲಸ ಮುಗಿದಿರುವುದನ್ನು ದೃಢಪಡಿಸಿ'],'Cancel booking':['बुकिंग रद्द करें','ಬುಕ್ಕಿಂಗ್ ರದ್ದು ಮಾಡಿ'],'Download bond':['बुकिंग दस्तावेज डाउनलोड करें','ಬುಕ್ಕಿಂಗ್ ದಾಖಲೆ ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ'],
  'Review':['समीक्षा','ವಿಮರ್ಶೆ'],'Save review':['समीक्षा सहेजें','ವಿಮರ್ಶೆ ಉಳಿಸಿ'],'Add equipment':['मशीन जोड़ें','ಯಂತ್ರ ಸೇರಿಸಿ'],'ready':['उपलब्ध','ಲಭ್ಯ'],'on_job':['काम पर','ಕೆಲಸದಲ್ಲಿ'],'maintenance':['रखरखाव','ನಿರ್ವಹಣೆಯಲ್ಲಿ'],'offline':['ऑफलाइन','ಆಫ್‌ಲೈನ್'],'Verified':['सत्यापित','ಪರಿಶೀಲಿಸಲಾಗಿದೆ'],'Awaiting verification':['सत्यापन बाकी','ಪರಿಶೀಲನೆ ಬಾಕಿ'],
  'Equipment name':['मशीन का नाम','ಯಂತ್ರದ ಹೆಸರು'],'Sector':['क्षेत्र','ವಿಭಾಗ'],'Registration':['पंजीकरण नंबर','ನೋಂದಣಿ ಸಂಖ್ಯೆ'],'Capacity':['क्षमता','ಸಾಮರ್ಥ್ಯ'],'Yard address':['मशीन रखने का पता','ಯಂತ್ರ ಇರುವ ವಿಳಾಸ'],'Rate in rupees':['दर रुपये में','ರೂಪಾಯಿಯಲ್ಲಿ ದರ'],'Billing unit':['दर की इकाई','ದರದ ಅಳತೆ'],
  'Sort bids':['बोली क्रम','ಬಿಡ್ ವಿಂಗಡಿಸಿ'],'Lowest price':['सबसे कम कीमत','ಕಡಿಮೆ ದರ'],'Highest rating':['सबसे अच्छी रेटिंग','ಹೆಚ್ಚಿನ ರೇಟಿಂಗ್'],'Most reviews':['सबसे अधिक समीक्षाएँ','ಹೆಚ್ಚು ವಿಮರ್ಶೆಗಳು'],'Fastest arrival':['सबसे जल्दी पहुँचना','ಬೇಗ ತಲುಪುವುದು'],'Ceiling':['अधिकतम राशि','ಗರಿಷ್ಠ ಮೊತ್ತ'],'Owner':['मालिक','ಮಾಲೀಕ'],'minutes':['मिनट','ನಿಮಿಷ'],'Select bid':['बोली चुनें','ಬಿಡ್ ಆಯ್ಕೆ ಮಾಡಿ'],
  'Equipment':['मशीन','ಯಂತ್ರ'],'Bid in rupees':['बोली रुपये में','ರೂಪಾಯಿಯಲ್ಲಿ ಬಿಡ್'],'Arrival in minutes':['पहुँचने का समय मिनट में','ತಲುಪುವ ಸಮಯ ನಿಮಿಷದಲ್ಲಿ'],'Submit bid':['बोली भेजें','ಬಿಡ್ ಕಳುಹಿಸಿ'],'Create auction':['बोली अनुरोध बनाएँ','ಹರಾಜು ವಿನಂತಿ ರಚಿಸಿ'],'Title':['शीर्षक','ಶೀರ್ಷಿಕೆ'],'Work description':['काम का विवरण','ಕೆಲಸದ ವಿವರ'],'Job address':['कार्यस्थल का पता','ಕೆಲಸದ ವಿಳಾಸ'],'Booking date':['बुकिंग तारीख','ಬುಕ್ಕಿಂಗ್ ದಿನಾಂಕ'],'Ceiling in rupees':['अधिकतम राशि रुपये में','ರೂಪಾಯಿಯಲ್ಲಿ ಗರಿಷ್ಠ ಮೊತ್ತ'],
  'Wallet balance':['वॉलेट राशि','ವಾಲೆಟ್ ಮೊತ್ತ'],'Payments and recorded calling require connected providers. No funds or audio are transferred in this prototype.':['भुगतान और रिकॉर्डेड कॉल के लिए सेवा प्रदाता चाहिए। यहाँ पैसा या ऑडियो ट्रांसफर नहीं होता।','ಪಾವತಿ ಮತ್ತು ದಾಖಲಾಗುವ ಕರೆಗಳಿಗೆ ಸೇವಾ ಸಂಪರ್ಕ ಬೇಕು. ಈ ಮಾದರಿಯಲ್ಲಿ ಹಣ ಅಥವಾ ಧ್ವನಿ ವರ್ಗಾವಣೆಯಾಗುವುದಿಲ್ಲ.'],
  'Name':['नाम','ಹೆಸರು'],'Workspace':['व्यवसाय','ವ್ಯವಹಾರ'],'Phone':['फोन','ಫೋನ್'],'Service area':['सेवा क्षेत्र','ಸೇವಾ ಪ್ರದೇಶ'],'Address':['पता','ವಿಳಾಸ'],'UPI ID':['यूपीआई आईडी','ಯುಪಿಐ ಐಡಿ'],'Bank name':['बैंक का नाम','ಬ್ಯಾಂಕ್ ಹೆಸರು'],'Save profile':['प्रोफाइल सहेजें','ವಿವರ ಉಳಿಸಿ'],
  'Close':['बंद करें','ಮುಚ್ಚಿ'],'Quantity per unit':['हर मशीन के काम की मात्रा','ಪ್ರತಿ ಯಂತ್ರದ ಕೆಲಸದ ಪ್ರಮಾಣ'],'Instructions':['निर्देश','ಸೂಚನೆಗಳು'],'Each listing uses its displayed billing unit. Final totals are calculated by the database.':['हर मशीन की दिखाई गई दर लागू है। अंतिम राशि डेटाबेस तय करता है।','ಪ್ರತಿ ಯಂತ್ರದ ತೋರಿಸಿದ ದರ ಅನ್ವಯಿಸುತ್ತದೆ. ಅಂತಿಮ ಮೊತ್ತವನ್ನು ಡೇಟಾಬೇಸ್ ಲೆಕ್ಕ ಹಾಕುತ್ತದೆ.'],'Use GPS':['जीपीएस उपयोग करें','ಜಿಪಿಎಸ್ ಬಳಸಿ'],'Latitude':['अक्षांश','ಅಕ್ಷಾಂಶ'],'Longitude':['देशांतर','ರೇಖಾಂಶ'],'Saving...':['सहेजा जा रहा है...','ಉಳಿಸಲಾಗುತ್ತಿದೆ...'],'Send booking request':['बुकिंग अनुरोध भेजें','ಬುಕ್ಕಿಂಗ್ ವಿನಂತಿ ಕಳುಹಿಸಿ'],
  'Estimated total':['अनुमानित कुल','ಅಂದಾಜು ಒಟ್ಟು'],'OPEN':['खुला','ತೆರೆದಿದೆ'],'AWARDED':['बोली चुनी गई','ಬಿಡ್ ಆಯ್ಕೆ ಮಾಡಲಾಗಿದೆ'],'CANCELLED':['रद्द','ರದ್ದು'],
  'Booking saved. The selected owners can now review it.':['बुकिंग सहेजी गई। चुने हुए मालिक अब देख सकते हैं।','ಬುಕ್ಕಿಂಗ್ ಉಳಿಸಲಾಗಿದೆ. ಆಯ್ದ ಮಾಲೀಕರು ಈಗ ನೋಡಬಹುದು.'],'Booking accepted. No payment has been collected.':['बुकिंग स्वीकार हुई। भुगतान नहीं लिया गया।','ಬುಕ್ಕಿಂಗ್ ಒಪ್ಪಲಾಗಿದೆ. ಯಾವುದೇ ಪಾವತಿ ಪಡೆದಿಲ್ಲ.'],'Milestone saved.':['चरण सहेजा गया।','ಹಂತ ಉಳಿಸಲಾಗಿದೆ.'],'Work completed. Payment remains unsettled.':['काम पूरा हुआ। भुगतान बाकी है।','ಕೆಲಸ ಮುಗಿದಿದೆ. ಪಾವತಿ ಬಾಕಿ ಇದೆ.'],'Booking cancelled.':['बुकिंग रद्द हुई।','ಬುಕ್ಕಿಂಗ್ ರದ್ದಾಗಿದೆ.'],'Review saved.':['समीक्षा सहेजी गई।','ವಿಮರ್ಶೆ ಉಳಿಸಲಾಗಿದೆ.'],'Equipment saved. Verification is required before customers can book it.':['मशीन सहेजी गई। बुकिंग से पहले सत्यापन जरूरी है।','ಯಂತ್ರ ಉಳಿಸಲಾಗಿದೆ. ಬುಕ್ಕಿಂಗ್ ಮಾಡುವ ಮೊದಲು ಪರಿಶೀಲನೆ ಬೇಕು.'],'Bid saved.':['बोली सहेजी गई।','ಬಿಡ್ ಉಳಿಸಲಾಗಿದೆ.'],'Auction saved.':['बोली अनुरोध सहेजा गया।','ಹರಾಜು ವಿನಂತಿ ಉಳಿಸಲಾಗಿದೆ.'],'Profile saved.':['प्रोफाइल सहेजी गई।','ವಿವರ ಉಳಿಸಲಾಗಿದೆ.'],
};
export function liveText(text:string,language:string) { return language==='en'?text:translations[text]?.[language==='kn'?1:0]||text; }
