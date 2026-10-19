# Handoff Reconciliation

Checked 2026-09-11 against Sumit's 2026-08-19 handoff, fetched Git refs and
code, and the authenticated GitHub, Vercel, Supabase, Sentry, and Play Console
dashboards. Production remains unchanged and no live payment was initiated.

## Current release state

- `main` remains at `0a23e3a`.
- PR #271 (server/API Sentry monitoring) merged to `staging` as `4f7b20f` after
  all four checks passed. The resulting Vercel staging deployment is Ready.
- PR #275 (renewal and calendar-month rent billing) merged to `staging` as
  `6afe36f` after all four checks passed. The resulting Vercel staging deployment
  is Ready.
- The additive renewal migration
  `20260817155535_lease_agreement_renewal_link.sql` was applied only to Supabase
  staging (`jvupbmmzyxizjwjjfrac`). The column, lookup index, and unique active
  renewal index were queried afterward and all were present.
- PR #277 (broker payout setup, Payments tab, and consultancy-fee copy) was
  updated onto `6afe36f`. Its only merge conflict retained `Consultancy fee`.
  Deployment typechecks, 311 API tests, and 431 mobile tests passed locally;
  GitHub CI and both Vercel checks passed. It merged to `staging` as `46e1c76`,
  and the resulting Vercel staging deployment is Ready.
- PR #278 is this documentation-only reconciliation and must be updated onto
  the final staging commit before it is merged.

## Implemented agreement and payment rules

- Agreements use calendar-month rent periods, not anniversary-to-anniversary
  months. A lease beginning September 10 bills September 10-30 and allows five
  days to pay. Full later months bill from the first through month end with the
  same five-day grace period.
- An agreement ending August 10 bills August 1-10. If its renewal begins August
  11, the renewal bills August 11-31 using the renewal agreement's rent.
- Split-month amounts use each agreement's monthly rent and the actual number of
  calendar days. Paise rounding preserves the exact monthly total when adjacent
  periods have the same rent.
- Renewal creation is signed-only, links the new draft to its source agreement,
  prevents duplicate active renewals, clones the required agreement data, and
  returns to the existing review/signing flow.
- Owner/tenant portal list and detail access are signed-only; unfinished original
  agreements and renewal drafts are hidden.
- Rent checkout, portal display, and payment history share the server-calculated
  periods and preserve paid/settled history.
- Broker payout setup and the Payments tab are now in staging. Razorpay Route
  broker recipients must be activated before consultancy-fee checkout can work.

## Signing decision

- Automated digital signing and Leegality are deferred.
- The broker completes and shares the document for customer review. After all
  parties approve, Aman/admin stamps it manually, uploads the final signed PDF,
  and delivers it to the customer or broker.
- Broker self-declaration of signed status is rejected by the API. Admin upload
  is the completion path.

## Verification completed

- Combined pre-merge validation passed: 311 API tests, 204 web-app tests, 431
  mobile tests, 45 marketing tests, deployment typechecks, app/API build,
  marketing build, and required artifact checks (991 tests total).
- After the final #277 rebase, deployment typechecks plus all 311 API and 431
  mobile tests passed again.
- Fresh Vercel previews exposed strict TypeScript inference gaps in the Sentry
  callbacks that local CI had missed. The callbacks were explicitly typed and a
  subsequent Vercel preview passed before #271 was merged.
- The Android device was previously authorized with TrustKeyper 1.0.0
  (versionCode 6) installed. It was no longer visible over USB/ADB when the final
  staging deployment became Ready, so physical-device regression remains pending
  reconnection.

## External readiness

- Vercel invoice $47.20 is paid with $0 due. Supabase invoice $41.30 is paid.
  New Git-triggered previews and staging deployments are working again.
- Ajay's Vercel team entry is Developer. The earlier Viewer warning on old PR
  comments is historical.
- Supabase staging contains the brokerage/portal migration and the renewal-link
  migration. Production must not receive migrations until a separate approved
  staging-to-main release.
- Sentry has IP-address storage prevention enabled. Preview still lacks the
  server `SENTRY_DSN`, `SENTRY_ENABLED`, and controlled-probe variables, so live
  API ingestion and source-map resolution remain unverified.
- Play Console closed testing 1.0.0 (version code 6) is active with 14 email-list
  testers. The production-access questionnaire must use factual tester
  recruitment, engagement, and feedback answers.
- App Store Connect work remains deferred at Ajay's request.
- Razorpay dashboard configuration review remains deferred. Code uses Razorpay
  Route, and transfer webhooks should be checked before production promotion.

## Remaining release order

1. Reconnect the authorized Android device and run the broker payout/Payments and full
   agreement/review/manual-signing/payment/renewal staging regression.
2. Merge this documentation update to staging after its checks pass.
3. Prepare a staging-to-main pull request with exact database migration and
   rollback notes.
4. Obtain explicit production approval before applying production migrations or
  merging to `main`, then verify the released app and stores.
