# Fuel Bunks & Partner Discounts

## Entry Points

Owner dashboard menu: **Fuel hub**. Route: `/dashboard/owner/fuel-hub` (alias `/owner/fuel-hub`).
QR verification route: `/fuel/voucher/:id?token=<random-uuid>`.

The demo uses fictional Bengaluru stations with clearly labelled, non-redeemable vouchers. Real sessions use Supabase records only; an empty database produces an empty station list, not invented partnerships. GPS is requested only when the owner presses **Use GPS**. Saved centers come from the owner's equipment locations and accepted active booking sites. Distances are straight-line Haversine distances, not road routes or proof of operating hours/fuel stock.

## Setup

Apply `supabase/migrations/20261012001200_fuel_hub.sql` after the repository's core/auth migrations that create `users`, `equipment`, `bookings` and `app_private`. Configure `SUPABASE_URL` and `SUPABASE_ANON_KEY` for server requests. Frontend Supabase configuration is unchanged. No new paid map key or PostGIS extension is required.

Approve actual pump partnerships before granting registration/discount permissions. Trusted database operators can provision:

```sql
INSERT INTO fuel_partner_access(user_id,can_register,can_offer_discounts)
VALUES ('<existing-approved-user-uuid>',true,true);

INSERT INTO fuel_bunk_staff(bunk_id,user_id)
VALUES ('<registered-bunk-uuid>','<existing-attendant-user-uuid>');
```

These tables have no client write permission. Application admins can register through the API. Ordinary equipment owners cannot grant themselves discounts. The map registration control is visible only when `fuel_hub_context()` authorizes registration (or within the explicitly labelled demo). The existing application account UI supports customer/owner logins; admin provisioning and review remain trusted operations.

## API

All endpoints are dispatched by `api/fuel.ts`. Vercel and Vite preserve these public paths:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/v1/fuel/context` | Capabilities, owned equipment and saved locations |
| GET | `/api/v1/fuel/bunks/nearby` | `latitude`, `longitude`, `radius_km` (5/10/25), `fuel_type` (diesel/petrol), `partner_only` |
| POST | `/api/v1/fuel/bunks` | Authorized map-pin registration |
| GET | `/api/v1/fuel/vouchers` | Current user's vouchers, expired status reconciled |
| POST | `/api/v1/fuel/vouchers/generate` | `bunk_id`, `fuel_type` (DIESEL/PETROL), `quantity_litres`, optional `equipment_id`, UUID `request_id` |
| GET | `/api/v1/fuel/vouchers/verify` | Redacted public verification using `id` and secret UUID `token` |
| POST | `/api/v1/fuel/vouchers/redeem` | Assigned pump staff/admin; `id`, `token`, actual `quantity_litres` |

Every endpoint except public verification requires a Supabase bearer session. Vouchers expire after 24 hours. Quantity range: 1-2,000 litres, at most two decimal places. At most 10 active vouchers per owner. Registration accepts discounts up to INR 10/litre; deployment operators should use their contracted rate. Standard pumps always have zero discount.

Database functions execute atomically. Owner locks serialize generation; unique request IDs prevent retry duplicates; pump records determine rates. Random 8-character hexadecimal codes have unique constraints and collision retries. Public URLs also require a random UUID token: the short code alone is not an access credential. Verification never includes owner identity, private contact information or equipment IDs. Redemption locks the voucher and rejects reuse, expiry, wrong attendants, unavailable partnerships and excess quantity. Partial redemption consumes the voucher once; actual savings are computed from the purchased quantity.

This is a discount entitlement system, not a fuel payment gateway or settlement ledger. It does not automatically obtain live Google station data, guarantee stock, establish partnerships, reimburse pumps, or transfer money. Production rollout needs actual agreements and authenticated attendant accounts; additional issuance/verification rate limiting and operational monitoring are recommended.

Map tiles: OpenStreetMap, with attribution displayed. Brand marks, when available, reference Wikimedia Commons file pages for [BPCL](https://commons.wikimedia.org/wiki/File:Bharat_Petroleum_logo.svg), [HPCL](https://commons.wikimedia.org/wiki/File:Hindustan_Petroleum-Logo.png), and [IndianOil](https://commons.wikimedia.org/wiki/File:Indian_Oil_Logo.svg). Images have text fallbacks; displaying a brand is not a claim of affiliation. See each source's copyright/trademark information before production use.

Run `node --import tsx --test tests/fuel.test.ts` for distance, money precision, authenticated access, SQL permissions, idempotency, privacy, expiry and redemption tests.
