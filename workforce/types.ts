export const workerRoles=['LABOUR','HEAVY_DRIVER','DRILLER','RIG_OPERATOR','MECHANIC','HELPER','OTHER'] as const;
export const wageTypes=['DAILY_WAGE','MONTHLY_SALARY'] as const;
export type WorkerRole=typeof workerRoles[number];
export type WageType=typeof wageTypes[number];
export type HireStatus='PENDING'|'ACTIVE'|'COMPLETED'|'CANCELLED';
export type OfferSide='EMPLOYER'|'WORKER';
export type HireAction='accept'|'decline'|'counter'|'cancel'|'complete';
export interface WageOffer {version:number;side:OfferSide;action:string;amount:number;note:string;created_at:string}
export interface WorkerProfile {
  id:string; user_id:string; full_name:string; phone_number:string; worker_role:WorkerRole;
  experience_years:number; address:string; public_area:string; latitude:number; longitude:number;
  type_of_work:string[]; wage_rate:number; wage_type:WageType; is_verified:boolean;
  driving_license_url:string|null; govt_id_url:string; license_class:string|null; skills:string[];
  availability_status:boolean; accepting_requests?:boolean; created_at:string;
}
export type PublicWorkerProfile=Pick<WorkerProfile,'id'|'full_name'|'worker_role'|'experience_years'|'public_area'|'type_of_work'|'wage_rate'|'wage_type'|'is_verified'|'skills'|'created_at'>&{distance_km:number;is_managed:boolean};
export interface WorkerHire {
  id:string;worker_id:string;employer_id:string;employer_type:'CUSTOMER'|'OWNER';
  start_date:string;end_date:string;agreed_wage:number;wage_type:WageType;status:HireStatus;
  site_location:string;machine_description:string|null;created_at:string;request_id:string;
  request_expires_at:string;worker_name?:string;is_manager?:boolean;phone_number?:string|null;
  expected_wage?:number;initial_offer?:number;offer_by?:OfferSide;offer_version?:number;offer_history?:WageOffer[];
  site_latitude?:number|null;site_longitude?:number|null;
  demo_example?:boolean;
}
export interface WorkforceRecords { profiles:WorkerProfile[];hires:WorkerHire[] }
