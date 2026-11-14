export type WorkforceRole='customer'|'owner';
export const workerProfilePath='/dashboard/worker/create-profile';
export const workforcePath=(role:WorkforceRole)=>role==='owner'?'/dashboard/owner/workforce':'/dashboard/customer/hire-workers';

// Route aliases use the signed-in account's view; URLs never switch account roles.
export function workforceDestination(path:string,role:WorkforceRole):string|null{
  if(path===workerProfilePath)return path;
  return ['/dashboard/owner/workforce','/dashboard/customer/hire-workers','/owner/workforce','/customer/workforce','/customer/hire-workers','/dashboard/customer/workforce'].includes(path)?workforcePath(role):null;
}
