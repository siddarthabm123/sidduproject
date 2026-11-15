import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import DemoFuelBills, { FuelBillDetails } from '../fuel/DemoFuelBills';
import { demoFuelBills, demoVouchers, fuelBillTotals } from '../fuel/demo';
import { effectiveStatus, validQuantity } from '../fuel/domain';
import { fuelText } from '../fuel/labels';

test('demo starts with usable vouchers without duplicating, expiring or overwriting user-created vouchers',()=>{
  const now=Date.parse('2026-11-15T10:00:00Z'),examples=demoVouchers([],now);
  assert.equal(examples.length,3);
  assert.equal(new Set(examples.map(v=>v.voucher_code)).size,3);
  for(const v of examples){
    assert.equal(v.demo,true);assert.match(v.voucher_code,/^[A-F0-9]{8}$/);
    assert.ok(validQuantity(v.quantity_litres));assert.equal(effectiveStatus(v.status,v.expires_at,now),'GENERATED');
  }
  const own={...examples[0],id:'owner-created',voucher_code:'AABB0011'};
  const loaded=demoVouchers([...examples,own],now+1000);
  assert.equal(loaded.length,4);assert.equal(loaded.find(v=>v.id===own.id),own);
  assert.equal(loaded[0].expires_at,examples[0].expires_at,'Reload must not extend a valid voucher');
  const later=now+2*86400000;
  assert.ok(demoVouchers(loaded,later).filter(v=>v.id.startsWith('demo-example-')).every(v=>effectiveStatus(v.status,v.expires_at,later)==='GENERATED'));
  const full=Array.from({length:10},(_,i)=>({...own,id:`manual-${i}`}));
  assert.equal(demoVouchers(full,now).length,10,'Examples must respect the existing active voucher limit');
});

test('demo bills reconcile to the pump cost minus partner discount, with localized sample disclosures',()=>{
  const bills=demoFuelBills(Date.parse('2026-11-15T10:00:00Z'));
  assert.deepEqual(bills.map(fuelBillTotals),[
    {original:27750,discount:300,paid:27450},
    {original:74000,discount:400,paid:73600},
    {original:12240,discount:120,paid:12120},
  ]);
  assert.deepEqual(fuelBillTotals({...bills[0],quantity_litres:125.25,price_per_litre:92.51,discount_rate:0.5}),{original:11586.88,discount:62.63,paid:11524.25});
  for(const language of ['en','hi','kn'] as const){
    const html=renderToStaticMarkup(createElement(DemoFuelBills,{bills,language,onPrint:()=>{}}));
    assert.ok(html.includes('₹820'));assert.ok(html.includes('₹1,13,170'));assert.ok(html.includes('₹1,13,990'));
    assert.ok(html.includes(fuelText('Sample receipt only. No payment was made. Not a tax invoice.',language)));
    assert.ok(html.includes(fuelText('Print sample bill',language)));
    if(language!=='en')assert.ok(!html.includes('Cost before discount'));
  }
  const printed=renderToStaticMarkup(createElement(FuelBillDetails,{bill:bills[0],language:'en'}));
  assert.ok(printed.includes('DEMO-BILL-D3B01001'));assert.ok(printed.includes('₹27,450'));
  assert.ok(printed.includes('Not a tax invoice.'));
});
