-- Schema correction vs Aman's real rent-agreement template.
-- Staging first — do not apply to production until promoted.
--
-- 1. Collapse inventory: drop unused two-level rooms/items → flat agreement_inventory_items
-- 2. Add party fields used in real party blocks + signature email
-- 3. Add commercial / property columns deferred from Phase 0

-- ---------------------------------------------------------------------------
-- 1. Drop two-level inventory (unused; no production data)
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS public.agreement_room_items;
DROP TABLE IF EXISTS public.agreement_rooms;

-- ---------------------------------------------------------------------------
-- 1b. Flat inventory (Annexure-1 style free-text lines)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agreement_inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id uuid NOT NULL REFERENCES public.lease_agreements (id) ON DELETE CASCADE,
  description text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agreement_inventory_items_agreement_id_idx
  ON public.agreement_inventory_items (agreement_id);

ALTER TABLE public.agreement_inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agreement_inventory_items FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.agreement_inventory_items FROM anon, authenticated;

CREATE POLICY "agreement_inventory_items_select_own" ON public.agreement_inventory_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.lease_agreements a
      WHERE a.id = agreement_inventory_items.agreement_id
        AND a.created_by_user_id = auth.uid()
    )
  );

CREATE POLICY "agreement_inventory_items_insert_own" ON public.agreement_inventory_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.lease_agreements a
      WHERE a.id = agreement_inventory_items.agreement_id
        AND a.created_by_user_id = auth.uid()
    )
  );

CREATE POLICY "agreement_inventory_items_update_own" ON public.agreement_inventory_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.lease_agreements a
      WHERE a.id = agreement_inventory_items.agreement_id
        AND a.created_by_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.lease_agreements a
      WHERE a.id = agreement_inventory_items.agreement_id
        AND a.created_by_user_id = auth.uid()
    )
  );

CREATE POLICY "agreement_inventory_items_delete_own" ON public.agreement_inventory_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.lease_agreements a
      WHERE a.id = agreement_inventory_items.agreement_id
        AND a.created_by_user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 2. agreement_parties — fields from real party / KYC / signature blocks
-- ---------------------------------------------------------------------------
ALTER TABLE public.agreement_parties
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS age integer,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS aadhaar text,
  ADD COLUMN IF NOT EXISTS pan text,
  ADD COLUMN IF NOT EXISTS email text;

-- ---------------------------------------------------------------------------
-- 3. lease_agreements — commercial + property (nullable until creation flow fills)
-- ---------------------------------------------------------------------------
ALTER TABLE public.lease_agreements
  ADD COLUMN IF NOT EXISTS execution_date date,
  ADD COLUMN IF NOT EXISTS effective_date date,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS execution_city text,
  ADD COLUMN IF NOT EXISTS duration_months integer,
  ADD COLUMN IF NOT EXISTS min_stay_months integer,
  ADD COLUMN IF NOT EXISTS notice_period_licensee_months integer,
  ADD COLUMN IF NOT EXISTS notice_period_licensor_months integer,
  ADD COLUMN IF NOT EXISTS monthly_rent_paise integer,
  ADD COLUMN IF NOT EXISTS security_deposit_paise integer,
  ADD COLUMN IF NOT EXISTS rent_due_day integer,
  ADD COLUMN IF NOT EXISTS property_address text,
  ADD COLUMN IF NOT EXISTS area_sqft numeric,
  ADD COLUMN IF NOT EXISTS facing text,
  ADD COLUMN IF NOT EXISTS car_parking_count integer;
