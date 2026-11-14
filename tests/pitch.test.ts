import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ownerEconomics,pitchPillars,executiveSummary} from '../pitch-model';

test('pitch fee is an explicit proposal, computes exact owner net and never alters checkout',()=>{
  assert.deepEqual(ownerEconomics(100000,2),{work:100000,fee:2000,ownerNet:98000});
  assert.deepEqual(ownerEconomics(100000,3),{work:100000,fee:3000,ownerNet:97000});
  for(const value of [0,-1,Infinity,NaN])assert.throws(()=>ownerEconomics(value,2));
  assert.throws(()=>ownerEconomics(100000,4 as 2));
});

test('public three-slide pitch labels sample money, unsupported claims and integration boundaries',()=>{
  const html=readFileSync(new URL('../PitchHighlights.tsx',import.meta.url),'utf8');
  assert.equal((html.match(/className="pitch-slide /g)||[]).length,3);
  assert.equal(pitchPillars.length,5);
  for(const value of ['Founder observation','3.5% customer fee','UNFUNDED','Actually paid / escrow funded','not an extra fee','not the current funded contract'])assert.ok(html.includes(value),value);
  assert.ok(pitchPillars.some(p=>p.boundary.includes('Independent worker login')));
  assert.ok(pitchPillars.some(p=>p.boundary.includes('No zero-cancellation guarantee')));
  const app=readFileSync(new URL('../App.tsx',import.meta.url),'utf8');
  assert.ok(app.indexOf("if(location==='/pitch-highlights')")<app.indexOf("if(workforceRoute){"));
  const source=readFileSync(new URL('../PitchHighlights.tsx',import.meta.url),'utf8');
  assert.ok(!/localStorage|supabase|api\/payments/.test(source));
  assert.ok(source.includes('PDF')&&source.includes('qr'));
});

test('executive summary is exactly 150 words and separates implemented features from proposed economics',()=>{
  assert.equal(executiveSummary.trim().split(/\s+/).length,150);
  assert.match(executiveSummary,/two to three percent/);
  assert.match(executiveSummary,/simulated/);
  assert.match(executiveSummary,/from experience/);
});
