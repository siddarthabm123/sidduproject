import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import discover,{ publicHttps } from '../api/discover-providers';
import { bookingCsv, csvCell, operationsSummary, quoteLine, validShortlist, workScope } from '../upgrades/tools';
import { filterBusinesses, publishedBusinesses, safePhone } from '../upgrades/suppliers';
import { upgradeText } from '../upgrades/labels';

test('booking preview follows database paise rounding for every listing before adding totals',()=>{
  assert.deepEqual(quoteLine(10001,3,1.25),{base:37504,fee:1313,total:38817});
  // Rounding the multiplied gross directly gives a different result at this boundary.
  assert.deepEqual(quoteLine(101,1,0.15),{base:15,fee:1,total:16});
  assert.deepEqual(quoteLine(50,1,0.29),{base:15,fee:1,total:16});
  assert.throws(()=>quoteLine(100,1,1.005));
  for(const args of [[100,1,NaN],[100,1,-1],[100,1.5,2],[100.2,1,2],[100,1,10001]] as const)assert.throws(()=>quoteLine(args[0],args[1],args[2]));
});
test('work scope is stored as customer-requested instructions, within the existing database limit',()=>{
  const form=new FormData();form.set('instructions','Gate 2, call on arrival');form.set('scopeCategory','Borewell');form.set('scopeRequirement','400 ft with casing quoted separately');form.set('scopeFuel','To be agreed');
  const text=workScope(form);assert.match(text,/Gate 2/);assert.match(text,/owner confirmation required/);assert.match(text,/400 ft/);assert.match(text,/Fuel responsibility: To be agreed/);
  form.set('instructions','x'.repeat(2000));assert.throws(()=>workScope(form),/2,000/);
});
test('operations exclude cancelled revenue and CSV neutralises formula injection without fabricating payments',()=>{
  const job={id:'one',public_code:'RD-1',equipment_title:'Excavator',customer_name:'=HYPERLINK("bad")',requested_date:'2026-11-16',reservation_start:'2026-11-16',reservation_end:'2026-11-17',equipment_units:1,total_cost_paise:103500,amount_paid_paise:0,status:'confirmed'};
  assert.deepEqual(operationsSummary([job,{...job,id:'cancelled',status:'cancelled'}]),{booked:103500,paid:0,due:103500});
  assert.ok(bookingCsv([job]).includes('"1035.00","0.00","1035.00"'));
  for(const s of ['=1+1','+cmd','\t@SUM(1)','-1'])assert.ok(csvCell(s).startsWith('"\''));
  assert.equal(csvCell('a,b"c'),'"a,b""c"');
  assert.ok(bookingCsv([{...job,status:'cancelled'}]).endsWith('"0.00"'));
});
test('shortlist stores only bounded equipment identifiers; external contacts retain their independent sources',()=>{
  assert.deepEqual(validShortlist(['a','a','../../private','<script>',null,'b']),['a','b']);
  assert.equal(validShortlist(Array.from({length:110},(_,i)=>'m-'+i)).length,100);
  assert.equal(filterBusinesses('Bengaluru','All').length,2);
  assert.equal(filterBusinesses('','Borewell')[0].name,'Eshan Borewells');
  for(const b of publishedBusinesses){assert.equal(new URL(b.source).hostname,new URL(b.website).hostname);assert.ok(safePhone(b.phone));assert.equal(b.checked,'2026-11-15')}
  assert.equal(safePhone('javascript:alert(1)'), '');
  for(const language of ['hi','kn'] as const)for(const phrase of ['Suppliers & dealers','Booking cost breakdown','Owner operations','Compare saved equipment','Work requirements'])assert.notEqual(upgradeText(phrase,language),phrase);
});
test('Google contacts are authenticated, on demand, sanitised, attributed and not cached',async()=>{
  const original=globalThis.fetch,keys=['SUPABASE_URL','SUPABASE_ANON_KEY','GOOGLE_PLACES_API_KEY'],before=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  process.env.SUPABASE_URL='https://database.example.test';process.env.SUPABASE_ANON_KEY='public-test-key';process.env.GOOGLE_PLACES_API_KEY='test-places-key';
  const invoke=async(body:unknown,headers:Record<string,string>={authorization:'Bearer test'})=>{const result={status:200,body:{} as any,headers:{} as Record<string,string>};const res={status(n:number){result.status=n;return res},setHeader(k:string,v:string){result.headers[k]=v},json(v:unknown){result.body=v;return v}};await discover({method:'POST',headers,body},res);return result};
  const googleCalls:{url:string;options:any}[]=[];
  try{
    globalThis.fetch=async(input:any,options:any)=>{
      const url=String(input);if(url.endsWith('/auth/v1/user'))return Response.json({id:randomUUID()});if(url.includes('claim_provider_request'))return Response.json(true);
      googleCalls.push({url,options});return Response.json({id:'ChIJ_Test1',displayName:{text:'Public business'},nationalPhoneNumber:'080 1234 5678',websiteUri:'javascript:alert(1)',googleMapsUri:'https://maps.google.com/?cid=1',businessStatus:'OPERATIONAL',attributions:[{provider:'Data provider',providerUri:'https://provider.example.test/'}]});
    };
    assert.equal((await invoke({action:'details',place_id:'ChIJ_Test1'},{})).status,401);assert.equal(googleCalls.length,0);
    assert.equal((await invoke({action:'details',place_id:'../secret'})).status,400);
    const result=await invoke({action:'details',place_id:'ChIJ_Test1'});
    assert.equal(result.status,200);assert.equal(result.headers['Cache-Control'],'private, no-store');assert.equal(result.body.provider.phone,'080 1234 5678');assert.equal(result.body.provider.website,'');assert.equal(result.body.provider.attributions[0].name,'Data provider');
    assert.equal(googleCalls[0].options.method,'GET');assert.ok(googleCalls[0].options.headers['X-Goog-FieldMask'].includes('nationalPhoneNumber'));
    delete process.env.GOOGLE_PLACES_API_KEY;assert.equal((await invoke({latitude:12.97,longitude:77.6})).body.configured,false);assert.equal(googleCalls.length,1);
    assert.equal(publicHttps('http://insecure.test'),'');assert.equal(publicHttps('https://user:pass@example.test'),'');
  }finally{globalThis.fetch=original;for(const k of keys){if(before[k]===undefined)delete process.env[k];else process.env[k]=before[k]}}
});
