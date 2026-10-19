# Open Items

Deliberately deferred work, tracked so "later, on purpose" doesn't become "forgotten."
Last reconciled: 2026-09-11. See [handoff status](./handoff-status.md) for
verified branch state versus historical dashboard reports.

## Observability / Sentry

- **Performance tracing and profiling are deliberately deferred.** The first
  Sentry rollout captures App browser errors only; it does not enable tracing,
  profiling, Session Replay, logs, or user feedback. Microsoft Clarity remains
  the user-session tool. Revisit tracing/profiling only after error monitoring
  is stable and its privacy, event-volume, and quota baseline has been reviewed.
- **Later rollout surfaces:** the marketing website and the mobile app remain
  intentionally outside the Sentry rollout. Server/API errors are now staged as
  the second rollout surface; validate source maps and privacy on staging before
  treating that surface as complete.

## Mobile notifications / activity history

- **Real activity / audit log (not built).** Today's bell + Home alerts are
  **derived live** from agreement rows (`in_review` + `changes_requested` /
  all-approved → ready to send). They are not a historical feed and do not
  persist. A genuine activity log needs a new `events` (or similar) table and
  writes wired into every existing mutation (created, edited, sent for review,
  approved, changes requested, signed, etc.), plus list/query APIs and UI.
  Do not bolt timestamps onto the current derived alerts as a substitute.
  This is a deliberate, correct v1 scope choice — not a bug.

## Design system / mobile theming

- **No brand error/red family in Figma.** The TrustKeyper Colors collection
  (`Primary/Azure`, `Primary/Emerald`, `Accent/{Sapphire,Cloud,Sea}`, `Neutral/*`)
  has no error, danger, rose, or red scale. Mobile keeps Material 3 defaults
  (`#B3261E` / `#F9DEDC`) via `apps/mobile/lib/theme/colors.ts` `md3Error`.
  Propico-in library reds in the same Figma file are a different product — do not
  adopt. **Needs a deliberate brand error palette before treating error chrome as
  final.**
- **No brand warning/amber family in Figma.** Workflow attention (e.g. party
  requested changes) must not use `error` red. Thin amber borders also read as
  alarm at 1–2px, so Home / Notifications “needs attention” cards use **primary
  azure** (`#305EFF`) — actionable, not broken. `interimWarning` (`#B45309` /
  `#FEF3C7`) remains exported from `colors.ts` but is **unused** by theme /
  shell chrome; Alert `notice` still uses its own provisional hexes.
  **Needs a deliberate brand warning palette in Figma before treating amber as
  final.**
- **Emerald has no dark steps (only 050–400).** Success fills use `emerald-400` /
  `emerald-050`. `colors.onSuccess` is navy `#192839` (passes 7.60:1 on
  emerald-400; white fails at 1.97:1). There is still no dark green in-family
  for “green-on-green” treatments if design wants that later.
- **Muted text accessibility:** Figma Neutral Light/600 `#768EA7` fails WCAG AA
  for body text on white (~3.4:1). App theme maps `onSurfaceVariant` to Light/800
  `#58728D` (`mutedTextAccessible`); keep `#768EA7` for large/decorative only.

## Mobile UX / onboarding

- **Android keyboard inset (CreationStepLayout / AuthScreenLayout):** Footer pads by keyboard height only when the window did **not** resize (Expo Go / edge-to-edge overlay). When `softwareKeyboardLayoutMode: "resize"` actually shrinks the window on a custom build, inset stays 0 to avoid the onboarding double-gap. `app.json` resize is app-wide but does **not** apply inside Expo Go — confirm both Expo Go and a native build after changes.
- **Local `dev:mobile` web bundling:** separate unrelated `react-native-pager-view` / `codegenNativeCommands` failure from `intro.tsx` — not blocking native builds; deferred.
- **Google Places Autocomplete for onboarding Step 4 (Your work location).** Built on
  `feature/work-location-redesign`: server proxy (`/api/v1/location-autocomplete`,
  `/api/v1/location-details`), India-biased, no device GPS, multi-select chips +
  manual fallback. **Blocked on GCP:** Sumit must enable Places API (New), create a
  server-restricted `GOOGLE_PLACES_API_KEY`, and set it on Vercel (and local `.env`)
  before end-to-end autocomplete can be tested. Manual entry works without the key.
- **Intro carousel uses branded icon illustrations** (Material icons on azure
  discs), not real photography/imagery. Acceptable placeholder per Sumit's
  review; revisit once real property/broker imagery is available.
