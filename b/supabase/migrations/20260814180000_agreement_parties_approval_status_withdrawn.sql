-- Allow a party to withdraw a prior approval on a live review link.
-- Staging first — do not apply to production until promoted.
-- Additive: existing pending / approved / changes_requested rows stay valid.

ALTER TABLE public.agreement_parties
  DROP CONSTRAINT IF EXISTS agreement_parties_approval_status_valid;

ALTER TABLE public.agreement_parties
  ADD CONSTRAINT agreement_parties_approval_status_valid
  CHECK (approval_status IN (
    'pending', 'approved', 'changes_requested', 'withdrawn'
  ));
