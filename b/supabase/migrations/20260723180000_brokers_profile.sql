-- Broker profile / onboarding (mobile). Staging first — do not apply to production until promoted.
CREATE TABLE IF NOT EXISTS public.brokers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  age integer,
  firm_name text,
  employment_type text NOT NULL DEFAULT '',
  business_since_year integer,
  properties_handled integer,
  deals_with text[] NOT NULL DEFAULT '{}'::text[],
  deals_with_other text,
  property_types text[] NOT NULL DEFAULT '{}'::text[],
  property_types_other text,
  region text NOT NULL DEFAULT '',
  pincodes text[] NOT NULL DEFAULT '{}'::text[],
  step_completed integer NOT NULL DEFAULT 0,
  onboarding_completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT brokers_step_completed_range CHECK (step_completed >= 0 AND step_completed <= 4),
  CONSTRAINT brokers_age_positive CHECK (age IS NULL OR age > 0),
  CONSTRAINT brokers_business_since_year_range CHECK (
    business_since_year IS NULL
    OR (business_since_year >= 1950 AND business_since_year <= 2100)
  ),
  CONSTRAINT brokers_properties_handled_nonneg CHECK (
    properties_handled IS NULL OR properties_handled >= 0
  )
);

CREATE INDEX IF NOT EXISTS brokers_user_id_idx ON public.brokers (user_id);

ALTER TABLE public.brokers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.brokers FROM anon, authenticated;
