import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { FuelBunk, FuelCenter } from './fuel/types';
import type { FuelLanguage } from './fuel/labels';
import { fuelText } from './fuel/labels';
import { rupees } from './fuel/domain';

const logos:Record<string,string>={BPCL:'Bharat Petroleum logo.svg',HPCL:'Hindustan Petroleum-Logo.png',IndianOil:'Indian Oil Logo.svg'};
export function brandLogoUrl(brand:string):string|undefined {
  const file=logos[brand];return file?`https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}`:undefined;
}
export function FuelBrand({brand}:{brand:string}) {
  const [failed,setFailed]=useState(false);const src=brandLogoUrl(brand);
  return <span className="fuel-brand">{src&&!failed?<img src={src} alt={brand} onError={()=>setFailed(true)} referrerPolicy="no-referrer"/>:<strong>{brand}</strong>}</span>;
}
interface Props {
  center:FuelCenter; bunks:FuelBunk[]; selected:string|null; registration:boolean;
  language:FuelLanguage; canGenerate:boolean;
  onSelect:(id:string)=>void; onGenerate:(bunk:FuelBunk)=>void;
  onRegister:(latitude:number,longitude:number)=>void;
}
export default function FuelBunkMap(props:Props) {
  const host=useRef<HTMLDivElement>(null);const map=useRef<L.Map|null>(null);
  const markers=useRef<Map<string,L.Marker>>(new Map());const callbacks=useRef(props);callbacks.current=props;
  const [tileError,setTileError]=useState(false);
  useEffect(()=>{
    if(!host.current)return;
    const instance=L.map(host.current,{scrollWheelZoom:false}).setView([props.center.latitude,props.center.longitude],13);
    map.current=instance;
    const tiles=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(instance);
    tiles.on('tileerror',()=>setTileError(true));tiles.on('tileload',()=>setTileError(false));
    instance.on('click',(event:L.LeafletMouseEvent)=>{if(callbacks.current.registration)callbacks.current.onRegister(event.latlng.lat,event.latlng.lng)});
    const observer=new ResizeObserver(()=>instance.invalidateSize());observer.observe(host.current);
    return()=>{observer.disconnect();instance.remove();map.current=null};
  },[]);
  useEffect(()=>{map.current?.setView([props.center.latitude,props.center.longitude],13)},[props.center.latitude,props.center.longitude]);
  useEffect(()=>{
    if(!map.current)return;
    const dot=L.marker([props.center.latitude,props.center.longitude],{icon:L.divIcon({className:'fuel-center-pin',html:'<span></span>',iconSize:[18,18],iconAnchor:[9,9]})}).addTo(map.current);
    dot.bindTooltip(fuelText(props.center.label,props.language),{direction:'bottom'});
    return()=>{dot.remove()};
  },[props.center,props.language]);
  useEffect(()=>{
    const instance=map.current;if(!instance)return;
    markers.current.forEach(m=>m.remove());markers.current.clear();
    const t=(text:string)=>fuelText(text,props.language);
    for(const bunk of props.bunks){
      const icon=L.divIcon({className:'fuel-marker-wrap',html:`<div class="fuel-map-pin ${bunk.is_partner?'partner':'standard'}"><span>${bunk.is_partner?`${rupees(bunk.discount_per_litre)}/L`:'&#9679;'}</span></div>`,iconSize:[64,44],iconAnchor:[32,44],popupAnchor:[0,-42]});
      const marker=L.marker([bunk.latitude,bunk.longitude],{icon,title:bunk.name}).addTo(instance);
      const popup=document.createElement('div');popup.className='fuel-map-popup';popup.setAttribute('data-localized','');
      const logo=brandLogoUrl(bunk.brand);
      if(logo){const img=document.createElement('img');img.src=logo;img.alt=bunk.brand;img.referrerPolicy='no-referrer';img.onerror=()=>img.remove();popup.append(img)}
      const add=(tag:string,text:string)=>{const el=document.createElement(tag);el.textContent=text;popup.append(el)};
      add('strong',bunk.name);add('p',`${bunk.brand} · ${bunk.distance_km.toFixed(1)} ${t('km')}`);
      add('p',bunk.fuel_types_available.map(f=>t(f==='diesel'?'Diesel':'Petrol')).join(' / '));
      add('p',bunk.is_partner?`${t('Save')} ${rupees(bunk.discount_per_litre)} ${t('per litre')}`:t('Standard pump'));
      if(bunk.is_partner&&props.canGenerate){const button=document.createElement('button');button.type='button';button.textContent=t('Generate Discount Voucher');button.onclick=()=>callbacks.current.onGenerate(bunk);popup.append(button)}
      marker.bindPopup(popup,{minWidth:220,maxWidth:270});
      marker.on('click',()=>callbacks.current.onSelect(bunk.id));
      marker.on('mouseover',()=>{if(!callbacks.current.registration)marker.openPopup()});
      markers.current.set(bunk.id,marker);
    }
    if(props.selected)markers.current.get(props.selected)?.openPopup();
  },[props.bunks,props.language,props.canGenerate]);
  useEffect(()=>{
    if(props.selected){const marker=markers.current.get(props.selected);if(marker){marker.openPopup();map.current?.panTo(marker.getLatLng())}}
  },[props.selected]);
  return <div className={`fuel-map-frame ${props.registration?'registering':''}`}>
    <div ref={host} className="fuel-map" aria-label={fuelText('Nearby fuel bunks',props.language)}/>
    {props.registration&&<div className="fuel-map-note" role="status">{fuelText('Choose a location on the map',props.language)}</div>}
    {tileError&&<div className="fuel-map-note" role="status">{fuelText('Map tiles unavailable',props.language)}</div>}
  </div>;
}
