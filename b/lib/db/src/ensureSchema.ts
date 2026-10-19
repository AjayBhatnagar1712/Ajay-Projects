/** Idempotent schema for local PGLite / manual bootstrap when drizzle-kit push is unavailable. */
export const USER_DATA_DDL = `
CREATE TABLE IF NOT EXISTS "user_data" (
  "phone" text NOT NULL,
  "role" text NOT NULL,
  "data_key" text NOT NULL,
  "value" text NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "user_data_phone_role_data_key_pk" PRIMARY KEY("phone","role","data_key")
);
`;

/** Defense in depth when the table is reachable via Supabase Data API or a limited DB role. */
export const USER_DATA_RLS_DDL = `
ALTER TABLE "user_data" ENABLE ROW LEVEL SECURITY;
`;

export const TENANT_INVITATIONS_DDL = `
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
`;

export async function ensureUserDataTable(exec: (sql: string) => Promise<unknown>): Promise<void> {
  await exec(USER_DATA_DDL);
  await exec(USER_DATA_RLS_DDL);
}

export async function ensureTenantInvitationsTable(
  exec: (sql: string) => Promise<unknown>,
): Promise<void> {
  await exec(TENANT_INVITATIONS_DDL);
}
