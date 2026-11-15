import type { UpgradeLanguage } from './upgrades/suppliers';
import { upgradeText } from './upgrades/labels';
interface ComparisonEquipment {id:string;title:string;owner:string;category:string;ratePaise:number;unit:string;units:number|null;rating:number|null;reviews:number|null;verified:boolean}
export default function EquipmentComparison({equipment,language}:{equipment:ComparisonEquipment[];language:UpgradeLanguage}){
  const t=(s:string)=>upgradeText(s,language);
  if(equipment.length<2)return null;
  const chosen=equipment.slice(0,4),money=(n:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(n/100);
  return <details className="rd-upgrade rd-comparison"><summary>{t('Compare saved equipment')} ({chosen.length})</summary><p className="rd-upgrade-note">{t('Compare machines with the same billing unit and work scope. Rates exclude unagreed extras. Up to four saved listings are shown.')}</p><div className="rd-upgrade-table"><table><thead><tr><th>{t('Equipment')}</th>{chosen.map(e=><th key={e.id}>{e.title}</th>)}</tr></thead><tbody>{[
    ['Owner',chosen.map(e=>e.owner)],['Category',chosen.map(e=>t(e.category))],['Rate',chosen.map(e=>`${money(e.ratePaise)} / ${t(e.unit)}`)],['Fleet units',chosen.map(e=>e.units??t('Not provided'))],['Rating',chosen.map(e=>e.rating===null?t('No reviews'):`${e.rating}${e.reviews===null?'':` (${e.reviews})`}`)],['Verification',chosen.map(e=>t(e.verified?'Reviewed listing':'Awaiting verification'))],
  ].map(([label,values])=><tr key={String(label)}><th>{t(String(label))}</th>{(values as (string|number)[]).map((v,i)=><td key={chosen[i].id}>{v}</td>)}</tr>)}</tbody></table></div></details>;
}
