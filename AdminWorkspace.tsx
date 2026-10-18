import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'wouter';
import { Check, LogOut, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { supabase } from './supabase';
import { interfaceText } from './interface-translations';
import './marketplace.css';

type Queue={equipment:{id:string;title:string;registration_number:string;is_verified:boolean}[];workers:{id:string;full_name:string;worker_role:string;govt_id_url:string;driving_license_url:string|null;is_verified:boolean}[];disputes:{booking_id:string;reason:string;funded:boolean}[];users:{id:string;name:string;role:string}[];bunks:{id:string;name:string}[]};
export default function AdminWorkspace({language}:{language:string}) {
  const [queue,setQueue]=useState<Queue|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
  const t=(s:string)=>interfaceText(s,language==='hi'?'hi':language==='kn'?'kn':'en')||s;
  const refresh=async()=>{
    if(!supabase)throw new Error('Supabase is not configured');
    const {data,error}=await supabase.rpc('admin_review_queue');if(error)throw error;setQueue(data);
  };
  useEffect(()=>{void refresh().catch(e=>setError(e.message))},[]);
  const run=async(action:()=>PromiseLike<{error:unknown}>)=>{
    if(busy)return;setBusy(true);setError('');setNotice('');
    try{const result=await action();if(result.error)throw result.error;setNotice(t('Saved successfully.'));await refresh()}catch(e){setError((e as Error).message)}finally{setBusy(false)}
  };
  const reason=()=>window.prompt(t('Review reason'))?.trim();
  const document=async(path:string)=>{
    const tab=window.open('about:blank','_blank');if(tab)tab.opener=null;
    const result=await supabase!.storage.from('worker-documents').createSignedUrl(path,60);
    if(result.error){tab?.close();setError(result.error.message);return}
    if(tab)tab.location.href=result.data.signedUrl;else setError(t('Allow popups to review this document.'));
  };
  const fuelAccess=(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();const f=new FormData(event.currentTarget);
    void run(()=>supabase!.rpc('admin_fuel_access',{p_user:f.get('user'),p_register:f.has('register'),p_discount:f.has('discount'),p_bunk:f.get('bunk')||null,p_staff:f.has('staff')}));
  };
  return <main className="real-marketplace admin-workspace" data-localized><header className="market-heading"><h1>RigDesk · {t('Admin review')}</h1><Link href="/account">{t('Account')}</Link><Link href="/sign-in">{t('Login')}</Link><button className="market-button" onClick={()=>void refresh().catch(e=>setError(e.message))}><RefreshCw size={16}/>{t('Refresh')}</button><button className="market-button" onClick={()=>void supabase?.auth.signOut().then(()=>{window.location.href='/sign-in'})}><LogOut size={16}/>{t('Sign out')}</button></header>{error&&<p role="alert" className="market-error">{t(error)}</p>}{notice&&<p role="status">{notice}</p>}{queue&&<><h2>{t('Equipment verification')}</h2><div className="market-grid">{queue.equipment.map(e=><article key={e.id}><h3>{e.title}</h3><p>{e.registration_number}</p><p>{t(e.is_verified?'Verified':'Awaiting verification')}</p><button className="market-button" disabled={busy} onClick={()=>{const r=reason();if(r)void run(()=>supabase!.rpc('admin_review_equipment',{p_id:e.id,p_verified:!e.is_verified,p_reason:r}))}}>{e.is_verified?<X size={16}/>:<ShieldCheck size={16}/>} {t(e.is_verified?'Revoke verification':'Approve equipment')}</button></article>)}</div><h2>{t('Worker document review')}</h2><div className="market-grid">{queue.workers.map(w=><article key={w.id}><h3>{w.full_name}</h3><p>{w.worker_role} · {t(w.is_verified?'Verified':'Unverified')}</p><div className="market-actions"><button className="market-button" onClick={()=>void document(w.govt_id_url)}>{t('Government ID')}</button>{w.driving_license_url&&<button className="market-button" onClick={()=>void document(w.driving_license_url!)}>{t('Driving license')}</button>}<button disabled={busy} className="market-button" onClick={()=>void run(()=>supabase!.rpc('review_worker_profile',{p_id:w.id,p_verified:!w.is_verified}))}><Check size={16}/>{t(w.is_verified?'Revoke verification':'Verify profile')}</button></div></article>)}</div><h2>{t('Open disputes')}</h2>{queue.disputes.map(d=><article className="market-row" key={d.booking_id}><p>{d.booking_id}<br/>{d.reason}</p>{d.funded?<p>{t('Payment reconciliation required')}</p>:<button className="market-button" disabled={busy} onClick={()=>{const r=reason();if(r)void run(()=>supabase!.rpc('admin_resolve_booking_issue',{p_booking:d.booking_id,p_reason:r}))}}>{t('Resolve issue')}</button>}</article>)}<h2>{t('Fuel partner permissions')}</h2><form className="market-form" onSubmit={fuelAccess}><label>{t('Account')}<select name="user" required>{queue.users.map(u=><option key={u.id} value={u.id}>{u.name} · {u.role} · {u.id.slice(0,8)}</option>)}</select></label><label><input type="checkbox" name="register"/>{t('Allow fuel station registration')}</label><label><input type="checkbox" name="discount"/>{t('Allow partner discounts')}</label><label>{t('Fuel station')}<select name="bunk"><option value="">{t('None')}</option>{queue.bunks.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label><label><input type="checkbox" name="staff"/>{t('Allow voucher redemption at this station')}</label><button className="market-button" disabled={busy}><Check size={16}/>{t('Save permissions')}</button></form></>}</main>;
}
