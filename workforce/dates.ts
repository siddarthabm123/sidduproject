export function localDate(date=new Date()):string {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function hiringEstimate(start:string,end:string,rate:number,wageType:string):{days:number;total:number}|null {
  if(wageType!=='DAILY_WAGE'||!Number.isFinite(rate)||rate<=0||rate>1000000)return null;
  const day=(input:string)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(input))return NaN;const date=new Date(`${input}T00:00:00Z`);return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===input?date.getTime():NaN};
  const days=(day(end)-day(start))/86400000+1;
  return Number.isInteger(days)&&days>0&&days<=366?{days,total:Math.round(Math.round(rate*100)*days)/100}:null;
}
