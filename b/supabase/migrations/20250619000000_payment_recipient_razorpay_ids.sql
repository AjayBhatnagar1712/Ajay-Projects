-- Payment recipient config — Razorpay product/stakeholder IDs + needs_clarification status

ALTER TABLE public.payment_recipient_config
  ADD COLUMN IF NOT EXISTS razorpay_product_id text;

ALTER TABLE public.payment_recipient_config
  ADD COLUMN IF NOT EXISTS razorpay_stakeholder_id text;

ALTER TABLE public.payment_recipient_config
  DROP CONSTRAINT IF EXISTS payment_recipient_config_validation_status_check;

ALTER TABLE public.payment_recipient_config
  ADD CONSTRAINT payment_recipient_config_validation_status_check
    CHECK (validation_status IN (
      'pending',
      'submitted',
      'needs_clarification',
      'cooling',
      'activated',
      'failed'
    ));
