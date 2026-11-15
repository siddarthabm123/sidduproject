# RigDesk Frontend Feature Audit and Pitch Boundaries

## Scope

Reviewed the root application's public entry points and role routing in `App.tsx`, the real-account path in `RealWorkspace.tsx`, equipment/site maps, account preferences and authentication, admin review, notifications, work records, worker registration/hiring, fuel maps/vouchers, document generation/verification and the API boundaries behind matching and payments. Generic UI primitives such as dialogs, tables and charts are components, not evidence of an independently working business feature. Archived `RigLogix-source-code/` and `RigLogix-runnable/` copies are not the active frontend. This is code inspection, not a fresh production transaction or verification of partner contracts.

The new public route is `/pitch-highlights`, with `#problem`, `#pillars` and `#bond` deep links. It is an English evaluator presentation, independent of account login and saved language/theme preferences. It does not mutate sessions, payments, pricing or existing bookings.

## Feature Inventory

| Area and pages | Features found | Implementation and limits |
| --- | --- | --- |
| Public landing, `/demo`, `/sign-in` | Shared customer/owner problem story, role demo selector, signup/login, language and theme | Built. Demo identities and activity are fictional/local. SMTP/SMS verification depends on configuration, not a fake success animation. |
| Account/preferences/recovery | Password login/recovery, profile/business/yard/payment-reference fields, cloud language/theme restore, entry-screen override | Built UI and Supabase calls. Payment-reference fields are not payment onboarding. Aadhaar format/reference collection is not identity verification. |
| Customer discovery and radar | Sector/category/search filters, explanatory machine specifications, equipment imagery, ratings, reviews and radius filtering | Built. Real account maps show stored coordinates, not live vehicle telemetry. Seed ratings/owner counts are demo evidence only. |
| Real equipment search | Date range, server remaining capacity, verification/readiness filtering, select quantities per listing | `RealWorkspace.tsx` uses `marketplace_availability` and `request_equipment_booking`. Final DB checks can reject stale availability. |
| Mixed / multi-owner bookings | Separate owner/unit allocation, exact total allocation, different billable quantities for each listing | Demo `OwnerAllocationPicker` and real batch booking are standout workflows. Each assigned owner receives separate booking responsibility, not one magically guaranteed dispatch. |
| Borewell quote | Drilling depth, casing depth/material, per-foot rate and mobilisation/fuel examples | `BorewellModal` and stable booking UI. Detailed quote figures are prototype assumptions. Real-account mixed bookings use displayed billing quantities, not every demo quote add-on. |
| Logistics quote | Pickup/delivery pins, estimated route kilometres, material/stone-size selection, per-km billing | Demo quote UX. Route-distance estimates do not establish road routing, delivery proof or freight compliance. |
| Shift/site capture | Date, shift/time, exact site address, pin and customer access/unloading instructions | Built capture. Stored pins do not prove physical arrival. |
| Water-point survey | Flat-fee survey request, land use and proposed drilling depth | Demo workflow in `App.tsx`. No staffed geological survey network established by source code. |
| Reverse auctions | Bulk project requirements, budget ceilings, competing owner bids, bid selection and booking conversion | Built demo and real-account RPC workflow. Demo requires a lower bid; the shared validation/real rules also enforce positive amounts and ceilings. No assurance all real bids undercut the current minimum. |
| Auction decision controls | Lowest price, highest rating, most reviews and fastest arrival sorting | Built. Demo includes completion-rate tie-breaks and seed bulk jobs. Speed is an ETA, not a guaranteed completion date. |
| Owner fleet | Equipment title, registration, category, capacity, rate/billing unit, units, yard coordinates and readiness | Demo includes edits/status/fuel/hour fields. Real frontend lists/creates equipment and routes it to review; do not imply demo edits or telemetry are live fleet integrations. |
| Owner operations | Incoming requests, owner acceptance/decline, milestones and customer completion sign-off | Built. Demo incoming cards include seeded offers and simulated earnings. |
| Work records | Daily hours, optional paired meter readings, notes, customer approve/reject with reason | `JobSheet.tsx`, private RPC-backed records for real accounts and local demo examples. Review does not itself pay the owner or prove condition. |
| Issues and reviews | Report job issues, completion restrictions, reviews/ratings after completed bookings | Real workflow plus admin review. Operations/staff still need to resolve real disputes. |
| Booking PDF and verifier | One-page document, prominent QR, HMAC-signed compressed data, database-issued live amounts, public status check | `bond-pdf.ts`, `bond-signature.ts`, `VerifyBondPage`. Public token strips private contacts/IP. Demo documents must remain marked demo. A valid QR cannot authenticate arbitrary content pasted around it or guarantee legal enforceability. |
| Wallet/reserve/cancellation | Displayed reserve = max(INR 2,500, 10% of demo total). Penalty = max(INR 1,500, 5%). Accepted-job lock/penalty illustrations | `App.tsx` helpers and `WalletPanel`. Current demo booking submit does not require an actual funded balance. Real booking UI does not invoke funded escrow lock. No zero-cancellation guarantee. |
| Payment/escrow layer | Card/balance lock, inspection sign-off, dispute freezing, commission/payout scheduling, webhook/refund processing | Backend service/test layer behind `PAYMENTS_ENABLED`, not an active frontend checkout. Requires provider accounts, direct DB transactional setup and validation. A 48-hour scheduling target is not bank-receipt proof. |
| Invoice factoring | Deferred invoice/factoring request service | Backend-only and lender-dependent. No working frontend loan marketplace or approved funding. |
| Workforce discovery | Search skills/name, role, daily/monthly wage, verification status, distance; availability and managed-worker controls | `WorkforcePage.tsx` in both dashboards. Equipment owners and customers can hire. |
| Worker registration | Three-step personal/experience/document form, license class, consent, private document uploads, unverified until review | `WorkerProfilePage.tsx`. Worker or authorised manager can register via an account. Separate worker sign-in and worker-initiated job applications are not implemented. |
| Wage negotiation | Fixed expected wage alongside original/current offer, accept/decline/counter, offer history, stale-version protection | `WorkerHireCard.tsx`, `workforce/negotiation.ts`. Worker-side response is through profile manager. No payroll or guaranteed employment. |
| Hiring site and estimate | GPS/manual site pin, map link, machine pairing, inclusive calendar-day subtotal | `WorkerSiteMap.tsx`, `HiringEstimate.tsx`. Monthly proration intentionally not invented. |
| Fuel discovery | Interactive pins/list, yard or project centre, GPS, fuel-type/radius/partner filters, per-litre rate | `FuelHubPage.tsx`, `FuelBunkMap.tsx`, `fuel/domain.ts`. Approved/staffed stations must be onboarded. Samples are fictional. |
| Fuel entitlement | Unique voucher/code/QR, quantity-derived savings, expiry, print sheet, equipment association | Built UI and APIs. Expired/generated/redeemed states and redemption permission boundaries exist. Real discounts require commercial agreements, not merely a Google listing. |
| Station registration / redemption | Admin-permitted map registration, configurable fuel/discount, assigned pump staff verify/redeem actual litres | `FuelVoucherPage.tsx`, admin controls and APIs. Does not itself purchase fuel. |
| Recommendations | Top-three local rank by distance/rating/verification, optional Gemini reasons | `api/recommend-vehicles.ts` and `RadarPageLive`. Gemini only when configured. Not supply prediction, price optimisation or real-time availability intelligence. |
| External discovery | Optional Google Places business names/address/rating/Maps links | `ExternalProviderPanel`, `api/discover-providers.ts`. Discovered businesses are not automatically verified platform owners or bookable inventory. |
| Dashboard metrics / telemetry | Active job counts, auction activity, fleet fuel/hour gauges, savings and earnings displays | Some real totals use account data. Seed utilisation/revenue/fuel/telematics and fixed broker comparison examples are not measured operating analytics. No predictive analytics engine found. |
| Admin and privacy | Review equipment and worker documents, scoped signed URLs, dispute review and fuel permissions | `AdminWorkspace.tsx`. Staff review, not automated Aadhaar/license identity assurance. |
| Notifications | Recipient-owned inbox, unread/read state, actionable offer/job messages, record navigation | `NotificationInbox.tsx`, `notifications.ts`. Polling, not push/SMTP/SMS delivery. |
| Reliability | Save/retry idempotency, preserve save success during refresh failure, offline warning, guarded auth failures | `marketplace-domain.ts`, `ConnectionStatus.tsx`, `RealWorkspace.tsx`. Offline notices are not offline bookings or a PWA queue. |

