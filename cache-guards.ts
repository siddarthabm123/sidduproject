const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const strings=(value:Record<string,unknown>,keys:string[])=>keys.every(key=>typeof value[key]==='string');
const numbers=(value:Record<string,unknown>,keys:string[])=>keys.every(key=>typeof value[key]==='number'&&Number.isFinite(value[key]));
const bid=(value:unknown)=>record(value)&&strings(value,['id','operator','equipment','eta'])&&numbers(value,['amount','rating','reviews','completionRate','distance']);
export function cacheItemValid(key:string,value:unknown){
  if(!record(value))return false;
  if(key.endsWith(':bookings'))return strings(value,['id','machineryId','machineryTitle','ownerName','customerName','location','date','status'])&&numbers(value,['durationHours','baseCost','platformFee','totalCost','ownerEarnings'])&&['PENDING','CONFIRMED','MOBILIZING','ON SITE','IN PROGRESS','COMPLETED'].includes(String(value.status));
  if(key.endsWith(':fleet'))return strings(value,['id','equipment','registration','capacity','status'])&&numbers(value,['rate','fuel','engineHours']);
  if(key.endsWith(':auctions-v2'))return strings(value,['id','title','category','location','description','requiredDate','status'])&&numbers(value,['maxPrice','lowestBid','bidCount'])&&Array.isArray(value.bids)&&value.bids.every(bid);
  return true;
}
// Validation is read-only: retain the original cache so recovery never silently erases history.
export function parseCachedValue<T>(raw:string|null,fallback:T,key=''):T {
  if(raw===null)return fallback;
  let value:unknown;try{value=JSON.parse(raw)}catch{return fallback}
  if(key==='riglogix-session')return record(value)&&['customer','owner'].includes(String(value.role))&&typeof value.loginId==='string'&&value.loginId.trim()?value as T:fallback;
  if(Array.isArray(fallback)){
    if(!Array.isArray(value))return fallback;
    if(/:(bookings|fleet|auctions-v2)$/.test(key))return value.filter(item=>cacheItemValid(key,item)) as T;
    return value as T;
  }
  if(fallback===null)return value as T;
  if(record(fallback)){
    if(!record(value))return fallback;
    return Object.fromEntries(Object.entries(fallback).map(([name,original])=>[name,typeof value[name]===typeof original&&(typeof original!=='number'||Number.isFinite(value[name]))?value[name]:original])) as T;
  }
  return typeof value===typeof fallback?value as T:fallback;
}
