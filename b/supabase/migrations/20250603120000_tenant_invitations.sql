-- Public tenant invitation records (token-based accept/decline, no tenant auth).

CREATE TABLE IF NOT EXISTS public.tenant_invitations (
  id text PRIMARY KEY,
  token text NOT NULL UNIQUE,
  owner_phone text NOT NULL,
  owner_name text NOT NULL,
  property_id text NOT NULL,
  property_label text NOT NULL,
  tenant_name text NOT NULL,
  tenant_phone text NOT NULL,
  monthly_rent text NOT NULL DEFAULT '',
  maintenance_included boolean NOT NULL DEFAULT false,
  monthly_maintenance text NOT NULL DEFAULT '',
  security_deposit text NOT NULL DEFAULT '',
  start_date text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  declined_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tenant_invitations_owner_phone_idx
  ON public.tenant_invitations (owner_phone);

CREATE INDEX IF NOT EXISTS tenant_invitations_token_idx
  ON public.tenant_invitations (token);

ALTER TABLE public.tenant_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.tenant_invitations FROM anon, authenticated;
