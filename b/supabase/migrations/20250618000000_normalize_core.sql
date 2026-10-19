-- Phase 1 normalisation: add paise columns to tenant_invitations and create core relational tables.
-- Additive only — existing user_data blob store is unchanged.

-- Section 0 — Fix existing tenant_invitations money columns
ALTER TABLE public.tenant_invitations
  ADD COLUMN IF NOT EXISTS monthly_rent_paise bigint;

ALTER TABLE public.tenant_invitations
  ADD COLUMN IF NOT EXISTS monthly_maintenance_paise bigint;

ALTER TABLE public.tenant_invitations
  ADD COLUMN IF NOT EXISTS security_deposit_paise bigint;

UPDATE public.tenant_invitations
SET monthly_rent_paise = (NULLIF(TRIM(monthly_rent), '')::numeric * 100)::bigint
WHERE monthly_rent_paise IS NULL;

UPDATE public.tenant_invitations
SET monthly_maintenance_paise = (NULLIF(TRIM(monthly_maintenance), '')::numeric * 100)::bigint
WHERE monthly_maintenance_paise IS NULL;

UPDATE public.tenant_invitations
SET security_deposit_paise = (NULLIF(TRIM(security_deposit), '')::numeric * 100)::bigint
WHERE security_deposit_paise IS NULL;

-- Section 1 — profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  phone text NOT NULL,
  role text NOT NULL,
  name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  firm text NOT NULL DEFAULT '',
  property_count text,
  property_intent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (phone, role)
);

CREATE INDEX IF NOT EXISTS profiles_phone_idx
  ON public.profiles (phone);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.profiles FROM anon, authenticated;

-- Section 2 — payment_accounts
CREATE TABLE IF NOT EXISTS public.payment_accounts (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  phone text NOT NULL,
  role text NOT NULL,
  bank_holder_name text NOT NULL DEFAULT '',
  bank_name text NOT NULL DEFAULT '',
  bank_account_number text NOT NULL DEFAULT '',
  bank_ifsc text NOT NULL DEFAULT '',
  upi_id text NOT NULL DEFAULT '',
  upi_qr_url text,
  aadhaar_url text,
  pan_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (phone, role)
);

CREATE INDEX IF NOT EXISTS payment_accounts_phone_idx
  ON public.payment_accounts (phone);

CREATE INDEX IF NOT EXISTS payment_accounts_phone_role_idx
  ON public.payment_accounts (phone, role);

ALTER TABLE public.payment_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.payment_accounts FROM anon, authenticated;

