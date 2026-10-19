# Sentry Error Monitoring

TrustKeyper uses Microsoft Clarity for user-session analytics. Sentry is scoped
to error monitoring; it must not be used as a second session-recording tool.

## Current scope

The first rollout covered browser errors in `artifacts/trustkeyper` (the App
SPA). It includes React 19 root error handlers and global browser error capture.

The second rollout covers staging API errors for the Vercel functions in `api/`
and the local/deployable Express mirror in `artifacts/api-server`.

Not enabled in this phase:

- performance tracing or profiling
- Session Replay, logs, screenshots, or user feedback
- marketing website or mobile-app monitoring

These deliberate follow-ups are tracked in `docs/open-items.md`.

## Privacy controls

The App does not send default PII. Cookies, HTTP headers, request/response
bodies, query parameters, GraphQL values, database values, stack-frame locals,
console breadcrumbs, and DOM-click breadcrumbs are disabled.

Before an event leaves the browser, a second filter removes the user and extra
payloads, strips URL queries and credentials, and redacts email addresses,
phone/bank-like numbers, PAN values, bearer/JWT tokens, secret fields, and
sensitive route parameters. Do not attach raw form values, payment data,
documents, tokens, or Supabase sessions in future `captureException` calls.

The API SDK uses the same privacy posture: no default PII, no logs, no tracing,
no profiling, no request/response headers, no bodies, no cookies, no query
strings, no stack locals, and no user object. A server-side filter also strips
URL query strings/credentials and redacts common identity, payment,
authorization, and token-like values before sending events.

## Vercel configuration

Configure these in the App Vercel project. Start with the staging/Preview
environment; do not add them to Production until staging verification passes.

| Variable                        | Visibility            | Purpose                                                              |
| ------------------------------- | --------------------- | -------------------------------------------------------------------- |
| `VITE_SENTRY_DSN`               | Browser-public        | Routes App error events to the Sentry project.                       |
| `VITE_SENTRY_ENABLED`           | Browser-public        | Optional emergency kill switch; set to `false` to stop events.       |
| `SENTRY_DSN`                    | Server runtime        | Routes API/Express error events to the Sentry project.               |
| `SENTRY_ENABLED`                | Server runtime        | Optional emergency kill switch; set to `false` to stop API events.   |
| `SENTRY_UPLOAD_SOURCEMAPS`      | Build-only            | Set to `1` to require and upload source maps.                        |
| `SENTRY_AUTH_TOKEN`             | Secret, build-only    | Authenticates source-map uploads. Never use a `VITE_` prefix.        |
| `SENTRY_ORG`                    | Build-only            | Sentry organization slug.                                            |
| `SENTRY_PROJECT`                | Build-only            | Sentry project slug.                                                 |
| `SENTRY_ENVIRONMENT`            | Build/runtime         | Optional override; otherwise inferred from the Vercel branch.        |
| `SENTRY_RELEASE`                | Build/runtime         | Optional override; otherwise derived from the Vercel commit SHA.     |
| `SENTRY_API_TEST_ERROR_ENABLED` | Server runtime        | Set to `1` only while validating the staging API probe.              |
| `SENTRY_API_TEST_ERROR_TOKEN`   | Server runtime secret | Required `x-trustkeyper-sentry-test` header value for the API probe. |

The App Vite build and the Express API esbuild bundle both fail early when
source-map upload is explicitly enabled but an upload credential is missing.
They also fail if Sentry rejects release creation or the source-map upload, for
example because the auth token is invalid or revoked. A green deployment
therefore confirms those upload steps completed. Local builds need none of
these values and keep Sentry disabled. Uploaded source maps are deleted from
`dist` after a successful upload so they are not published with the deployment.

The Vercel functions in `api/` are built by Vercel's Node builder rather than
the Express esbuild bundle. Validate their stack traces directly in Sentry on
the staging deployment. If Vercel function frames do not resolve to the original
TypeScript source, connect/repair the Sentry Vercel integration or Vercel
source-map setting before calling the API rollout complete.

## Staging rollout check

1. Add the variables to the App Vercel project's Preview environment.
2. Deploy the PR from `staging`; confirm the build reports a successful source-map upload.
3. Trigger one controlled test error without entering real user data.
4. Confirm it appears under environment `staging` with the expected release.
5. Confirm its stack trace resolves to the original TypeScript/React source.
6. Inspect the event and breadcrumbs for PII, tokens, request bodies, and query strings.
7. Confirm normal App login and core flows still work and Clarity is unaffected.
8. Only after review and staging approval, raise the separate PR from `staging` to `main`.

If privacy inspection fails, set `VITE_SENTRY_ENABLED=false`, redeploy staging,
and do not promote the change.

## API staging rollout check

The probe requires `VERCEL_ENV=preview` plus its enable flag and header token.
Production deployment/target metadata, the `main` branch, or a production Sentry
environment always disable it. For a local Express test, explicitly set
`SENTRY_ENVIRONMENT=staging` with a non-production `NODE_ENV`. Unknown environments
are rejected. Changing only the flag or possessing the token cannot enable the
probe on production.

1. Confirm Sentry Security & Privacy has "Prevent Storing of IP Addresses"
   enabled before triggering API events.
2. Add `SENTRY_DSN`, `SENTRY_ENABLED=true`, `SENTRY_UPLOAD_SOURCEMAPS=1`, the
   Sentry upload variables, and the temporary API probe variables to the App
   Vercel project's staging/Preview environment.
3. Deploy from `staging`; confirm the App and Express API source-map uploads
   succeed in the build log. Ajay should not trigger a deployment if Sumit owns
   deployment/billing.
4. Trigger the controlled API probe with a POST to `/api/sentry-test-error` and
   header `x-trustkeyper-sentry-test: <SENTRY_API_TEST_ERROR_TOKEN>`.
5. Confirm the Sentry event is environment `staging`, release
   `trustkeyper-api@<commit>` (or the configured `SENTRY_RELEASE`), and the
   stack trace resolves to the original TypeScript API file/line.
6. Inspect the event payload: no user identity, no IP address, no cookies, no
   auth header, no request/response body, and no query string/token leakage.
7. Set `SENTRY_API_TEST_ERROR_ENABLED=0` or remove the probe token after
   validation so the endpoint returns 404 again.
