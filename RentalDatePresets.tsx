import React from 'react';

// Presets change the existing availability date range, never the displayed billing rate.
export function rentalEndDate(start:string,days:1|7|30):string|null{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(start))return null;
  const date=new Date(`${start}T12:00:00Z`);
  if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==start)return null;
  date.setUTCDate(date.getUTCDate()+days-1);return date.toISOString().slice(0,10);
}
export default function RentalDatePresets({start,end,onChange,t}:{start:string;end:string;onChange:(date:string)=>void;t:(label:string)=>string}){
 return <div className="rental-date-presets" role="group" aria-label={t('Rental duration')}>
  <span>{t('Rental duration')}</span>{([1,7,30] as const).map(days=>{const target=rentalEndDate(start,days);return <button type="button" key={days} disabled={!target} aria-pressed={target===end} onClick={()=>{if(target)onChange(target)}}>{t(days===1?'Daily':days===7?'Weekly':'Monthly')}<small>{days} {t('days')}</small></button>})}
 </div>;
}