## Hidden Gems Worth Explaining

**Release update, 15 November 2026:** The new role-specific workforce job board adds customer headcount/salary requirements, owner job vacancies, managed crew applications, document-review eligibility and atomic crew awards into existing hiring records. Frontend/API source and demo examples are deployed; the new SQL update is not installed in the live Supabase project, so the real-account board remains unavailable. Independent worker sign-in remains planned. See [job board details](workforce-job-board.md).

1. **The same job can need several owners.** Unit allocation and listing-specific quantities handle a genuine equipment-procurement complication.
2. **Customers need not select the cheapest bid.** Rating, reviews and ETA sorting support a reasoned award, though demo reputation is not field validation.
3. **A worker's expectation survives negotiation.** Separate wage snapshots and versioned counters make offer changes understandable.
4. **Work records invite disagreement explicitly.** Reject-with-reason is more credible than automatic approval or a decorative completed badge.
5. **A printed record can point back to issued data without exposing private contacts.** The verifier checks signed values and current status; this is record integrity, not a legal authenticity guarantee.
6. **Vouchers have a real redemption boundary.** Assigned staff and expiry/single-use semantics distinguish a discount entitlement from a decorative QR.
7. **Retrying a multi-item request need not duplicate it.** Request fingerprints, request IDs and atomic server validation support operational reliability.
8. **Real accounts and fictional demos have different data paths.** Fresh real accounts do not inherit pitch transactions, owners or measured savings.

