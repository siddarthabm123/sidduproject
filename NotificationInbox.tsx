import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Bell, Check, RefreshCw } from 'lucide-react';
import { useLocation } from 'wouter';
import { supabase } from './supabase';
import { FuelModal } from './fuel/FuelModal';
import { useUiText } from './localization';
import { demoWorkers } from './workforce/demo';
import { demoNotices, noticeCopy, notificationPaths } from './notifications';
import type { Notice } from './notifications';
import type { WorkerHire, WorkerProfile } from './workforce/types';

function storedArray<T>(key:string):T[]{try{const value=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?value:[]}catch{return []}}

export default function NotificationInbox({userId,demo,role}:{userId?:string;demo:boolean;role:'customer'|'owner'}){
 const t=useUiText(),[,navigate]=useLocation(),[open,setOpen]=useState(false),[rows,setRows]=useState<Notice[]>([]),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const generation=useRef(0),active=useRef(true);
 const demoKey=`rigdesk-demo-notifications-read-${role}`;
 const load=async()=>{
   const ticket=++generation.current;setLoading(true);
   try{
     let notices:Notice[]=[];
     if(demo){
       const profiles=[...storedArray<WorkerProfile>('rigdesk-demo-worker-profiles-v1'),...demoWorkers];
       notices=demoNotices(storedArray<WorkerHire>('rigdesk-demo-worker-hires-v1'),profiles,role,new Set(storedArray<string>(demoKey)));
     }else if(supabase&&userId){const result=await supabase.from('workspace_notifications').select('id,title_key,target_path,record_id,created_at,read_at').eq('recipient_id',userId).order('created_at',{ascending:false}).limit(50);if(result.error)throw result.error;notices=result.data||[];}
     if(active.current&&ticket===generation.current){setRows(notices);setError('');}
   }catch{if(active.current&&ticket===generation.current)setError('Notifications are temporarily unavailable. Please retry.');}
   finally{if(active.current&&ticket===generation.current)setLoading(false)}
 };
 useEffect(()=>{active.current=true;setRows([]);void load();const interval=setInterval(()=>{if(document.visibilityState==='visible')void load()},30000);const focus=()=>void load();window.addEventListener('focus',focus);return()=>{active.current=false;generation.current++;clearInterval(interval);window.removeEventListener('focus',focus)}},[userId,demo,role]);
 const mark=async(ids:string[])=>{
   if(busy)return false;setBusy(true);setError('');
   try{if(demo){localStorage.setItem(demoKey,JSON.stringify([...new Set([...storedArray<string>(demoKey),...ids])].slice(-100)));}
     else{if(!supabase)throw Error();const result=await supabase.rpc('mark_workspace_notifications_read',{p_ids:ids});if(result.error)throw result.error;}
     if(!active.current)return false;generation.current++;setLoading(false);const now=new Date().toISOString();setRows(previous=>previous.map(n=>ids.includes(n.id)?{...n,read_at:n.read_at||now}:n));return true;
   }catch{setError('Notifications are temporarily unavailable. Please retry.');return false}finally{setBusy(false)}
 };
 const unread=rows.filter(n=>!n.read_at).length;
 const locale=document.documentElement.lang==='kn'?'kn-IN':document.documentElement.lang==='hi'?'hi-IN':'en-IN';
 return <><button className="notification-trigger" aria-label={`${t('Notifications')}${unread?`: ${unread}`:''}`} title={t('Notifications')} data-testid="button-notifications" onClick={()=>{setOpen(true);void load()}}><Bell size={18}/>{unread>0&&<span>{unread>9?'9+':unread}</span>}</button>{open&&<FuelModal title={t('Notifications')} busy={busy} onClose={()=>setOpen(false)}><div className="fuel-dialog-body notification-list" aria-busy={loading}>
   {demo&&<p className="notification-demo">{t('Demo activity only. Offers and work shown here are examples, not real requests.')}</p>}
   {error&&<p className="fuel-error" role="alert">{t(error)}</p>}
   <div className="notification-toolbar"><span>{unread} {t('Unread')} · {rows.length} {t('updates')}</span><div className="market-actions"><button className="market-button" type="button" disabled={busy||loading} onClick={()=>void load()} title={t('Refresh')} aria-label={t('Refresh')}><RefreshCw size={16}/></button><button className="market-button" type="button" disabled={busy||!unread} onClick={()=>void mark(rows.filter(n=>!n.read_at).map(n=>n.id))}><Check size={15}/>{t('Mark all as read')}</button></div></div>
   {!rows.length&&!error&&<p role="status">{t(loading?'Loading notifications...':'No notifications yet. New booking and hiring updates appear here.')}</p>}
   {rows.map(n=>{const copy=noticeCopy(n),h=n.hire;return <button key={n.id} type="button" className={`notification-item ${n.read_at?'':'unread'}`} disabled={busy||!notificationPaths.has(n.target_path)||!/^[-0-9a-f]{36}$/i.test(n.record_id)} onClick={()=>{void mark([n.id]).then(ok=>{if(ok){setOpen(false);navigate(`${n.target_path}#record-${n.record_id}`)}})}}>
     <span className="notification-meta"><span>{t(h?'Worker hiring':n.target_path.includes('bookings')||n.target_path.includes('/jobs')?'Equipment booking':'Worker hiring')}</span><span>{t(n.read_at?'Read':'Unread')}</span></span>
     <strong>{t(copy.title)}</strong>{h&&<span className="notification-worker">{h.worker_name||t('Worker')} · {new Intl.NumberFormat(locale,{style:'currency',currency:'INR',maximumFractionDigits:2}).format(h.agreed_wage)} {t(h.wage_type==='DAILY_WAGE'?'per day':'per month')}</span>}
     <span className="notification-body">{t(copy.body)}</span>
     <span className="notification-bottom"><time dateTime={n.created_at}>{new Date(n.created_at).toLocaleString(locale,{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'})}</time><span className="notification-action">{t(copy.action)} <ArrowUpRight size={14}/></span></span>
   </button>})}
 </div></FuelModal>}</>;
}
