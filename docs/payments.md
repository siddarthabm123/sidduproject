# B2B Escrow and Invoice Service

This is a server-side service layer on the existing Node.js/TypeScript and Supabase/PostgreSQL stack. It does not perform live financial transactions by default. Existing demo wallet balances are never accepted as verified funding.

## Models and Money

The escrow schema was installed in the existing production Supabase project on 17 October 2026; payment APIs remain disabled. For a new environment, apply `supabase/migrations/20261012001100_payment_escrow.sql` after the core schema and migrations through `20261010001000_marketplace_reservations.sql` in staging first, followed by `20261017001400_explicit_rpc_permissions.sql` after the feature schemas. Updates are wrapped in `BEGIN` / `COMMIT` and do not backfill prototype wallet balances as real money.

`payment_escrows` is the database representation of `PaymentEscrow`, linked one-to-one to a booking. It contains the requested `id`, `booking_id`, `contractor_id`, `vendor_id`, `locked_amount`, `status`, `payout_due_date`, and `created_at`, plus funding evidence, idempotency, commission and settlement fields. All monetary fields are integer INR paise, never floating-point rupees. Current booking amount limits remain INR 21,474,836.47. Currency conversion is not implemented.

Additional models:

- `payment_balances`: verified contractor credit, distinct from prototype wallets.
- `payment_receipts`: unique captured provider PaymentIntents, preventing double-use across different webhook IDs.
- `inspection_logs`: immutable post-return observations with separate contractor sign-off.
- `payment_invoices`: signed-off vendor receivables, with an escrow reference for prepaid jobs.
- `invoice_factoring_requests`: vendor requests for unpaid deferred invoices; not a financing approval or advance.
- `payment_jobs`: durable transfer/refund outbox with row leases, retry tracking and stable provider idempotency keys.
- `payment_ledger`: append-only funding, transfer, commission and refund entries.
- `payment_webhook_events`: processed event identities and normalized payloads.
- `payment_accounts`: trusted customer and verified vendor destination mappings, managed only by privileged onboarding.

Commission is server-owned and snapshotted when funds lock. The default is **750 basis points (7.5%) of the locked gross amount**, rounded to the nearest paise; policy permits 5-10%. Vendor net plus commission equals the locked gross. This replaces settlement accounting for funded jobs, not the existing prototype's 3.5% customer quote calculation. Commercial terms and the vendor's net amount must be shown and agreed in the future payment UI before enabling production checkout.

## Endpoints

All endpoints accept `POST`. Booking/inspection/factoring endpoints require a valid Supabase bearer token. They cannot set monetary totals, verification flags or payout destinations from client input. Payment APIs are disabled unless `PAYMENTS_ENABLED=true`.

| Endpoint | Input | Behavior |
| --- | --- | --- |
| `/api/v1/payments/escrow/lock` | `booking_id`, `source: "balance"`, or `source: "card"` and `payment_intent_id`; UUID `Idempotency-Key` header | Checks ownership and availability, validates verified balance or captured card evidence, reserves funds and atomically confirms booking. |
| `/api/v1/inspections/post-return` | `booking_id`, boolean `damage_flag`, `notes` | A booking party records the inspection after the owner requests completion. Damage immediately freezes escrow and opens a booking dispute. |
| `/api/v1/inspections/sign-off` | `inspection_id` | Only the contractor can approve a damage-free inspection without open disputes. Atomically completes the booking, creates the invoice and queues funded vendor payout. |
| `/api/v1/payments/escrow/release` | `booking_id` | Idempotently returns/schedules the payout only after successful post-return sign-off. |
| `/api/v1/payments/escrow/refund` | `booking_id` | Contractor-only cancellation before dispatch: credits verified balance atomically, or queues a card refund until provider confirmation. |
| `/api/v1/payments/factoring/request` | `invoice_id`; UUID `Idempotency-Key` header | Only the invoice vendor can submit an undisputed, unpaid deferred receivable. Escrow-funded invoices cannot be factored. |
| `/api/v1/payments/webhook` | Original Stripe body and `Stripe-Signature` header | Verifies signature, timestamp and test/live mode; retrieves capture evidence and commits deduplicated financial events. |
| `/api/v1/payments/worker` | `Authorization: Bearer <PAYMENT_WORKER_SECRET>` | Claims at most ten outbox jobs and submits idempotent provider operations. Never equates an HTTP submission with confirmed payout. |

Example lock, using placeholders rather than real credentials:

```sh
curl -X POST http://127.0.0.1:5180/api/v1/payments/escrow/lock \
  -H 'Authorization: Bearer <supabase-access-token>' \
  -H 'Idempotency-Key: 12345678-1234-4234-8234-123456789abc' \
  -H 'Content-Type: application/json' \
  -d '{"booking_id":"<booking-uuid>","source":"balance"}'
```

## Capture and Provider Setup

Configure these **server-only** variables in staging; never expose them with a `VITE_` prefix or commit their values:

