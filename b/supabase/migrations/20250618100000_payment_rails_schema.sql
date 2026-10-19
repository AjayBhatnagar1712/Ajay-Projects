-- Phase 0 — payment rails schema (recipient config, KYC, rent payment types, webhooks)

-- Section 1 — payment_recipient_config (replaces owner_payment_config)
-- Choice: DROP + CREATE (not ALTER ... RENAME). Production owner_payment_config is empty
-- and the PK changes from (phone) to (phone, role); dropped RazorpayX columns and new fields
-- are easier to express as a clean create than incremental alters on a misnamed table.

DROP TABLE IF EXISTS public.owner_payment_config;

CREATE TABLE IF NOT EXISTS public.payment_recipient_config (
  phone text NOT NULL,
  role text NOT NULL,
  razorpay_linked_account_id text,
  razorpay_reference_id text,
  commission_rate_bps integer NOT NULL DEFAULT 0
    CHECK (commission_rate_bps >= 0 AND commission_rate_bps <= 10000),
  validation_status text NOT NULL DEFAULT 'pending'
    CHECK (validation_status IN ('pending', 'submitted', 'cooling', 'activated', 'failed')),
  activated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (phone, role)
);

CREATE INDEX IF NOT EXISTS payment_recipient_config_validation_status_idx
  ON public.payment_recipient_config (validation_status);

ALTER TABLE public.payment_recipient_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.payment_recipient_config FROM anon, authenticated;

-- Section 2 — payment_recipient_kyc
CREATE TABLE IF NOT EXISTS public.payment_recipient_kyc (
  phone text NOT NULL,
  role text NOT NULL,
  legal_name text NOT NULL,
  email text NOT NULL,
  pan text NOT NULL, -- TODO: encrypt at rest, see backlog
  registered_address jsonb NOT NULL,
  business_category text NOT NULL,
  business_subcategory text NOT NULL,
  business_type text NOT NULL,
  bank_account_number text,
  bank_ifsc text,
  bank_holder_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (phone, role),
  FOREIGN KEY (phone, role) REFERENCES public.payment_recipient_config (phone, role) ON DELETE CASCADE
);

ALTER TABLE public.payment_recipient_kyc ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.payment_recipient_kyc FROM anon, authenticated;

-- Section 3 — rent_payments (payment types + partial uniques)
ALTER TABLE public.rent_payments
  ADD COLUMN IF NOT EXISTS payment_type text NOT NULL DEFAULT 'rent'
    CHECK (payment_type IN ('rent', 'brokerage_tenant', 'brokerage_owner'));

ALTER TABLE public.rent_payments
  ADD COLUMN IF NOT EXISTS broker_phone text;

ALTER TABLE public.rent_payments
  ADD COLUMN IF NOT EXISTS payee_role text;

ALTER TABLE public.rent_payments
  ALTER COLUMN rent_period DROP NOT NULL;

ALTER TABLE public.rent_payments
  DROP CONSTRAINT IF EXISTS rent_payments_agreement_id_rent_period_key;

ALTER TABLE public.rent_payments
  DROP CONSTRAINT IF EXISTS rent_payments_agreement_id_rent_period_unique;

CREATE UNIQUE INDEX IF NOT EXISTS rent_payments_rent_period_uniq
  ON public.rent_payments (agreement_id, rent_period)
  WHERE payment_type = 'rent';

CREATE UNIQUE INDEX IF NOT EXISTS rent_payments_brokerage_uniq
  ON public.rent_payments (agreement_id, payment_type)
  WHERE payment_type IN ('brokerage_tenant', 'brokerage_owner');

COMMENT ON COLUMN public.rent_payments.status IS 'Lifecycle: created → paid → settled (+ failed)';

-- Section 4 — rent_payment_transfers (recipient naming)
ALTER TABLE public.rent_payment_transfers
  RENAME COLUMN owner_phone TO recipient_phone;

ALTER TABLE public.rent_payment_transfers
  RENAME COLUMN owner_name TO recipient_name;

ALTER TABLE public.rent_payment_transfers
  ADD COLUMN IF NOT EXISTS recipient_role text;

ALTER INDEX IF EXISTS rent_payment_transfers_owner_phone_idx
  RENAME TO rent_payment_transfers_recipient_phone_idx;

-- Section 5 — razorpay_webhook_events
CREATE TABLE IF NOT EXISTS public.razorpay_webhook_events (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  razorpay_event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  signature_valid boolean NOT NULL DEFAULT false,
  processing_status text NOT NULL DEFAULT 'received'
    CHECK (processing_status IN ('received', 'processed', 'failed', 'ignored')),
  processing_error text,
  razorpay_payment_id text,
  razorpay_order_id text,
  razorpay_transfer_id text,
  rent_payment_id text REFERENCES public.rent_payments (id) ON DELETE SET NULL,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS razorpay_webhook_events_razorpay_payment_id_idx
  ON public.razorpay_webhook_events (razorpay_payment_id);

CREATE INDEX IF NOT EXISTS razorpay_webhook_events_razorpay_order_id_idx
  ON public.razorpay_webhook_events (razorpay_order_id);

CREATE INDEX IF NOT EXISTS razorpay_webhook_events_razorpay_transfer_id_idx
  ON public.razorpay_webhook_events (razorpay_transfer_id);

ALTER TABLE public.razorpay_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.razorpay_webhook_events FROM anon, authenticated;
