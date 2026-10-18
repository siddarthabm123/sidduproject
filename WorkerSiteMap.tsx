import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { LocateFixed } from 'lucide-react';
import type { FuelLanguage } from './fuel/labels';
import { workerText } from './workforce/labels';
import 'leaflet/dist/leaflet.css';

export type SitePoint={latitude:number;longitude:number};
export default function WorkerSiteMap({value,center,language,onChange,onLocatingChange,disabled=false}:{value:SitePoint|null;center:SitePoint;language:FuelLanguage;onChange:(point:SitePoint)=>void;onLocatingChange:(busy:boolean)=>void;disabled?:boolean}){
  const host=useRef<HTMLDivElement>(null),map=useRef<L.Map|null>(null),marker=useRef<L.Marker|null>(null);
  const current=useRef({onChange,onLocatingChange,disabled});current.current={onChange,onLocatingChange,disabled};
  const mounted=useRef(true),sequence=useRef(0);
  const [error,setError]=useState(''),[locating,setLocating]=useState(false);
  const [draft,setDraft]=useState({latitude:'',longitude:''});
  useEffect(()=>{setDraft({latitude:value?String(value.latitude):'',longitude:value?String(value.longitude):''})},[value]);
  const t=(s:string)=>workerText(s,language);
  const choose=(point:SitePoint)=>{sequence.current++;setLocating(false);current.current.onLocatingChange(false);current.current.onChange(point)};
  useEffect(()=>{
    if(!host.current)return;
    mounted.current=true;
    const initial=value||center,instance=L.map(host.current,{scrollWheelZoom:false}).setView([initial.latitude,initial.longitude],14);map.current=instance;
    const tiles=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'}).addTo(instance);
    tiles.on('tileerror',()=>setError('Map unavailable. Enter coordinates manually.'));
    instance.on('click',(event:L.LeafletMouseEvent)=>{if(!current.current.disabled)choose({latitude:event.latlng.lat,longitude:event.latlng.lng})});
    const observer=new ResizeObserver(()=>instance.invalidateSize());observer.observe(host.current);
    return()=>{mounted.current=false;sequence.current++;current.current.onLocatingChange(false);observer.disconnect();instance.remove();map.current=null};
  },[]);
  useEffect(()=>{
    const instance=map.current;if(!instance)return;
    marker.current?.remove();marker.current=null;
    if(!value)return;
    const pin=L.marker([value.latitude,value.longitude],{draggable:!disabled,title:t('Hiring site pin'),icon:L.divIcon({className:'worker-site-pin',html:'<span></span>',iconSize:[28,28],iconAnchor:[14,14]})}).addTo(instance);
    pin.on('dragend',()=>{if(!current.current.disabled){const p=pin.getLatLng();choose({latitude:p.lat,longitude:p.lng})}});
    marker.current=pin;instance.setView([value.latitude,value.longitude],instance.getZoom());
  },[value,disabled,language]);
  useEffect(()=>{
    if(!disabled)map.current?.dragging.enable();else map.current?.dragging.disable();
  },[disabled]);
  const gps=()=>{
    if(!navigator.geolocation){setError('GPS unavailable. Enter a location.');return}
    const attempt=++sequence.current;setLocating(true);current.current.onLocatingChange(true);setError('');navigator.geolocation.getCurrentPosition(p=>{if(mounted.current&&attempt===sequence.current)choose({latitude:p.coords.latitude,longitude:p.coords.longitude})},()=>{if(mounted.current&&attempt===sequence.current){setLocating(false);current.current.onLocatingChange(false);setError('GPS unavailable. Enter a location.')}},{enableHighAccuracy:true,timeout:12000,maximumAge:0});
  };
  const coordinate=(axis:'latitude'|'longitude',raw:string)=>{
    const n=Number(raw),limit=axis==='latitude'?90:180;
    if(raw.trim()&&Number.isFinite(n)&&Math.abs(n)<=limit){setError('');choose({...value||center,[axis]:n})}
    else setDraft(previous=>({...previous,[axis]:value?String(value[axis]):''}));
  };
  return <section className="worker-site"><div className="worker-site-heading"><strong>{t('Hiring site map')}</strong><button type="button" className="fuel-button secondary" disabled={disabled||locating} onClick={gps}><LocateFixed size={16}/>{t(locating?'Getting GPS':'Use current location')}</button></div><div ref={host} className="worker-site-map" aria-label={t('Hiring site map')}/><div className="fuel-form-grid"><label>{t('Latitude')}<input type="number" min="-90" max="90" step="any" disabled={disabled} value={draft.latitude} onChange={e=>setDraft({...draft,latitude:e.target.value})} onBlur={e=>coordinate('latitude',e.target.value)}/></label><label>{t('Longitude')}<input type="number" min="-180" max="180" step="any" disabled={disabled} value={draft.longitude} onChange={e=>setDraft({...draft,longitude:e.target.value})} onBlur={e=>coordinate('longitude',e.target.value)}/></label></div>{!value&&<p>{t('Choose the site on the map or use current location.')}</p>}{error&&<p role="alert" className="fuel-error">{t(error)}</p>}</section>;
}
