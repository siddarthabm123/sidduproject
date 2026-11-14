import React, { lazy, Suspense } from 'react';
import { Link } from 'wouter';
import { ArrowRight, MapPin, MessageSquare, Plus, Users } from 'lucide-react';
import { boardText } from './workforce/board-labels';
import { workforcePath, workerProfilePath } from './workforce/routes';
import type { WorkforceRole } from './workforce/routes';
import type { FuelLanguage } from './fuel/labels';

const WorkforceJobBoard=lazy(()=>import('./WorkforceJobBoard'));
export default function WorkforceSection({role,language,demo=false}:{role:WorkforceRole;language:FuelLanguage;demo?:boolean}){
  const t=(text:string)=>boardText(text,language),path=workforcePath(role);
  return <section aria-label={t('Workforce')} data-localized data-testid={`workforce-section-${role}`} className="my-6 rounded-2xl border border-[#b6d2ca] bg-[#e6f2ee] p-5 text-[#18303a]">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3"><Users size={24} className="mt-1 shrink-0 text-[#1a7d78]"/><div>
        <p className="text-xs font-bold uppercase tracking-wide text-[#1a7d78]">{t('Workforce')}</p>
        <h2 className="mt-1 text-xl font-bold">{t(role==='owner'?'Post jobs & review crew bids':'Request workers & apply for jobs')}</h2>
        <p className="mt-2 text-sm leading-6 text-[#526169]">{t(role==='owner'?'Have work available? Publish vacancies, review customer crew bids and award the required places.':'Need workers? Set your budget and headcount. You can also submit your managed crew to owner jobs.')}</p>
      </div></div>
      <Link href={path} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1a7d78] px-4 py-3 text-sm font-bold text-white">{t(role==='owner'?'Post available job':'Post worker requirement')}<ArrowRight size={16}/></Link>
    </div>
    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#526169]"><span className="inline-flex items-center gap-1.5"><MapPin size={14}/>{t('Hiring site map')}</span><span>{t('Worker expected wage')}</span><span className="inline-flex items-center gap-1.5"><MessageSquare size={14}/>{t('Counter-offer')}</span></div>
    <nav aria-label={t('Workforce')} className="mt-4 flex flex-wrap gap-x-5 gap-y-3 border-t border-[#b6d2ca] pt-4 text-sm font-bold text-[#1a7d78]">
      <Link href={`${path}#hiring-agreements`} className="underline underline-offset-4">{t('Hiring agreements')}</Link>
      <Link href={`${path}#worker-profiles`} className="underline underline-offset-4">{t('My worker profiles')}</Link>
      <Link href={workerProfilePath} className="inline-flex items-center gap-1.5 underline underline-offset-4"><Plus size={15}/>{t('Create worker profile')}</Link>
    </nav>
    <Suspense fallback={<p role="status">{t('Loading workforce')}</p>}><WorkforceJobBoard compact role={role} language={language} demo={demo}/></Suspense>
  </section>;
}
