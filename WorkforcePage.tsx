import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { Check, LocateFixed, MapPin, Plus, Search, ShieldCheck, Users, X } from 'lucide-react';
import { FuelModal } from './fuel/FuelModal';
import { distanceKm, rupees } from './fuel/domain';
import type { FuelLanguage } from './fuel/labels';
import { workerRequest } from './workforce/client';
import { demoNegotiations, demoWorkers } from './workforce/demo';
import WorkerSiteMap from './WorkerSiteMap';
import type { SitePoint } from './WorkerSiteMap';
import WorkerHireCard from './WorkerHireCard';
import { respondDemoHire } from './workforce/negotiation';
import { workerText } from './workforce/labels';
import { hireWorkerSchema } from './workforce/validation';
import { localDate } from './workforce/dates';
import { workerRoles } from './workforce/types';
import type { HireAction, PublicWorkerProfile, WorkerHire, WorkerProfile, WorkforceRecords } from './workforce/types';
import './workforce.css';

const demoHireKey='rigdesk-demo-worker-hires-v1',demoProfileKey='rigdesk-demo-worker-profiles-v1';
export function demoProfiles():WorkerProfile[]{try{const v=JSON.parse(localStorage.getItem(demoProfileKey)||'[]');return Array.isArray(v)?v.filter(p=>['demo-manager','demo-owner','demo-customer'].includes(p.user_id)&&typeof p.full_name==='string'&&Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)).slice(0,100).map(p=>p.user_id==='demo-manager'?{...p,user_id:'demo-owner'}:p):[]}catch{return []}}
export function allDemoProfiles():WorkerProfile[]{const custom=demoProfiles();return [...custom,...demoWorkers.filter(p=>!custom.some(c=>c.id===p.id))]}
function demoHires():WorkerHire[]{try{const v=JSON.parse(localStorage.getItem(demoHireKey)||'[]');let rows:WorkerHire[]=Array.isArray(v)?v.filter(h=>typeof h.worker_id==='string'&&typeof h.end_date==='string').slice(0,100):[];if(!localStorage.getItem('rigdesk-worker-negotiation-examples-v1')){rows=[...demoNegotiations().filter(example=>!rows.some(h=>h.worker_id===example.worker_id&&['PENDING','ACTIVE'].includes(h.status))),...rows];localStorage.setItem(demoHireKey,JSON.stringify(rows));localStorage.setItem('rigdesk-worker-negotiation-examples-v1','true')}return rows}catch{return []}}
export const saveDemoProfile=(profile:WorkerProfile)=>localStorage.setItem(demoProfileKey,JSON.stringify([profile,...demoProfiles().filter(p=>p.id!==profile.id)]));
export default function WorkforcePage({role,demo,language}:{role:'customer'|'owner';demo:boolean;language:FuelLanguage}){
 const t=(s:string)=>workerText(s,language);
 const [query,setQuery]=useState(''),[category,setCategory]=useState(''),[wage,setWage]=useState(''),[verified,setVerified]=useState(''),[radius,setRadius]=useState(25);
 const [lat,setLat]=useState('12.97'),[lng,setLng]=useState('77.6'),[workers,setWorkers]=useState<PublicWorkerProfile[]>([]);
 const [records,setRecords]=useState<WorkforceRecords>({profiles:[],hires:[]});
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[refresh,setRefresh]=useState(0);
 const [worker,setWorker]=useState<PublicWorkerProfile|null>(null),[busy,setBusy]=useState(false),[formError,setFormError]=useState('');
 const [start,setStart]=useState(localDate()),[end,setEnd]=useState(localDate()),[rate,setRate]=useState(''),[site,setSite]=useState(''),[machine,setMachine]=useState('');
 const request=useRef<{payload:string;id:string}|null>(null),pending=useRef(false);
 const [sitePoint,setSitePoint]=useState<SitePoint|null>(null),[siteLocating,setSiteLocating]=useState(false);
 useEffect(()=>{
   const timer=setInterval(()=>setRefresh(n=>n+1),30000);
   const visible=()=>{if(document.visibilityState==='visible')setRefresh(n=>n+1)};
   document.addEventListener('visibilitychange',visible);
   return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',visible)};
 },[]);
 useEffect(()=>{
   const controller=new AbortController();setLoading(true);setError('');
   const timer=setTimeout(()=>{
     if(demo){
       const now=Date.now();const profiles=allDemoProfiles();const hires=demoHires();
       const managed=profiles.filter(p=>p.user_id===`demo-${role}`||p.user_id==='demo-manager');
       const rows=profiles.filter(p=>p.availability_status&&(!category||p.worker_role===category)&&(!wage||p.wage_type===wage)&&(!verified||p.is_verified===(verified==='true'))&&(!query||(p.full_name+' '+p.skills.join(' ')+' '+p.type_of_work.join(' ')).toLowerCase().includes(query.toLowerCase()))&& !hires.some(h=>h.worker_id===p.id&&((h.status==='ACTIVE'&&Date.parse(h.end_date)>now)||(h.status==='PENDING'&&Date.parse(h.request_expires_at)>now)))).map(p=>({...p,distance_km:distanceKm(Number(lat),Number(lng),p.latitude,p.longitude),is_managed:managed.some(m=>m.id===p.id)})).filter(p=>p.distance_km<=radius).sort((a,b)=>a.distance_km-b.distance_km);
       setWorkers(rows);setRecords({profiles:managed,hires:hires.filter(h=>h.employer_id===`demo-${role}`||managed.some(p=>p.id===h.worker_id)).map(h=>({...h,is_manager:managed.some(p=>p.id===h.worker_id)}))});setLoading(false);return;
     }
     const params=new URLSearchParams({latitude:lat,longitude:lng,radius_km:String(radius),role:category,wage_type:wage,verified_status:verified,q:query});
     workerRequest<{workers:PublicWorkerProfile[]}>(`search?${params}`,undefined,controller.signal).then(data=>setWorkers(data.workers)).catch(e=>{if(!controller.signal.aborted){setWorkers([]);setError(e.message)}}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});
   },250);
   return()=>{clearTimeout(timer);controller.abort()};
 },[demo,role,query,category,wage,verified,radius,lat,lng,refresh]);
 useEffect(()=>{if(demo)return;const controller=new AbortController();workerRequest<{records:WorkforceRecords}>('records',undefined,controller.signal).then(data=>setRecords(data.records)).catch(e=>{if(!controller.signal.aborted)setError(e.message)});return()=>controller.abort()},[demo,refresh]);
 const hire=async(event:React.FormEvent)=>{
   event.preventDefault();if(!worker||pending.current)return;setFormError('');
   if(!start||!end||!Number.isFinite(Date.parse(start))||!Number.isFinite(Date.parse(end))){setFormError('Invalid workforce request');return}
   const exclusiveEnd=new Date(`${end}T00:00:00`);exclusiveEnd.setDate(exclusiveEnd.getDate()+1);
   const payload={worker_id:worker.id,start_date:new Date(`${start}T00:00:00`).toISOString(),end_date:exclusiveEnd.toISOString(),agreed_wage:Number(rate),wage_type:worker.wage_type,site_location:site,machine_description:machine,site_latitude:sitePoint?.latitude??null,site_longitude:sitePoint?.longitude??null};
   const serialized=JSON.stringify(payload);if(request.current?.payload!==serialized)request.current={payload:serialized,id:crypto.randomUUID()};
   const parsed=hireWorkerSchema.safeParse({...payload,request_id:request.current.id});if(!parsed.success){setFormError('Invalid workforce request');return}
   pending.current=true;setBusy(true);
   try{
     if(demo){
       const current=demoHires();if(current.some(h=>h.worker_id===worker.id&&h.status==='PENDING'&&Date.parse(h.request_expires_at)>Date.now()))throw new Error('Worker is already reserved for this period');
       const row:WorkerHire={...parsed.data,id:crypto.randomUUID(),worker_name:worker.full_name,employer_id:`demo-${role}`,employer_type:role==='owner'?'OWNER':'CUSTOMER',status:'PENDING',created_at:new Date().toISOString(),request_expires_at:new Date(Date.now()+86400000).toISOString(),is_manager:false,expected_wage:worker.wage_rate,initial_offer:parsed.data.agreed_wage,offer_by:'EMPLOYER',offer_version:1,offer_history:[{version:1,side:'EMPLOYER',action:'OFFER',amount:parsed.data.agreed_wage,note:'',created_at:new Date().toISOString()}]};
       localStorage.setItem(demoHireKey,JSON.stringify([row,...current]));
     }else await workerRequest('hire',parsed.data);
     setWorker(null);setNotice('Request sent. Awaiting worker manager acceptance.');setRefresh(n=>n+1);
   }catch(e){setFormError(e instanceof Error?e.message:'Invalid workforce request')}finally{pending.current=false;setBusy(false)}
 };
 const respond=async(id:string,action:HireAction,version:number,amount?:number,note=''):Promise<boolean>=>{
   if(pending.current)return false;pending.current=true;setBusy(true);setError('');
   try{if(demo){const current=demoHires().map(h=>{if(h.id!==id)return h;const manager=[...demoWorkers,...demoProfiles()].find(p=>p.id===h.worker_id)?.user_id||'';return respondDemoHire(h,`demo-${role}`,manager,action,version,amount,note)});localStorage.setItem(demoHireKey,JSON.stringify(current));}else await workerRequest('respond',{id,action,expected_version:version,amount,note});setRefresh(n=>n+1);return true}catch(e){setError(e instanceof Error?e.message:'Invalid workforce request');setRefresh(n=>n+1);return false}finally{pending.current=false;setBusy(false)}
 };
 const gps=()=>{if(!navigator.geolocation){setError('GPS unavailable. Enter a location.');return}navigator.geolocation.getCurrentPosition(p=>{setLat(String(p.coords.latitude));setLng(String(p.coords.longitude))},()=>setError('GPS unavailable. Enter a location.'),{timeout:12000})};
 return <div className="workforce fuel-hub" data-localized><div className="fuel-page-heading"><div><span className="fuel-eyebrow">RIGDESK / {t('Workforce')}</span><h1>{t(role==='owner'?'Hire On-Site Workforce':'Recruit Skilled Workers')}</h1></div><Link href="/dashboard/worker/create-profile" className="fuel-button"><Plus size={17}/>{t('Create worker profile')}</Link></div>
   {demo&&<p className="fuel-demo">{t('Demo workers only. No real employment contracts or document uploads.')}</p>}
   <div className="workforce-filters"><label>{t('Search name or skills')}<span className="workforce-search"><Search size={16}/><input value={query} maxLength={100} onChange={e=>setQuery(e.target.value)}/></span></label>
     <label>{t('Role')}<select value={category} onChange={e=>setCategory(e.target.value)}><option value="">{t('All roles')}</option>{workerRoles.map(r=><option key={r} value={r}>{t(r)}</option>)}</select></label>
     <label>{t('Daily wage')} / {t('Monthly salary')}<select value={wage} onChange={e=>setWage(e.target.value)}><option value="">{t('All wage types')}</option><option value="DAILY_WAGE">{t('Daily wage')}</option><option value="MONTHLY_SALARY">{t('Monthly salary')}</option></select></label>
     <label>{t('Verified Profile')}<select value={verified} onChange={e=>setVerified(e.target.value)}><option value="">{t('All profiles')}</option><option value="true">{t('Verified Profile')}</option><option value="false">{t('Unverified Profile')}</option></select></label>
   </div><div className="workforce-location"><label>{t('Latitude')}<input type="number" min="-90" max="90" step="any" value={lat} onChange={e=>setLat(e.target.value)}/></label><label>{t('Longitude')}<input type="number" min="-180" max="180" step="any" value={lng} onChange={e=>setLng(e.target.value)}/></label><label>{t('Distance radius')}<select value={radius} onChange={e=>setRadius(Number(e.target.value))}>{[5,10,25,50].map(n=><option key={n} value={n}>{n} km</option>)}</select></label><button className="fuel-button secondary" onClick={gps}><LocateFixed size={16}/>{t('Use GPS')}</button></div>
   {error&&<p className="fuel-error" role="alert">{t(error)}</p>}{notice&&<p className="fuel-success" role="status">{t(notice)}</p>}
   <section aria-busy={loading}>{loading&&!workers.length?<p className="fuel-empty" role="status">{t('Loading workforce')}</p>:!workers.length?<p className="fuel-empty">{t('No workers match your filters')}</p>:<div className="workforce-grid">{workers.map(w=><article className="worker-card" key={w.id}>
     <div className="worker-card-head"><div className="worker-avatar"><Users size={25}/></div><div><h2>{w.full_name}</h2><span className="worker-role">{t(w.worker_role)}</span></div></div>
     <span className={`worker-verification ${w.is_verified?'verified':'unverified'}`}>{w.is_verified&&<ShieldCheck size={14}/>} {t(w.is_verified?'Verified Profile':'Unverified Profile')}</span>
     <p>{w.experience_years} {t('Years')} · <MapPin size={13}/> {w.public_area} · {w.distance_km.toFixed(1)} {t('km')}</p><p>{w.type_of_work.join(' · ')}</p>
     <div className="worker-wage">{rupees(w.wage_rate)} <span>/ {t(w.wage_type==='DAILY_WAGE'?'Day':'Month')}</span></div>
     <button className="fuel-button" disabled={w.is_managed} onClick={()=>{request.current=null;setWorker(w);setRate(String(w.wage_rate));setSitePoint(null);setSite('');setFormError('')}}><Plus size={16}/>{t('Assign / Hire Worker')}</button>
   </article>)}</div>}</section>
   <section className="workforce-records"><h2>{t('Hiring agreements')}</h2>{!records.hires.length?<p className="fuel-empty">{t('No hiring agreements yet')}</p>:records.hires.map(h=><WorkerHireCard key={`${h.id}-${h.offer_version||1}-${h.status}`} hire={h} language={language} busy={busy} onRespond={respond}/>)}</section>
   <section className="workforce-records"><h2>{t('My worker profiles')}</h2>{!records.profiles.length?<p className="fuel-empty">{t('No worker profiles yet')}</p>:records.profiles.map(p=><article className="worker-hire" key={p.id}><div><strong>{p.full_name}</strong><p>{t(p.worker_role)} · {t(p.is_verified?'Verified Profile':'Unverified Profile')}</p></div><Link href={`/dashboard/worker/create-profile?edit=${p.id}`} className="fuel-button secondary">{t('Edit profile')}</Link></article>)}</section>
   {worker&&<FuelModal title={t('Assign / Hire Worker')} busy={busy} onClose={()=>setWorker(null)}><form onSubmit={hire}><div className="fuel-dialog-body"><strong>{worker.full_name} · {t(worker.worker_role)}</strong><span className={`worker-verification ${worker.is_verified?'verified':'unverified'}`}>{t(worker.is_verified?'Verified Profile':'Unverified Profile')}</span>
     <div className="fuel-form-grid"><label>{t('Start date')}<input type="date" value={start} min={localDate()} required onChange={e=>setStart(e.target.value)} disabled={busy}/></label><label>{t('End date (inclusive)')}<input type="date" value={end} min={start} required onChange={e=>setEnd(e.target.value)} disabled={busy}/></label></div>
     <div className="worker-expected-wage"><span>{t('Worker expected wage')}</span><strong>{rupees(worker.wage_rate)} / {t(worker.wage_type==='DAILY_WAGE'?'Day':'Month')}</strong></div><label>{t('Your offered wage')} / {t(worker.wage_type==='DAILY_WAGE'?'Day':'Month')}<input type="number" value={rate} min="1" max="1000000" step="0.01" required onChange={e=>setRate(e.target.value)} disabled={busy}/></label>
     <WorkerSiteMap value={sitePoint} center={{latitude:Number.isFinite(Number(lat))&&Math.abs(Number(lat))<=90?Number(lat):12.97,longitude:Number.isFinite(Number(lng))&&Math.abs(Number(lng))<=180?Number(lng):77.6}} language={language} onChange={setSitePoint} onLocatingChange={setSiteLocating} disabled={busy}/><label>{t('Site location')}<textarea value={site} minLength={5} maxLength={500} required onChange={e=>setSite(e.target.value)} disabled={busy}/></label><label>{t('Machine pairing (optional)')}<input value={machine} maxLength={200} onChange={e=>setMachine(e.target.value)} disabled={busy}/></label><p>{t('Contact available after acceptance')}</p>{formError&&<p className="fuel-error" role="alert">{t(formError)}</p>}
   </div><footer><button type="button" className="fuel-button secondary" disabled={busy} onClick={()=>setWorker(null)}>{t('Cancel')}</button><button className="fuel-button" disabled={busy||siteLocating}><Check size={16}/>{t('Submit hire request')}</button></footer></form></FuelModal>}
 </div>;
}
