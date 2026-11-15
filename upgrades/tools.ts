export function quoteLine(ratePaise:number,units:number,quantity:number){
  const hundredths=Math.round(quantity*100);
  if(!Number.isSafeInteger(ratePaise)||ratePaise<0||!Number.isInteger(units)||units<0||!Number.isFinite(quantity)||quantity<=0||quantity>10000||Math.abs(quantity*100-hundredths)>1e-7)throw new Error('Invalid quote quantity');
  const raw=ratePaise*units*hundredths;
  if(!Number.isSafeInteger(raw))throw new Error('Quote amount is too large');
  const base=Math.round(raw/100),fee=Math.round(base*35/1000);
  if(!Number.isSafeInteger(base+fee))throw new Error('Quote amount is too large');
  return {base,fee,total:base+fee};
}
export interface OperationsJob {id:string;public_code:string;equipment_title:string;customer_name:string;requested_date:string;reservation_start:string;reservation_end:string;equipment_units:number;total_cost_paise:number;amount_paid_paise:number;status:string}
export function operationsSummary(jobs:OperationsJob[]){
  return jobs.filter(j=>j.status!=='cancelled').reduce((s,j)=>({booked:s.booked+j.total_cost_paise,paid:s.paid+j.amount_paid_paise,due:s.due+Math.max(0,j.total_cost_paise-j.amount_paid_paise)}),{booked:0,paid:0,due:0});
}
export function csvCell(value:unknown){
  const text=String(value??'');
  return '"'+(/^[\s]*[=+@-]/.test(text)?"'"+text:text).replace(/"/g,'""')+'"';
}
export function bookingCsv(jobs:OperationsJob[]){
  const rows=[['Booking','Equipment','Customer','Start','End (exclusive)','Units','Status','Booked INR','Recorded paid INR','Unsettled INR'],...jobs.map(j=>[j.public_code,j.equipment_title,j.customer_name,j.reservation_start,j.reservation_end,j.equipment_units,j.status,(j.total_cost_paise/100).toFixed(2),(j.amount_paid_paise/100).toFixed(2),(j.status==='cancelled'?0:Math.max(0,j.total_cost_paise-j.amount_paid_paise)/100).toFixed(2)])];
  return '\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
}
export function workScope(form:FormData){
  const value=(name:string)=>String(form.get(name)||'').trim();
  const rows=[['Work category',value('scopeCategory')],['Attachment / material',value('scopeAttachment')],['Depth / payload / shift',value('scopeRequirement')],['Site access / loading',value('scopeAccess')],['Operator responsibility',value('scopeOperator')],['Fuel responsibility',value('scopeFuel')]];
  const instructions=value('instructions');
  const summary=rows.filter(([,v])=>v).map(([label,v])=>`${label}: ${v}`).join('\n');
  const text=[instructions,summary&&`CUSTOMER REQUESTED SCOPE (owner confirmation required)\n${summary}`].filter(Boolean).join('\n\n');
  if(text.length>2000)throw new Error('Keep instructions and work requirements under 2,000 characters.');
  return text;
}
export function validShortlist(value:unknown):string[]{return Array.isArray(value)?[...new Set(value.filter((v):v is string=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v)))].slice(0,100):[]}
