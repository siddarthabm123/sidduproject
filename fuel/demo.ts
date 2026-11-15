import { effectiveStatus, savings } from './domain';
import type { FuelBunk, FuelContext, FuelVoucher } from './types';
export const demoContext:FuelContext={can_register:true,can_offer_discounts:true,can_generate:true,
  centers:[{id:'yard',label:'Demo fleet yard',latitude:12.97,longitude:77.6},{id:'site',label:'Demo project site',latitude:13.018,longitude:77.57}],
  equipment:[{id:'demo-excavator',title:'Demo crawler excavator'},{id:'demo-tipper',title:'Demo tipper truck'}]};
// Fictional locations and discounts: never publish these as real partnerships.
export const demoBunks:FuelBunk[]=[
  {id:'demo-1',name:'Demo Central Fuel Point',brand:'BPCL',address:'Sample station, Central Bengaluru',latitude:12.973,longitude:77.612,discount_per_litre:1,is_partner:true,fuel_types_available:['diesel','petrol'],contact_phone:'',created_at:'2026-10-12T00:00:00Z',distance_km:0},
  {id:'demo-2',name:'Demo Westside Energy',brand:'HPCL',address:'Sample station, West Bengaluru',latitude:12.99,longitude:77.57,discount_per_litre:0.5,is_partner:true,fuel_types_available:['diesel'],contact_phone:'',created_at:'2026-10-12T00:00:00Z',distance_km:0},
  {id:'demo-3',name:'Demo South Fuel Stop',brand:'IndianOil',address:'Sample station, South Bengaluru',latitude:12.94,longitude:77.596,discount_per_litre:0,is_partner:false,fuel_types_available:['diesel','petrol'],contact_phone:'',created_at:'2026-10-12T00:00:00Z',distance_km:0},
  {id:'demo-4',name:'Demo North Service Station',brand:'Shell',address:'Sample station, North Bengaluru',latitude:13.018,longitude:77.592,discount_per_litre:0,is_partner:false,fuel_types_available:['diesel','petrol'],contact_phone:'',created_at:'2026-10-12T00:00:00Z',distance_km:0},
  {id:'demo-5',name:'Demo East Fleet Fuel',brand:'IndianOil',address:'Sample station, East Bengaluru',latitude:12.978,longitude:77.695,discount_per_litre:1,is_partner:true,fuel_types_available:['diesel','petrol'],contact_phone:'',created_at:'2026-10-12T00:00:00Z',distance_km:0}
];

// Demo examples stay in the browser; these are not pump invoices or live prices.
export function demoVouchers(stored:FuelVoucher[]=[],now=Date.now()):FuelVoucher[]{
  const examples=([
    [0,'DIESEL',250,'demo-excavator','D3A01001'],
    [1,'DIESEL',400,'demo-tipper','D3A01002'],
    [4,'PETROL',60,null,'D3A01003'],
  ] as const).map(([station,fuel,quantity,equipment,code]):FuelVoucher=>{
    const bunk=demoBunks[station];
    return {id:`demo-example-${code}`,owner_id:'demo-owner',bunk_id:bunk.id,bunk_name:bunk.name,bunk_address:bunk.address,
      equipment_id:equipment,fuel_type:fuel,quantity_litres:quantity,discount_rate:bunk.discount_per_litre,
      estimated_savings:savings(quantity,bunk.discount_per_litre),voucher_code:code,verification_token:'demo',request_id:`demo-${code}`,
      status:'GENERATED',expires_at:new Date(now+86400000).toISOString(),created_at:new Date(now).toISOString(),demo:true};
  });
  const ids=new Set(examples.map(v=>v.id));
  const own=stored.filter(v=>!ids.has(v.id));
  const slots=Math.max(0,10-own.filter(v=>effectiveStatus(v.status,v.expires_at,now)==='GENERATED').length);
  return [...examples.slice(0,slots).map(v=>stored.find(old=>old.id===v.id&&effectiveStatus(old.status,old.expires_at,now)==='GENERATED')||v),...own].slice(0,100);
}

export interface DemoFuelBill {
  id:string; voucher_code:string; bunk_name:string; bunk_address:string; equipment:string;
  fuel_type:'DIESEL'|'PETROL'; quantity_litres:number; price_per_litre:number; discount_rate:number; billed_at:string;
}
export const fuelBillTotals=(bill:DemoFuelBill)=>{
  const original=savings(bill.quantity_litres,bill.price_per_litre);
  const discount=savings(bill.quantity_litres,bill.discount_rate);
  return {original,discount,paid:Math.round((original-discount)*100)/100};
};
export function demoFuelBills(now=Date.now()):DemoFuelBill[]{
  return ([
    [0,'DIESEL',300,92.5,'Demo crawler excavator',1,'D3B01001'],
    [1,'DIESEL',800,92.5,'Demo tipper truck',3,'D3B01002'],
    [4,'PETROL',120,102,'Demo site support vehicle',7,'D3B01003'],
  ] as const).map(([station,fuel,quantity,price,equipment,days,code])=>{
    const bunk=demoBunks[station];
    return {id:`DEMO-BILL-${code}`,voucher_code:code,bunk_name:bunk.name,bunk_address:bunk.address,equipment,
      fuel_type:fuel,quantity_litres:quantity,price_per_litre:price,discount_rate:bunk.discount_per_litre,billed_at:new Date(now-days*86400000).toISOString()};
  });
}
