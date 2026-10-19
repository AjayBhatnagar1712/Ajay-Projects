# Security architecture

TrustKeyper uses **Supabase phone OTP** for identity and **JWT-gated sync API** for cloud data.

## Sync API access model

| Route | Auth | Purpose |
|-------|------|---------|
| `GET .../exists` | Public | Pre-OTP signup/login checks |
| `GET .../roles` | Public | Role picker before session |
| `GET .../summaries` | Public | Account summaries for marketing welcome-back |
| `GET .../:role` | JWT required | Pull account blob |
| `PUT .../:role` | JWT required | Bulk save |
| `PUT .../:role/:key` | JWT required | Single key save |

When `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set on the server, protected routes call `assertSyncAccountAuth` in `@workspace/auth-server`, which:

1. Validates the Bearer token via `supabase.auth.getUser(token)`
2. Extracts the user's phone from Supabase Auth
3. Requires an exact match with the `:phone` path segment

Set `SYNC_AUTH_DISABLED=1` only for local mock demos without Supabase server env.

## Marketing CORS allowlist

Cross-origin browser calls from the marketing site are gated by `api/_lib/marketingCors.ts`.

**Allowed origins:**
- `https://trustkeyper.com`
- `https://www.trustkeyper.com`
- `https://staging.trustkeyper.com`
- `https://trustkeyper-website.vercel.app`
- `https://trustkeyper-marketing.vercel.app`
- `http://localhost:5174`
- optional `MARKETING_STAGING_ORIGIN` (server env on the app project — extra stable staging/alias URL)

**Allowed route surface (not the full API):**
- `GET /api/sync/accounts/:phone/roles`
- `GET /api/sync/accounts/:phone/summaries`
- `PUT /api/sync/accounts/:phone/:role/profile` (and OPTIONS)
- `POST /api/contact` (and OPTIONS)

**Known limitation:** Per-deployment Vercel **preview URLs are not allowlisted** unless listed above or set via `MARKETING_STAGING_ORIGIN`. Preview-branch marketing builds that call the app API will fail CORS unless they use an allowlisted origin.

## Public discovery endpoints (open item)

`GET .../roles` and `GET .../summaries` are **unauthenticated** and enumerable by phone number (needed for marketing login discovery).

**Ops note (as of 2026-07):** Vercel Deployment Protection is **OFF** on the app project (`trustkeyper`), so these routes are reachable on the public app host without Vercel auth gating. Rate limiting is **deferred** (future: Vercel middleware / edge / Upstash). Treat hardening as an open security item — do not silently expand the public surface.

## Postgres `user_data`

- RLS is **enabled** with no `anon`/`authenticated` policies (see `supabase/migrations/`).
- Production API uses a direct Postgres connection; app-layer JWT checks are the primary control.
- RLS is defense in depth if the table is ever exposed via Supabase Data API.

## Payment error logging

Razorpay Route responses can include stakeholder **KYC and bank PII**. Server handlers must log via `sanitizeErrorForLog` (`api/_lib/sanitizeErrorForLog.ts`) — **message** and optional **code** only.

**Never** log raw error objects, `JSON.stringify(err)`, or Razorpay payload dumps in application logs. Custom `toString` / nested `error` objects can leak PII.

## Local Razorpay spike script

`scripts/spike-razorpay-account.ts` is a **local-only** manual spike. It is not imported by the app, CI, or deploys. It logs **full** Razorpay API responses (including KYC/bank fields) and creates real linked accounts on whichever Razorpay account the credentials belong to.

**Never run it against live/production credentials.** Use test/sandbox keys only.

## Environment (production)

| Variable | Scope |
|----------|--------|
| `VITE_SUPABASE_URL` | Browser (app and marketing). Marketing Production and app Production both use Supabase project `dsqhifabykbtqvzvogdt` (verified from the marketing Production bundle). Marketing previously used staging Supabase; the switch to prod is required for cross-origin login/handoff. |
| `VITE_SUPABASE_ANON_KEY` | Browser |
| `SUPABASE_URL` | Server (app project; JWT verify — same prod project in Production) |
| `SUPABASE_ANON_KEY` | Server (JWT verify only) |
| `DATABASE_URL` | Server only |
| `MARKETING_STAGING_ORIGIN` | Server only (CORS) |
| `VITE_MARKETING_URL` | App browser — **keep unset on app Production** until handoff is validated (see CONTRIBUTING.md) |

Never put `service_role` or `DATABASE_URL` in `VITE_*` variables.

## Future scalability

- **Rate limiting** on public `/exists`, `/roles`, and `/summaries` (Vercel middleware or edge)
- **`auth_user_id` column** on `user_data` when moving off phone-as-key
- **Supabase RLS policies** if sync moves to client SDK + PostgREST
- **Audit log** table for sync writes
- **Preview CORS** strategy if marketing previews must call the app API
