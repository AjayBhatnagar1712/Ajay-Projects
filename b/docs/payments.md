# Payments — Razorpay Route notes

Operational notes and resolved issues for TrustKeyper's Razorpay Route
integration. Keep this file updated when onboarding or settlement behaviour
surprises us in staging or production.

---

## Phone OTP provider (related ops)

Auth SMS is **not** part of Razorpay, but it shares the same staging/production
ops surface. Phone OTP migrated from **Vonage** to **Twilio Verify** (with
Indian DLT registration), configured in the Supabase Auth SMS settings — app
code still only calls Supabase.

Supabase’s **test phone number allowlist** bypasses the SMS provider entirely
(staging OTP `123456`). See TESTING.md. Do not expect Twilio delivery for
allowlisted numbers.

---

## Invalid housing subcategory (`real_estate_agents`)

**Reference:** Razorpay ticket #19705336 · PRs #130, #131 · 2026-07-08

### Issue
Route account creation with `profile.subcategory: "real_estate_agents"` caused
accounts to stay at `activation_status: "needs_clarification"` indefinitely,
with an empty `requirements` array (no actionable guidance from the API).

### Root cause
`real_estate_agents` is not a valid Razorpay subcategory. Per Razorpay's
official Route integration docs (Appendix: Business Sub-Category table), the
valid subcategories under category `housing` are:
- `developer`
- `facility_management`
- `rwa`
- `coworking`
- `realestate_classifieds`
- `space_rental`

TrustKeyper's model (individual property owners collecting rent via the
platform) maps to `space_rental`.

### Fix
Changed `profile.subcategory` to `space_rental` in `buildRazorpayAccountPayload()`
(`api/_lib/paymentOnboardHandler.ts`) and the corresponding
`business_subcategory` value in the DB insert. Confirmed end-to-end: a fresh
test account went from `needs_clarification` to `activated` within seconds of
correcting this value. **PR #130.**

### Related notes
- **`business_type` display:** Continues to show as `not_yet_registered` in the
  Razorpay account object response even when `individual` is submitted and
  correctly stored, and even after the account fully activates. This appears to
  be expected/cosmetic behaviour on Razorpay's side, not an error — do not treat
  this field as an activation blocker.
- **Bank beneficiary name:** `bankBeneficiaryName` / `settlements.beneficiary_name`
  submitted during product configuration must match the KYC-verified stakeholder
  name exactly, or the account gets stuck in `under_review` / DB `submitted`.
  Confirmed via staging phone `9000000024` during testing.
- **Stale `validation_status` / missed webhooks:** Our DB `validation_status` can
  go stale if a Razorpay webhook is missed. Added
  `syncRecipientValidationFromRazorpay()` (`api/_lib/razorpayRouteHelpers.ts`),
  which re-fetches Route product status and mirrors it whenever the onboarding
  status endpoint is hit, so the app self-heals even without a webhook.
  **PR #131.**

---

## Mobile lease portal (owner / tenant)

- **UPI as owner payout:** Not supported on Razorpay Route linked accounts.
  Settlements are bank account + IFSC only. UPI VPA belongs to RazorpayX Payouts —
  out of scope for the portal payout setup. Bank-only for now.
- **Brokerage fee:** Stored as `lease_agreements.brokerage_fee_paise` (set on Terms
  step). Tenant pays once after signing via
  `POST /api/payments-create-lease-brokerage-order` with Route transfer
  `on_hold: 0` to the **broker** linked account (broker must be Route-activated).
- **Monthly rent:** `POST /api/payments-create-lease-rent-order` transfers to the
  **owner** linked account with `on_hold: 0` (no escrow).
- **`transfer.*` webhooks:** Still a Razorpay Dashboard enablement task for Sumit.

## Calendar-month rent billing (confirmed 2026-09-10)

Ajay confirmed Aman's rule and the exact examples below. This supersedes the
earlier anniversary-to-anniversary proposal and the temporary shared-month block.

- Each signed agreement is billed separately within each calendar month. Per
  the confirmed business rule, a mid-month start on day `D` bills
  `days-in-month - D`; calendar-start and final partial months include their
  covered end day. Amount = monthly rent * billed days / actual days in that
  month, rounded once to the nearest paise. No fixed 30-day divisor.
- Calendar-start bills are payable through the 5th, inclusive. A mid-month start
  is payable through start date + 5 calendar days, including month/year rollover.
  Dates and late status use Asia/Kolkata. There is no automatic late fee.
- Example: 10 Sep 2026 to 10 Aug 2027 gives 20/30 of rent for September (due
  15 Sep); full rent October-July (due on each 5th); 10/31 for August (due 5 Aug).
  Renewal from 11 Aug gives 20/31 at the new agreement's rate, due 16 Aug.
- Renewal starts after the old inclusive end date. Two agreements may bill
  different days in the same month. Actual overlapping days still require review.
- Bills appear from the coverage start date. Unpaid past bills remain payable
  after month rollover and agreement expiry. This is an in-app bill schedule;
  no PDF invoice generation, scheduled email, SMS or push delivery is added.
- Checkout, portal amounts and late markers use the same calculation. Completed
  ledger amounts are preserved, never retrospectively repriced. Existing gateway
  orders with incompatible amounts require manual review, not replacement.
- Rent retries reuse the recorded Razorpay order. A transaction serializes rent
  checkouts per agreement; paid/settled/received rent cannot be reset by checkout.
  This change does not modify the separate consultancy-fee order handler.
- New drafts, edited drafts and renewals use day 5 for monthly payment terms.
  Existing signed PDF files are not rewritten. Agreement start/end inputs remain
  the contract dates; the confirmed eleven-month example renews to 11 July 2028.
- Before rollout, reconcile any historical/offline payments against the ledger:
  absence of a payment record means an issued bill is outstanding. Confirm the
  existing portal and renewal migrations are deployed; no new schema is required.
