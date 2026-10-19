# Auth — marketing and app

TrustKeyper currently has **two browser auth entry systems** against the **same** Supabase Auth project in production (phone OTP). Marketing Production and app Production both use project `dsqhifabykbtqvzvogdt`. This is intentional for the marketing launch and is known architectural debt.

## Two systems

| Surface | Where | Entry UX |
|---|---|---|
| **App** | `artifacts/trustkeyper` · app.trustkeyper.com | `/login`, `/signup/*` pages (wrapped by `AppAuthEntryRedirect` when `VITE_MARKETING_URL` is set) |
| **Marketing** | `artifacts/website` · trustkeyper.com | Auth **modal** + `/login/existing` + `/signup/role`, `/signup/owner`, `/signup/broker` |

Both call `supabase.auth.signInWithOtp` / `verifyOtp` with `+91` phone numbers. SMS is delivered by the Supabase-configured provider (Twilio Verify + Indian DLT). Staging test numbers use Supabase’s allowlist and bypass the provider (OTP `123456` — see TESTING.md).

### Session storage is per-origin

Both clients use Supabase `storageKey: "tk-auth-session"`, but **localStorage is origin-scoped**. Completing OTP on trustkeyper.com does **not** create a session on app.trustkeyper.com. Crossing origins requires an explicit handoff.

## Marketing → app handoff

Implemented in:

- Marketing: `artifacts/website/src/lib/marketingAppRoutes.ts` + `marketingSessionHandoff.ts`
- App: `artifacts/trustkeyper/src/lib/marketingHandoff.ts` + `MarketingHandoffGate`

**URL shape:**

- **Query:** `from=marketing`, `phone`, `role`, optional `remember=1` (and signup flags where applicable)
- **Hash:** `#tk_session=<urlencoded base64 JSON>` with `access_token` and optional `refresh_token`

**Gate placement:** `MarketingHandoffGate` wraps **above** `WouterRouter` in `App.tsx` and blocks all route rendering until the handoff resolves. On success it applies the session then `history.replaceState` to pathname only. On failure it clears the URL, stores `tk_marketing_handoff_error`, and navigates to `/login`.

**Why the gate exists (PR #143):** `OwnerLayout` / `BrokerLayout` / `TenantLayout` guard effects ran before handoff applied, called `setLocation("/login")`, and wouter’s `pushState` discarded the query/hash (session tokens lost). The gate prevents those layouts from mounting until handoff finishes.

## App `/login` as recovery

Do **not** remove the app’s `/login` (and related signup pages) until the marketing modal path has been proven reliable in production over time. Failed handoffs and users who bookmark app URLs still need an in-app recovery path.

When `VITE_MARKETING_URL` is set, `AppAuthEntryRedirect` immediately sends `/login` and `/signup` traffic to the marketing site. Keep that env **unset on app Production** until handoff is validated — otherwise failed handoffs can loop (see CONTRIBUTING.md).

## Consolidation (later)

Long-term, prefer a single auth entry UX (likely marketing-owned) with the app consuming handoff only. Until then, treat dual OTP UIs as debt: shared Supabase project, duplicated UX/code paths, careful env discipline across two Vercel projects.
