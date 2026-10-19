-- Phase 0: mobile lease agreements parent + parties + per-room inventory.
-- Staging first — do not apply to production until promoted.
-- Does NOT modify public.agreements (web blob-mirror).
--
-- App-enforced (Zod / API handlers — not DB CHECKs):
--   * Signer count 2–5 per lease_agreements row
--   * At least one owner and one tenant among agreement_parties
-- Phone is normalized to 10 digits at insert; DB enforces shape only.

-- ---------------------------------------------------------------------------
-- lease_agreements (mobile-clean parent)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lease_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lease_agreements_created_by_user_id_idx
  ON public.lease_agreements (created_by_user_id);

ALTER TABLE public.lease_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lease_agreements FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.lease_agreements FROM anon, authenticated;

CREATE POLICY "lease_agreements_select_own" ON public.lease_agreements
  FOR SELECT
  TO authenticated
  USING (auth.uid() = created_by_user_id);

CREATE POLICY "lease_agreements_insert_own" ON public.lease_agreements
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "lease_agreements_update_own" ON public.lease_agreements
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by_user_id)
  WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "lease_agreements_delete_own" ON public.lease_agreements
  FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by_user_id);

-- ---------------------------------------------------------------------------
-- agreement_parties
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agreement_parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id uuid NOT NULL REFERENCES public.lease_agreements (id) ON DELETE CASCADE,
  role text NOT NULL,
  name text NOT NULL,
  phone text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agreement_parties_role_valid CHECK (role IN ('owner', 'tenant')),
  CONSTRAINT agreement_parties_phone_10_digits CHECK (phone ~ '^[0-9]{10}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS agreement_parties_agreement_phone_uidx
  ON public.agreement_parties (agreement_id, phone);

-- At most one is_primary = true per (agreement_id, role).
CREATE UNIQUE INDEX IF NOT EXISTS agreement_parties_one_primary_per_role_uidx
  ON public.agreement_parties (agreement_id, role)
  WHERE is_primary;

CREATE INDEX IF NOT EXISTS agreement_parties_agreement_id_idx
  ON public.agreement_parties (agreement_id);

ALTER TABLE public.agreement_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agreement_parties FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.agreement_parties FROM anon, authenticated;

CREATE POLICY "agreement_parties_select_own" ON public.agreement_parties
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.lease_agreements a
      WHERE a.id = agreement_parties.agreement_id
        AND a.created_by_user_id = auth.uid()
    )
  );

CREATE POLICY "agreement_parties_insert_own" ON public.agreement_parties
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.lease_agreements a
      WHERE a.id = agreement_parties.agreement_id
        AND a.created_by_user_id = auth.uid()
    )
  );

CREATE POLICY "agreement_parties_update_own" ON public.agreement_parties
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.lease_agreements a
      WHERE a.id = agreement_parties.agreement_id
        AND a.created_by_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.lease_agreements a
      WHERE a.id = agreement_parties.agreement_id
        AND a.created_by_user_id = auth.uid()
    )
  );

CREATE POLICY "agreement_parties_delete_own" ON public.agreement_parties
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.lease_agreements a
      WHERE a.id = agreement_parties.agreement_id
        AND a.created_by_user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- agreement_rooms
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agreement_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id uuid NOT NULL REFERENCES public.lease_agreements (id) ON DELETE CASCADE,
  label text NOT NULL,
  room_kind text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agreement_rooms_kind_valid CHECK (
    room_kind IS NULL
    OR room_kind IN (
      'bedroom',
      'kitchen',
      'living_room',
      'bathroom',
      'balcony',
      'dining',
      'other'
    )
  )
);

CREATE INDEX IF NOT EXISTS agreement_rooms_agreement_id_idx
  ON public.agreement_rooms (agreement_id);

ALTER TABLE public.agreement_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agreement_rooms FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.agreement_rooms FROM anon, authenticated;

CREATE POLICY "agreement_rooms_select_own" ON public.agreement_rooms
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.lease_agreements a
      WHERE a.id = agreement_rooms.agreement_id
        AND a.created_by_user_id = auth.uid()
    )
  );

CREATE POLICY "agreement_rooms_insert_own" ON public.agreement_rooms
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.lease_agreements a
      WHERE a.id = agreement_rooms.agreement_id
        AND a.created_by_user_id = auth.uid()
    )
  );

CREATE POLICY "agreement_rooms_update_own" ON public.agreement_rooms
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.lease_agreements a
      WHERE a.id = agreement_rooms.agreement_id
        AND a.created_by_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.lease_agreements a
      WHERE a.id = agreement_rooms.agreement_id
        AND a.created_by_user_id = auth.uid()
    )
  );

CREATE POLICY "agreement_rooms_delete_own" ON public.agreement_rooms
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.lease_agreements a
      WHERE a.id = agreement_rooms.agreement_id
        AND a.created_by_user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- agreement_room_items
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agreement_room_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.agreement_rooms (id) ON DELETE CASCADE,
  item text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  condition text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agreement_room_items_quantity_positive CHECK (quantity > 0),
  CONSTRAINT agreement_room_items_condition_valid CHECK (
    condition IS NULL
    OR condition IN ('good', 'working', 'damaged', 'needs_repair')
  )
);

CREATE INDEX IF NOT EXISTS agreement_room_items_room_id_idx
  ON public.agreement_room_items (room_id);

ALTER TABLE public.agreement_room_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agreement_room_items FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.agreement_room_items FROM anon, authenticated;

CREATE POLICY "agreement_room_items_select_own" ON public.agreement_room_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.agreement_rooms r
      JOIN public.lease_agreements a ON a.id = r.agreement_id
      WHERE r.id = agreement_room_items.room_id
        AND a.created_by_user_id = auth.uid()
    )
  );

CREATE POLICY "agreement_room_items_insert_own" ON public.agreement_room_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.agreement_rooms r
      JOIN public.lease_agreements a ON a.id = r.agreement_id
      WHERE r.id = agreement_room_items.room_id
        AND a.created_by_user_id = auth.uid()
    )
  );

CREATE POLICY "agreement_room_items_update_own" ON public.agreement_room_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.agreement_rooms r
      JOIN public.lease_agreements a ON a.id = r.agreement_id
      WHERE r.id = agreement_room_items.room_id
        AND a.created_by_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.agreement_rooms r
      JOIN public.lease_agreements a ON a.id = r.agreement_id
      WHERE r.id = agreement_room_items.room_id
        AND a.created_by_user_id = auth.uid()
    )
  );

CREATE POLICY "agreement_room_items_delete_own" ON public.agreement_room_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.agreement_rooms r
      JOIN public.lease_agreements a ON a.id = r.agreement_id
      WHERE r.id = agreement_room_items.room_id
        AND a.created_by_user_id = auth.uid()
    )
  );
