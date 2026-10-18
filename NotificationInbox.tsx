import { useEffect, useRef, useState } from 'react';
import { Bell, Check, RefreshCw } from 'lucide-react';
import { useLocation } from 'wouter';
import { supabase } from './supabase';
import { FuelModal } from './fuel/FuelModal';
import { useUiText } from './localization';

type Notice={id:string;title_key:string;target_path:string;record_id:string;created_at:string;read_at:string|null};
const paths=new Set(['/customer/bookings','/owner/jobs','/dashboard/customer/hire-workers','/dashboard/owner/workforce']);
export default function NotificationInbox({userId,demo,role}:{userId?:string;demo:boolean;role:'customer'|'owner'}){
 const t=useUiText(),[,navigate]=useLocation(),[open,setOpen]=useState(false),[rows,setRows]=useState<Notice[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const generation=useRef(0),active=useRef(true);
 const demoKey=`rigdesk-demo-notifications-read-${role}`;
 const load=async()=>{
   const ticket=++generation.current;
   try{
     let notices:Notice[]=[];
     if(demo){
       const read=new Set<string>(JSON.parse(localStorage.getItem(demoKey)||'[]'));
       const hires=JSON.parse(localStorage.getItem('rigdesk-demo-worker-hires-v1')||'[]');
       notices=(Array.isArray(hires)?hires:[]).filter(h=>h.demo_example).slice(0,10).map(h=>({id:`${h.id}:${h.offer_version||1}:${h.status}`,title_key:'Demo hiring example',record_id:h.id,target_path:role==='owner'?'/dashboard/owner/workforce':'/dashboard/customer/hire-workers',created_at:h.created_at,read_at:read.has(`${h.id}:${h.offer_version||1}:${h.status}`)?h.created_at:null}));
     }else if(supabase&&userId){const result=await supabase.from('workspace_notifications').select('id,title_key,target_path,record_id,created_at,read_at').eq('recipient_id',userId).order('created_at',{ascending:false}).limit(50);if(result.error)throw result.error;notices=result.data||[];}
     if(active.current&&ticket===generation.current){setRows(notices);setError('');}
   }catch{if(active.current&&ticket===generation.current)setError('Notifications are temporarily unavailable. Please retry.');}
 };
 useEffect(()=>{active.current=true;setRows([]);void load();const interval=setInterval(()=>{if(document.visibilityState==='visible')void load()},30000);const focus=()=>void load();window.addEventListener('focus',focus);return()=>{active.current=false;generation.current++;clearInterval(interval);window.removeEventListener('focus',focus)}},[userId,demo,role]);
 const mark=async(ids:string[])=>{
   if(busy)return false;setBusy(true);setError('');
   try{if(demo){const previous=JSON.parse(localStorage.getItem(demoKey)||'[]');localStorage.setItem(demoKey,JSON.stringify([...new Set([...(Array.isArray(previous)?previous:[]),...ids])].slice(-100)));}
     else{if(!supabase)throw Error();const result=await supabase.rpc('mark_workspace_notifications_read',{p_ids:ids});if(result.error)throw result.error;}
     if(!active.current)return false;generation.current++;const now=new Date().toISOString();setRows(previous=>previous.map(n=>ids.includes(n.id)?{...n,read_at:n.read_at||now}:n));return true;
   }catch{setError('Notifications are temporarily unavailable. Please retry.');return false}finally{setBusy(false)}
 };
 const unread=rows.filter(n=>!n.read_at).length;
 return <><button className="notification-trigger" aria-label={`${t('Notifications')}${unread?`: ${unread}`:''}`} title={t('Notifications')} data-testid="button-notifications" onClick={()=>{setOpen(true);void load()}}><Bell size={18}/>{unread>0&&<span>{unread>9?'9+':unread}</span>}</button>{open&&<FuelModal title={t('Notifications')} busy={busy} onClose={()=>setOpen(false)}><div className="fuel-dialog-body notification-list">{demo&&<p>{t('Demo examples only. No real alerts are sent.')}</p>}{error&&<p role="alert">{t(error)}</p>}<div className="market-actions"><button className="market-button" type="button" disabled={busy} onClick={()=>void load()}><RefreshCw size={15}/>{t('Refresh')}</button><button className="market-button" type="button" disabled={busy||!unread} onClick={()=>void mark(rows.filter(n=>!n.read_at).map(n=>n.id))}><Check size={15}/>{t('Mark all as read')}</button></div>{!rows.length&&!error&&<p>{t('No notifications yet. New booking and hiring updates appear here.')}</p>}{rows.map(n=><button key={n.id} type="button" className={`notification-item ${n.read_at?'':'unread'}`} disabled={busy||!paths.has(n.target_path)} onClick={()=>{void mark([n.id]).then(ok=>{if(ok){setOpen(false);navigate(`${n.target_path}#record-${n.record_id}`)}})}}><strong>{t(n.title_key)}</strong><time dateTime={n.created_at}>{new Date(n.created_at).toLocaleString(document.documentElement.lang==='kn'?'kn-IN':document.documentElement.lang==='hi'?'hi-IN':'en-IN')}</time><span>{t(n.read_at?'Read':'Unread')}</span></button>)}</div></FuelModal>}</>;
}
