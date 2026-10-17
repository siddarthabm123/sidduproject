import type { FuelBunk, FuelContext } from './types';
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
