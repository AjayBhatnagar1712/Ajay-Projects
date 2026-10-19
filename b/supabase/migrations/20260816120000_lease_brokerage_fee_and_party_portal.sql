-- Additive: brokerage fee on mobile lease agreements
ALTER TABLE public.lease_agreements
  ADD COLUMN IF NOT EXISTS brokerage_fee_paise integer;

COMMENT ON COLUMN public.lease_agreements.brokerage_fee_paise IS
  'Broker-negotiated brokerage in paise; nullable until set. Visible to tenant after signing.';

-- Cross-broker party lookup for owner/tenant portal
CREATE INDEX IF NOT EXISTS agreement_parties_phone_idx
  ON public.agreement_parties (phone);

-- Soft-reference: agreement_id may be web agreements.id OR lease_agreements.id (UUID text)
ALTER TABLE public.rent_payments
  DROP CONSTRAINT IF EXISTS rent_payments_agreement_id_fkey;

COMMENT ON COLUMN public.rent_payments.agreement_id IS
  'Soft reference to public.agreements.id (web) or lease_agreements.id (mobile portal). FK dropped for dual-table support.';

-- Allow late status for overdue unpaid rent markers
ALTER TABLE public.rent_payments
  DROP CONSTRAINT IF EXISTS rent_payments_status_check;

ALTER TABLE public.rent_payments
  ADD CONSTRAINT rent_payments_status_check
  CHECK (status IN ('created', 'paid', 'settled', 'failed', 'late'));
