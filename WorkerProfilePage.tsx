import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, ArrowRight, Check, FileCheck, Upload } from 'lucide-react';
import type { FuelLanguage } from './fuel/labels';
import { uploadWorkerDocument, workerRequest } from './workforce/client';
import { workerText } from './workforce/labels';
import { documentFileSchema, workerExperienceSchema, workerPersonalSchema, workerProfileSchema } from './workforce/validation';
import { workerRoles } from './workforce/types';
import type { WorkerProfile, WorkerRole, WageType, WorkforceRecords } from './workforce/types';
import { demoProfiles, saveDemoProfile } from './WorkforcePage';
import './workforce.css';

interface Fields {full_name:string;phone_number:string;address:string;public_area:string;worker_role:WorkerRole;latitude:string;longitude:string;experience_years:string;work:string;skills:string;wage_rate:string;wage_type:WageType;license_class:string;availability_status:boolean}
const initial:Fields={full_name:'',phone_number:'',address:'',public_area:'',worker_role:'LABOUR',latitude:'12.97',longitude:'77.6',experience_years:'0',work:'',skills:'',wage_rate:'800',wage_type:'DAILY_WAGE',license_class:'',availability_status:true};
const entries=(s:string)=>s.split(',').map(v=>v.trim()).filter(Boolean);
export default function WorkerProfilePage({demo,role,language}:{demo:boolean;role:'owner'|'customer';language:FuelLanguage}){
 const t=(s:string)=>workerText(s,language);const edit=new URLSearchParams(window.location.search).get('edit');
 const [form,setForm]=useState<Fields>(initial),[step,setStep]=useState(0),[error,setError]=useState(''),[fields,setFields]=useState<string[]>([]),[busy,setBusy]=useState(false),[loading,setLoading]=useState(Boolean(edit)),[success,setSuccess]=useState(false);
 const [government,setGovernment]=useState<File|null>(null),[license,setLicense]=useState<File|null>(null),[govtPath,setGovtPath]=useState(''),[licensePath,setLicensePath]=useState<string|null>(null),[consent,setConsent]=useState(false);
 const requestId=useRef(crypto.randomUUID());const pending=useRef(false);
 const destination=role==='owner'?'/dashboard/owner/workforce':'/dashboard/customer/hire-workers';
 useEffect(()=>{
   if(!edit)return;
   const controller=new AbortController();
   const apply=(profile:WorkerProfile)=>{setForm({full_name:profile.full_name,phone_number:profile.phone_number,address:profile.address,public_area:profile.public_area,worker_role:profile.worker_role,latitude:String(profile.latitude),longitude:String(profile.longitude),experience_years:String(profile.experience_years),work:profile.type_of_work.join(', '),skills:profile.skills.join(', '),wage_rate:String(profile.wage_rate),wage_type:profile.wage_type,license_class:profile.license_class||'',availability_status:profile.accepting_requests??profile.availability_status});setGovtPath(profile.govt_id_url);setLicensePath(profile.driving_license_url)};
   if(demo){const found=demoProfiles().find(p=>p.id===edit&&(p.user_id===`demo-${role}`||p.user_id==='demo-manager'));if(found)apply(found);else setError('Profile not found');setLoading(false);return}
   workerRequest<{records:WorkforceRecords}>('records',undefined,controller.signal).then(({records})=>{const found=records.profiles.find(p=>p.id===edit);if(!found)throw new Error('Profile not found');apply(found)}).catch(e=>{if(!controller.signal.aborted)setError(e.message)}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});
   return()=>controller.abort();
 },[edit,demo,role]);
 const value=<K extends keyof Fields>(key:K,next:Fields[K])=>setForm(p=>({...p,[key]:next}));
 const personal=()=>({full_name:form.full_name,phone_number:form.phone_number,address:form.address,public_area:form.public_area,worker_role:form.worker_role,latitude:Number(form.latitude),longitude:Number(form.longitude)});
 const experience=()=>({experience_years:Number(form.experience_years),type_of_work:entries(form.work),skills:entries(form.skills),wage_rate:Number(form.wage_rate),wage_type:form.wage_type});
 const next=()=>{
   if(step===0&&(!form.latitude.trim()||!form.longitude.trim())){setFields(['latitude','longitude']);setError('Check the highlighted fields.');return}
   const result=step===0?workerPersonalSchema.safeParse(personal()):workerExperienceSchema.safeParse(experience());
   if(!result.success){setFields(result.error.issues.map(i=>String(i.path[0])));setError('Check the highlighted fields.');return}
   setFields([]);setError('');setStep(n=>n+1);
 };
 const file=(candidate:File|undefined,kind:'government'|'license')=>{
   if(!candidate)return;
   if(!documentFileSchema.safeParse(candidate).success){setError('Invalid document file. Use PDF, PNG or JPEG (up to 5 MB).');return}
   setError('');if(kind==='government'){setGovernment(candidate);setGovtPath('')}else{setLicense(candidate);setLicensePath(null)};
 };
 const submit=async(event:React.FormEvent)=>{
   event.preventDefault();if(pending.current)return;setError('');
   if(!consent){setError('Worker consent is required');return}
   if(!demo&&!government&&!govtPath){setFields(['govt_id_url']);setError('Check the highlighted fields.');return}
   if(form.worker_role==='HEAVY_DRIVER'&&((!demo&&!license&&!licensePath)||!form.license_class)){setError('Commercial driving license and class are required');return}
   pending.current=true;setBusy(true);
   try{
     let govt=govtPath,driving=licensePath;
     if(demo){govt='00000000-0000-4000-8000-000000000000/00000000-0000-4000-8000-000000000001.pdf';driving=form.worker_role==='HEAVY_DRIVER'?'00000000-0000-4000-8000-000000000000/00000000-0000-4000-8000-000000000002.pdf':null}
     else{
       if(government){govt=await uploadWorkerDocument(government);setGovtPath(govt);setGovernment(null)}
       if(license){driving=await uploadWorkerDocument(license);setLicensePath(driving);setLicense(null)}
     }
     const result=workerProfileSchema.safeParse({...personal(),...experience(),...(edit?{id:edit}:{}),request_id:requestId.current,govt_id_url:govt,driving_license_url:driving,license_class:form.license_class||null,availability_status:form.availability_status,consent:true});
     if(!result.success){setFields(result.error.issues.map(i=>String(i.path[0])));setError('Check the highlighted fields.');return}
     if(demo){const p:WorkerProfile={...result.data,id:edit||crypto.randomUUID(),user_id:`demo-${role}`,created_at:new Date().toISOString(),is_verified:false};saveDemoProfile(p)}
     else await workerRequest('profile',result.data);
     setSuccess(true);
   }catch(e){setError(e instanceof Error?e.message:'Invalid workforce request')}finally{pending.current=false;setBusy(false)}
 };
 const input=(key:keyof Fields,label:string,type='text',extra:Record<string,unknown>={})=><label>{t(label)}<input type={type} value={String(form[key])} aria-invalid={fields.includes(key)} onChange={e=>value(key,e.target.value as never)} disabled={busy} {...extra}/></label>;
 if(loading)return <div className="workforce fuel-hub" data-localized><p role="status">{t('Loading workforce')}</p></div>;
 return <div className="workforce fuel-hub worker-profile-page" data-localized><Link href={destination} className="worker-back"><ArrowLeft size={16}/>{t('Workforce')}</Link><h1>{t(edit?'Edit profile':'Create worker profile')}</h1>
   {demo&&<p className="fuel-demo">{t('Demo workers only. No real employment contracts or document uploads.')}</p>}
   {success?<><p className="worker-created" role="status"><FileCheck size={23}/>{t('Profile created. Status: Unverified until identity & license documents are reviewed by admin.')}</p><Link href={destination} className="fuel-button"><UsersIcon/>{t('Workforce')}</Link></>:<>
     <ol className="worker-steps">{['Personal details','Experience & rates','Private documents'].map((s,i)=><li key={s} aria-current={step===i?'step':undefined} className={step>=i?'current':''}><span>{i+1}</span>{t(s)}</li>)}</ol>
     <form onSubmit={submit} className="worker-profile-form">{error&&<p className="fuel-error" role="alert">{t(error)}</p>}
       {step===0&&<div className="worker-form-fields">{input('full_name','Full name','text',{maxLength:120})}{input('phone_number','Phone number','tel',{maxLength:16})}
         <label>{t('Role')}<select value={form.worker_role} onChange={e=>value('worker_role',e.target.value as WorkerRole)}>{workerRoles.map(r=><option key={r} value={r}>{t(r)}</option>)}</select></label>
         {input('public_area','Public area / city','text',{maxLength:120})}<label className="full-width">{t('Private address')}<textarea value={form.address} maxLength={500} aria-invalid={fields.includes('address')} onChange={e=>value('address',e.target.value)}/></label>{input('latitude','Latitude','number',{min:-90,max:90,step:'any'})}{input('longitude','Longitude','number',{min:-180,max:180,step:'any'})}
       </div>}
       {step===1&&<div className="worker-form-fields">{input('experience_years','Years of experience','number',{min:0,max:60,step:0.5})}{input('wage_rate','Wage expectation','number',{min:1,max:1000000,step:0.01})}
         <div className="fuel-segment full-width" role="group" aria-label={t('Wage expectation')}>{(['DAILY_WAGE','MONTHLY_SALARY'] as WageType[]).map(w=><button key={w} type="button" aria-pressed={form.wage_type===w} className={form.wage_type===w?'active':''} onClick={()=>value('wage_type',w)}>{t(w==='DAILY_WAGE'?'Daily wage':'Monthly salary')}</button>)}</div>
         {input('work','Machinery / work handled','text',{'aria-invalid':fields.includes('type_of_work'),placeholder:t('Comma-separated entries'),maxLength:2000})}{input('skills','Skills','text',{placeholder:t('Comma-separated entries'),maxLength:2000})}
         <label className="fuel-check full-width"><input type="checkbox" checked={form.availability_status} onChange={e=>value('availability_status',e.target.checked)}/>{t('Available')}</label>
       </div>}
       {step===2&&<div className="worker-documents"><label className="worker-upload"><Upload size={20}/>{t('Government ID (PDF, PNG, JPEG; 5 MB max)')}<input type="file" accept="application/pdf,image/png,image/jpeg" disabled={busy||demo} onChange={e=>file(e.target.files?.[0],'government')}/>{govtPath&&!government&&<span>{t('Document retained privately')}</span>}</label>
         <label className="worker-upload"><Upload size={20}/>{t('Commercial driving license')}<input type="file" accept="application/pdf,image/png,image/jpeg" disabled={busy||demo} onChange={e=>file(e.target.files?.[0],'license')}/>{licensePath&&!license&&<span>{t('Document retained privately')}</span>}</label>
         {input('license_class','License class','text',{maxLength:100})}<label className="worker-consent"><input type="checkbox" required checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/>{t('I am this worker, or have permission to register and manage this profile.')}</label>
       </div>}
       <footer>{step>0&&<button type="button" className="fuel-button secondary" disabled={busy} onClick={()=>{setStep(n=>n-1);setError('');setFields([])}}><ArrowLeft size={16}/>{t('Back')}</button>}{step<2?<button type="button" className="fuel-button" onClick={next}>{t('Next')}<ArrowRight size={16}/></button>:<button className="fuel-button" disabled={busy}><Check size={16}/>{t(busy?'Saving':edit?'Save changes':'Submit profile')}</button>}</footer>
     </form></>}
 </div>;
}
function UsersIcon(){return <FileCheck size={17}/>}
