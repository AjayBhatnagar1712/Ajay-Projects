-- agreement_parties.phone: allow E.164 (+…), migrate legacy bare 10-digit India rows.
-- Replaces CHECK phone ~ '^[0-9]{10}$' which blocked international numbers.

ALTER TABLE public.agreement_parties
  DROP CONSTRAINT IF EXISTS agreement_parties_phone_10_digits;

-- Existing mobile rows are bare 10-digit India numbers (Zod last-10 normalize).
UPDATE public.agreement_parties
SET phone = '+91' || phone
WHERE phone ~ '^[0-9]{10}$';

ALTER TABLE public.agreement_parties
  ADD CONSTRAINT agreement_parties_phone_e164
  CHECK (phone ~ '^\+[1-9][0-9]{7,14}$');

COMMENT ON COLUMN public.agreement_parties.phone IS
  'Party phone in E.164 (e.g. +919876543210). Used for contact / future Leegality invitees; not printed in the PDF party block.';
