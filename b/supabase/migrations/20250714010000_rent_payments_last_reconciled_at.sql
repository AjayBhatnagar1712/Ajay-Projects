-- Throttle on-read Razorpay transfer reconciliation so history loads
-- do not re-fetch the same pending transfers on every request.
-- Used by reconcileStaleTransfers (payments-*-history): skip re-fetch
-- until last_reconciled_at is older than the cool-down window.
ALTER TABLE public.rent_payments
  ADD COLUMN IF NOT EXISTS last_reconciled_at timestamptz;
