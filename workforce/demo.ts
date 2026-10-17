import type { WorkerProfile } from './types';
export const demoWorkers:WorkerProfile[]=[
 ['Anand Kumar','HEAVY_DRIVER',7,1200,'DAILY_WAGE',true,12.97,77.61,'Excavator 20T, JCB','Bengaluru Central'],
 ['Ravi Gowda','DRILLER',5,28000,'MONTHLY_SALARY',false,12.99,77.57,'Rig Drilling, Borewell','Rajajinagar'],
 ['Suresh P','LABOUR',3,800,'DAILY_WAGE',false,12.95,77.6,'Site Clearing, Loading','Wilson Garden'],
 ['Imran Ali','MECHANIC',9,32000,'MONTHLY_SALARY',true,13.02,77.59,'Hydraulics, Diesel Engines','Hebbal'],
 ['Manjunath S','RIG_OPERATOR',6,1500,'DAILY_WAGE',true,12.96,77.64,'Rig Drilling, Compressor','Indiranagar'],
 ['Kiran R','HELPER',2,650,'DAILY_WAGE',false,12.93,77.58,'Site Clearing, Rig Support','Banashankari']
].map((v,i)=>({id:`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,user_id:`sample-${i}`,full_name:String(v[0]),worker_role:v[1] as WorkerProfile['worker_role'],experience_years:Number(v[2]),wage_rate:Number(v[3]),wage_type:v[4] as WorkerProfile['wage_type'],is_verified:Boolean(v[5]),latitude:Number(v[6]),longitude:Number(v[7]),type_of_work:String(v[8]).split(', '),skills:String(v[8]).split(', '),public_area:String(v[9]),address:'Demo address',phone_number:'',driving_license_url:null,govt_id_url:'demo-only',license_class:null,availability_status:true,created_at:'2026-10-12T00:00:00Z'}));
