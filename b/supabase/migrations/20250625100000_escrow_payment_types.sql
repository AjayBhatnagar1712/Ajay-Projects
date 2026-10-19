-- Escrow payment types for tenant agreement trust-layer payments

ALTER TABLE public.rent_payments
  DROP CONSTRAINT IF EXISTS rent_payments_payment_type_check;

ALTER TABLE public.rent_payments
  ADD CONSTRAINT rent_payments_payment_type_check
  CHECK (payment_type IN ('rent', 'brokerage_tenant', 'brokerage_owner', 'security_deposit'));

CREATE UNIQUE INDEX IF NOT EXISTS rent_payments_security_deposit_uniq
  ON public.rent_payments (agreement_id, payment_type)
  WHERE payment_type = 'security_deposit';

COMMENT ON COLUMN public.rent_payments.payment_type IS
  'Lifecycle types: rent, brokerage_tenant, brokerage_owner, security_deposit';
