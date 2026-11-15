// Render audit only: effects, real browser layout and external services are not exercised.
import {createServer} from 'vite';
import {createElement} from 'react';
import {renderToPipeableStream} from 'react-dom/server';
import {Router} from 'wouter';
import {PassThrough} from 'node:stream';
import {mkdir,writeFile} from 'node:fs/promises';
const values=new Map();
const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key),clear:()=>values.clear()};
globalThis.window={localStorage:storage,sessionStorage:storage,location:{pathname:'/',search:'',hash:'',origin:'http://localhost:5180'},addEventListener(){},removeEventListener(){},dispatchEvent(){},matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}})};
globalThis.localStorage=storage;globalThis.sessionStorage=storage;
globalThis.document={documentElement:{lang:'en',dataset:{theme:'light'}},title:'RigDesk',visibilityState:'visible'};
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:true,language:'en-IN'}});
const server=await createServer({mode:'test',server:{middlewareMode:true},appType:'custom',optimizeDeps:{noDiscovery:true,entries:[]},ssr:{noExternal:['leaflet']},plugins:[{
 name:'render-audit-fixtures',enforce:'pre',resolveId(id){if(id==='leaflet')return '\0audit-leaflet'},load(id){if(id==='\0audit-leaflet')return 'export default {}'},
 transform(code,id){if(id.replaceAll('\\','/').endsWith('/App.tsx'))return code+'\nexport const renderAuditFixtures={demoProfile,demoBookings,fleetSeed,auctionSeed,machinerySeed,BorewellModal,StableBookingModal,MachineryModal};'},
}]});
const result=[];
async function render(Component,props,path){
 return new Promise((resolve,reject)=>{
  const chunks=[],errors=[];const output=new PassThrough();output.on('data',chunk=>chunks.push(chunk));output.on('end',()=>errors.length?reject(errors[0]):resolve(Buffer.concat(chunks).toString()));
  const stream=renderToPipeableStream(createElement(Router,{ssrPath:path},createElement(Component,props)),{onAllReady(){stream.pipe(output)},onError(error){errors.push(error)},onShellError:reject});
  const timer=setTimeout(()=>{stream.abort();reject(new Error('Render exceeded 15 seconds'))},15000);output.on('end',()=>clearTimeout(timer));output.on('error',reject);
 });
}
try{
 const {default:App,renderAuditFixtures:f}=await server.ssrLoadModule('/App.tsx');
 const routes={guest:['/','/demo','/sign-in','/reset-password','/launch-guide','/privacy','/terms'],customer:['/customer/dashboard','/customer/machinery','/customer/auctions','/customer/radar','/customer/bookings','/customer/suppliers','/dashboard/customer/hire-workers','/dashboard/worker/create-profile','/account'],owner:['/owner/dashboard','/owner/fleet','/owner/jobs','/owner/equipment-radar','/owner/operations','/owner/suppliers','/dashboard/owner/workforce','/dashboard/owner/fuel-hub','/account']};
 const configure=(role,language,theme)=>{
  storage.clear();document.documentElement.lang=language;document.documentElement.dataset.theme=theme;
  if(role!=='guest'){
   const profile={...f.demoProfile(role),language,theme};storage.setItem('riglogix-session',JSON.stringify(profile));
   const prefix=`riglogix-account:${encodeURIComponent(profile.loginId.toLowerCase())}:`;
   for(const [key,data] of [['bookings',f.demoBookings()],['auctions-v2',f.auctionSeed],['fleet',f.fleetSeed]])storage.setItem(['bookings','auctions-v2'].includes(key)?`rigdesk-demo-shared:${key}`:prefix+key,JSON.stringify(data));
  }
  storage.setItem('riglogix-entry-language',JSON.stringify(language));storage.setItem('riglogix-entry-theme',JSON.stringify(theme));
 };
 const check=async(name,Component,props,path)=>{
  try{window.location={pathname:path,search:'',hash:'',origin:'http://localhost:5180'};const html=await render(Component,props,path);if(!html.length)throw new Error('Empty rendered page');result.push({name,status:'pass',bytes:Buffer.byteLength(html)})}
  catch(e){result.push({name,status:'fail',error:e.message,stack:e.stack?.split('\n').slice(0,5).join('\n')});console.error(name,e.message)}
 };
 for(const [role,paths] of Object.entries(routes))for(const language of ['en','hi','kn'])for(const theme of ['light','dark'])for(const path of paths){configure(role,language,theme);await check(`${role} ${language} ${theme} ${path}`,App,{},path)}
 for(const name of ['BorewellModal','StableBookingModal','MachineryModal'])for(const machine of f.machinerySeed.filter(m=>['Borewell Rig','Tipper Truck','Excavator'].includes(m.category))){configure('customer','en','light');await check(`${name} ${machine.category}`,f[name],{m:machine,onClose(){}},'/customer/machinery')}
 for(const key of ['bookings','auctions-v2','fleet'])for(const value of [null,{},'old-data']){
  configure(key==='fleet'?'owner':'customer','en','light');
  const session=JSON.parse(storage.getItem('riglogix-session')),prefix=`riglogix-account:${encodeURIComponent(session.loginId.toLowerCase())}:`;
  storage.setItem(key==='fleet'?prefix+key:`rigdesk-demo-shared:${key}`,JSON.stringify(value));
  await check(`old cache ${key} ${JSON.stringify(value)}`,App,{},key==='fleet'?'/owner/fleet':key==='bookings'?'/customer/bookings':'/customer/auctions');
 }
 for(const value of [[],{},null,{role:'customer',loginId:null},{role:'wrong',loginId:'old.demo'}]){configure('guest','en','light');storage.setItem('riglogix-session',JSON.stringify(value));await check(`old session ${JSON.stringify(value)}`,App,{},'/customer/dashboard')}
 configure('guest','en','light');const {default:Pitch}=await server.ssrLoadModule('/PitchHighlights.tsx');
 for(const hash of ['problem','pillars','bond']){window.location.hash='#'+hash;try{const html=await render(Pitch,{},'/pitch-highlights');const visible=(html.match(/<section class="pitch-slide [^"]+" aria-label=/g)||[]).length;if(visible!==1)throw Error(`Expected one visible slide; got ${visible}`);result.push({name:`pitch ${hash}`,status:'pass'})}catch(e){result.push({name:`pitch ${hash}`,status:'fail',error:e.message})}}
 await mkdir('output/performance-audit',{recursive:true});await writeFile('output/performance-audit/render-results.json',JSON.stringify(result,null,2));
 const failed=result.filter(r=>r.status==='fail');console.log(JSON.stringify({checks:result.length,passed:result.length-failed.length,failures:failed},null,2));if(failed.length)process.exitCode=1;
}finally{await server.close()}
