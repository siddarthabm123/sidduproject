import { z } from 'zod';
import { wageTypes, workerRoles } from './types.js';
const items=z.array(z.string().trim().min(1).max(100)).max(20);
const privateDocument=z.string().max(250).regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(pdf|png|jpg)$/i,'Use a private uploaded document');
export const workerPersonalSchema=z.object({full_name:z.string().trim().min(2).max(120),phone_number:z.string().regex(/^\+?\d{10,15}$/),address:z.string().trim().min(5).max(500),public_area:z.string().trim().min(2).max(120),worker_role:z.enum(workerRoles),latitude:z.number().min(-90).max(90),longitude:z.number().min(-180).max(180)});
export const workerExperienceSchema=z.object({experience_years:z.number().min(0).max(60),type_of_work:items.min(1),skills:items,wage_rate:z.number().min(1).max(1000000).refine(n=>Math.abs(n*100-Math.round(n*100))<1e-7,'Use up to two decimal places'),wage_type:z.enum(wageTypes)});
export const workerProfileSchema=workerPersonalSchema.extend(workerExperienceSchema.shape).extend({
  id:z.uuid().optional(),request_id:z.uuid(),availability_status:z.boolean().default(true),govt_id_url:privateDocument,
  driving_license_url:privateDocument.nullable().default(null),license_class:z.string().trim().max(100).nullable().default(null),consent:z.literal(true)
}).superRefine((v,ctx)=>{if(v.worker_role==='HEAVY_DRIVER'&&(!v.driving_license_url||!v.license_class))ctx.addIssue({code:'custom',message:'Commercial driving license and class are required',path:['driving_license_url']})});
export const hireWorkerSchema=z.object({worker_id:z.uuid(),start_date:z.iso.datetime({offset:true}),end_date:z.iso.datetime({offset:true}),agreed_wage:z.number().min(1).max(1000000).refine(n=>Math.abs(n*100-Math.round(n*100))<1e-7),wage_type:z.enum(wageTypes),site_location:z.string().trim().min(5).max(500),machine_description:z.string().trim().max(200).default(''),request_id:z.uuid(),site_latitude:z.number().min(-90).max(90).nullable().default(null),site_longitude:z.number().min(-180).max(180).nullable().default(null)}).superRefine((v,ctx)=>{const days=(Date.parse(v.end_date)-Date.parse(v.start_date))/86400000;if(days<=0||days>366)ctx.addIssue({code:'custom',message:'Choose a hiring period of up to 366 days',path:['end_date']});if((v.site_latitude===null)!==(v.site_longitude===null))ctx.addIssue({code:'custom',message:'Choose both site coordinates',path:['site_latitude']})});
export const hireResponseSchema=z.object({id:z.uuid(),action:z.enum(['accept','decline','counter','cancel','complete']),amount:workerExperienceSchema.shape.wage_rate.optional(),expected_version:z.number().int().min(1).max(2147483647).optional(),note:z.string().trim().max(500).default('')}).superRefine((v,ctx)=>{if(v.action==='counter'&&(v.amount===undefined||v.expected_version===undefined))ctx.addIssue({code:'custom',message:'A counter-offer amount and current version are required',path:['amount']})});
export type WorkerProfileForm=z.input<typeof workerProfileSchema>;
export type WorkerHireForm=z.infer<typeof hireWorkerSchema>;
export const documentFileSchema=z.object({size:z.number().min(1).max(5242880),type:z.enum(['application/pdf','image/png','image/jpeg'])});
export function documentSignature(bytes:Uint8Array,type:string):boolean {
  if(type==='application/pdf')return [37,80,68,70,45].every((b,i)=>bytes[i]===b);
  if(type==='image/png')return [137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b);
  return type==='image/jpeg'&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
}
