# eSign / Leegality Integration — Decisions & Open Items

**Last updated:** 2026-09-10
**Owner:** Sumit Mandal
**Status:** Source of truth. Every implementation prompt must be read against this doc. Supersedes all prior verbal decisions and the earlier version of this file.

---

## Scope

Leegality eSign integration targets the **mobile broker app only**. Web's existing manual-upload eSign path (`send-for-esign`, `tenant_workspace` lifecycle, blob-based agreement status) is **left untouched**. Mobile is a clean, API-first, relational build — intended as the target architecture web migrates to later.

---

## Decided

### Parties & signatories
- **Every party added in the Parties step is a Leegality signatory** — all owners, all co-owners, all tenants, all co-tenants. Not "primary owner + primary tenant only." This supersedes the earlier "owner + tenant only" decision.
- **Signer count is 2–5 per agreement** (minimum one owner + one tenant; max 5 for the Leegality workflow). Enforced in Zod/API — not a DB CHECK.
- Parties are persisted as **structured records** (`agreement_parties` table), never as joined strings. The web app's flattening (`additionalOwnerNames`, comma-joined `coTenantName`/`coTenantContact`) must NOT be copied into mobile.
- Phone numbers are **normalized to 10-digit at insert** (Leegality requires 10-digit).
- KYC (Aadhaar/PAN/etc.) is collected for **every signer**, not just primary — preserving the web `allParties` invariant.

### Leegality workflow strategy (RESOLVED — confirmed by Leegality support, 2026-07-24)
- **One workflow handles variable signer count.** Confirmed directly by Leegality support: configure a single workflow with **5 invitee slots** (our max), leave all invitee details (name/email/phone) blank on the dashboard — these become placeholder slots filled via API. A 2-party agreement sends 2 invitee objects, a 5-party sends 5. Unused slots simply don't activate.
- **Single `profileId`, no per-count workflow selection needed.** This simplifies the send layer: build the invitee array directly from `agreement_parties` (2–5 rows) and send — no branching logic to pick between multiple workflows.
- **Signature coordinate implication:** the workflow's 5 signature-coordinate slots per page are fixed at workflow-creation time regardless of how many invitees actually sign. When fewer than 5 sign, the unused coordinate positions are simply blank space on the page — not an error, just a layout fact. The PDF's signature-block layout (every page, bottom-left flowing right then up) should be designed for the max (5) and gracefully leaves empty positions for fewer signers.
- **Group Invitee remains the wrong tool** — it's "any K of M" threshold signing, opposite of our "everyone must sign" requirement. Not used.

### Document generation
- Agreement PDF is **generated server-side from structured fields**. It is always a pure function of the data — no freeform editing, no Word doc, no document editor.
- **Editing = changing a configurable field and regenerating.** Broker edits only when needed (e.g. tenant negotiates rent Rs. 60,000 → Rs. 50,000); broker changes the field, PDF regenerates. Broker cannot edit freeform text.
- **Versioning is by field values, not documents** — since the PDF always regenerates from data, "what changed" is a field diff.
- The PDF reproduces **Aman's existing, in-use agreement template structure exactly**: stamp paper page → `BETWEEN` with each party's full details (including age, residential address, Aadhaar, and PAN where present) → `WHEREAS` recitals → 34 numbered clauses → `IN WITNESS` → signature block using name + email → `ANNEXURE-1`.
- `ANNEXURE-1` is a **two-column fixtures & fittings table** (Description | Quantity), stored as `agreement_inventory_items` with separate `description` and `quantity` columns. There are no room groups.
- Monetary amounts in the generated agreement use **`Rs.` formatting, not the `₹` symbol**, matching Aman's real agreements.

### Signatures
- Signature required on **every page**, placed **bottom-left flowing right, then up** — accommodating 2–5 signers per page.
- **Aadhaar-based OTP verification**, handled by Leegality — **deferred** (see Review flow / Leegality deferral below).

