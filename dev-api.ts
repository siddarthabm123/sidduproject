import { randomBytes } from 'node:crypto';
import { loadEnv } from 'vite';
import type { Plugin } from 'vite';

export function devApi():Plugin {
  return {name:'rigdesk-development-api',apply:'serve',configureServer(server){
    const env=loadEnv(server.config.mode,server.config.root,'');
    for(const name of ['SUPABASE_URL','SUPABASE_ANON_KEY','VITE_SUPABASE_URL','VITE_SUPABASE_ANON_KEY','BOND_PDF_SECRET','BOND_VERIFY_BASE_URL','GOOGLE_PLACES_API_KEY','GEMINI_API_KEY','PAYMENTS_ENABLED','PAYMENTS_LIVE_MODE','SUPABASE_SERVICE_ROLE_KEY','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','PAYMENT_WORKER_SECRET']){
      if(env[name]&&!process.env[name])process.env[name]=env[name];
    }
    // Ephemeral key only for local preview. Production still requires a private secret.
    process.env.BOND_PDF_SECRET ||= randomBytes(32).toString('hex');
    process.env.BOND_VERIFY_BASE_URL ||= `http://localhost:${server.config.server.port}/verify/`;
    server.middlewares.use(async(req,res,next)=>{
      const url=new URL(req.url||'/', 'http://localhost');
      const routes:Record<string,string>={'/api/generate-bond':'/api/generate-bond.ts','/api/verify-bond':'/api/verify-bond.ts','/api/discover-providers':'/api/discover-providers.ts','/api/recommend-vehicles':'/api/recommend-vehicles.ts'};
      for(const route of ['payments/escrow/lock','payments/escrow/release','payments/escrow/refund','payments/factoring/request','payments/webhook','payments/worker','inspections/post-return','inspections/sign-off'])routes[`/api/v1/${route}`]='/api/payments.ts';
      const fuelRoute=url.pathname.startsWith('/api/v1/fuel/');
      const workerRoute=url.pathname.startsWith('/api/v1/workers/');
      const module=fuelRoute?'/api/fuel.ts':workerRoute?'/api/workers.ts':routes[url.pathname];if(!module)return next();
      try{
        const requestLimit=url.pathname.startsWith('/api/v1/')?65536:16384;
        const chunks:Buffer[]=[];let size=0;for await(const chunk of req){const bytes=Buffer.from(chunk);size+=bytes.length;if(size>requestLimit){res.statusCode=413;res.end('Request too large');return}chunks.push(bytes)}
        const rawBody=Buffer.concat(chunks);const body=rawBody.toString('utf8');
        const handler=(await server.ssrLoadModule(module)).default;
        const response={setHeader:(name:string,value:string)=>res.setHeader(name,value),status:(code:number)=>{res.statusCode=code;return response},json:(value:unknown)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value))},send:(value:string|Buffer)=>res.end(value)};
        const query=Object.fromEntries(url.searchParams);if(fuelRoute)query.route=url.pathname.slice('/api/v1/fuel/'.length);
        if(workerRoute)query.route=url.pathname.slice('/api/v1/workers/'.length);
        if(module==='/api/payments.ts')query.route=url.pathname.slice('/api/v1/'.length);
        let parsed:unknown;try{parsed=url.pathname==='/api/v1/payments/webhook'?undefined:body?JSON.parse(body):undefined}catch{res.statusCode=400;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:'Invalid JSON request'}));return}
        await handler({method:req.method,headers:req.headers,query,rawBody,body:parsed},response);
      }catch{res.statusCode=500;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:'Local API request failed.'}))}
    });
  }};
}
