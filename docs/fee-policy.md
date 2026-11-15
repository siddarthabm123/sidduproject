# Prototype fee policy

Last clarified: 15 November 2026.

The current real equipment booking request uses a **3.5% customer-side platform fee on the equipment subtotal**. The unit rate is in paise. Each listing's base is rounded first, then its platform fee is rounded; line totals are summed. `upgrades/tools.ts` mirrors the existing PostgreSQL calculation for preview only. The database remains authoritative. Transport, operator, fuel, consumables and applicable tax are not silently added or assumed included.

The proposed **2-3% owner-side fee** in the pitch is a future business-model experiment, not the current quote policy. No owner commission, weekly/monthly discount, GST rate or other charge was introduced by this upgrade. The canvas's older 5% illustration is a sensitivity scenario and must not be presented as the live fee.

Real payment collection is disabled. Before activating it, agree one fee payer/rate/inclusion/tax policy, reconcile the payment service's commission with accepted quotes, preserve versioned commercial terms, and test provider net amounts, reversals and refunds. Do not charge both the proposed owner fee and current customer fee accidentally. A policy change should apply prospectively to newly accepted quotes, never rewrite existing bookings silently.
