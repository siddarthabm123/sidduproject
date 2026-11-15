import React from 'react';
import { BadgeCheck, Printer, Receipt, TrendingDown } from 'lucide-react';
import { fuelBillTotals } from './demo';
import type { DemoFuelBill } from './demo';
import { rupees } from './domain';
import { fuelText } from './labels';
import type { FuelLanguage } from './labels';

export function FuelBillDetails({bill,language}:{bill:DemoFuelBill;language:FuelLanguage}){
  const t=(text:string)=>fuelText(text,language),total=fuelBillTotals(bill);
  return <>
    <p className="fuel-demo-stamp">{t('Sample receipt only. No payment was made. Not a tax invoice.')}</p>
    <code>{bill.id}</code><h3>{bill.bunk_name}</h3><p>{bill.bunk_address}</p>
    <p>{new Date(bill.billed_at).toLocaleDateString(language==='kn'?'kn-IN':language==='hi'?'hi-IN':'en-IN')} · {t(bill.equipment)}</p>
    <p>{t('Voucher code')}: <code>{bill.voucher_code}</code></p>
    <dl className="fuel-bill-lines">
      <div><dt>{t(bill.fuel_type==='DIESEL'?'Diesel':'Petrol')}</dt><dd>{bill.quantity_litres} L × {rupees(bill.price_per_litre)}/L</dd></div>
      <div><dt>{t('Cost before discount')}</dt><dd>{rupees(total.original)}</dd></div>
      <div className="fuel-bill-saving"><dt>{t('RigDesk partner discount')} ({rupees(bill.discount_rate)}/L)</dt><dd>−{rupees(total.discount)}</dd></div>
      <div className="fuel-bill-paid"><dt>{t('Amount paid (example)')}</dt><dd>{rupees(total.paid)}</dd></div>
    </dl>
  </>;
}

export default function DemoFuelBills({bills,language,onPrint}:{bills:DemoFuelBill[];language:FuelLanguage;onPrint:(bill:DemoFuelBill)=>void}){
  const t=(text:string)=>fuelText(text,language);
  const totals=bills.reduce((sum,bill)=>{const value=fuelBillTotals(bill);return {original:sum.original+value.original,discount:sum.discount+value.discount,paid:sum.paid+value.paid,litres:sum.litres+bill.quantity_litres}},{original:0,discount:0,paid:0,litres:0});
  return <section className="fuel-bills" aria-labelledby="fuel-bills-title">
    <div className="fuel-section-head"><h2 id="fuel-bills-title"><Receipt size={20}/>{t('Fuel bills & savings examples')}</h2><span className="fuel-discount">{bills.length} {t('Sample completed purchases')}</span></div>
    <p className="fuel-bill-intro">{t('See how a partner voucher reduces the fuel bill. Prices, purchases and savings below are fictional demo examples.')}</p>
    <div className="fuel-savings-summary">
      <div><span>{t('Fuel purchased (example)')}</span><strong>{totals.litres.toLocaleString('en-IN')} L</strong></div>
      <div><span>{t('Cost before discount')}</span><strong>{rupees(totals.original)}</strong></div>
      <div className="fuel-summary-benefit"><span><TrendingDown size={16}/>{t('Saved through RigDesk (example)')}</span><strong>{rupees(totals.discount)}</strong></div>
      <div><span>{t('Amount paid (example)')}</span><strong>{rupees(totals.paid)}</strong></div>
    </div>
    <div className="fuel-bill-grid">{bills.map(bill=><article className="fuel-bill" key={bill.id}>
      <div className="fuel-voucher-heading"><Receipt size={19}/><strong>{t('Fuel purchase example')}</strong><span className="fuel-discount"><BadgeCheck size={13}/>{t('Redeemed (demo)')}</span></div>
      <FuelBillDetails bill={bill} language={language}/>
      <button className="fuel-button secondary" onClick={()=>onPrint(bill)}><Printer size={16}/>{t('Print sample bill')}</button>
    </article>)}</div>
    <p className="fuel-bill-intro">{t('Active vouchers show potential savings. These sample completed purchases show the discount after redemption; they do not count unused vouchers as savings.')}</p>
  </section>;
}