- **Referral tracking / deep links (deferred).** Profile “Refer a friend” is a
  plain native share of marketing copy + `https://trustkeyper.com` — no referral
  code, no personalization, no install attribution. Full referral tracking needs
  a third-party deep-link / deferred-deep-link service (e.g. ChottuLink, Branch):
  a plain URL cannot survive an App Store / Play Store install and still carry a
  referrer. **Deliberately deferred** until that infrastructure is chosen.

## Agreement details / PDF

- **PDF generation silently drops non-WinAnsi characters.** After the preview
  500 fix (PR #223), emoji, CJK, and most symbols beyond Western Latin-1 accents
  (`é`, etc. are kept) are **silently removed** from party names, addresses, and
  inventory descriptions when generating the PDF — no broker warning, no visible
  marker (not replaced with `?`). A legal document can end up missing characters
  the broker actually typed. Fix options: (a) client-side validation rejecting
  non-WinAnsi input before submission, or (b) switch the PDF generator to a
  Unicode-capable font (e.g. General Sans / Roboto, already used elsewhere in
  the app) so nothing needs to be dropped. **(b) is the more correct long-term
  fix.**
- **Start + Duration → auto-derive End** was discussed and deliberately **not**
  built. Current direction (Start + End as inputs; Duration calculated and shown
  as read-only “X months and Y days”, including leap-year and month-end clamping
  regression tests) is verified correct and is staying as-is. The alternative
  remains a legitimate future UX option if broker feedback asks for it — **not
  planned work right now.**

## eSign / Leegality (mobile)

Source of truth for decided scope: [`docs/esign-decisions.md`](./esign-decisions.md).
Do not implement against assumptions that contradict that file.

### Deferred with review-flow ship (updated 2026-07-30)

- **Leegality send / webhook / workflow setup** — deferred entirely for now.
  After all parties approve in the lightweight review flow, the broker sends the
  approved document to Aman/admin. Aman/admin stamps it manually, uploads the
  final signed PDF, and delivers it to the customer or broker.
  Do not build Leegality client calls, webhook handlers, or production
  workflow/`profileId` wiring until this is un-deferred.
- **Broker self-declaration of signed status is already blocked.** The status
  endpoint rejects a broker request to mark signed. Admin signed-PDF upload is
  the completion path; automated provider completion is still deferred.
- **Leegality party phone format.** Party phones are stored as international
  E.164, but Leegality (when integrated) expects India-format **10-digit**
  invitee numbers. Strip/adapt E.164 at send time — **do not** send `+91…` as-is
  to Leegality's API.
- **Stamp-paper visual on Document Preview (Figma stub only).** Figma frame
  `1110:1689` / Document Preview includes a “GOVERNMENT OF … E-STAMP SECURED”
  header placeholder on the Legal Document Paper card. Mobile preview keeps the
  real PDF.js WebView (no stylized stub). Do **not** ship that Figma chrome until
  stamp-paper / Leegality eStamping is decided (see `docs/esign-decisions.md` —
  still deferred with Aman). When built, render it as part of the generated PDF
  (or a deliberate preview overlay tied to that product decision), not as fake
  copy around the WebView.
- **Phase 4 — single Leegality workflow setup (production dashboard)** — configure
  **one** workflow with **5 blank invitee slots** (name/email/phone empty), place
  signature coordinates for all 5 slots (every page, bottom-left flowing right
  then up), then capture `profileId` + auth token + private salt. Requires a
  sample PDF from Phase 1 first. No per-count workflows. Blocked behind the
  Leegality deferral above.

### Parked (non-blocking)

- **Web / mobile agreement divergence** — web remains on blob + manual-upload
  eSign; mobile uses relational + (eventually) Leegality. Divergence until web
  migrates to the API-first model. Support/product must not assume a shared list.
- **Owner identity reuse (per-property)** — owners are embedded per-property with
  no deduplication; accepted for v1, revisit when owners become first-class.
- **Records tab Owners/Tenants cross-agreement identity** — parties are
  phone-deduplicated with `alternateNames` for name mismatches, but there is
  **no true first-class person identity** across agreements. Intentional for v1
  (related to, but distinct from, per-property owner embedding above).
- **WhatsApp Business API** — automated (non-broker-initiated) review-link
  delivery; pilot uses native share sheet only.
- **Records tab Owners/Tenants N+1 — partially resolved.** Properties/Owners/
  Tenants use `GET /api/v1/parties` (phone-deduped contact summaries with
  agreement context), so mobile no longer fans out per-agreement detail GETs for
  people. **Residual:** Records still has no dedicated summary endpoint if
  further scale issues arise.

### Resolved / obsoleted

- **Splash Lottie is the final mark-only animation.** `apps/mobile` splash uses
  `assets/animations/splash.json` (watermark-free mark from Bharat; no wordmark).
  The older Jitter.video-watermarked wordmark Lottie is **not referenced**
  anywhere. Resolved 2026-08-05 (confirmed in codebase).
- **Variable-invitee vendor question** — resolved 2026-07-24. Leegality support
  confirmed one workflow with 5 blank slots handles 2–5 signers via API; unused
  slots do not activate. No per-count workflows.
- **eSign timing vs escrow** — resolved: sign → money → keys (eSign before
  escrow on the mobile path).
- **Leegality sandbox access** — not obtained in time; build against stubbed
  Leegality responses, then one deliberate production smoke with throwaway
  invitees (see decisions doc).
- **Co-owner legal enforceability (one signatory)** — obsoleted: every party
  added in Parties is a signatory (2–5 capped; ≥1 owner + ≥1 tenant).

## Security / Infrastructure

- **Rate limiting on public lease-agreement review endpoints.**
  `GET`/`POST /api/v1/review/:token` are unauthenticated (token is the credential).
  Without rate limiting, a token can be spammed to repeatedly overwrite a party's
  approval decision. Not being solved in the review-flow build — **must be
  addressed before real broker / pilot usage.**
- **Rate limiting on public sync endpoints.** `/api/sync/accounts/:phone/roles` and
  `/summaries` are unauthenticated and enumerable — they disclose whether a phone
  number has an account and the account holder's name. Deferred pending discussion.
- **Historical environment warning from Sumit's machine:** root `.env` pointed at
  production Supabase/DB (`dsqhifabykbtqvzvogdt`), while mobile pointed to staging.
  This is not the current Ajay checkout configuration: on September 9, neither
  `.env.staging` nor `apps/mobile/.env` exists, and root DATABASE_URL does not
  identify either known Supabase project. Verify each command's actual target
  before running it; never copy production credentials into local development
  just to make a command work. Staging/local setup remains to be verified.
- **CI workspace-lib build-order gap.** Any new `lib/*` workspace package must be
  added to the CI “Build workspace libs” pre-test step
  (`.github/workflows/ci.yml`), or `test:api` will fail on a clean checkout even
  though it passes locally with a stale/rebuilt `dist`. Bit once with
  `@workspace/lease-agreement` (fixed in PR #179) — remember for the next new
  package.
- **Vercel Deployment Protection is OFF** on the `trustkeyper` (app) project.
  Blocked on a plan upgrade (Deployment Protection Exceptions is a paid feature).
  Re-enable for Preview once available.
- **Local `/api/contact` route missing** in the Express dev server — the contact
  endpoint only exists as a Vercel function, so it can't be exercised in local dev.
  Developer-convenience gap, not a production risk.

## Launch readiness / compliance
- **Store approval and production readiness need current verification.** Sumit's
  August 19 handoff reports completed listing materials, Android 1.0.0/versionCode
  6 in closed testing, and iOS 1.0.0/build 7 resubmitted for review. Check today's
  console outcomes and account/data-deletion requirements separately. The older
  claim that iOS was unstarted is obsolete. Production schema parity is also
  unverified: compare migrations before a deliberate staging-to-main release.
  See `docs/handoff-status.md`; historical submissions are not launch approval.
- **Aadhaar / PAN regulatory compliance for public app distribution.** The app
  collects and stores real Aadhaar and PAN numbers. Before any public Play Store /
  App Store release, this needs real legal review regarding India's UIDAI rules on
  Aadhaar storage/handling — flagged to Aman as his domain, not resolved.

## Analytics

- **GTM go-live gated** on Ciza confirming the container (`GTM-T679X9X7`) actually
  contains the GA4 config tag, Conversion Linker, and Ads conversion tag on the
  `contact_form_submit` trigger. Do NOT set `VITE_ENABLE_ANALYTICS=1` on Production
  until confirmed — an empty container loads and fires nothing, indistinguishable
  from working.

## Marketing site — cosmetic cleanup

- Mobile connector lines on How-It-Works / onboarding steps (Figma shows them;
  current build hides the connector below `lg`).
- Tablet behavior of the contact illustration (currently `hidden lg:block` — gone
  below 1024px, confirm that's intended for tablet).
- ~7 sub-4px / auto-layout-gap deltas from the 390px mobile audit — noise, low priority.

## Architecture (design decisions, not bugs)

- **Dual auth systems.** App has `/login` + `/signup/*` pages; marketing site has a
  modal + `/login/existing` + `/signup/*` routes. Both use Supabase phone OTP against
  the same production project. Consolidating to one auth surface is worth a deliberate
  design conversation. Until then, keep the app's `/login` as the recovery fallback.
- **`VITE_MARKETING_URL` stays unset** on the app's Production env. Setting it activates
  `AppAuthEntryRedirect`, which loops failed handoffs back to the marketing modal.

## Owner / tenant portal

- **Unfinished-agreement visibility is resolved on staging.** PR #275 makes
  portal list/detail access signed-only, including renewal drafts. Keep this
  guard covered when the portal query is changed in future.

## Payments (pre-dates this work)

- **Razorpay webhook subscription is missing `transfer.*` events.** The production
  webhook ledger (`razorpay_webhook_events`) has only ever recorded
  `payment.captured` and `payment.failed` — never `transfer.created`,
  `transfer.processed`, or `transfer.failed`. Until transfer events are enabled in
  the Razorpay dashboard, settlement completion relies on the on-read reconciler
  (`api/_lib/paymentReadHandler.ts`). **Sumit must enable `transfer.*` in the
  Razorpay Dashboard → Webhooks (account-level) — not configurable via API/Cursor.**
  Code handlers already exist in `api/_lib/razorpayWebhookHandler.ts`.
  (The previously tracked blocker — `razorpay_transfer_id` NULL at order creation —
  was fixed in `bd8e892`: transfer ids are now persisted in the same transaction
  as the `rent_payments` insert.)
- **Route owner payout is bank-only.** Razorpay Route linked-account settlements
  accept bank account + IFSC on the Route product config — not UPI VPA. UPI payouts
  are a RazorpayX Payouts product. Owner portal payout setup is bank-only until a
  deliberate RazorpayX integration.
- **Brokerage Route transfer requires broker recipient activation.** Tenant brokerage
  pays via order + `on_hold: 0` transfer to the broker's Route linked account
  (`payment_recipient_config` role=`broker`). Brokers must complete bank Route
  onboarding or brokerage checkout returns `broker_payout_inactive`.
- **Rent reminders are in-app derived alerts only** (2 days before `rentDueDay`).
  No push/SMS notification pipeline yet for owner/tenant portal.

## Local pnpm / node_modules corruption

Cursor agent shells can override `PNPM_STORE_PATH` to an in-repo `.pnpm-store`, which
creates a **dual-store** setup (project `.pnpm-store` + global
`~/Library/pnpm/store/v11`). That can leave a huge local store (~1GB) and odd
`node_modules` linkage. Separately, some published packages (e.g. `nanoid@3.3.12`,
`resolve@1.22.12`) ship a `.claude/` folder in their npm tarball — that is upstream
packaging noise, not proof of local store corruption by itself.

**Symptoms:** Metro / Expo fails oddly after agent-driven installs; `find node_modules -name .claude -type d` shows dirs; an in-repo `.pnpm-store` exists; `pnpm store path` unexpectedly points inside the repo when Cursor sets `PNPM_STORE_PATH`.

**Clean reinstall (run in a normal terminal, outside Cursor sandbox):**

```bash
unset PNPM_STORE_PATH
export CI=true

# zsh: enable NULL_GLOB so empty globs do not abort the wipe
setopt NULL_GLOB

rm -rf node_modules \
  apps/*/node_modules \
  artifacts/*/node_modules \
  lib/*/node_modules \
  lib/integrations/*/node_modules \
  scripts/node_modules \
  .pnpm-store

pnpm store prune || true
CI=true pnpm install

# sanity checks
test -f node_modules/.pnpm/nanoid@3.3.12/node_modules/nanoid/package.json
pnpm store path   # expect ~/Library/pnpm/store/v11 (not repo/.pnpm-store)
pnpm run dev:mobile
```

Do **not** set `PNPM_STORE_PATH` to a path inside the repo for day-to-day work.
For Metro watch mode, drop `CI=true` when starting `dev:mobile`.

## Mobile bottom sheets

Inventory add/edit uses a custom Reanimated `BottomSheet` (`apps/mobile/lib/ui/BottomSheet.tsx`),
not `@gorhom/bottom-sheet`. Gesture Handler is not a dependency, and gorhom v5 is
still rocky on Expo 54 + Reanimated 4. Revisit the library only if Gesture Handler
lands for another reason **and** Reanimated 4 support is stable. Until then, do
not add those native peers just for this drawer.
