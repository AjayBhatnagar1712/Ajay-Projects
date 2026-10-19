-- Lease agreement party review fields for lightweight review flow.
-- Staging first — do not apply to production until promoted.
-- No public RLS / anon grants: public token access is API service-role only.

ALTER TABLE public.agreement_parties
  ADD COLUMN IF NOT EXISTS review_token text,
  ADD COLUMN IF NOT EXISTS review_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS review_comment text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'agreement_parties_approval_status_valid'
      AND conrelid = 'public.agreement_parties'::regclass
  ) THEN
    ALTER TABLE public.agreement_parties
      ADD CONSTRAINT agreement_parties_approval_status_valid
      CHECK (approval_status IN ('pending', 'approved', 'changes_requested'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS agreement_parties_review_token_uidx
  ON public.agreement_parties (review_token)
  WHERE review_token IS NOT NULL;
