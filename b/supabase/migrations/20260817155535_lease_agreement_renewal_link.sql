ALTER TABLE public.lease_agreements
  ADD COLUMN IF NOT EXISTS renewed_from_agreement_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'lease_agreements_renewed_from_agreement_id_fkey'
      AND conrelid = 'public.lease_agreements'::regclass
  ) THEN
    ALTER TABLE public.lease_agreements
      ADD CONSTRAINT lease_agreements_renewed_from_agreement_id_fkey
      FOREIGN KEY (renewed_from_agreement_id)
      REFERENCES public.lease_agreements(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS lease_agreements_renewed_from_agreement_id_idx
  ON public.lease_agreements (renewed_from_agreement_id);

CREATE UNIQUE INDEX IF NOT EXISTS lease_agreements_one_active_renewal_idx
  ON public.lease_agreements (renewed_from_agreement_id)
  WHERE renewed_from_agreement_id IS NOT NULL
    AND status IN ('draft', 'in_review', 'esign_sent');

COMMENT ON COLUMN public.lease_agreements.renewed_from_agreement_id IS
  'Original signed lease agreement that this renewal draft was cloned from.';
