-- Track failed Route transfers for ops visibility.
-- When a transfer to a recipient (owner/broker) fails, the tenant has still
-- paid (status stays 'paid'), but the recipient did not receive funds — this
-- flags such payments for manual attention without corrupting the status field.
ALTER TABLE public.rent_payments
  ADD COLUMN IF NOT EXISTS transfer_failed_at timestamptz;
