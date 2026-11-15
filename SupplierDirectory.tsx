import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { Building2, Check, ExternalLink, LocateFixed, MapPin, Phone, Search } from 'lucide-react';
import { discoverProviders } from './upgrades/client';
import { filterBusinesses, publishedBusinesses, safePhone } from './upgrades/suppliers';
import type { Supplier, UpgradeLanguage } from './upgrades/suppliers';
import { upgradeText } from './upgrades/labels';
import './upgrades.css';

export default function SupplierDirectory({demo,role,language,compact=false,initialCategory='heavy equipment',location}:{demo:boolean;role:'customer'|'owner';language:UpgradeLanguage;compact?:boolean;initialCategory?:string;location?:{lat:number;lng:number}}){
  const t=(s:string)=>upgradeText(s,language);
  const [query,setQuery]=useState(''),[category,setCategory]=useState('All'),[searchCategory,setSearchCategory]=useState(initialCategory);
  const [lat,setLat]=useState(String(location?.lat??12.97)),[lng,setLng]=useState(String(location?.lng??77.6));
  const [providers,setProviders]=useState<Supplier[]>([]),[contacts,setContacts]=useState<Record<string,Supplier>>({});
  const [busy,setBusy]=useState(false),[contactBusy,setContactBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const request=useRef<AbortController|null>(null),mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;request.current?.abort()}},[]);
  const search=async()=>{
    if(demo){setNotice('Demo accounts use the published contacts below. Google search requires a real account and a configured API.');return}
    if(!lat.trim()||!lng.trim()||!Number.isFinite(Number(lat))||!Number.isFinite(Number(lng))||Math.abs(Number(lat))>90||Math.abs(Number(lng))>180){setError('Enter valid coordinates.');return}
    request.current?.abort();const controller=new AbortController();request.current=controller;setBusy(true);setError('');setNotice('');setProviders([]);setContacts({});
    try{const result=await discoverProviders<{configured:boolean;providers:Supplier[];message?:string}>({category:searchCategory,latitude:Number(lat),longitude:Number(lng),language},controller.signal);if(!controller.signal.aborted){setProviders(result.providers||[]);if(!result.configured)setNotice(result.message||'Google Places discovery is not connected yet.');else if(!result.providers.length)setNotice('No Google results found.')}}
    catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Provider discovery is temporarily unavailable.')}finally{if(!controller.signal.aborted)setBusy(false)}
  };
  const contact=async(id:string)=>{
    if(contactBusy)return;setContactBusy(id);setError('');
    try{const result=await discoverProviders<{configured:boolean;provider?:Supplier;message?:string}>({action:'details',place_id:id});if(mounted.current){if(result.provider)setContacts(previous=>({...previous,[id]:result.provider!}));else setNotice(result.message||'Google Places discovery is not connected yet.')}}
    catch(e){if(mounted.current)setError(e instanceof Error?e.message:'Provider discovery is temporarily unavailable.')}finally{if(mounted.current)setContactBusy('')}
  };
  const locate=()=>{
    if(!navigator.geolocation){setError('Location unavailable. Enter coordinates manually.');return}
    navigator.geolocation.getCurrentPosition(p=>{if(mounted.current){setLat(String(p.coords.latitude));setLng(String(p.coords.longitude))}},()=>{if(mounted.current)setError('Location unavailable. Enter coordinates manually.')},{timeout:12000,maximumAge:60000});
  };
  const businesses=compact?filterBusinesses('',category).filter(b=>initialCategory.toLowerCase().includes('bore')?b.category==='Borewell':true).slice(0,2):filterBusinesses(query,category);
  return <section className={`rd-upgrade rd-suppliers ${compact?'rd-suppliers-compact':''}`} data-localized>
    <header className="rd-upgrade-heading"><div><span className="rd-upgrade-eyebrow">RIGDESK / {t('Suppliers & dealers')}</span><h1>{t(compact?'Published business contacts':'Find a business. Confirm the machine.')}</h1></div><Building2 size={28}/></header>
    <p className="rd-upgrade-note">{t('Contacts are published by the businesses. Confirm service area, identity, equipment, price and dates directly. No stock, discount or booking is guaranteed.')}</p>
    {!compact&&<div className="rd-upgrade-filters"><label>{t('Search businesses')}<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Bengaluru / JCB / borewell"/></label><label>{t('Category')}<select value={category} onChange={e=>setCategory(e.target.value)}>{['All',...new Set(publishedBusinesses.map(b=>b.category))].map(c=><option value={c} key={c}>{t(c)}</option>)}</select></label></div>}
    <div className="rd-supplier-grid">{businesses.map(b=><article key={b.id}>
      <span className="rd-external-badge">{t('External business — not a RigDesk partner')}</span><h2>{b.name}</h2><p>{t(b.category)}</p><p><MapPin size={15}/>{t(b.area)}</p>
      <div className="rd-upgrade-actions"><a className="rd-upgrade-button" href={`tel:${safePhone(b.phone)}`}><Phone size={15}/>{b.phone}</a><a href={b.website} target="_blank" rel="noopener noreferrer">{t('Official website')} <ExternalLink size={13}/></a></div>
      <p className="rd-upgrade-source"><a href={b.source} target="_blank" rel="noopener noreferrer">{t('View source')}</a> · {t('Source checked')}: {b.checked}</p>
    </article>)}</div>{!businesses.length&&<p role="status">{t('No matching businesses. Try another category or search.')}</p>}
    {compact?<Link className="rd-upgrade-button" href={`/${role}/suppliers`}>{t('Suppliers & dealers')} <ExternalLink size={15}/></Link>:<>
      <section className="rd-google-search"><nav className="rd-upgrade-actions"><Link href="/privacy">{t('Privacy')}</Link><Link href="/terms">{t('Terms')}</Link></nav><h2>{t('Google business search')}</h2><p>{t('Availability not confirmed')}</p>
        {demo&&<p className="rd-upgrade-note">{t('Demo accounts use the published contacts below. Google search requires a real account and a configured API.')}</p>}
        <form onSubmit={e=>{e.preventDefault();void search()}} className="rd-upgrade-filters"><label>{t('Category')}<input value={searchCategory} onChange={e=>setSearchCategory(e.target.value)} required maxLength={80}/></label>
          <label>{t('Latitude')}<input type="number" step="any" min="-90" max="90" required value={lat} onChange={e=>setLat(e.target.value)}/></label><label>{t('Longitude')}<input type="number" step="any" min="-180" max="180" required value={lng} onChange={e=>setLng(e.target.value)}/></label>
          <button type="button" className="rd-upgrade-button secondary" onClick={locate}><LocateFixed size={16}/>{t('Use my location')}</button><button className="rd-upgrade-button" disabled={busy}><Search size={16}/>{t(busy?'Searching…':'Search near this location')}</button></form>
        {error&&<p className="rd-upgrade-error" role="alert">{t(error)}</p>}{notice&&<p role="status">{t(notice)}</p>}
        {!!providers.length&&<><p className="rd-google-attribution"><img src="/assets/google-maps-attribution.png" alt="Google Maps" translate="no"/></p><div className="rd-supplier-grid">{providers.map(p=>{const detail=contacts[p.id];return <article key={p.id}><span className="rd-external-badge">{t('Availability not confirmed')}</span><h3>{p.name}</h3><p>{p.address}</p>{p.rating!==null&&<p>{t('Google rating')}: {p.rating} ({p.reviewCount??0})</p>}
          <a href={p.mapsUrl} target="_blank" rel="noopener noreferrer">{t('View on Google Maps')} <ExternalLink size={13}/></a>
          {detail?<div className="rd-upgrade-actions">{detail.phone&&safePhone(detail.phone)?<a className="rd-upgrade-button" href={`tel:${safePhone(detail.phone)}`}><Phone size={15}/>{detail.phone}</a>:<p>{t('Phone number not published.')}</p>}{detail.website&&<a href={detail.website} target="_blank" rel="noopener noreferrer">{t('Official website')}</a>}{detail.businessStatus&&<p>{detail.businessStatus}</p>}</div>:<button className="rd-upgrade-button secondary" disabled={!!contactBusy||busy} onClick={()=>void contact(p.id)}>{t(contactBusy===p.id?'Searching…':'Show published contact')}</button>}
          {(p.attributions||[]).map((a,i)=>a.url?<a className="rd-upgrade-source" key={i} href={a.url} target="_blank" rel="noopener noreferrer">{a.name}</a>:<span key={i}>{a.name}</span>)}
        </article>})}</div></>}
      </section>
      <section className="rd-supplier-join"><h2>{t('Own equipment? Join RigDesk.')}</h2><ol>{['Create an equipment-owner account','Complete your business profile','Add machines, genuine photos, rates and yard location','Submit equipment for admin review','Reviewed listings can receive booking requests'].map(s=><li key={s}><Check size={16}/>{t(s)}</li>)}</ol><Link className="rd-upgrade-button" href={role==='owner'?'/owner/fleet':'/sign-in?role=owner'}>{t(role==='owner'?'Add my equipment':'Create an equipment-owner account')}</Link></section>
    </>}
  </section>;
}
