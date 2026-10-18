import { useUiText } from './localization';
import { rupees } from './fuel/domain';
import { hiringEstimate } from './workforce/dates';
export default function HiringEstimate({start,end,rate,wageType}:{start:string;end:string;rate:number;wageType:string}){
 const t=useUiText(),estimate=hiringEstimate(start,end,rate,wageType);
 return <aside className="hiring-estimate">{estimate&&<><span>{t('Estimated wage subtotal')}</span><strong>{rupees(estimate.total)} <small>({estimate.days} {t(estimate.days===1?'calendar day':'calendar days')})</small></strong></>}{wageType==='MONTHLY_SALARY'&&<p>{t('Monthly salary: total depends on agreed payroll dates and proration.')}</p>}<p>{t('Agree working hours, overtime, travel, accommodation and cancellation terms before accepting. No wage payment is collected here.')}</p></aside>;
}
