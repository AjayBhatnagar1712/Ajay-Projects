-- Enable RLS on user_data (no anon/authenticated policies — API-only access via server JWT).
-- Run once on Supabase Postgres (SQL editor or migration pipeline).

ALTER TABLE IF EXISTS public.user_data ENABLE ROW LEVEL SECURITY;

-- Optional: revoke direct table access from Supabase API roles if the table was ever exposed.
REVOKE ALL ON TABLE public.user_data FROM anon, authenticated;
