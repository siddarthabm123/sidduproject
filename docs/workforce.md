# Worker Profiles & On-Demand Hiring

## Routes

- `/dashboard/owner/workforce`: owner search, hiring and managed profiles.
- `/dashboard/customer/hire-workers`: customer recruiting and machine-pairing requests.
- `/dashboard/worker/create-profile`: three-step create/edit form, accessible to a signed-in account; `?edit=<managed-profile-id>` edits an existing profile.

Workers can use a regular account to manage their own profile. Fleet owners can register multiple operators only after confirming permission to manage their details. `user_id` denotes the authenticated profile manager, not an automatically verified worker identity. Hiring requests need approval from that manager. Profiles and requests remain private to their relevant account(s).

## Database and Storage Setup

Apply `supabase/migrations/20261012001300_workforce.sql` after the core/auth migrations (`users`, `auth.uid()` and `app_private` must exist). This requires Supabase Storage's `storage.buckets` and `storage.objects` tables. The migration creates/locks a private `worker-documents` bucket, with a 5 MB limit and PDF/PNG/JPEG allowlist.

Use the existing Supabase environment configuration. Uploads go directly to Supabase Storage with the current user's session, under `<user-uuid>/<random-uuid>.<extension>`. Database document fields contain private object paths, never public government-ID URLs. Clients can insert into/read their own folder; admins can read for review. No anonymous document access or client overwrite/delete permission is added. Audit existing Storage policies: an unrelated broad policy must not expose this bucket.

Profile registration validates document existence and ownership, manager consent, wage precision and commercial-driving licence/class requirements for heavy drivers. Browser file validation checks size, MIME and file signature. This is not server antivirus or document authenticity verification. Add server-side scanning, retention/erasure operations and a staffed identity/licence review process before collecting real sensitive documents at production scale. Prefer minimal/masked identity evidence; never publish identity numbers or documents in the marketplace.

## APIs

`api/workers.ts` dispatches these endpoints; each requires a Supabase bearer session:

| Method | Path | Input / Output |
| --- | --- | --- |
| POST | `/api/v1/workers/profile` | Validated profile fields, private document paths, `consent: true`, UUID `request_id`; optional managed-profile `id` for updates |
| GET | `/api/v1/workers/search` | `latitude`, `longitude`, `radius_km` (5/10/25/50), optional `role`, `wage_type`, `verified_status` (true/false), `q` |
| POST | `/api/v1/workers/hire` | Worker, inclusive-start/exclusive-end timestamps, agreed wage **per day/month**, wage type, site, optional machine description, UUID request ID |
| GET | `/api/v1/workers/records` | Managed profiles and the caller's hiring agreements/incoming requests |
| POST | `/api/v1/workers/respond` | Hire `id`, `action`: accept / cancel / complete |
| POST | `/api/v1/workers/review` | Admin-only `id`, `is_verified`; records reviewer and timestamp |

Search returns only public professional information, approximate distance and public area. No phone, private address, precise coordinates, document references or manager ID are returned. Hires reveal worker contact only after acceptance. Identity documents are never returned to hiring employers.

Location is supplied through coordinates or explicit GPS access; no location-name geocoding API is configured. Worker skill/machinery entries are user-provided and are not translated as professional certifications. Wage units remain explicit; payroll, taxes, attendance, legally signed contracts, document validation by issuing authorities, and wage payment are not implemented by this feature. A machine pairing is an agreement description, not an equipment reservation.

## Lifecycle and Availability

1. New/edited profiles are **Unverified**; a client cannot set a verified badge.
2. An authenticated customer/owner submits a **PENDING** hiring request. A database row lock protects against competing requests, and availability is reserved immediately. A worker cannot hire their own managed profile.
3. The profile manager accepts: **ACTIVE**. Contact becomes available to the employer. Employers cannot accept on behalf of unrelated workers.
4. Either party can cancel. The employer can complete an active hire after its end date.
5. Pending requests expire after 24 hours and stop blocking searches/new hires. Completed/cancelled/end-dated hires stop reserving availability. The manual `accepting_requests` preference remains separate from reservation-derived availability, so cancellation does not override a worker's unavailable preference.

Database RPC transactions and locks protect changes; unique request IDs prevent retry duplicates. Agreed wages use exact PostgreSQL numeric values. The UI keeps start/end dates and daily/monthly rate explicit; the end date shown in the form is inclusive, converted to an exclusive timestamp for conflict checks.

Admins review identity and licence evidence using the private Storage dashboard (or short-lived signed URLs), then call the review API. No public admin review screen or automated verification claim is included. Profile edits invalidate review and clear reviewer metadata.

Demo workers/requests persist locally and are labelled as samples; they create no employment relationship, upload no real documents and collect no payment. Real sessions never fall back to fake workers on database errors.

Types: `workforce/types.ts`. Zod schemas: `workforce/validation.ts`. Tests: `tests/workforce.test.ts`, including private Storage policies, ownership, verification, profile retries, availability, contact gating, acceptance and expiration.
