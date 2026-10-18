import { authenticatedDatabase, serverDatabase, ServiceError } from '../server-supabase.js';
import { coordinates, radii, validQuantity } from '../fuel/domain.js';

interface Request { method?: string; headers: Record<string,unknown>; query: Record<string,unknown>; body?: unknown }
interface Response { status(n: number): Response; json(value: unknown): unknown; setHeader(name: string,value: string): unknown }
const methods:Record<string,string>={'bunks/nearby':'GET','bunks':'POST','context':'GET','vouchers':'GET','vouchers/generate':'POST','vouchers/verify':'GET','vouchers/redeem':'POST'};
const uuid=(v: unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const invalid=()=>{throw new Error('Invalid fuel request')};
export default async function handler(req: Request,res: Response) {
  res.setHeader('Cache-Control','no-store');
  const route=String(req.query.route||'');const method=methods[route];
  if(!Object.hasOwn(methods,route))return res.status(404).json({error:'Fuel endpoint not found'});
  if(req.method!==method){res.setHeader('Allow',method);return res.status(405).json({error:'Method not allowed'})}
  try {
    const db=route==='vouchers/verify'?serverDatabase():await authenticatedDatabase(req);
    const body=req.body&&typeof req.body==='object'&&!Array.isArray(req.body)?req.body as Record<string,unknown>:{};
    let fn='';let args:Record<string,unknown>={};let key='';
    switch(route){
      case 'context':fn='fuel_hub_context';key='context';break;
      case 'vouchers':fn='my_fuel_vouchers';key='vouchers';break;
      case 'bunks/nearby': {
        const lat=Number(req.query.latitude),lng=Number(req.query.longitude),radius=Number(req.query.radius_km??10);
        const fuel=req.query.fuel_type??'diesel',partner=req.query.partner_only??'false';
        if(req.query.latitude==null||req.query.longitude==null||String(req.query.latitude).trim()===''||String(req.query.longitude).trim()===''||!coordinates(lat,lng)||!radii.includes(radius as 5)||!['diesel','petrol'].includes(String(fuel))||!['true','false'].includes(String(partner)))invalid();
        fn='fuel_bunks_nearby';key='bunks';args={p_latitude:lat,p_longitude:lng,p_radius_km:radius,p_fuel:fuel,p_partner_only:partner==='true'};break;
      }
      case 'bunks': {
        const fuels=body.fuel_types_available;
        if(typeof body.latitude!=='number'||typeof body.longitude!=='number'||!coordinates(body.latitude,body.longitude)||
          !Array.isArray(fuels)||fuels.length<1||fuels.length>2||fuels.some(f=>!['diesel','petrol'].includes(f))||
          typeof body.is_partner!=='boolean'||['name','brand','address'].some(k=>typeof body[k]!=='string')||
          String(body.name).trim().length<2||String(body.name).length>120||String(body.brand).trim().length<2||String(body.brand).length>60||String(body.address).trim().length<5||String(body.address).length>500||
          (body.contact_phone!==undefined&&(typeof body.contact_phone!=='string'||body.contact_phone.length>25))||
          (body.is_partner&&(typeof body.discount_per_litre!=='number'||!Number.isFinite(body.discount_per_litre)||body.discount_per_litre<=0||body.discount_per_litre>10||Math.abs(body.discount_per_litre*100-Math.round(body.discount_per_litre*100))>1e-7)))invalid();
        fn='register_fuel_bunk';key='bunk';args={p_data:body};break;
      }
      case 'vouchers/generate': {
        if(!uuid(body.bunk_id)||!uuid(body.request_id)||(body.equipment_id!=null&&!uuid(body.equipment_id))||!['DIESEL','PETROL'].includes(String(body.fuel_type))||typeof body.quantity_litres!=='number'||!validQuantity(body.quantity_litres))invalid();
        fn='generate_fuel_voucher';key='voucher';args={p_bunk_id:body.bunk_id,p_request_id:body.request_id,p_fuel:body.fuel_type,p_quantity:body.quantity_litres,p_equipment_id:body.equipment_id??null};break;
      }
      case 'vouchers/verify':
      case 'vouchers/redeem': {
        const input=route==='vouchers/verify'?req.query:body;
        if(!uuid(input.id)||!uuid(input.token))invalid();
        const verify=route==='vouchers/verify';fn=verify?'verify_fuel_voucher':'redeem_fuel_voucher';key=verify?'voucher':'redemption';args={p_id:input.id,p_token:input.token};
        if(!verify){if(typeof body.quantity_litres!=='number'||!validQuantity(body.quantity_litres))invalid();args.p_quantity=body.quantity_litres}break;
      }
    }
    const {data,error}=await db.rpc(fn,args);
    if(error){
      const code=error.code;
      if(code==='42501'||code==='28000')return res.status(code==='42501'?403:401).json({error:error.message});
      if(code==='22023')return res.status(400).json({error:error.message});
      if(['23514','23502','22P02'].includes(code))return res.status(400).json({error:'Invalid fuel request'});
      return res.status(503).json({error:'Fuel service is unavailable. Check database migrations.'});
    }
    if(route==='vouchers/verify'&&!data)return res.status(404).json({error:'Voucher not found'});
    if(data?.error)return res.status(409).json(data);
    return res.status(200).json({[key]:data});
  }catch(error){
    if(error instanceof ServiceError){if(error.retryAfter)res.setHeader('Retry-After',String(error.retryAfter));return res.status(error.status).json({error:error.message})}
    const message=error instanceof Error?error.message:'';
    const auth=/Authentication required|session has expired/.test(message);
    return res.status(auth?401:message==='Invalid fuel request'?400:503).json({error:auth?message:message==='Invalid fuel request'?message:'Fuel service is unavailable. Please retry later.'});
  }
}
