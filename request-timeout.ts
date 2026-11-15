export async function timedFetch(input:RequestInfo|URL,options:RequestInit={},timeoutMs=12000):Promise<Response>{
  const controller=new AbortController();let timedOut=false;
  const relay=()=>controller.abort(options.signal?.reason);
  if(options.signal?.aborted)relay();else options.signal?.addEventListener('abort',relay,{once:true});
  const timer=setTimeout(()=>{timedOut=true;controller.abort()},timeoutMs);
  try{return await fetch(input,{...options,signal:controller.signal})}
  catch(error){if(timedOut)throw new Error('Request timed out. Please retry.');throw error}
  finally{clearTimeout(timer);options.signal?.removeEventListener('abort',relay)}
}
