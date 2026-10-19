-- Store the real payment method (card / upi / netbanking / wallet) captured
-- from the payment.captured webhook, so payment history shows the actual
-- method instead of a placeholder.
ALTER TABLE public.rent_payments
  ADD COLUMN IF NOT EXISTS payment_method text;
