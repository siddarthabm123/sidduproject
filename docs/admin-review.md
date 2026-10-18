# Administrator Review

Open `/admin` after signing into an authorized account. Customer/owner accounts retain their role and activities; separate `platform_admins` membership enables administration. Membership has RLS enabled and cannot be written through the browser client.

## Provisioning

Only a trusted database operator should run this after confirming the intended existing account and obtaining approval for access to private identity documents:

```sql
INSERT INTO public.platform_admins(user_id)
SELECT id FROM public.users WHERE lower(email)=lower('<approved-existing-login-email>')
ON CONFLICT DO NOTHING;
```

An operator can revoke membership with `DELETE FROM public.platform_admins WHERE user_id='<approved-user-uuid>';`. Neither operation belongs in a public API. Never publish real login emails, credentials or identity documents in the repository.

## Workflow

- Equipment approval/revocation requires a reason and writes an audit event. Owner registration/identity edits invalidate approval.
- Worker documents remain in the private `worker-documents` bucket. Review links expire after 60 seconds. A badge represents admin review, not government-backed Aadhaar authentication.
- Unfunded disputes can be resolved with a reason; booking dates, parties and totals are not rewritten.
- Funded disputes require payment-provider reconciliation, not generic resolution.
- Grant fuel registration, discount approval and station-specific redemption only to onboarded partners/staff. Permissions do not create a commercial partnership.

## Authentication

Email OTP requires `VITE_ENABLE_EMAIL_OTP=true`, working Supabase email delivery and a template containing the OTP token. Password signup is the default, but Supabase's confirmation policy determines whether signup immediately creates a session. Recovery uses `/reset-password`; add its production URL to allowed Supabase redirects. Never report successful delivery or verification when the provider failed.

`VITE_ENABLE_PHONE_OTP` defaults to false; enable it only after testing a configured SMS provider. SMTP, Google Places, Gemini, masked recorded calling, live payment checkout and invoice funding require real providers or commercial partners. Local permissions do not substitute for credentials or onboarding.