## Economics and Claim Corrections

- **80% agent involvement:** supplied founder field observation, not a surveyed national statistic. Display its attribution whenever it appears.
- **2-3% owner take rate:** new business proposal. On INR 100,000 of agreed work, platform gross revenue is INR 2,000-3,000 and owner net INR 98,000-97,000 before other agreed charges/taxes. Gross revenue is not profit.
- **Current estimate:** demo and real booking estimates use a separate 3.5% customer fee. This task does not change it or stack another fee on existing customers.
- **Other inconsistent historic proposals:** earlier canvas/pitch experiments suggest 5%, and escrow service uses a configurable example commission. Reconcile and disclose one policy before real charging.
- **Cancellation commitment:** a reserve can reduce an agreed loss but cannot prevent cancellation, equipment failure or disputes. A displayed wallet hold is not a captured payment.
- **Fuel retention:** a negotiated discount could encourage repeat use, but eligibility, funding and station settlement need signed agreements. No guarantee an owner will accept platform fees.
- **Earlier projected savings:** fixed broker-price multipliers in prototype estimates are examples, not evidence of actual customer savings.

## New Pitch Bond Preview

`/pitch-highlights#bond` is a deliberately unfunded example for one JCB, 40 planned hours at INR 2,500/hour. Work value INR 100,000. The proposed reserve INR 10,000 is a portion of that value, not an extra charge or a funded ledger entry. Actually paid and funded escrow are both zero. The proposed INR 5,000 cancellation amount remains subject to agreed terms and dispute review. The QR opens the sample page, not `/verify/`, and signs no data. The downloadable sample adds neither personal data nor actual signatures. The existing live signed booking PDF is separate and unchanged.

## 150-Word Executive Summary

The exact summary is exported as `executiveSummary` in `pitch-model.ts`. Print it with:

```powershell
node --import tsx --input-type=module -e "import {executiveSummary} from './pitch-model.ts'; console.log(executiveSummary);"
```

## Verification — 14 November 2026

- TypeScript checking, all 80 automated tests and the Vite production build passed.
- React server rendering confirmed all three slide panels and claim disclosures render. The local public route returned HTTP 200 without signing in.
- Browser tools failed during initialization, so screenshot layout, mobile viewports, print pagination and the sample PDF download interaction have not received a visual or click-through pass.
- This route was subsequently deployed on 15 November 2026 in application commit `ec600cc`. The public production route returns 200. The release passed 89 automated tests, TypeScript checking and the production build; no real payment/partner activation or browser visual verification is claimed.
