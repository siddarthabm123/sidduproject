# Database and Deployment Runbook

## Observed State, 13-17 October 2026

The updated prototype was deployed to [the RigDesk production URL](https://rigdesk-marketplace-rig-logi-x.vercel.app/) on 17 October 2026. The Vercel project has production Supabase browser configuration and bond-signing configuration. Production `/`, `/demo`, fuel hub and customer workforce routes returned HTTP 200; unauthenticated fuel/workforce APIs returned 401 and the disabled payment endpoint returned 503. Read-only public RPC probes on 17 October returned `PGRST202` for `marketplace_equipment`, `fuel_hub_context` and `my_workforce_records`: these functions are not exposed in the target API schema cache. This does not prove which other tables or migrations exist.

The Supabase CLI is not authenticated yet. A browser login flow was started, but it requires the account owner to complete the one-time verification. No production SQL migrations have been applied in this setup session. The authenticated SQL editor cannot be controlled through the available computer-use surface. A frontend deployment does not establish database readiness. Do not use the public anon key to attempt database administration or bypass RLS.

## Database Rollout

1. Authenticate locally using `npx supabase login`; keep the token out of chat, source control and browser code.
2. Verify project `aejaswaorfmlzagucnvm` before any writes. Take a backup appropriate to the project's plan.
3. Run the read-only `supabase/preflight.sql` in the authenticated SQL editor. Inspect existing tables, columns, functions, migration history and every Storage policy. A broad existing Storage policy can defeat the intended private bucket policy.
4. Reconcile existing schema/history. Root migrations were originally maintained outside the CLI migrations directory; **do not blindly run `supabase db push` or mark every migration applied**.
5. Apply only missing prerequisites in staging, then production: root core/RLS/auth-workflows/financial-lock scripts, followed by migrations 007 (Aadhaar reference), 008 (account preferences), 009 (secure marketplace), 010 (reservations), 011 (payment service, dormant), 012 (fuel), and 013 (workforce). Demo seeds are excluded. Review existing constraint names before reapplying a migration.
6. Confirm account-scoped RPC permissions, row-level security and the private `worker-documents` bucket. Workforce storage allows own-folder access and trusted admin review, not public identity-document access.
7. Verify with two controlled customer/owner accounts: inventory, capacity conflicts, bids, bookings, profile visibility, worker acceptance and voucher ownership. Do not create fake live partnerships, verified workers, wallet credits or real transfers as a test.

The current suite passes 56 tests, including SQL exercised in isolated PGlite PostgreSQL fixtures. It is not evidence that a live Supabase migration has succeeded.

## Vercel

Run `npm run typecheck`, `npm test` and `npm run build`, then `npx vercel deploy --yes` for a preview. Check API responses and routes before `npx vercel deploy --prod --yes`. The root API directory now has seven dispatcher/endpoint functions; public payment, inspection, fuel and workforce URLs are preserved by rewrites. Signed webhook bytes are not parsed before verification.

Production requires `VITE_ENABLE_SUPABASE=true`, `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. The server functions fall back to these URL/anon values; explicit `SUPABASE_URL` and `SUPABASE_ANON_KEY` are also supported. Never prefix service-role or payment credentials with `VITE_`. Preserve `BOND_PDF_SECRET` and the production verification URL across deployments.

Leave `PAYMENTS_ENABLED` unset/false until payment onboarding, service-role credentials, signed gateway events, reconciliation, staffed disputes and payout-worker scheduling are tested. A 48-hour queued deadline is not a guaranteed received payout. No financed advance is implemented without a lender integration.

Fuel discounts require approved pump agreements and assigned attendants. Workforce collection of sensitive documents needs informed consent, review staff, retention/erasure policy and production upload scanning. SMTP remains independent of database migrations; never display a false email/OTP verification success.

## Source and Rollback

Commit reviewed source, tests, migrations and documentation together; never commit `.env*`, tokens, generated private documents or `.vercel`. Push the actual working branch rather than assuming `main`. Supabase migrations are not automatically run by GitHub or Vercel.

Keep the previous Vercel deployment available for rollback. Database rollback needs a reviewed forward repair or backup restore; frontend rollback must not drop live tables or erase user activity. Record deployment URLs and verified schema status in the README after completion.
