import { randomBytes } from 'node:crypto';
import { loadEnv } from 'vite';
import type { Plugin } from 'vite';

export function devApi():Plugin {
  return {name:'rigdesk-development-api',apply:'serve',configureServer(server){
    const env=loadEnv(server.config.mode,server.config.root,'');
    for(const name of ['SUPABASE_URL','SUPABASE_ANON_KEY','VITE_SUPABASE_URL','VITE_SUPABASE_ANON_KEY','BOND_PDF_SECRET','BOND_VERIFY_BASE_URL','GOOGLE_PLACES_API_KEY','GEMINI_API_KEY']){
      if(env[name]&&!process.env[name])process.env[name]=env[name];
    }
    // Ephemeral key only for local preview. Production still requires a private secret.
    process.env.BOND_PDF_SECRET ||= randomBytes(32).toString('hex');
    process.env.BOND_VERIFY_BASE_URL ||= `http://localhost:${server.config.server.port}/verify/`;
    server.middlewares.use(async(req,res,next)=>{
      const url=new URL(req.url||'/', 'http://localhost');
      const routes:Record<string,string>={'/api/generate-bond':'/api/generate-bond.ts','/api/verify-bond':'/api/verify-bond.ts','/api/discover-providers':'/api/discover-providers.ts','/api/recommend-vehicles':'/api/recommend-vehicles.ts'};
      const module=routes[url.pathname];if(!module)return next();
      try{
        let body='';for await(const chunk of req){body+=String(chunk);if(Buffer.byteLength(body)>16384){res.statusCode=413;res.end('Request too large');return}}
        const handler=(await server.ssrLoadModule(module)).default;
        const response={setHeader:(name:string,value:string)=>res.setHeader(name,value),status:(code:number)=>{res.statusCode=code;return response},json:(value:unknown)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value))},send:(value:string|Buffer)=>res.end(value)};
        await handler({method:req.method,headers:req.headers,query:Object.fromEntries(url.searchParams),body:body?JSON.parse(body):undefined},response);
      }catch{res.statusCode=500;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:'Local API request failed.'}))}
    });
  }};
}
