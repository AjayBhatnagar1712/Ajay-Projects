# TrustKeyper — Testing Guide

Testing is not optional. Every feature ships with tests. Every bug fix includes a regression test. This document covers what to test, how to test it, and the tools we use.

---

## The Rule

> Every PR that adds a feature includes tests for that feature.
> Every bug fix includes a regression test so it can never silently return.

Tests are not written retroactively. They ship with the code.

---

## Testing Stack

| Type | Tool | What it tests |
|---|---|---|
| Unit | Vitest | Pure functions, utilities, data transforms |
| Component | Vitest + Testing Library | UI behaviour from the user's perspective |
| E2E | Playwright | Critical user journeys against staging |
| Manual | Test plan (this doc) | Flows that require real OTP, real devices |

---

## Unit Tests (Vitest)

### What to unit test

- All functions in `lib/` — data transforms, validation logic, storage helpers
- All utility functions in `artifacts/trustkeyper/src/lib/`
- Zod schemas — valid inputs pass, invalid inputs fail with correct errors
- Business logic — invitation expiry, role checks, data key mappings
- Edge cases — empty arrays, null values, malformed phone numbers

### What NOT to unit test

- Implementation details — don't test internal state, test outcomes
- Third-party libraries — don't test that Supabase works
- Trivial getters/setters with no logic

### File location

Colocate tests with the code they test:

```
lib/
  sync-store/
    src/
      index.ts
      index.test.ts        ← test lives here
artifacts/trustkeyper/
  src/
    lib/
      phoneOtp.ts
      phoneOtp.test.ts     ← test lives here
```

### Example unit test

```typescript
// lib/invitations-store/src/expiry.test.ts
import { describe, it, expect } from 'vitest'
import { isInvitationExpired } from './expiry'

describe('isInvitationExpired', () => {
  it('returns true for past expiry date', () => {
    const pastDate = new Date(Date.now() - 1000 * 60 * 60)
    expect(isInvitationExpired(pastDate)).toBe(true)
  })

  it('returns false for future expiry date', () => {
    const futureDate = new Date(Date.now() + 1000 * 60 * 60)
    expect(isInvitationExpired(futureDate)).toBe(false)
  })

  it('returns true for exact current time (boundary)', () => {
    expect(isInvitationExpired(new Date())).toBe(true)
  })
})
```

### Running unit tests

```bash
pnpm run test          # watch mode — use during development
pnpm run test:run      # single run — use before opening a PR
pnpm run test:coverage # with coverage report
```

### Coverage targets

| Area | Target |
|---|---|
| `lib/` utilities | 80%+ |
| API handlers (logic, not HTTP wiring) | 70%+ |
| Frontend utilities (`src/lib/`) | 70%+ |

Coverage is a floor, not a goal. Don't write useless tests to hit numbers.

---

## Component Tests (Vitest + Testing Library)

### What to component test

- User interactions — clicking, typing, submitting
- Conditional rendering — what shows when data is empty, loading, errored
- Form validation — error messages appear for invalid inputs
- Navigation — does the correct route get pushed on success

### What NOT to component test

- Styles or CSS classes — test behaviour, not appearance
- Internal component state — test what users see, not how it's stored
- Snapshot tests — they break constantly and tell you nothing

### Guiding principle

> "The more your tests resemble the way your software is used, the more confidence they can give you." — Testing Library

Write tests from the user's perspective:

```typescript
// artifacts/trustkeyper/src/components/OtpInput.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { OtpInput } from './OtpInput'

describe('OtpInput', () => {
  it('calls onComplete when all 6 digits are entered', async () => {
    const onComplete = vi.fn()
    render(<OtpInput onComplete={onComplete} />)

    const inputs = screen.getAllByRole('textbox')
    inputs.forEach((input, i) => {
      fireEvent.change(input, { target: { value: String(i + 1) } })
    })

    expect(onComplete).toHaveBeenCalledWith('123456')
  })

  it('shows error state when invalid OTP prop is passed', () => {
    render(<OtpInput onComplete={vi.fn()} error="Invalid code" />)
    expect(screen.getByText('Invalid code')).toBeInTheDocument()
  })
})
```

### File location

Same as unit tests — colocate with the component:

```
src/components/
  OtpInput.tsx
  OtpInput.test.tsx
```

---

## End-to-End Tests (Playwright)

### Scope

E2E tests cover critical user journeys only — the paths that would be catastrophic if broken. Not everything. Not happy paths only.

### Critical journeys to test

