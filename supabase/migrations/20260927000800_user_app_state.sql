CREATE TABLE IF NOT EXISTS public.user_app_state (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_app_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users can read their own app state" ON public.user_app_state;
CREATE POLICY "users can read their own app state"
  ON public.user_app_state FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "users can create their own app state" ON public.user_app_state;
CREATE POLICY "users can create their own app state"
  ON public.user_app_state FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "users can update their own app state" ON public.user_app_state;
CREATE POLICY "users can update their own app state"
  ON public.user_app_state FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
