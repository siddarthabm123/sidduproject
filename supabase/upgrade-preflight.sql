-- Read-only inspection of the EXISTING project. No resets, seeds or writes.
SELECT to_regclass('public.users') AS users,
       to_regclass('public.equipment') AS equipment,
       to_regclass('public.worker_profiles') AS workers,
       to_regclass('public.worker_hires') AS hires,
       to_regclass('public.workforce_posts') AS workforce_posts,
       to_regclass('public.workforce_applications') AS workforce_applications;
SELECT to_regprocedure('public.workforce_board()') AS workforce_board,
       to_regprocedure('public.claim_provider_request(text)') AS provider_quota,
       to_regprocedure('public.admin_access()') AS admin_access;
SELECT table_name, row_security
FROM (SELECT c.relname AS table_name,c.relrowsecurity AS row_security
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname IN
        ('users','equipment','worker_profiles','worker_hires','workforce_posts','workforce_applications')) objects
ORDER BY table_name;
