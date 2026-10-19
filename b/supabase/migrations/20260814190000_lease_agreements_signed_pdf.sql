-- Additive: store the private Blob key and audit timestamps for signed lease PDFs.
-- Status remains app-enforced; these columns do not change the status CHECK.

ALTER TABLE public.lease_agreements
  ADD COLUMN IF NOT EXISTS signed_pdf_pathname text,
  ADD COLUMN IF NOT EXISTS signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS signed_uploaded_by_phone text,
  ADD COLUMN IF NOT EXISTS signing_notified_at timestamptz;
