import { upgradeText } from './upgrades/labels';
import type { UpgradeLanguage } from './upgrades/suppliers';
import { quoteLine } from './upgrades/tools';
import './upgrades.css';
const money=(n:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(n/100);
export function QuoteBreakdown({items,language}:{items:{id:string;title:string;rate:number;units:number;quantity:number;unit:string}[];language:UpgradeLanguage}){
  const t=(s:string)=>upgradeText(s,language);
  let lines:{id:string;title:string;rate:number;units:number;quantity:number;unit:string;base:number;fee:number;total:number}[];
  try{lines=items.map(item=>({...item,...quoteLine(item.rate,item.units,item.quantity)}))}catch{return <p role="alert">{t('Invalid quote quantity')}</p>}
  const sum=lines.reduce((s,l)=>({base:s.base+l.base,fee:s.fee+l.fee,total:s.total+l.total}),{base:0,fee:0,total:0});
  return <section className="rd-quote-breakdown"><h3>{t('Booking cost breakdown')}</h3>{lines.map(line=><div className="rd-quote-line" key={line.id}><span>{line.title}<small>{money(line.rate)} × {line.quantity} {line.unit} × {line.units}</small></span><strong>{money(line.base)}</strong></div>)}<dl><div><dt>{t('Equipment subtotal')}</dt><dd>{money(sum.base)}</dd></div><div><dt>{t('Platform fee')} (3.5%)</dt><dd>{money(sum.fee)}</dd></div><div><dt>{t('Estimated payable')}</dt><dd>{money(sum.total)}</dd></div></dl><p>{t('Transport, operator, fuel, consumables and applicable tax must be agreed separately. They are not included unless explicitly stated in the accepted scope.')}</p></section>;
}
export function WorkScopeFields({language}:{language:UpgradeLanguage}){
  const t=(s:string)=>upgradeText(s,language);
  return <fieldset className="rd-work-scope"><legend>{t('Work requirements')}</legend><label>{t('Work category')}<select name="scopeCategory">{['Excavation / JCB','Borewell','Logistics','Other'].map(s=><option key={s} value={s}>{t(s)}</option>)}</select></label><label>{t('Attachment or material')}<input name="scopeAttachment" maxLength={160}/></label><label>{t('Depth / payload / shift requirement')}<input name="scopeRequirement" maxLength={160}/></label><label>{t('Site access and loading instructions')}<input name="scopeAccess" maxLength={200}/></label>{[['scopeOperator','Operator responsibility'],['scopeFuel','Fuel responsibility']].map(([name,label])=><label key={name}>{t(label)}<select name={name}>{['To be agreed','Customer supplies','Owner supplies'].map(s=><option key={s} value={s}>{t(s)}</option>)}</select></label>)}<p>{t('Additional work and charges require agreement from both parties. Drilling does not guarantee water yield.')}</p></fieldset>;
}
