import { authenticatedDatabase, ServiceError, serviceStatus } from '../server-supabase.js';

export function publicHttps(value:unknown):string {
  try {const url=new URL(String(value));return url.protocol==='https:'&&!url.username&&!url.password?url.toString():''}catch{return ''}
}
export default async function handler(req:any,res:any){
  res.setHeader('Cache-Control','private, no-store');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed.'})}
  if(req.body?.action!==undefined&&!['search','details'].includes(req.body.action))return res.status(400).json({error:'Invalid provider request.'});
  const details=req.body?.action==='details';
  const category=String(req.body?.category||'heavy equipment').replace(/[^a-zA-Z0-9 &-]/g,'').slice(0,80);
  const latitude=Number(req.body?.latitude),longitude=Number(req.body?.longitude);
  const placeId=String(req.body?.place_id||'');
  if(details?!/^[A-Za-z0-9_-]{5,255}$/.test(placeId):req.body?.latitude==null||req.body?.longitude==null||String(req.body.latitude).trim()===''||String(req.body.longitude).trim()===''||!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180)
    return res.status(400).json({error:details?'Invalid business identifier.':'A valid search location is required.'});
  try{
    const db=await authenticatedDatabase(req);
    const apiKey=process.env.GOOGLE_PLACES_API_KEY;
    if(!apiKey)return res.status(200).json({configured:false,providers:[],message:'Google Places discovery is not connected yet.'});
    const quota=await db.rpc('claim_provider_request',{p_service:'places'});
    if(quota.error)throw new ServiceError('Provider discovery is temporarily unavailable.',503);
    if(quota.data!==true)throw new ServiceError('Too many requests. Please retry later.',429,60);
    const response=await fetch(details?`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`:'https://places.googleapis.com/v1/places:searchText',{
      method:details?'GET':'POST',
      headers:{'Content-Type':'application/json','X-Goog-Api-Key':apiKey,'X-Goog-FieldMask':details?
        'id,displayName,formattedAddress,nationalPhoneNumber,internationalPhoneNumber,websiteUri,googleMapsUri,businessStatus,attributions':
        'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.googleMapsUri,places.attributions'},
      ...(details?{}:{body:JSON.stringify({textQuery:`${category} rental and service providers`,maxResultCount:10,languageCode:['en','hi','kn'].includes(req.body?.language)?req.body.language:'en',locationBias:{circle:{center:{latitude,longitude},radius:15000}}})}),
      signal:AbortSignal.timeout(10000),
    });
    if(!response.ok)throw new ServiceError(response.status===404?'Business details are unavailable.':'Provider discovery is temporarily unavailable.',response.status===404?404:response.status===429?429:503,60);
    const result=await response.json();
    const normalize=(place:any)=>({
      id:String(place.id||''),name:String(place.displayName?.text||'Equipment provider').slice(0,200),address:String(place.formattedAddress||'').slice(0,600),
      rating:typeof place.rating==='number'?place.rating:null,reviewCount:typeof place.userRatingCount==='number'?place.userRatingCount:null,
      mapsUrl:publicHttps(place.googleMapsUri),
      attributions:(Array.isArray(place.attributions)?place.attributions:[]).map((a:any)=>({name:String(a.provider||'').slice(0,160),url:publicHttps(a.providerUri)})),
    });
    if(details){
      const phone=String(result.internationalPhoneNumber||result.nationalPhoneNumber||'').replace(/[^+\d ()-]/g,'').slice(0,30);
      return res.status(200).json({configured:true,provider:{...normalize(result),phone,website:publicHttps(result.websiteUri),businessStatus:String(result.businessStatus||'UNKNOWN').slice(0,40)}});
    }
    return res.status(200).json({configured:true,providers:(Array.isArray(result.places)?result.places:[]).map(normalize).filter((p:any)=>p.id&&p.mapsUrl)});
  }catch(error){
    if(error instanceof ServiceError&&error.retryAfter)res.setHeader('Retry-After',String(error.retryAfter));
    return res.status(serviceStatus(error)).json({configured:false,providers:[],error:error instanceof ServiceError?error.message:'Provider discovery is temporarily unavailable.'});
  }
}
