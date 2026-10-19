-- Broker-confirmed (or iOS Share callback) party review link delivery.
-- Staging first — do not apply to production until promoted.
-- Distinct from token minting: review_shared_at is set only after share confirmation.

ALTER TABLE public.agreement_parties
  ADD COLUMN IF NOT EXISTS review_shared_at timestamptz;
