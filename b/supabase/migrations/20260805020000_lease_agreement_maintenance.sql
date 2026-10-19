-- lease_agreements: maintenance included flag + optional monthly amount (paise).
-- Default included=false so brokers opt in; unchecked reveals the amount field.

ALTER TABLE public.lease_agreements
  ADD COLUMN IF NOT EXISTS maintenance_included boolean NOT NULL DEFAULT false;

ALTER TABLE public.lease_agreements
  ADD COLUMN IF NOT EXISTS monthly_maintenance_paise integer;

ALTER TABLE public.lease_agreements
  DROP CONSTRAINT IF EXISTS lease_agreements_monthly_maintenance_paise_nonneg;

ALTER TABLE public.lease_agreements
  ADD CONSTRAINT lease_agreements_monthly_maintenance_paise_nonneg
  CHECK (
    monthly_maintenance_paise IS NULL OR monthly_maintenance_paise >= 0
  );

COMMENT ON COLUMN public.lease_agreements.maintenance_included IS
  'When true, maintenance is included in rent and monthly_maintenance_paise is unused.';

COMMENT ON COLUMN public.lease_agreements.monthly_maintenance_paise IS
  'Monthly maintenance amount in paise when maintenance_included is false; null when included.';
