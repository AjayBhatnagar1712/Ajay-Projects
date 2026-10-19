# Website support inbox

The website-only support form at `/support.html` sends messages to the Realtime Database path `supportMessages/{uuid}`. `/admin.html` has a Support messages section and a separate App administration section that embeds the unchanged Flutter admin portal. Native app source and bundles are not modified.

## Access and behavior

- No sign-in is required to submit a support request, including sign-in problems. The public page does not publish a support email address. It asks visitors for their own reply address.
- Visitors can only create a new, schema-validated message. They cannot read any messages, overwrite a submission, change status, or delete records.
- Inbox reads and status changes require the existing admin policy: the configured legacy admin email or a UID already present in `/admins`. No user is newly granted admin access.
- Original submitted fields are immutable. Administrators can mark messages New, Read, or Resolved. The inbox starts with the latest 100 records and offers older-page loading. Search and filters apply to loaded records; refresh reloads their status. Admin deletion is allowed by rules for privacy requests or spam cleanup through the Firebase console.
- Message text is rendered with `textContent`, never interpreted as HTML. Reply by email opens the admin's email application; it does not send automatically.
- Submissions have a server timestamp, required consent, and bounded fields (message maximum 4,000 characters). A hidden bot field and one-minute browser cooldown discourage accidental repeats; these are NOT server-enforced rate limits. A determined client can bypass them. Monitor the inbox/quota; stronger abuse protection needs a trusted rate-limited endpoint or verified App Check setup. No paid service or billing upgrade is enabled by this implementation.
- Submission success is shown only after the database confirms the write. On network failure the draft remains in the form, not in browser persistent storage. A timeout can mean delivery is uncertain; retrying can produce another submission.
- English/Hindi switching covers the public form, validation, and delivery status. User-entered message content is never translated.

## Local verification

Use Java 21 or later for the current Firebase CLI. The downloaded test JRE in `build/support-test-runtime` is optional and ignored by Git; it does not change the system Java installation.

```powershell
firebase emulators:start --only 'auth,database' --project demo-guruvandan-support --config firebase.support-emulators.json
$env:SUPPORT_EMULATOR_TESTS='1'
node --test test/website/*.test.mjs
```

For browser QA, start `tool/website_preview.cjs` with a temporary `PORT` and visit `/support.html?emulator=1` and `/admin.html?emulator=1`. Emulator mode is honored only on localhost or 127.0.0.1. The rules tests create emulator-only accounts; the legacy test account uses the password `emulator-only-password`. Never use those credentials or test data in production. Stop preview and emulator processes after testing.

## Release

Run `node tool/stage_website_release.mjs` to create the immutable hosting release from the existing app build plus website overlays. It includes a snapshot of the database rules. Compare deployed rules before publishing to ensure unrelated permissions have not changed. Deploy the database rules first, then Hosting using the staged configuration. Do not publish the form without its database rules. `node tool/verify_website_release.mjs` verifies live website files and unchanged Flutter bundles.

The public theme uses the homepage/shop palette, typography, header and footer across Support, Privacy, Account deletion and shared quotes. The cinematic homepage and Shop retain their existing scenes and layout.
