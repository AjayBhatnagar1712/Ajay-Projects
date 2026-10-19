-- agreement_inventory_items: structured quantity (leave existing descriptions as-is).
-- Existing rows keep description text unchanged; quantity defaults to 1.

ALTER TABLE public.agreement_inventory_items
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1;

ALTER TABLE public.agreement_inventory_items
  DROP CONSTRAINT IF EXISTS agreement_inventory_items_quantity_positive;

ALTER TABLE public.agreement_inventory_items
  ADD CONSTRAINT agreement_inventory_items_quantity_positive
  CHECK (quantity >= 1);

COMMENT ON COLUMN public.agreement_inventory_items.quantity IS
  'Positive item count for Annexure-1. Legacy rows default to 1; description is not parsed.';

COMMENT ON COLUMN public.agreement_inventory_items.description IS
  'Fixture/fitting description without quantity (quantity lives in quantity column).';