### Review flow
- Broker generates draft → sends for review → each party receives a **tokenized, unauthenticated TrustKeyper-branded review page** (extends the existing `/onboard/tenant/:token` pattern, but relational/API-first per mobile's architecture, NOT the blob-based onboard storage).
- Parties **view the agreement and either Approve or Request Changes**. Requesting changes records the decision immediately; a comment is **optional** and may be submitted afterward. They do not sign at this stage and Leegality is not involved.
- Broker sees responses in the app, edits fields if needed, regenerates, re-sends. **Editing at review stage is free** — no Leegality cost until all parties approve.
- **Link delivery via the native share sheet** — broker taps "Send for Review," OS share sheet opens with a pre-filled message + link, broker picks WhatsApp / SMS / email / etc. Broker-initiated; no WhatsApp Business API needed.
- The current web "Send for E-Signing" is broken (downloads PDF, opens WhatsApp with no attachment). The review-link approach is the fix, not an addition.
- Public review payloads **null out Aadhaar and PAN for every party** (including the token-holder). Review links are bearer credentials shared over WhatsApp/SMS; KYC must not ride along.
- Public review payloads include **broker `{ name, phone }` only** (name from `brokers`, phone from `auth.users`) so parties can call the broker after requesting changes — no firm, region, email, or other profile fields.
- Review tokens use **cryptographically strong random values** (`crypto.randomBytes(32).toString("base64url")`), not the weaker onboarding `bt_…` pattern.

### Leegality deferral (updated 2026-07-30)
- **Leegality send / webhook / workflow setup is deferred entirely for now.**
- This phase stops at the **lightweight review / approval state**.
- Once all parties approve in-app, the broker sends the approved document to
  **Aman/admin for manual stamping outside the app**. Aman/admin then uploads the
  final signed PDF and delivers it to the customer or broker. The broker cannot
  mark the agreement signed through the status endpoint.
- No in-app Leegality client calls, webhook handling, or production workflow/`profileId` setup are required to ship review.

### Sequencing
- **Sign → money → keys.** eSign fires BEFORE escrow/payment. This is the opposite of web's current escrow-first order. Nothing in the mobile path may assume escrow-first. (When Leegality is later wired, this order still applies.)

### Testing (no sandbox)
- Leegality sandbox access could not be obtained in time.
- When Leegality is eventually wired: build everything up to the actual Leegality call against a **stubbed response** shaped like the documented payload. Fully testable without Leegality.
- First real test is a **single, deliberate run against production** with throwaway data (own phone numbers as invitees), consuming a small number of real eSign credits. Aman is aware.
- **No iterative testing against production** — every real send costs a credit and appears in Aman's dashboard.

---

## Open — blocking document finalisation / SEND (deferred with Leegality)

- **Single workflow setup on the production Leegality dashboard** — 5 blank invitee slots, capture one `profileId` + auth token + private salt. Needs a sample PDF from Phase 1 first (for signature coordinate placement across all 5 slots). **Deferred** until Leegality integration resumes.
- **Automated stamp paper handling** — manual stamping by Aman/admin is the
  current process. Whether a future Leegality integration should include
  eStamping remains deferred with Leegality SEND.

## Open — parked, non-blocking
- **Web/mobile agreement divergence** until web migrates to the relational path.
- **Owner reuse across properties** — owners embedded per-property, no dedup (deferred).
- **WhatsApp Business API** for automated (non-broker-initiated) link delivery — future upgrade, not needed for demo/pilot.

## Resolved / obsoleted
- **Co-owner legal enforceability risk** — obsoleted by "everyone signs." No longer a concern since every owner signs.
- **eSign-vs-escrow timing** — resolved: sign first.
- **Google Docs / external editor for drafts** — rejected. Field-based editing only; no editor needed.
- **Variable-invitee-count vendor question** — resolved 2026-07-24. Leegality support confirmed one workflow with 5 blank slots handles 2–5 signers via API. No per-count workflows needed.

---

## Non-goals for this build
- No document editor, no Word round-trip, no freeform text editing.
- No in-app party review accounts (owners/tenants are not app users — they use the tokenized web page).
- No automated link delivery (broker-initiated share sheet only).
- No payments/escrow in the eSign path (separate, and after signing).
- No Leegality SEND / webhook / workflow setup in the review-flow phase.

---

## Implementation reminders
- API-first, relational. No blob sync, no `user_data` JSON on the mobile path.
- Leegality client server-side only when re-enabled; env-driven (base URL, `X-Auth-Token`, private salt, `profileId` set). `X-Auth-Token` header, never `Authorization: Bearer`.
- Webhook `mac` = HMAC-SHA1(documentId, privateSalt), verified server-side.
- Signed-document Details URLs expire in ~15s — fetch immediately on webhook receipt, then store.
- Idempotency: if `leegality_document_id` set and status non-terminal, return existing rather than re-sending.
- `agreement_documents` table (currently unused) is the intended home for stored PDFs.
- Vercel functions capped at `maxDuration: 30` — don't chain PDF-gen + Leegality call + Details fetch + storage naively.
- Public review access is **server-side token validation only** — no public RLS, no anon table grants.
