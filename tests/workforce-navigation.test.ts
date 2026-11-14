import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Router } from 'wouter';
import WorkforceSection from '../WorkforceSection';
import { workforceDestination, workforcePath, workerProfilePath } from '../workforce/routes';

test('workforce aliases stay in the signed-in role and do not consume other workspace routes',()=>{
  for(const role of ['customer','owner'] as const){
    for(const path of ['/dashboard/owner/workforce','/dashboard/customer/hire-workers','/owner/workforce','/customer/workforce','/customer/hire-workers','/dashboard/customer/workforce']){
      assert.equal(workforceDestination(path,role),workforcePath(role));
    }
    assert.equal(workforceDestination(workerProfilePath,role),workerProfilePath);
    for(const path of ['/','/account','/owner/dashboard','/customer/bookings','/owner/fleet','/owner/workforce-other'])assert.equal(workforceDestination(path,role),null);
  }
});

test('customer and owner dashboard entries reach hiring, agreements, managed profiles and registration in all languages',()=>{
  for(const role of ['customer','owner'] as const){
    for(const language of ['en','hi','kn'] as const){
      const html=renderToStaticMarkup(createElement(Router,{ssrPath:`/${role}/dashboard`,children:createElement(WorkforceSection,{role,language})}));
      for(const href of [workforcePath(role),`${workforcePath(role)}#hiring-agreements`,`${workforcePath(role)}#worker-profiles`,workerProfilePath])assert.ok(html.includes(`href="${href}"`),href);
      assert.ok(html.includes(`workforce-section-${role}`));
      if(language!=='en')assert.ok(!html.includes('Assign / Hire Worker')&&!html.includes('Find operators for your fleet')&&!html.includes('Find skilled people'));
      const other=role==='owner'?'customer':'owner';
      assert.ok(!html.includes(`href="${workforcePath(other)}`));
    }
  }
});
