-- Brokers RLS policies + FORCE (staging first).
-- Complements 20260723180000_brokers_profile.sql which enabled RLS
-- and revoked anon/authenticated but created no policies.

CREATE POLICY "brokers_select_own" ON public.brokers
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "brokers_insert_own" ON public.brokers
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "brokers_update_own" ON public.brokers
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.brokers FORCE ROW LEVEL SECURITY;
