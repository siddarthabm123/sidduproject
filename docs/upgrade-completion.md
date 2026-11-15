# RigDesk upgrade: completed work and owner actions

15 November 2026. This release adds practical tools to the existing prototype. It does not create payment, messaging, fuel or financing provider accounts.

Deployed application: `511707c`, [live RigDesk](https://rigdesk-marketplace-rig-logi-x.vercel.app/). Source and this checklist are on [`codex/ui-redesign-warm-stone`](https://github.com/siddarthabm123/sidduproject/tree/codex/ui-redesign-warm-stone). Public setup overview: [launch guide](https://rigdesk-marketplace-rig-logi-x.vercel.app/launch-guide).

## Implemented

| Upgrade | Where / behavior | Data boundary |
| --- | --- | --- |
| Shared supplier directory | Customer and owner menu: **Suppliers & dealers**, `/customer/suppliers` and `/owner/suppliers` | Four real businesses' public contacts and source dates. External businesses, not onboarded/verified RigDesk partners. |
| Google discovery repair | Bearer-authenticated search, on-demand published phone/website/business status, quota enforcement, no-store responses, safe HTTPS links, official attribution, distinct errors | A real signed-in account and server Google Places key are required. Google data is held in page memory, not copied into the permanent owner database or plotted on Leaflet. |
| Supplier onboarding guide | Directory links to owner signup or existing owner fleet form; signup understands `?role=owner` | Real owner profile/equipment use existing Supabase workflows. This is not a claim-business authority verification system. |
| Genuine listing media/specifications | Owner equipment form accepts an HTTPS photo URL and technical specs, with integer fleet units | Uses the owner's actual submitted image instead of the same hard-coded excavator image. Admin equipment review remains required; media ownership/content still needs review. |
| Equipment shortlist | Save/remove/filter on real and demo equipment search | Account-scoped **on this device only**, clearly labelled. Not cloud sync or shared company procurement. |
| Saved equipment comparison | Compare up to four saved listings by owner, category, billing unit/rate, fleet units, rating and review status | Missing demo unit/review counts are not invented. Availability and prices must be reconfirmed before booking. |
| Accurate booking review | Equipment line subtotals, 3.5% fee and total, using base-then-fee paise rounding | Preview mirrors the existing PostgreSQL policy; the database is authoritative. No new taxes, operator fees or changed commission. |
| Saved requested work scope | Work category, attachment/material, depth/payload/shift, site access, operator/fuel responsibility and request acknowledgement | Included in existing booking instructions, visible to the booking parties after applicable access checks. Customer-requested scope is not a mutually accepted variation or contract. |
| Repeat discovery | Completed/cancelled real jobs offer **Find this equipment again** | Reopens search; no automatic new charge or reuse of stale capacity. |
| Owner operations | `/owner/operations`: upcoming jobs, recorded work/payment/unsettled totals and CSV export; demo adapter uses fictional booking records | Real values derive from current Supabase booking rows. Cancelled work is excluded from headline totals. Recorded paid amounts are not independent proof of bank settlement. |
| Cost planner | Owner operations: monthly income versus fuel/wages/transport/maintenance | A calculator only; inputs are not saved expenses, tax calculations or certified profitability. |
| Public readiness/privacy/terms | `/launch-guide`, `/privacy`, `/terms` | Explains current behavior and setup limits; commercial/privacy review and real support arrangements remain launch work. |
| Localisation/themes | New controls support English/Hindi/Kannada and existing light/dark theme | Business names, published contacts and user-authored information remain unchanged. |
| Fee documentation | [Current policy](fee-policy.md) | Current 3.5% customer estimate is separated from the proposed 2-3% owner model and older 5% sensitivity example. |

## Public contact sources

Basic business facts were read from the businesses' own published pages on 15 November 2026, with a source link shown in the UI:

- [Eshan Borewells](https://www.eshanborewells.com/): Bengaluru borewell work; published phone +91 98447 75905.
- [Vinayaka Earth Movers](https://vinayakaearthmovers.in/contact): Begur/Bengaluru earthmoving and JCB services; published phone +91 99001 51334.
- [Sanghvi Movers](https://sanghvicranes.com/): crane services; published India enquiry phone +91 20 66744700. Confirm coverage for a particular site.
- [VRL Logistics](https://vrlgroup.in/ContactUs): logistics customer enquiry phone 1800 599 7800. Confirm route/service; this is not a listed RigDesk tipper inventory.

No ratings, fleet counts, availability, pricing, partner discounts or RigDesk review badges were invented for these businesses. No business was called, messaged, registered or charged. No Justdial collection was scraped or imported.

Google implementation references: [Place Details](https://developers.google.com/maps/documentation/places/web-service/place-details), [content/attribution policy](https://developers.google.com/maps/documentation/places/web-service/policies). The unmodified `public/assets/google-maps-attribution.png` is from Google's linked official attribution asset archive. [Justdial terms](https://www.justdial.com/Terms-of-Use) do not permit the proposed unlicensed directory scraping approach.

## Verified environment limits

- The existing Vercel production configuration has Supabase browser settings and bond settings, but **no Google Places API key**. Published-source contacts work independently; live Google search remains unconfigured until the key is added.
- Supabase CLI reports no access token. No database write, reset, seed or migration was performed by this release. The previously prepared workforce job-board SQL remains pending.
- Existing payment APIs remain disabled. No payment, email/SMS or recorded-calling provider account was created by this work; delivery and provider round trips remain unverified.
- Automated isolated PostgreSQL tests do not substitute for a real separate-account staging transaction or concurrent production database tests.

## Your next actions, in order

1. **Finish the missing database update.** Open the existing [Supabase SQL editor](https://supabase.com/dashboard/project/aejaswaorfmlzagucnvm/sql/new). Run [the read-only preflight](../supabase/upgrade-preflight.sql). If the workforce board objects are absent and the recorded prerequisites are present, review and apply [the existing additive workforce update](../supabase/migrations/20261115001900_workforce_job_board.sql) once. Do not reset the project or import demo seeds. Alternatively sign in locally with `supabase login`; never paste tokens or passwords into chat. Follow [the workforce guide](workforce-job-board.md).
2. **Enable nearby Google lookup if wanted.** Create/use a Google Cloud project, enable Places API (New), configure billing, quota/budget alerts and API-key restrictions. Add `GOOGLE_PLACES_API_KEY` as a server-only Production variable in the existing RigDesk Vercel project, then redeploy. Do not prefix this key with `VITE_`. Google search/details incur provider usage; the four published contacts do not require this key.
3. **Recruit real supply.** Speak to willing local owners, collect their own accurate business/equipment information and consent, and ask them to register. Review machinery, actual photos, registration/capacity and availability. Published contact information is not onboarding consent or evidence of ownership.
4. **Choose the commercial policy.** Decide whether future charging remains the current 3.5% customer estimate or changes to a 2-3% owner fee. Agree inclusions, taxes, scope changes, cancellation/refund terms and responsibility for failed jobs. Have the policy reflected consistently in provider commission, accepted quotations and documents before real charging.
5. **Activate genuine payments through an approved provider.** Complete business/vendor onboarding, configure server-only credentials/webhooks, verified funding and payout operations. Test failures, refunds, chargebacks, disputes and reconciliation in staging. The project must not hold customer funds in an improvised operating-account escrow. See [payments](payments.md).
6. **Contract one fuel partner.** Agree the real discount/funding/settlement arrangement, onboard pump staff and supervise issue → redeem actual litres → receipt/reconciliation. Demo bills do not establish a discount at any named brand or station.
7. **Configure communications and support.** Set up a real sending identity/SMTP and recovery delivery; add approved SMS/WhatsApp only when needed. Publish a support channel and assign a person to disputes. Recorded calls additionally require a telephony provider, consent and recording access/retention arrangements.
8. **Run a small supervised pilot.** Use separate customer/owner accounts; submit a real machine, review it, request dated capacity, accept work, save scope/work entries, approve completion and verify the bond. Test an expired/declined request and unrelated-account access. Then try a small set of actual local jobs and record time-to-confirm, successful fulfilment, repeat use and support cost.

## Remaining product development

| Work | Why it remains |
| --- | --- |
| Cloud-synced shortlists and company procurement | Needs a dedicated account-scoped schema/RLS update; current saved list is device-only. |
| Itemised mutually accepted commercial quotations and amendments | Current work scope is a customer request; it does not create owner-approved extra charges. |
| Worker-owned login, delegated consent, attendance and payroll statements | Existing hiring is managed-profile based; workforce board database update is still pending. |
| Photo/video inspections and signatures | Needs a private evidence bucket, review/retention process and a bilateral evidence workflow. |
| Maintenance/expiry reminders and stored cost ledger | Current operations screen is derived reporting plus a calculator, not a maintenance system or accounting ledger. |
| Breakdown replacements and emergency dispatch | Requires replacement inventory, approved contract changes and staffed operational support. |
| GPS/OEM telemetry, automated dispatch and prediction | Stored/map pins are not live telematics. Requires actual feeds/devices and reliable operating data. |
| Multi-site purchase approvals and consolidated invoices | Needs enterprise membership/permissions and an agreed invoice/tax workflow. |
| Factoring, insurance, used equipment/spares | Provider/commercial/regulatory setup and demand validation are separate from the current booking pilot. |
| Mobile/offline drafts and native apps | The responsive website remains the application; no false offline booking confirmation is provided. |

## Validation

All **96 tests**, TypeScript checking and the production build passed for the upgrade. The test command limits file concurrency to two because each PostgreSQL suite runs an isolated in-memory database; this avoids avoidable memory pressure on development/CI hosts without dropping coverage.

Release checks are recorded in [deployment history](deployment.md). New regression checks cover quote rounding, scope limits, protected Google details/no caching, published-source integrity, shortlist bounds, cancellation totals, and CSV formula safety. Server rendering checks cover supplier screens, readiness/privacy/terms and quote breakdown in English/Hindi/Kannada. The browser runtime could not initialize in this environment, so desktop/mobile visual interaction, native print dialogs and a complete live two-account transaction remain manual checks.
