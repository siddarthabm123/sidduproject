import { useState } from 'react';
import { CalendarDays, Download, TrendingUp } from 'lucide-react';
import { bookingCsv, operationsSummary } from './upgrades/tools';
import type { OperationsJob } from './upgrades/tools';
import type { UpgradeLanguage } from './upgrades/suppliers';
import { upgradeText } from './upgrades/labels';
import './upgrades.css';
const money=(n:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(n/100);
export default function OwnerOperations({jobs,language,demo=false}:{jobs:OperationsJob[];language:UpgradeLanguage;demo?:boolean}){
  const t=(s:string)=>upgradeText(s,language),summary=operationsSummary(jobs);
  const [income,setIncome]=useState('0'),[fuel,setFuel]=useState('0'),[wages,setWages]=useState('0'),[other,setOther]=useState('0');
  const costs=[income,fuel,wages,other].map(Number),valid=costs.every(n=>Number.isFinite(n)&&n>=0&&n<=100000000);
  const upcoming=jobs.filter(j=>!['cancelled','completed'].includes(j.status)).sort((a,b)=>a.reservation_start.localeCompare(b.reservation_start));
  const exportRecords=()=>{const url=URL.createObjectURL(new Blob([bookingCsv(jobs)],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=`RigDesk-${demo?'demo-':''}booking-records.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
  return <section className="rd-upgrade rd-owner-operations" data-localized><header className="rd-upgrade-heading"><h2><TrendingUp size={22}/>{t('Owner operations')}</h2><button className="rd-upgrade-button secondary" type="button" onClick={exportRecords} disabled={!jobs.length}><Download size={16}/>{t('Export booking records')}</button></header>{demo&&<p className="rd-upgrade-note">Demo / {t('Planning estimate only. Values are not saved as payments or expenses.')}</p>}
    <div className="rd-operations-stats">{[['Booked work value',summary.booked],['Recorded payments',summary.paid],['Unsettled work value',summary.due]].map(([label,value])=><div key={label}><span>{t(String(label))}</span><strong>{money(Number(value))}</strong></div>)}</div><p className="rd-upgrade-note">{t('These totals reflect booking records, not profit or proof of bank settlement. Cancelled jobs are excluded.')}</p>
    <h3><CalendarDays size={18}/>{t('Upcoming assignments')}</h3>{!upcoming.length?<p>{t('No upcoming assignments.')}</p>:<div className="rd-upgrade-table"><table><thead><tr>{['Equipment','Start','End','Status','Units'].map(s=><th key={s}>{t(s)}</th>)}</tr></thead><tbody>{upcoming.map(j=><tr key={j.id}><td><a href={`/owner/jobs#record-${j.id}`}>{j.equipment_title}</a><small>{j.public_code}</small></td><td>{j.reservation_start}</td><td>{new Date(new Date(j.reservation_end+'T12:00:00').getTime()-86400000).toLocaleDateString(language+'-IN')}</td><td>{t(j.status)}</td><td>{j.equipment_units}</td></tr>)}</tbody></table></div>}
    <details className="rd-cost-planner"><summary>{t('Monthly cost planner')}</summary><div className="rd-upgrade-filters">{[[income,setIncome,'Expected rental income'],[fuel,setFuel,'Fuel cost'],[wages,setWages,'Operator wages'],[other,setOther,'Transport and maintenance']].map(([value,set,label])=><label key={String(label)}>{t(String(label))}<input type="number" min="0" max="100000000" step="0.01" value={String(value)} onChange={e=>(set as (v:string)=>void)(e.target.value)}/></label>)}</div><p>{t('Estimated contribution before other costs and tax')}: <strong>{valid?money(Math.round((costs[0]-costs[1]-costs[2]-costs[3])*100)):'—'}</strong></p><p className="rd-upgrade-note">{t('Planning estimate only. Values are not saved as payments or expenses.')}</p></details>
  </section>;
}