| Journey | Priority | Notes |
|---|---|---|
| Owner signup — phone → OTP → dashboard | P0 | Core onboarding |
| Owner login — existing account | P0 | |
| Owner adds a property | P0 | |
| Owner sends tenant invitation | P0 | |
| Tenant receives and accepts invitation | P0 | Requires two sessions |
| Owner views dashboard after tenant accepts | P1 | |
| Broker signup and adds property | P1 | |
| Admin login and views dashboard | P1 | |
| OTP failure — wrong code shows error | P1 | Error path |
| Invitation expired — correct error shown | P1 | Error path |

### File location

```
e2e/
  owner-onboarding.spec.ts
  owner-property.spec.ts
  tenant-invitation.spec.ts
  broker-onboarding.spec.ts
  admin.spec.ts
```

### Example E2E test

```typescript
// e2e/owner-onboarding.spec.ts
import { test, expect } from '@playwright/test'

test('owner can sign up and reach dashboard', async ({ page }) => {
  await page.goto('/');

  // Select owner role
  await page.getByRole('button', { name: 'I own property' }).click()

  // Fill in details
  await page.getByLabel('Full name').fill('Test Owner')
  await page.getByLabel('Phone number').fill('9000000001')
  await page.getByRole('button', { name: 'Send OTP' }).click()

  // Enter OTP (staging uses test OTP bypass)
  await page.getByLabel('OTP').fill('123456')
  await page.getByRole('button', { name: 'Verify' }).click()

  // Should reach dashboard
  await expect(page).toHaveURL('/owner/dashboard')
  await expect(page.getByText('Welcome')).toBeVisible()
})
```

### Running E2E tests

E2E testing via Playwright is **planned but not yet set up** — there is no `pnpm run test:e2e` script yet. When added, tests will run against staging (or local dev) using `STAGING_URL`. See the example spec above for the intended structure.

### E2E in CI

Playwright E2E in CI is planned as the gate before `staging` → `main` promotion. It is not wired up yet.

---

## Manual Testing

Some things require real phones, real OTP, and real user flows. These cannot be automated.

### Before every staging → main release

Run through this checklist manually on staging:

#### Auth flows
- [ ] Owner signup — new phone number, full onboarding
- [ ] Owner login — existing account, remember me on + off
- [ ] Broker signup — new phone number
- [ ] Broker login — existing account
- [ ] Admin login — admin phone number
- [ ] Session expiry — logout and verify data clears correctly
- [ ] Multi-role — same phone, owner + broker roles, switch between them

#### Owner flows
- [ ] Add a new property — complete all steps
- [ ] Edit property details
- [ ] Upload a document to a property
- [ ] Raise a maintenance ticket
- [ ] Send a tenant invitation via the app
- [ ] View invitation status after sending
- [ ] Generate a rental agreement

#### Tenant flows (once live)
- [ ] Receive invitation link
- [ ] Accept invitation — OTP verify
- [ ] View property details as tenant
- [ ] Raise a maintenance ticket as tenant

#### Broker flows
- [ ] Add a property
- [ ] Add a tenant
- [ ] Generate a rental agreement
- [ ] View deal board

#### Cross-device
- [ ] Login on mobile (iOS Safari) — verify session persists
- [ ] Login on Android Chrome — verify session persists
- [ ] Login on new device — verify cloud sync restores data

#### Responsive
- [ ] All flows at 375px width (iPhone SE)
- [ ] All flows at 768px width (tablet)
- [ ] All flows at 1280px width (desktop)

#### Accessibility
- [ ] Tab through all interactive elements — focus states visible
- [ ] Modal dialogs — focus trapped inside
- [ ] Screen reader on key flows (VoiceOver/TalkBack)

---

## Testing in Cursor

When writing code with Cursor, always include this in your prompt:

> "Write tests for this as you go. Unit tests for any utility functions or business logic. Component tests for any UI components. Follow the patterns in TESTING.md. Tests go in the same folder as the code they test."

Cursor should never ship a feature without tests included in the same PR.

---

## Test Data

### Staging test accounts

Use these phone numbers on staging — they are seeded in the staging database:

| Role | Phone | Notes |
|---|---|---|
| Owner | 9000000001 | Has 2 properties, 1 active tenant |
| Owner | 9000000002 | Empty account for onboarding tests |
| Broker | 9000000010 | Has properties and deals |
| Admin | (set in ADMIN_PHONES env) | |

### OTP in staging

Staging uses Supabase's test phone numbers feature for OTP bypass. The OTP for all test numbers is `123456`. This does not consume Twilio Verify SMS credits (provider bypass).

Real phone numbers on staging go through real OTP — use sparingly.

---

## What to do when a bug is found in production

1. Reproduce it on staging first
2. Write a failing test that captures the bug before fixing it
3. Fix the bug
4. Confirm the test now passes
5. The test stays in the codebase permanently — it's a regression guard

Never fix a production bug without a test. If you can't write a test for it, that's a signal the code isn't testable and should be refactored.
