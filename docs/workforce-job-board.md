# Customer requirements and owner jobs

## Account roles

- Customer: publish worker requirements, dates, per-worker daily/monthly salary, headcount and a site pin. Review owner crew offers. Apply to owner vacancies with one or more profiles the customer manages.
- Owner: publish available jobs and vacancies. Review customer applications from the overview/account workforce section or the full workforce page. Offer managed owner crews to customer requirements.
- Both: see submitted application status, withdraw a pending application, and view existing agreements and profile management. The worker directory and existing bilateral wage negotiation remain available below the job board.

## Document gate

Every applicant must select their own profiles with completed admin review. Private government photo ID is required. Heavy drivers additionally need a private commercial driving license and a nonempty license class. The database checks that the uploaded objects still exist, the profiles remain reviewed, roles/wage types match, and profile managers own the submitted crew. Editing a profile resets the existing review process. ID files, street addresses and telephone numbers are not returned by the job-board API. The employer sees names, proposed wage and review requirements; admin review retains access to documents. File inspection and manual admin review do not constitute a government identity/permit verification integration.

## Acceptance and data consistency

`workforce_posts` stores requirements/vacancies, salary, dates and awarded headcount. `workforce_applications` stores private crew applications, one per applicant per post, and the created hire IDs. Authenticated RPCs return only applications belonging to the applicant or the post author.

Post author role comes from the database. Only the other account role can apply; only the post author can accept/decline. A pending applicant can withdraw. Request IDs make saved posts/applications retryable without duplicates. Acceptance locks the post and application, rechecks documents and remaining headcount, and creates an active `worker_hires` agreement per worker. All changes execute in the same PostgreSQL function transaction: an unavailable/unreviewed crew member rolls back the entire award. Accepted applications can be retried without creating more hires. The existing hiring checks prevent overlapping active/reserved workers. Awarded places count accepted applications; cancelling a subsequent hire does not automatically reopen the job post.

New routes reuse the existing `/api/workers.ts` dispatcher:

- `GET /api/v1/workers/jobs`
- `POST /api/v1/workers/job-post`
- `POST /api/v1/workers/apply`
- `POST /api/v1/workers/application-response`

The dashboard inbox and full board refresh every 30 seconds while visible, on focus, after local actions and on demo storage changes. This is polling, not instant cross-account push delivery. Accepted applications also appear in the existing account-scoped hiring records. Pending job applications are shown in the new dashboard section rather than added to the notification bell.

## Existing Supabase update — not installed yet

No reset, replacement database, demo seeds or real user activity is needed. In the authenticated SQL editor of the existing project, first inspect:

```sql
SELECT to_regclass('public.worker_profiles'),to_regclass('public.worker_hires'),
       to_regclass('public.workforce_posts'),to_regclass('public.workforce_applications');
SELECT to_regprocedure('public.hire_worker(uuid,timestamptz,timestamptz,numeric,wage_type,text,text,uuid,double precision,double precision)'),
       to_regprocedure('public.workforce_board()');
```

If the board tables/function are missing and workforce/profile/negotiation updates are installed, apply `supabase/migrations/20261115001900_workforce_job_board.sql` once. It adds two RLS-protected tables and four authenticated-only functions and preserves existing user/profile/hiring rows. Do not apply it blindly if those objects already exist. Record the update in deployment history and check anonymous execution is denied. Existing admin-review membership and the private `worker-documents` bucket are required. No authenticated database/CLI session is currently available in this local workspace, so live installation has not been performed.

The new frontend is local and has not been deployed. Until the SQL update is installed, real job-board requests show an unavailable message; the older worker directory and hiring records remain separate and usable.

## Demo and validation

The shared demo board has a customer requirement, an owner vacancy and a pending application in each direction. It uses fictional worker profiles and never uploads real identity documents. Accept in one role, switch demo roles, and review the same application/agreement in the other role. Browser storage is a demo simulation, not a replacement for PostgreSQL transactions.

The automated checks cover role/ownership restrictions, document review, idempotent requests, crew eligibility, private application visibility, atomic crew awards, two-way hiring records and endpoint authentication. Interactive browser and live two-account checks remain distinct from these isolated PostgreSQL tests.
