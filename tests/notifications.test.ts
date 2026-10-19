import test from 'node:test';
import assert from 'node:assert/strict';
import { demoNotices,noticeCopy } from '../notifications';
import { demoNegotiations,demoWorkers } from '../workforce/demo';
import { translatePhrase } from '../localization';
import { readFileSync } from 'node:fs';

test('notifications describe the correct negotiation side, wage, timestamp and role',()=>{
 const now=new Date('2026-10-19T10:00:00Z'),hires=demoNegotiations(now);
 const customer=demoNotices(hires,demoWorkers,'customer',new Set());
 assert.equal(customer.length,4);
 const counter=customer.find(n=>n.hire?.worker_name==='Anand Kumar')!;
 assert.equal(noticeCopy(counter,now.getTime()).title,'Worker proposed a different wage');
 assert.equal(counter.hire?.agreed_wage,1100);
 assert.equal(noticeCopy(counter,now.getTime()).action,'Review counter-offer');
 const manager=demoNotices(hires,demoWorkers,'owner',new Set([counter.id])).find(n=>n.id===counter.id)!;
 assert.equal(noticeCopy(manager,now.getTime()).title,'Your worker counter-offer was sent');
 assert.ok(manager.read_at);
 const updated={...hires[0],offer_history:[...hires[0].offer_history!,{version:3,side:'EMPLOYER' as const,action:'COUNTER',amount:1050,note:'',created_at:'2026-10-19T11:00:00Z'}],agreed_wage:1050,offer_by:'EMPLOYER' as const,offer_version:3};
 const latest=demoNotices([...hires.slice(1),updated],demoWorkers,'customer',new Set([counter.id]));
 assert.equal(latest[0].created_at,'2026-10-19T11:00:00Z');assert.equal(latest[0].read_at,null);
 assert.equal(demoNotices([{...hires[0],employer_id:'other',worker_id:'unrelated'}],demoWorkers,'customer',new Set()).length,0);
});

test('closed and expired notices do not tell users to accept offers',()=>{
 const now=new Date('2026-10-19T10:00:00Z'),h=demoNegotiations(now)[0],base=demoNotices([h],demoWorkers,'customer',new Set())[0];
 for(const status of ['ACTIVE','COMPLETED','CANCELLED'] as const){const copy=noticeCopy({...base,hire:{...h,status}},now.getTime());assert.equal(copy.action,'View hiring agreement');assert.notEqual(copy.title,'Worker proposed a different wage');}
 assert.equal(noticeCopy(base,now.getTime()+86400001).title,'Hiring request expired');
 assert.equal(noticeCopy({...base,hire:{...h,status:'CANCELLED',offer_history:[{version:2,side:'WORKER',action:'DECLINE',amount:1100,note:'',created_at:now.toISOString()}]}},now.getTime()).title,'Hiring offer declined');
});

test('all notification copy has Hindi and Kannada translations, including real record updates',()=>{
 const now=new Date('2026-10-19T10:00:00Z'),h=demoNegotiations(now)[0],base=demoNotices([h],demoWorkers,'customer',new Set())[0];
 const copies=[noticeCopy(base,now.getTime()),noticeCopy({...base,isManager:true},now.getTime()),noticeCopy({...base,hire:{...h,offer_by:'EMPLOYER'}},now.getTime()),noticeCopy({...base,isManager:true,hire:{...h,offer_by:'EMPLOYER'}},now.getTime()),noticeCopy(base,now.getTime()+86400001)];
 for(const status of ['ACTIVE','COMPLETED','CANCELLED'] as const)copies.push(noticeCopy({...base,hire:{...h,status}},now.getTime()));
 for(const title of ['New booking request','Booking status updated','Completion approval requested','New hiring request','Wage offer updated','Hiring status updated','Booking issue updated','Work log approval requested','Work log reviewed'])copies.push(noticeCopy({...base,hire:undefined,title_key:title}));
 for(const copy of copies)for(const value of Object.values(copy))for(const lang of ['hi','kn'] as const)assert.notEqual(translatePhrase(value,lang),value,`${lang}: ${value}`);
 assert.match(readFileSync(new URL('../fuel/FuelModal.tsx',import.meta.url),'utf8'),/import ['"]\.\.\/fuel\.css['"]/);
});
