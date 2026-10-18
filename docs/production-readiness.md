# RigDesk Upgrade Scope and Launch Gates

This release improves a working prototype. It does not certify the platform for handling real funds, regulated lending or recorded calls. Sample names and activity are fictional and must never be promoted into verified production partners or financial records.

## Implemented in This Release

- Distinguish invalid authentication, provider throttling and infrastructure failure; preserve real sessions during transient auth outages.
- Return truthful discovery/recommendation error statuses while retaining a useful ranking fallback. Shared PostgreSQL quotas cap Places at 10 and recommendations at 20 requests per signed-in account per minute. These are not an IP/WAF or anti-Sybil system.
- Reject prototype-inherited route keys in workforce/fuel dispatchers.
- React context/dictionary localization, including labels, errors and translated native options with stable values. Brand names, registered businesses, addresses and user-authored notes are not machine-translated.
- Standard equipment-search navigation, notification button, unread indicator, account-owned read-state and links to corresponding records. Only new changes after the database update generate real notifications; existing activity is not fabricated/backfilled.
- Real-account date-based capacity search and atomic final reservation validation. Scheduling remains day-level, not shift-level or telematics-based.
- Clarify displayed-price inclusions, inclusive calendar-day wage subtotals and missing monthly proration terms.
- Daily owner work entries, optional paired meter readings, immutable customer decisions and private party-only access. Duplicate retries reuse the request ID. Rejected hours free the daily reporting allowance. These records do not change agreed pricing, release funds or prove equipment condition.
- Offline notice, no false success messaging, basic MIME/frame/referrer/permission/CSP headers and production-dependency audit in CI.
- Clearly labelled local demo work records and negotiations. Real-account history remains in Supabase.

## Required Before Real Payments

- Select an appropriate payment/settlement partner and complete business/vendor onboarding. Provider names alone are not credentials or approval.
- Build approved checkout and payout-account onboarding, disclose customer fees/vendor net amounts and agree cancellation/refund terms. Reconcile the prototype's quote fee with the funded escrow commission before activation.
- Configure server-only secrets, verified webhooks and an authenticated payout-worker schedule; test refunds, timeouts, chargebacks, unavailable destinations and reconciliation alerts.
- Run independent-connection contention tests on a dedicated staging PostgreSQL database. The current database tests use isolated PGlite; do not misrepresent them as production contention/load tests.
- Have payment, tax, privacy and contract requirements reviewed for the actual business and jurisdiction. Do not use the company operating account as a makeshift customer escrow.
- A 48-hour scheduling deadline is not a guaranteed bank-receipt time. Factoring requests are not approved loans or funded advances.

## Other External Setup

| Service | Before Activation |
| --- | --- |
| SMTP / SMS | Approved sending identity/provider, DNS configuration, delivery/rate-limit testing and recovery/verification round trips. Never simulate successful delivery in a real account. |
| Calling / recording | Business telephony account/company number, booking-party authorization, clear notice/consent, retention policy, restricted recordings and callback verification. Microphone access is currently disabled by policy because no browser calling integration exists. |
| Fuel partners | Signed commercial agreement, approved station/staff onboarding and a tested attendant redemption process. Public station listings do not establish a RigDesk discount partnership. |
| Identity documents | Staffed review, malware scanning, retention/deletion process and access audit. Do not label a format-checked Aadhaar number as verified identity. |
| Maps | Production tile-service capacity/terms and fallbacks. Location sharing must be voluntary and show freshness; stored pins are not live tracking. |
| Operations | Hosted error monitoring, uptime alerts, tested backups/restores, a staffed support/dispute process and an incident owner. No paid external monitoring account has been created. |

## Product Backlog: Not Yet Implemented

1. Complete quoted package pricing for machine/operator/transport/fuel/taxes and accepted scope amendments.
2. Independent worker sign-in, consent-based manager delegation, attendance and payroll statements.
3. Photo evidence, condition inspections, electronic signatures and an agreed correction/escalation process for disputed work logs.
4. Breakdown replacements and authorised subcontracting, without changing the customer contract silently.
5. Verified-job reliability metrics, no-show policies and comparable auction scope/exclusions.
6. Saved equipment/crews and repeat booking, with server-side capacity and price reconfirmation.
7. Maintenance/document-expiry reminders, measured fuel reconciliation and genuine owner profitability reporting.
8. Enterprise sites, purchase approvals, budgets and consolidated invoices.
9. Safe offline drafts, explicit syncing and a tested PWA; never label an offline draft as a confirmed reservation.
10. Partner-backed invoice financing only after commercial/regulatory/credit review.

## Release Acceptance Checklist

- Run `pnpm run typecheck`, `pnpm test`, `pnpm run build` and `pnpm audit --prod`.
- Exercise entry/demo/customer/owner equipment, auctions, bookings, workforce and fuel in English, Hindi and Kannada, light/dark and desktop/mobile. Check filter values, pending/save errors, modal close/keyboard focus and readable text.
- Check notification read persistence/navigation; in staging, verify customer A cannot read or mark owner/customer B's notifications or work entries.
- In staging, reserve competing units, retry submissions, expire/decline bookings and verify capacity recovery. Work logs must reject unrelated users, future dates, invalid meter pairs, duplicate payload changes and over-24-hour totals.
- Verify real-account availability against server records, plus final transaction revalidation. A displayed count can change before submission.
- Do not accept real employment/payment terms or send real customer alerts as automated QA. Use clearly identified staging fixtures and demo profiles.
- Preserve signing secrets and the public bond verifier URL. Confirm existing printed QR documents are not broken by deployment.
- Keep the prior Vercel deployment for rollback. Repair schema forward with review; never drop live tables to revert a UI release.
