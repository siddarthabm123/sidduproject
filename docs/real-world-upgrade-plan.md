# RigDesk: Real-world upgrade plan

Reviewed 15 November 2026. This is a product/code review and proposed roadmap, not a fresh authenticated production acceptance test. Competitor descriptions below are their public product claims, not independently tested service guarantees.

## Recommendation

Build a dependable local equipment transaction network: confirmed supply, comparable scope, accountable work records and clear settlement. Start with one service cluster and JCB/excavators, borewell rigs and tippers. Do not expand into every marketplace category before completing real jobs reliably.

## Current foundation and immediate gaps

Already implemented in source: customer/owner accounts; equipment search and capacity reservations; auctions and bid selection; multiple-owner unit allocation; site pins; job milestones and daily work approval; reviews; QR-backed booking records; private workforce profiles, hiring and wage negotiation; fuel maps/vouchers; admin review; account-scoped notifications; English/Hindi/Kannada and themes. Demo vouchers/bills illustrate benefits but are not real transactions.

| Gap | Evidence | Priority / next step |
| --- | --- | --- |
| Dealer discovery is incomplete | `api/discover-providers.ts` requests names, addresses, ratings and Google links, but no phone, website, hours or business status. `ExternalProviderPanel` in `App.tsx` sends no bearer token while the configured endpoint requires an authenticated account. | P0: share an authenticated client, use honest error states, and add on-demand Place Details. Demo sessions need a separate explicit sample mode, not a fake authenticated token. |
| Discovery is not a supplier onboarding funnel | External provider panels are in demo equipment flows; `RealWorkspace.tsx` does not expose an equivalent supplier workflow. No dealer claim/consent/verified-inventory process. | P0: expose discovery in real customer search and owner partnerships; add claim, review and inventory publication. |
| Latest crew job board needs live SQL | `docs/workforce-job-board.md` records the unapplied additive update. | P0: inspect the existing database, apply only the missing update, then prove customer/owner applications and awards using two separate accounts in staging. |
| Financial UI does not collect real funds | Payment service is disabled; demo wallet/reserve and bills are illustrations. | P0 before paid pilot: provider onboarding, honest lock state, reconciliation, refunds and disputes. Never label a requested deposit as funded. |
| Fee policy differs between materials | Pitch proposes a 2-3% owner fee, current UI keeps a 3.5% calculation, and the canvas describes a 5% experiment. | P0: agree one fee owner/rate/tax policy, version accepted quotes, reconcile UI, invoice and backend before charging. |
| Real job execution remains incomplete | Daily work logs exist, but photo inspections, signatures, change orders, repair/replacement operations and document-expiry management remain backlog items. | P1: scope/quote acceptance, handover evidence, approved variations and support escalation. |
| Fuel benefit needs commercial operations | Discounts and receipt examples do not establish pump agreements. | P1: one signed pilot pump agreement, approved attendant login, single-use redemption and actual-quantity receipts. |

The code review does not establish whether every external API credential is currently configured. Browser visual verification was unavailable because the browser runtime failed to initialize.

## Competitor lessons

