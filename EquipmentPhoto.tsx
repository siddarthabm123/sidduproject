import React, { useState } from 'react';
import type { ReactNode } from 'react';
import { useUiText } from './localization';

export const demoPhotoCredits:Record<string,{author:string;source:string;license:string}>={
 '/assets/compact-excavator-photo.jpg':{author:'Isaac Egger',source:'https://commons.wikimedia.org/wiki/File:Mini_Excavator.jpg',license:'https://creativecommons.org/licenses/by-sa/2.0/'},
 '/assets/farm-tractor-photo.jpg':{author:'Bob Adams',source:'https://commons.wikimedia.org/wiki/File:Massey_Ferguson_440_tractor_(15701374518).jpg',license:'https://creativecommons.org/licenses/by-sa/2.0/'},
 '/assets/drilling-rig-photo.jpg':{author:'Mcfly05',source:'https://commons.wikimedia.org/wiki/File:Water_well_drilling_rig.jpg',license:'https://creativecommons.org/licenses/by-sa/4.0/'},
};
const fallbacks:Record<string,string>={Excavator:'/assets/heavy-excavator.jpg','Tipper Truck':'/assets/tipper-truck.jpg','Borewell Rig':'/assets/borewell-rig.jpg',Tractor:'/assets/tractor-4wd.jpg','Tractor Trailer':'/assets/tractor-trailer.jpg','Compact Tractor':'/assets/compact-tractor.jpg','Motor Grader':'/assets/motor-grader.jpg','Skid Steer Loader':'/assets/skid-steer.jpg'};
export function equipmentPhotoSource(src:string|undefined,category:string,failed:readonly string[]=[]):string|null{
 const candidates=[src,fallbacks[category]];
 return candidates.find(value=>value&&!failed.includes(value)&&!/(?:\.svg(?:[?#]|$)|^data:image\/svg\+xml)/i.test(value))||null;
}
export default function EquipmentPhoto({src,category,alt,children,className=''}:{src?:string;category:string;alt:string;children?:ReactNode;className?:string}){
 const [failed,setFailed]=useState<string[]>([]),t=useUiText();
 const source=equipmentPhotoSource(src,category,failed),credit=source?demoPhotoCredits[source]:undefined;
 return <figure className={`rd-equipment-photo ${className}`}><div className="rd-equipment-photo-frame">
  {source?<img src={source} alt={alt} loading="lazy" decoding="async" onError={()=>setFailed(previous=>previous.includes(source)?previous:[...previous,source])}/>:<div className="rd-photo-unavailable" role="img" aria-label={`${category}: ${t('Photo unavailable')}`}>{t('Photo unavailable')}<span>{category}</span></div>}
  <div className="rd-equipment-photo-badges">{children}</div>
 </div>{credit&&<figcaption><span>{t('Illustrative category photo')} · </span><a href={credit.source} target="_blank" rel="noreferrer">{t('Photo credit')}: {credit.author}</a> · <a href={credit.license} target="_blank" rel="noreferrer">CC BY-SA {credit.license.includes('4.0')?'4.0':'2.0'}</a></figcaption>}</figure>;
}
