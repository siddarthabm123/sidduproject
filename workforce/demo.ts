import type { WorkerHire, WorkerProfile } from './types';
export const demoWorkers:WorkerProfile[]=[
 ['Anand Kumar','HEAVY_DRIVER',7,1200,'DAILY_WAGE',true,12.97,77.61,'Excavator 20T, JCB','Bengaluru Central'],
 ['Ravi Gowda','DRILLER',5,28000,'MONTHLY_SALARY',false,12.99,77.57,'Rig Drilling, Borewell','Rajajinagar'],
 ['Suresh P','LABOUR',3,800,'DAILY_WAGE',false,12.95,77.6,'Site Clearing, Loading','Wilson Garden'],
 ['Imran Ali','MECHANIC',9,32000,'MONTHLY_SALARY',true,13.02,77.59,'Hydraulics, Diesel Engines','Hebbal'],
 ['Manjunath S','RIG_OPERATOR',6,1500,'DAILY_WAGE',true,12.96,77.64,'Rig Drilling, Compressor','Indiranagar'],
 ['Kiran R','HELPER',2,650,'DAILY_WAGE',false,12.93,77.58,'Site Clearing, Rig Support','Banashankari']
].map((v,i)=>({id:`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,user_id:i===0||i===1||i===3?'demo-owner':'demo-customer',full_name:String(v[0]),worker_role:v[1] as WorkerProfile['worker_role'],experience_years:Number(v[2]),wage_rate:Number(v[3]),wage_type:v[4] as WorkerProfile['wage_type'],is_verified:Boolean(v[5]),latitude:Number(v[6]),longitude:Number(v[7]),type_of_work:String(v[8]).split(', '),skills:String(v[8]).split(', '),public_area:String(v[9]),address:'Demo address',phone_number:'',driving_license_url:null,govt_id_url:'demo-only',license_class:null,availability_status:true,created_at:'2026-10-12T00:00:00Z'}));

export function demoNegotiations(now=new Date()):WorkerHire[]{
  const start=new Date(now);start.setDate(start.getDate()+1);start.setHours(9,0,0,0);
  const end=new Date(start);end.setDate(end.getDate()+2);
  return [[0,'customer',1000,1100],[1,'customer',25000,25000],[2,'owner',650,650],[4,'owner',1300,1400]].map(([index,role,initial,latest])=>{
    const worker=demoWorkers[Number(index)],counter=initial!==latest;
    return {id:crypto.randomUUID(),request_id:crypto.randomUUID(),worker_id:worker.id,worker_name:worker.full_name,employer_id:`demo-${role}`,employer_type:role==='owner'?'OWNER':'CUSTOMER',
      start_date:start.toISOString(),end_date:end.toISOString(),status:'PENDING',expected_wage:worker.wage_rate,initial_offer:Number(initial),agreed_wage:Number(latest),wage_type:worker.wage_type,
      offer_by:counter?'WORKER':'EMPLOYER',offer_version:counter?2:1,site_location:'Demo project site, Bengaluru',site_latitude:12.97,site_longitude:77.6,machine_description:worker.type_of_work[0],
      request_expires_at:new Date(now.getTime()+86400000).toISOString(),created_at:now.toISOString(),demo_example:true,
      offer_history:[{version:1,side:'EMPLOYER',action:'OFFER',amount:Number(initial),note:'',created_at:now.toISOString()},...(counter?[{version:2,side:'WORKER' as const,action:'COUNTER',amount:Number(latest),note:'',created_at:now.toISOString()}]:[])]};
  });
}
