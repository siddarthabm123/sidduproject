import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { LocateFixed } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { interfaceText } from './interface-translations';

type Pin={id:string;title:string;current_lat:number|null;current_lng:number|null;current_address:string;updated_at:string};
export default function EquipmentMap({equipment,language,center,onLocate}:{equipment:Pin[];language:string;center:{lat:number;lng:number}|null;onLocate:()=>void}) {
  const host=useRef<HTMLDivElement>(null),map=useRef<L.Map|null>(null);
  const [radius,setRadius]=useState(25),[tileError,setTileError]=useState(false);
  const t=(s:string)=>interfaceText(s,language==='kn'?'kn':language==='hi'?'hi':'en')||s;
  const pins=equipment.filter(e=>e.current_lat!==null&&e.current_lng!==null&&Number.isFinite(Number(e.current_lat))&&Number.isFinite(Number(e.current_lng)));
  useEffect(()=>{
    if(!host.current)return;
    const instance=L.map(host.current,{scrollWheelZoom:false}).setView([12.97,77.6],11);map.current=instance;
    const tiles=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap contributors',maxZoom:19}).addTo(instance);
    tiles.on('tileerror',()=>setTileError(true));tiles.on('tileload',()=>setTileError(false));
    const observer=new ResizeObserver(()=>instance.invalidateSize());observer.observe(host.current);
    return()=>{observer.disconnect();instance.remove();map.current=null};
  },[]);
  useEffect(()=>{
    const instance=map.current;if(!instance)return;
    const group=L.featureGroup().addTo(instance);
    const origin=center?L.latLng(center.lat,center.lng):null;
    if(origin)L.circle(origin,{radius:radius*1000,color:'#167d65',fillOpacity:.06}).addTo(group);
    for(const item of pins){
      const position=L.latLng(Number(item.current_lat),Number(item.current_lng));
      if(origin&&origin.distanceTo(position)>radius*1000)continue;
      const popup=document.createElement('div');popup.setAttribute('data-localized','');
      const title=document.createElement('strong');title.textContent=item.title;popup.append(title);
      const address=document.createElement('p');address.textContent=item.current_address;popup.append(address);
      const updated=document.createElement('p');updated.textContent=`${t('Last updated')}: ${new Date(item.updated_at).toLocaleString(language==='kn'?'kn-IN':language==='hi'?'hi-IN':'en-IN')}`;popup.append(updated);
      const marker=L.circleMarker(position,{radius:10,color:'#173b33',weight:2,fillColor:'#f0bf48',fillOpacity:1}).bindPopup(popup).bindTooltip(item.title).addTo(group);
      const element=marker.getElement();element?.setAttribute('tabindex','0');element?.setAttribute('role','button');element?.setAttribute('aria-label',item.title);
      element?.addEventListener('keydown',event=>{if((event as KeyboardEvent).key==='Enter'||(event as KeyboardEvent).key===' '){event.preventDefault();marker.openPopup()}});
    }
    if(group.getLayers().length)instance.fitBounds(group.getBounds(),{padding:[30,30],maxZoom:14});
    return()=>{group.remove()};
  },[equipment,center,radius,language]);
  return <section><div className="market-toolbar"><button className="market-button" type="button" onClick={onLocate}><LocateFixed size={16}/>{t('Use GPS')}</button><label>{t('Distance radius')}<select value={radius} onChange={e=>setRadius(Number(e.target.value))}>{[5,10,25,50].map(n=><option key={n} value={n}>{n} {t('km')}</option>)}</select></label></div><p>{t('Stored equipment locations, not live tracking.')}</p>{!pins.length&&<p role="status">{t('No equipment coordinates available.')}</p>}{tileError&&<p role="alert">{t('Map tiles unavailable. Equipment details remain in the list.')}</p>}<div ref={host} className="equipment-map" aria-label={t('Equipment radar')}/></section>;
}