| Public reference | Capabilities advertised | Useful RigDesk upgrade |
| --- | --- | --- |
| [Equipment Rentals India](https://www.equipmentrentalsindia.com/public/) and [equipment listings](https://www.equipmentrentalsindia.com/browse-equipment) | Rental/sale/finance/spares discovery and watchlists | Rich specification sheets, save/compare, repeat requirements and a supplier/dealer onboarding funnel. Used sales/spares can wait. |
| [MYCRANE India](https://in.my-crane.com/) and [FAQ](https://in.my-crane.com/faq/) | Technical enquiry capture, proposal comparison, equipment documents and itemised commercial offers | Category-specific work requests and comparable total cost, with transport/operator/exclusions. Equipment suitability needs owner/qualified-person confirmation. |
| [EQUIP9 workforce](https://www.equip9.com/dir/workforce/) | Operator/mechanic/owner network | Workforce is not unique by itself: add worker-controlled consent, attendance, wage evidence and reliable assignment. |
| [United Rentals Total Control](https://www.unitedrentals.com/project-uptime/equipment/streamline-procurement-and-invoicing-total-control) | Role-specific procurement, purchase orders and invoices across locations | Later enterprise accounts: site budgets, approvals and consolidated documents. |
| [Trackunit](https://trackunit.com/rental/) | Connected fleet visibility, utilisation and maintenance tools | Begin with manual meter/service logs; add real telematics only with devices or authorised OEM feeds. |

Do not pitch listings, maps, a workforce directory, quotes or AI as individually exclusive. A defensible advantage must be demonstrated through local supply density, response speed, fulfilment reliability and repeat customers.

## Real dealer discovery and onboarding

### Google Places: extend the existing integration

1. Search with equipment category, location and supported user-selected geography. The current 15 km `locationBias` prefers a region; do not describe it as a strict service-area guarantee.
2. Show an external-directory card: business name, published source rating/count, address, Google link, and source attribution. Display **External listing — availability not confirmed**.
3. Fetch phone, website, operating/business status and hours on demand through Place Details, requesting only needed fields. Field selection affects billing; add quotas, budgets and honest provider failure messages. Never infer WhatsApp support from the presence of a phone number.
4. Fix frontend bearer authentication and expose the flow to real accounts. Distinguish missing setup, expired session, quota exhaustion, zero results and upstream failure.
5. Keep Google data display separate from the existing Leaflet/OpenStreetMap pins. Google policy requires Google Maps for Places results drawn on a map; a correctly attributed list without a map is another option. Review caching headers against allowed storage rules; do not build a permanent copied directory. Store exempt place IDs and fetch permitted fresh details as needed.
6. Use a consent-based **Join / claim a RigDesk business** funnel. The business supplies its own contact, service radius, machinery photos, fleet quantity, rates, documents and payout details. Verify business authority and duplicates; a phone check alone does not prove equipment ownership.
7. Publish RigDesk inventory only after onboarding/review. Use distinct states: external business, claimed business, reviewed owner, available machine, confirmed booking. Keep Google ratings separate from completed-job RigDesk reviews.
8. A customer can submit a draft requirement associated with an external provider. It becomes a binding booking only after the onboarded owner confirms machine, dates, scope and price. No deposit against unconfirmed external stock.

[Place Details documentation](https://developers.google.com/maps/documentation/places/web-service/place-details) supports contact/website fields. [Google Places policies](https://developers.google.com/maps/documentation/places/web-service/policies) govern attribution, maps and caching. Google data does not prove live stock, capacity, rates, ownership or a RigDesk partnership.

### Justdial and other sources

[Justdial's terms](https://www.justdial.com/Terms-of-Use) prohibit scraping, automated queries and compiling competing listing collections. Do not create a Justdial scraper or assume its public pages provide a reusable commercial API. Explore a written licensing/partnership arrangement; until then, recruit through owner-submitted profiles, referrals, local workshops, associations and dealer-authorised imports. Apply the same source-permission checks to other directories.

Directory discovery and direct business onboarding are different data flows. Bulk outbound messages need an approved communication process; no outreach or contact import was performed by this review.

## Dashboard additions by participant

| Participant | Add next | Practical outcome |
| --- | --- | --- |
| Customer / contractor | Work-requirement wizard; complete quote comparison; genuine capacity calendar and offer expiry; save/rebook; site approvals; work evidence; cancellation/refund visibility | A comparable, confirmed job instead of a cheap headline rate with surprises. |
| Equipment owner | Per-machine calendar; quote builder; incoming job inbox with response deadline; service/document expiry; fuel/operator/transport expenses; receivables and net contribution | Better utilisation and clear economics, including after a customer is already known. |
| Worker | Independent access; consent to manager representation; document status; accept/decline/counter; attendance and wage statements; report unsafe work | Workers can control assignments and understand pay. Keep identity documents private and employer views minimal. |
| Dealer / service business | Claim business; reviewed inventory; rental/sales/service classification; lead inbox; referral attribution; authorised CSV import | A real supply-acquisition channel. Avoid a separate full dashboard until the onboarding workflow works. |
| Fuel attendant / partner | Authorised redemption; actual litres; single-use confirmation; receipt; daily discount/reimbursement report | A benefit that a real pump can operate and reconcile. |
| Admin / support | Supplier pipeline; evidence reviews; dispute queue; duplicate/fraud flags; expired-document alerts; payment reconciliation; support ownership and audit trail | Human accountability when a job does not go to plan. |

## High-impact execution improvements

1. **Comparable total price.** Quote machine, unit/duration, included operator/fuel, mobilisation/demobilisation, waiting/overtime, consumables, applicable tax and exclusions separately. Require customer approval of scope/price changes. Do not invent tax rates.
2. **Category-specific jobs.** Borewell: agreed depth assumptions, casing, diameter, ground assumptions and extra-depth approval. JCB: attachment, shift hours, site access, overtime and spoil movement. Logistics: payload/material, pickup/drop, trips, loading responsibilities and delivery evidence. Borewell contracts must not promise water yield merely because drilling is complete.
3. **Fair bidding.** Match bids to the same scope, show delivered total and quote validity, attach capacity and dates, distinguish arrival ETA from completion time, and rank on verified reliability as well as price. Add anti-spam and revision history.
4. **Booking and cancellation clarity.** Mutually accepted terms, funded-deposit proof only when payment is confirmed, customer/owner cancellation rules, fair refunds and escalation. A deposit reduces risk; it cannot guarantee zero cancellations.
5. **Evidence and change control.** Handover/return photos, timestamped meter readings, checklists, accepted daily logs and versioned change orders. Link the current booking record to the QR document; describe exactly what the verifier checks.
6. **Failure recovery.** Breakdown reporting, named coordinator, replacement approval with capacity recheck, revised price/ETA and customer consent. Do not promise replacement times until supply and staffing can meet them.
7. **Meaningful owner retention.** Repeat bookings, calendar, receivables, useful work history, verified jobs and genuine partner savings. Add reminders before expensive hardware/AI. Owners need a reason to stay beyond hidden contact details.
8. **Communication and mobile use.** Configure a real transactional email provider; then approved opt-in messaging. Offer low-bandwidth screens, voice notes/transcription with consent, and offline drafts with explicit sync. Never treat an offline draft as confirmed.

## Delivery sequence and acceptance gates

These are planning ranges, dependent on engineering capacity and provider/partner approval; they are not delivery commitments.

| Stage | Scope | Acceptance gate |
| --- | --- | --- |
| 0: first 1-2 weeks | Fix discovery auth/states; agree fee policy; install missing job-board SQL after preflight; create onboarding pipeline; set up recovery/delivery and support ownership | Separate real test accounts exchange a requirement/application; unrelated accounts cannot read documents, applications or bookings; no fabricated success/funded state. |
| 1: weeks 3-4 | Owner onboarding and genuine inventory; category-specific requirement/quote; capacity confirmation; expiry and cancellation terms; save/rebook | At least 10 reviewed local owners and 20 owner-confirmed machines as recruitment targets; complete five supervised jobs with documented scope and completion. No real-money flow until provider gates pass. |
| 2: weeks 5-8 | Authorised payment onboarding/reconciliation; work evidence/variations; staffed disputes; worker-controlled assignment; one contracted fuel partner | Demonstrate payment success/failure/refund/dispute tests in staging; complete a real attendant redemption pilot only after agreements; prove commission and payout amounts reconcile. |
| 3: weeks 9-12 | Owner cost/receivables reports; service reminders; repeat booking; multi-site approvals; review pilot outcomes | Track fill rate, late/no-show rate, quote variance, time to resolve disputes, repeat use and net contribution before expanding. |
| Later | Telematics, insurance/financing referrals, used equipment/spares and advanced AI | Add only after repeat demand, authorised integrations and operating capacity justify them. |

## Pilot economics and measurements

Test the proposed 2-3% owner fee on actual willingness to pay. At INR 100,000 completed work value, gross platform revenue is INR 2,000-3,000 before processing, support, acquisition, refunds and tax. It is not profit. Fuel savings are an owner benefit, not automatically platform revenue; a 1,000 L purchase at INR 1/L saves INR 1,000 and does not on its own justify a higher commission.

Agree one consistent rate/payer policy before charging. Track contribution per completed job, acquisition source/cost, response time, successful fulfilment, actual same-scope savings, repeat booking, dispute rate and sign-off-to-payout time. Set improvement targets after measuring the first supervised jobs; do not advertise arbitrary guarantees or present the founder's 80% broker estimate as a measured national statistic.

The initial operating experiment should recruit 10-20 local owners, 5-10 repeat contractor prospects and one willing fuel partner. These are targets, not existing traction. One coordinator can assist the first jobs while the platform records evidence. Expand after the workflow works reliably in the first cluster.

## First implementation batch

1. Authenticated Google discovery + on-demand published contact details + proper attribution/error states.
2. Business claim/consent + reviewed owner inventory and date/capacity confirmation.
3. Complete category-specific RFQ/quote comparison + fee consistency + accepted terms.
4. Missing workforce database update + separate-account acceptance tests.
5. Work evidence/change orders + staffed support, followed by provider-gated payments and genuine pump redemption.

This document is the original planning snapshot. Some items have subsequently been implemented: see [the completed-work report and activation checklist](upgrade-completion.md) for current scope and remaining work. Production records, payment providers and the existing quote fee were not changed by these upgrades.
