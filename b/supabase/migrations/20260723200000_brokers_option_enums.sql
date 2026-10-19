-- Align brokers option columns with product enum values.
-- Staging only until promoted. Existing test data may contain pre-spec values
-- (e.g. employment_type=self_employed, deals_with={owners,tenants},
-- property_types={apartment}); those are filtered/cleared below before CHECKs.

ALTER TABLE public.brokers
  DROP CONSTRAINT IF EXISTS brokers_employment_type_valid;
ALTER TABLE public.brokers
  DROP CONSTRAINT IF EXISTS brokers_deals_with_valid;
ALTER TABLE public.brokers
  DROP CONSTRAINT IF EXISTS brokers_property_types_valid;

-- Normalize rows that would violate the new constraints (test / early onboarding data).
UPDATE public.brokers
SET
  employment_type = CASE
    WHEN employment_type IN ('full_time', 'part_time', '') THEN employment_type
    ELSE ''
  END,
  deals_with = COALESCE(
    (
      SELECT array_agg(v ORDER BY ord)
      FROM unnest(deals_with) WITH ORDINALITY AS t(v, ord)
      WHERE v IN ('rent', 'sale', 'maintenance', 'other')
    ),
    '{}'::text[]
  ),
  property_types = COALESCE(
    (
      SELECT array_agg(v ORDER BY ord)
      FROM unnest(property_types) WITH ORDINALITY AS t(v, ord)
      WHERE v IN (
        'flats',
        'independent_house',
        'community_flats',
        'villas',
        'commercial',
        'other'
      )
    ),
    '{}'::text[]
  ),
  updated_at = now();

UPDATE public.brokers
SET
  deals_with_other = CASE
    WHEN 'other' = ANY (deals_with) THEN deals_with_other
    ELSE NULL
  END,
  property_types_other = CASE
    WHEN 'other' = ANY (property_types) THEN property_types_other
    ELSE NULL
  END;

ALTER TABLE public.brokers
  ADD CONSTRAINT brokers_employment_type_valid CHECK (
    employment_type IN ('', 'full_time', 'part_time')
  );

ALTER TABLE public.brokers
  ADD CONSTRAINT brokers_deals_with_valid CHECK (
    deals_with <@ ARRAY['rent', 'sale', 'maintenance', 'other']::text[]
  );

ALTER TABLE public.brokers
  ADD CONSTRAINT brokers_property_types_valid CHECK (
    property_types <@ ARRAY[
      'flats',
      'independent_house',
      'community_flats',
      'villas',
      'commercial',
      'other'
    ]::text[]
  );