```dotenv
PAYMENTS_ENABLED=true
PAYMENTS_LIVE_MODE=false
SUPABASE_SERVICE_ROLE_KEY=<server-only-key>
STRIPE_SECRET_KEY=<test-secret-key>
STRIPE_WEBHOOK_SECRET=<endpoint-signing-secret>
PAYMENT_WORKER_SECRET=<random-secret-at-least-32-characters>
```

Use trusted onboarding to provision `payment_accounts.customer_reference` for contractors and `vendor_destination` / `payout_enabled` for verified vendors. This module deliberately does not let users self-approve payout accounts.

An existing server checkout must create platform PaymentIntents with the server-calculated amount, `inr` currency, and the registered Stripe customer. For escrow, immutable checkout metadata must include `purpose=escrow`, `contractor_id`, `booking_id`, and UUID `request_id` matching the lock request header. For verified balance top-ups, use `purpose=balance` and `contractor_id`. This service validates existing captured PaymentIntents; creating a checkout, handling card details and vendor KYC UI are not implemented here. A `requires_capture` authorization alone is not treated as locked money.

Configure webhook subscriptions for `payment_intent.succeeded`, `transfer.created`, `refund.created`, `refund.updated`, and `charge.dispute.created`. The official Stripe SDK verifies the exact raw body. A captured payment that can no longer fund the booking, or a second capture for an already funded booking, creates a compensating refund job rather than another escrow. Malformed or unverifiable receipts are rejected for reconciliation instead of inventing funding.

Schedule the authenticated worker every minute using your hosting scheduler or a trusted external scheduler. The code provides the worker endpoint but does not create a production schedule. Monitor payout deadlines, disabled destinations, insufficient provider balance, submitted jobs without confirmation, and jobs with errors. Missing onboarding blocks transfer, not job sign-off.

## Transaction and State Guarantees

Each Supabase RPC runs as one PostgreSQL transaction: ownership, row locks, balance debit/credit, escrow status, booking status, ledger and outbox writes commit together or roll back together. External provider calls cannot participate in a PostgreSQL transaction; the durable outbox and idempotent provider requests handle that boundary without holding database locks across network calls.

The release deadline is sign-off plus **48 calendar hours**, with transfers queued immediately. `HOLDING` remains until a matched successful transfer webhook; the due date is not a guarantee of bank receipt. `RELEASED` means funds reached the connected vendor account, not necessarily its bank account. Refunds stay pending until matched confirmation, except internal verified-balance refunds, which are atomic.

Damaged inspections and ordinary booking disputes both freeze funds. Pending transfers are cancelled. A dispute after submission can race an external transfer; the confirmed transfer is still recorded, escrow stays `DISPUTED`, and operations must reconcile/reverse it with the provider. Dispute resolution is intentionally a privileged manual process; resolving a booking issue alone does not automatically unfreeze escrow.

Workers use five-minute leases, stable destination snapshots and stable provider idempotency keys. If a response is lost, retries use the same job ID. Ambiguous attempts older than 23 hours require provider reconciliation before retrying, because Stripe may prune idempotency keys after 24 hours. Never manually mark a job paid based only on a worker response.

Factoring is a separate deferred-payment path: signed-off unfunded jobs produce 60-day receivables by default. The vendor may request factoring, but lender onboarding, debtor verification, underwriting, pricing, assignment and actual advance/disbursement require a financing-provider integration. `REQUESTED` does not credit balances or change an invoice to paid. Invoice payment records and terms must be reconciled by trusted operations before financing approval.

## Operational Boundary

The `PaymentEscrow` name describes this application's funding-reserve ledger; it is not proof of a legally regulated escrow account. Stripe explicitly states that it does not provide escrow services. Use an approved provider/legal structure before advertising regulated escrow or guaranteed bank settlement. The adapter uses connected-account transfers; bank payouts are a distinct provider operation. See [Stripe manual payouts](https://docs.stripe.com/connect/manual-payouts), [transfers](https://docs.stripe.com/api/transfers/create), and [webhook delivery guidance](https://docs.stripe.com/events/manage-webhook-endpoints).

Balance top-up chargebacks freeze the contractor's verified balance and unsettled balance-funded escrow. Resolving the incident and clearing this freeze requires trusted financial reconciliation; a new top-up does not silently remove the freeze. Only platform-account webhook events are accepted, not financial events issued on connected accounts.

The database schema is installed in production, but this implementation has not moved real money. Payment activation still needs payment UI integration, audit/retention policy, reconciliation dashboards, legal/commercial approval, full PostgreSQL multi-connection concurrency tests, and provider staging tests.

## Tests

```sh
pnpm run typecheck
pnpm run test
pnpm run build
```

`tests/escrow.test.ts` uses isolated PostgreSQL-compatible PGlite plus a mocked provider. It verifies receipt/event deduplication, unauthorized writes, ownership, insufficient-balance rollback, exact capture binding, refund compensation, contractor-only sign-off, commission math, 48-hour deadlines, lost provider responses, confirmed releases/refunds, damage/chargeback freezes, and factoring eligibility. SDK-generated webhook fixtures also verify tamper and timestamp rejection. No real provider API requests or transfers occur during tests.
