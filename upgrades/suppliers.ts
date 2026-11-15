export type UpgradeLanguage='en'|'hi'|'kn';
export interface Supplier {
  id:string;name:string;address:string;mapsUrl:string;rating:number|null;reviewCount:number|null;
  phone?:string;website?:string;businessStatus?:string;attributions?:{name:string;url:string}[];
}
export interface PublishedBusiness {id:string;name:string;category:string;area:string;phone:string;website:string;source:string;checked:string}
// Public business facts from each business's own website. These are not RigDesk partners.
export const publishedBusinesses:PublishedBusiness[]=[
  {id:'eshan',name:'Eshan Borewells',category:'Borewell',area:'Bengaluru',phone:'+919844775905',website:'https://www.eshanborewells.com/',source:'https://www.eshanborewells.com/',checked:'2026-11-15'},
  {id:'vinayaka',name:'Vinayaka Earth Movers',category:'Excavator / JCB',area:'Begur, Bengaluru',phone:'+919900151334',website:'https://vinayakaearthmovers.in/',source:'https://vinayakaearthmovers.in/contact',checked:'2026-11-15'},
  {id:'sanghvi',name:'Sanghvi Movers',category:'Crane',area:'India — confirm project coverage',phone:'+912066744700',website:'https://sanghvicranes.com/',source:'https://sanghvicranes.com/',checked:'2026-11-15'},
  {id:'vrl',name:'VRL Logistics',category:'Logistics',area:'India — confirm route and service',phone:'18005997800',website:'https://vrlgroup.in/',source:'https://vrlgroup.in/ContactUs',checked:'2026-11-15'},
];
export const safePhone=(phone:string)=>/^\+?\d[\d ()-]{5,28}$/.test(phone)?phone.replace(/[^+\d]/g,''):'';
export function filterBusinesses(query:string,category:string){
  return publishedBusinesses.filter(b=>(category==='All'||b.category===category)&&`${b.name} ${b.category} ${b.area}`.toLowerCase().includes(query.trim().toLowerCase()));
}
