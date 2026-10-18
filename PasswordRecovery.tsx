import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'wouter';
import { hasRecoverySession, supabase } from './supabase';
import { interfaceText } from './interface-translations';
import './marketplace.css';

export default function PasswordRecovery({language}:{language:string}) {
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[recovery,setRecovery]=useState(hasRecoverySession),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const t=(s:string)=>interfaceText(s,language==='kn'?'kn':language==='hi'?'hi':'en')||s;
  useEffect(()=>{
    if(!supabase)return;
    const {data}=supabase.auth.onAuthStateChange((event,session)=>{if(event==='PASSWORD_RECOVERY'&&session)setRecovery(true)});
    // Supabase may consume the fragment before this lazy page mounts.
    if(new URLSearchParams(window.location.hash.slice(1)).get('type')==='recovery')void supabase.auth.getSession().then(r=>setRecovery(!!r.data.session));
    return()=>data.subscription.unsubscribe();
  },[]);
  const submit=async(event:FormEvent)=>{
    event.preventDefault();if(!supabase||busy)return;setBusy(true);setError('');setNotice('');
    try{
      const result=recovery?await supabase.auth.updateUser({password}):await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:`${window.location.origin}/reset-password`});
      if(result.error)throw result.error;
      if(recovery){await supabase.auth.signOut();setRecovery(false);setPassword('');setNotice('Password updated. Log in with your new password.')}
      else setNotice('Check your email for the recovery link. Email delivery requires configured SMTP.');
    }catch(e){setError((e as Error).message)}finally{setBusy(false)};
  };
  return <main className="real-marketplace admin-workspace" data-localized><h1>RigDesk · {t('Reset password')}</h1><form className="market-form" onSubmit={submit}>{recovery?<label>{t('Create password')}<input type="password" autoComplete="new-password" required minLength={8} value={password} onChange={e=>setPassword(e.target.value)}/></label>:<label>{t('Email address')}<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label>}<button className="market-button" disabled={busy||!supabase}>{t(recovery?'Reset password':'Send recovery email')}</button></form>{error&&<p role="alert">{t(error)}</p>}{notice&&<p role="status">{t(notice)}</p>}<Link href="/sign-in">{t('Login')}</Link></main>;
}
