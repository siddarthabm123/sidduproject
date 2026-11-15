import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCachedValue } from '../cache-guards';
import {loadDemoBoard} from '../workforce/board-demo';
test('malformed or outdated cache shapes cannot crash list pages and original input is retained',()=>{
  for(const key of ['rigdesk-demo-shared:bookings','rigdesk-demo-shared:auctions-v2','riglogix-account:owner:fleet'])for(const raw of ['null','{}','"old-data"','[null,{}]','broken JSON'])assert.deepEqual(parseCachedValue(raw,[],key),[]);
  const raw='{"role":"customer","loginId":null}';assert.equal(parseCachedValue(raw,null,'riglogix-session'),null);assert.equal(raw,'{"role":"customer","loginId":null}');
  assert.deepEqual(parseCachedValue('{"balance":"bad","bank":null}',{balance:0,bank:'Not set'}),{balance:0,bank:'Not set'});
  assert.equal(parseCachedValue('"kn"','en'),'kn');
});
test('corrupt demo job boards recover in memory without overwriting saved history',()=>{
  const previous=globalThis.localStorage;const data=new Map<string,string>();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>data.set(key,value)}});
  try{
    for(const raw of ['null','{}','broken JSON']){data.set('rigdesk-demo-workforce-board-v1',raw);assert.equal(loadDemoBoard().posts.length,2);assert.equal(data.get('rigdesk-demo-workforce-board-v1'),raw)}
    data.set('rigdesk-demo-workforce-board-v1','{"posts":[null],"applications":[null]}');assert.deepEqual(loadDemoBoard(),{posts:[],applications:[]});
  }finally{if(previous===undefined)Reflect.deleteProperty(globalThis,'localStorage');else Object.defineProperty(globalThis,'localStorage',{configurable:true,value:previous})}
});
test('valid booking history survives alongside malformed cache entries without a rewrite',()=>{
  const booking={id:'demo',machineryId:'machine',machineryTitle:'JCB',ownerName:'Owner',customerName:'Customer',location:'Site',date:'2026-11-15',status:'PENDING',durationHours:8,baseCost:1000,platformFee:35,totalCost:1035,ownerEarnings:1000};
  const raw=JSON.stringify([booking,null,{id:'incomplete'}]);assert.deepEqual(parseCachedValue(raw,[],'rigdesk-demo-shared:bookings'),[booking]);assert.equal(JSON.parse(raw).length,3);
});
