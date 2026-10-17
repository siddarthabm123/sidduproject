import type { FuelBunk, FuelType } from './types.js';

export const radii = [5, 10, 25] as const;
export function coordinates(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude)<=90 && Math.abs(longitude)<=180;
}
export function distanceKm(lat: number, lng: number, otherLat: number, otherLng: number): number {
  const radians=(n: number)=>n*Math.PI/180;
  const a=Math.sin(radians(otherLat-lat)/2)**2+Math.cos(radians(lat))*Math.cos(radians(otherLat))*Math.sin(radians(otherLng-lng)/2)**2;
  return 6371*2*Math.asin(Math.sqrt(Math.max(0,Math.min(1,a))));
}
export function nearbyBunks(bunks: FuelBunk[], lat: number, lng: number, radius: number, fuel: FuelType, partnerOnly: boolean): FuelBunk[] {
  return bunks.map(b=>({...b,distance_km:distanceKm(lat,lng,b.latitude,b.longitude)}))
    .filter(b=>b.distance_km<=radius && b.fuel_types_available.includes(fuel) && (!partnerOnly||b.is_partner))
    .sort((a,b)=>a.distance_km-b.distance_km || a.id.localeCompare(b.id));
}
export function savings(quantity: number, rate: number): number {
  return Math.round(Math.round(quantity*100)*Math.round(rate*100)/100)/100;
}
export function validQuantity(n: number): boolean {
  return Number.isFinite(n) && n>=1 && n<=2000 && Math.abs(n*100-Math.round(n*100))<1e-7;
}
export function effectiveStatus(status: string, expires: string, now=Date.now()): string {
  return status==='GENERATED' && new Date(expires).getTime()<=now?'EXPIRED':status;
}
export const rupees=(n: number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(n);
