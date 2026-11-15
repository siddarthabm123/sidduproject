import test from 'node:test';
import assert from 'node:assert/strict';
import {timedFetch} from '../request-timeout';
test('requests have a deadline while unmount cancellation and caller headers survive',async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async(_input,options)=>{assert.equal((options?.headers as Record<string,string>).Authorization,'Bearer test');return new Response('ok')};
  assert.equal(await(await timedFetch('https://example.test',{headers:{Authorization:'Bearer test'}})).text(),'ok');
  globalThis.fetch=async(_input,options)=>new Promise((_resolve,reject)=>{const abort=()=>reject(new DOMException('Aborted','AbortError'));if(options?.signal?.aborted)abort();else options?.signal?.addEventListener('abort',abort,{once:true})});
  await assert.rejects(timedFetch('https://example.test',{},5),/Request timed out/);
  const controller=new AbortController();controller.abort();await assert.rejects(timedFetch('https://example.test',{signal:controller.signal}),/Aborted/);
 }finally{globalThis.fetch=original}
});