-- Section 3 — properties
CREATE TABLE IF NOT EXISTS public.properties (
  id text PRIMARY KEY,
  account_phone text NOT NULL,
  account_role text NOT NULL,
  nickname text,
  address text NOT NULL DEFAULT '',
  area text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  pincode text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT 'India',
  owner_name text NOT NULL DEFAULT '',
  owner_contact text NOT NULL DEFAULT '',
  property_type text NOT NULL DEFAULT '',
  property_type_other text,
  unit_size text NOT NULL DEFAULT '',
  unit_size_other text,
  furnishing text NOT NULL DEFAULT '',
  built_up_area text NOT NULL DEFAULT '',
  built_up_units text NOT NULL DEFAULT '',
  total_floors text NOT NULL DEFAULT '',
  bedrooms text NOT NULL DEFAULT '',
  bathrooms text NOT NULL DEFAULT '',
  balconies text NOT NULL DEFAULT '',
  floor_level text NOT NULL DEFAULT '',
  main_door_direction text NOT NULL DEFAULT '',
  monthly_rent_paise bigint NOT NULL DEFAULT 0,
  rent_negotiable boolean NOT NULL DEFAULT false,
  maintenance_included boolean NOT NULL DEFAULT false,
  monthly_maintenance_paise bigint NOT NULL DEFAULT 0,
  security_deposit_paise bigint NOT NULL DEFAULT 0,
  available_from text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Draft'
    CHECK (status IN ('Active', 'Draft', 'Rented')),
  uploaded_by text
    CHECK (uploaded_by IS NULL OR uploaded_by IN ('owner', 'broker')),
  images_urls jsonb,
  images_legacy jsonb,
  listing_details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS properties_account_phone_role_idx
  ON public.properties (account_phone, account_role);

CREATE INDEX IF NOT EXISTS properties_status_idx
  ON public.properties (status);

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.properties FROM anon, authenticated;

-- Section 4 — property_co_owners
CREATE TABLE IF NOT EXISTS public.property_co_owners (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  property_id text NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  contact text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS property_co_owners_property_id_idx
  ON public.property_co_owners (property_id);

ALTER TABLE public.property_co_owners ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.property_co_owners FROM anon, authenticated;

-- Section 5 — tenants
CREATE TABLE IF NOT EXISTS public.tenants (
  id text PRIMARY KEY,
  account_phone text NOT NULL,
  account_role text NOT NULL,
  name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  who text,
  food text,
  city text,
  localities jsonb,
  property_type text,
  sharing text,
  roommate jsonb,
  identify jsonb,
  occupancy_from text,
  aadhaar_url text,
  pan_url text,
  status text NOT NULL DEFAULT 'Lead Added',
  invitation_sent boolean NOT NULL DEFAULT false,
  details_complete boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tenants_account_phone_role_idx
  ON public.tenants (account_phone, account_role);

CREATE INDEX IF NOT EXISTS tenants_phone_idx
  ON public.tenants (phone);

CREATE INDEX IF NOT EXISTS tenants_status_idx
  ON public.tenants (status);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.tenants FROM anon, authenticated;

-- Section 6 — agreements
CREATE TABLE IF NOT EXISTS public.agreements (
  id text PRIMARY KEY,
  account_phone text NOT NULL,
  account_role text NOT NULL,
  property_id text REFERENCES public.properties (id) ON DELETE SET NULL,
  property_title text NOT NULL DEFAULT '',
  owner_name text NOT NULL DEFAULT '',
  owner_contact text NOT NULL DEFAULT '',
  tenant_id text REFERENCES public.tenants (id) ON DELETE SET NULL,
  tenant_name text NOT NULL DEFAULT '',
  tenant_contact text NOT NULL DEFAULT '',
  tenant_aadhaar text,
  tenant_pan text,
  co_tenant_name text,
  co_tenant_contact text,
  start_date text NOT NULL DEFAULT '',
  end_date text,
  monthly_rent_paise bigint NOT NULL DEFAULT 0,
  security_deposit_paise bigint NOT NULL DEFAULT 0,
  lock_in_period text NOT NULL DEFAULT '',
  notice_period text NOT NULL DEFAULT '',
  rent_due_day text NOT NULL DEFAULT '',
  maintenance_charges_paise bigint NOT NULL DEFAULT 0,
  maintenance_included boolean NOT NULL DEFAULT false,
  brokerage_amount_paise bigint NOT NULL DEFAULT 0,
  brokerage_paid_by text,
  brokerage_mode text,
  rent_split_mode text,
  rent_splits jsonb,
  agreement_text text,
  status text NOT NULL DEFAULT 'Draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agreements_account_phone_role_idx
  ON public.agreements (account_phone, account_role);

CREATE INDEX IF NOT EXISTS agreements_property_id_idx
  ON public.agreements (property_id);

CREATE INDEX IF NOT EXISTS agreements_tenant_id_idx
  ON public.agreements (tenant_id);

CREATE INDEX IF NOT EXISTS agreements_status_idx
  ON public.agreements (status);

ALTER TABLE public.agreements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.agreements FROM anon, authenticated;

-- Section 7 — agreement_documents
CREATE TABLE IF NOT EXISTS public.agreement_documents (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  agreement_id text NOT NULL REFERENCES public.agreements (id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  file_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agreement_documents_agreement_id_idx
  ON public.agreement_documents (agreement_id);

ALTER TABLE public.agreement_documents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.agreement_documents FROM anon, authenticated;

-- Section 8 — property_inquiries
CREATE TABLE IF NOT EXISTS public.property_inquiries (
  id text PRIMARY KEY,
  account_phone text NOT NULL,
  account_role text NOT NULL,
  property_id text REFERENCES public.properties (id) ON DELETE SET NULL,
  property_label text NOT NULL DEFAULT '',
  name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  who text,
  food text,
  linkedin_url text,
  status text NOT NULL DEFAULT 'open',
  lead_status text,
  source text,
  shared_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS property_inquiries_account_phone_role_idx
  ON public.property_inquiries (account_phone, account_role);

CREATE INDEX IF NOT EXISTS property_inquiries_property_id_idx
  ON public.property_inquiries (property_id);

CREATE INDEX IF NOT EXISTS property_inquiries_status_idx
  ON public.property_inquiries (status);

CREATE INDEX IF NOT EXISTS property_inquiries_phone_idx
  ON public.property_inquiries (phone);

ALTER TABLE public.property_inquiries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.property_inquiries FROM anon, authenticated;

-- Section 9 — property_invites
CREATE TABLE IF NOT EXISTS public.property_invites (
  id text PRIMARY KEY,
  account_phone text NOT NULL,
  account_role text NOT NULL,
  property_id text REFERENCES public.properties (id) ON DELETE SET NULL,
  property_label text NOT NULL DEFAULT '',
  inquiry_id text REFERENCES public.property_inquiries (id) ON DELETE SET NULL,
  invitation_id text,
  name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  who text,
  food text,
  linkedin_url text,
  monthly_rent_paise bigint NOT NULL DEFAULT 0,
  maintenance_included boolean NOT NULL DEFAULT false,
  monthly_maintenance_paise bigint NOT NULL DEFAULT 0,
  security_deposit_paise bigint NOT NULL DEFAULT 0,
  start_date text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  rejected_at timestamptz
);

CREATE INDEX IF NOT EXISTS property_invites_account_phone_role_idx
  ON public.property_invites (account_phone, account_role);

CREATE INDEX IF NOT EXISTS property_invites_property_id_idx
  ON public.property_invites (property_id);

CREATE INDEX IF NOT EXISTS property_invites_inquiry_id_idx
  ON public.property_invites (inquiry_id);

CREATE INDEX IF NOT EXISTS property_invites_status_idx
  ON public.property_invites (status);

CREATE INDEX IF NOT EXISTS property_invites_phone_idx
  ON public.property_invites (phone);

ALTER TABLE public.property_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.property_invites FROM anon, authenticated;

-- Section 10 — maintenance_tickets
CREATE TABLE IF NOT EXISTS public.maintenance_tickets (
  id text PRIMARY KEY,
  account_phone text NOT NULL,
  account_role text NOT NULL,
  property_id text REFERENCES public.properties (id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open',
  priority text,
  raised_by text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS maintenance_tickets_account_phone_role_idx
  ON public.maintenance_tickets (account_phone, account_role);

CREATE INDEX IF NOT EXISTS maintenance_tickets_property_id_idx
  ON public.maintenance_tickets (property_id);

CREATE INDEX IF NOT EXISTS maintenance_tickets_status_idx
  ON public.maintenance_tickets (status);

ALTER TABLE public.maintenance_tickets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.maintenance_tickets FROM anon, authenticated;

-- Section 11 — documents
CREATE TABLE IF NOT EXISTS public.documents (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  account_phone text NOT NULL,
  account_role text NOT NULL,
  entity_type text NOT NULL
    CHECK (entity_type IN ('profile', 'property', 'agreement', 'tenant')),
  entity_id text NOT NULL,
  label text NOT NULL DEFAULT '',
  file_name text NOT NULL DEFAULT '',
  file_size bigint,
  file_url text,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS documents_account_phone_role_idx
  ON public.documents (account_phone, account_role);

CREATE INDEX IF NOT EXISTS documents_entity_type_entity_id_idx
  ON public.documents (entity_type, entity_id);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.documents FROM anon, authenticated;

-- Section 12 — broker_onboard_invites
CREATE TABLE IF NOT EXISTS public.broker_onboard_invites (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  broker_phone text NOT NULL,
  tenant_phone text NOT NULL,
  tenant_name text NOT NULL DEFAULT '',
  token text NOT NULL DEFAULT gen_random_uuid()::text UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS broker_onboard_invites_broker_phone_idx
  ON public.broker_onboard_invites (broker_phone);

CREATE INDEX IF NOT EXISTS broker_onboard_invites_tenant_phone_idx
  ON public.broker_onboard_invites (tenant_phone);

CREATE INDEX IF NOT EXISTS broker_onboard_invites_token_idx
  ON public.broker_onboard_invites (token);

CREATE INDEX IF NOT EXISTS broker_onboard_invites_status_idx
  ON public.broker_onboard_invites (status);

ALTER TABLE public.broker_onboard_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.broker_onboard_invites FROM anon, authenticated;

-- Section 13 — owner_payment_config
CREATE TABLE IF NOT EXISTS public.owner_payment_config (
  phone text PRIMARY KEY,
  razorpay_contact_id text,
  razorpay_fund_account_id text,
  razorpay_linked_account_id text,
  commission_rate_bps integer NOT NULL DEFAULT 0
    CHECK (commission_rate_bps >= 0 AND commission_rate_bps <= 10000),
  validation_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS owner_payment_config_phone_idx
  ON public.owner_payment_config (phone);

ALTER TABLE public.owner_payment_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.owner_payment_config FROM anon, authenticated;

-- Section 14 — rent_payments
CREATE TABLE IF NOT EXISTS public.rent_payments (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  agreement_id text REFERENCES public.agreements (id) ON DELETE SET NULL,
  property_id text REFERENCES public.properties (id) ON DELETE SET NULL,
  owner_phone text NOT NULL,
  tenant_phone text NOT NULL,
  rent_period text NOT NULL,
  amount_paise bigint NOT NULL,
  commission_paise bigint NOT NULL DEFAULT 0,
  owner_settlement_paise bigint NOT NULL DEFAULT 0,
  razorpay_order_id text,
  razorpay_payment_id text,
  razorpay_transfer_ids jsonb,
  initiated_by text,
  payer_phone text,
  status text NOT NULL DEFAULT 'created',
  paid_at timestamptz,
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agreement_id, rent_period)
);

CREATE INDEX IF NOT EXISTS rent_payments_agreement_id_idx
  ON public.rent_payments (agreement_id);

CREATE INDEX IF NOT EXISTS rent_payments_property_id_idx
  ON public.rent_payments (property_id);

CREATE INDEX IF NOT EXISTS rent_payments_owner_phone_idx
  ON public.rent_payments (owner_phone);

CREATE INDEX IF NOT EXISTS rent_payments_tenant_phone_idx
  ON public.rent_payments (tenant_phone);

CREATE INDEX IF NOT EXISTS rent_payments_status_idx
  ON public.rent_payments (status);

ALTER TABLE public.rent_payments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.rent_payments FROM anon, authenticated;

-- Section 15 — rent_payment_transfers
CREATE TABLE IF NOT EXISTS public.rent_payment_transfers (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  rent_payment_id text NOT NULL REFERENCES public.rent_payments (id) ON DELETE CASCADE,
  owner_phone text NOT NULL,
  owner_name text NOT NULL DEFAULT '',
  amount_paise bigint NOT NULL,
  razorpay_transfer_id text,
  razorpay_fund_account_id text,
  status text NOT NULL DEFAULT 'pending',
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rent_payment_transfers_rent_payment_id_idx
  ON public.rent_payment_transfers (rent_payment_id);

CREATE INDEX IF NOT EXISTS rent_payment_transfers_owner_phone_idx
  ON public.rent_payment_transfers (owner_phone);

CREATE INDEX IF NOT EXISTS rent_payment_transfers_status_idx
  ON public.rent_payment_transfers (status);

ALTER TABLE public.rent_payment_transfers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.rent_payment_transfers FROM anon, authenticated;
