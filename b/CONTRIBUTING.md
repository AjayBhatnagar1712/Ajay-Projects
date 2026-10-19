# Contributing to TrustKeyper

This document defines how we work — branching, PRs, commits, code standards, testing, and the release process. Every contributor (including Cursor agents) follows this. No exceptions, no shortcuts under time pressure.

---

## Branches

### Permanent branches

| Branch | Purpose |
|---|---|
| `main` | Production. What's live at app.trustkeyper.com. |
| `staging` | Pre-production. Mirrors production config, points to staging Supabase. |

### Working branches

Always branch from `staging`, not `main`.

| Pattern | Use for |
|---|---|
| `feature/short-description` | New features |
| `fix/short-description` | Bug fixes |
| `chore/short-description` | Config, deps, tooling, docs |
| `refactor/short-description` | Code improvements with no behaviour change |

**Examples:**
```
feature/tenant-dashboard
fix/otp-session-persistence
chore/add-vitest-setup
refactor/normalise-property-schema
```

### Branch rules (enforced via GitHub)

- **`main`** — no direct pushes. **PR + review required** (branch protection). All CI checks must pass. Sumit's approval required.
- **`staging`** — no direct pushes. PR required. All CI checks must pass.
- All other branches — free to push directly.

### Deploy targets (two Vercel projects)

| Project | What ships | Production branch |
|---|---|---|
| `trustkeyper` | App SPA + API | `main` → app.trustkeyper.com |
| `trustkeyper-website` | Marketing SPA | `staging` → trustkeyper.com |

Merging to `staging` updates **marketing Production** and **app staging**. Merging `staging` → `main` updates **app Production** only. Do not assume one deploy covers both surfaces.

### Environment variable scoping

Put vars on the project that actually consumes them:

| Scope | Examples |
|---|---|
| App project (`trustkeyper`) — server | `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ADMIN_PHONES`, `RESEND_*`, Razorpay keys, `MARKETING_STAGING_ORIGIN` (CORS) |
| App project — browser (`VITE_*`) | `VITE_SUPABASE_*`, `VITE_ADMIN_PHONES`, optional `VITE_API_URL` |
| Marketing project (`trustkeyper-website`) — browser | `VITE_SUPABASE_*`, `VITE_API_URL` (app API base for cross-origin), `VITE_APP_URL` (app origin for handoff links), `VITE_ENABLE_ANALYTICS` |

**`VITE_MARKETING_URL` on the app project:** Must stay **unset on app Production** until the marketing→app handoff is fully validated in production. When set, `AppAuthEntryRedirect` sends `/login` and `/signup` visitors to the marketing site. If handoff fails, users can loop: app `/login` → marketing → failed handoff → app `/login` again. Staging may set it for integration testing; Production must not until the gate path is proven.

---

## Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/).

```
type: short description in lowercase

Optional longer body explaining WHY, not what.
```

### Types

| Type | Use for |
|---|---|
| `feat` | New user-facing feature |
| `fix` | Bug fix |
| `chore` | Tooling, dependencies, config, no production code change |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test` | Adding or fixing tests |
| `docs` | Documentation only |
| `style` | Formatting, whitespace (no logic change) |
| `perf` | Performance improvement |

### Examples

```
feat: tenant invitation accept flow with OTP verification
fix: session persistence lost on iOS Safari private mode
chore: add Vitest and configure test setup
refactor: extract property validation into shared util
test: add unit tests for invitation expiry logic
docs: update README with staging setup instructions
```

**Never:**
- `fix: stuff`
- `update`
- `WIP`
- `Meena's changes`

---

## Pull Requests

### Every PR must have

1. **A clear title** following the commit convention (`feat: ...`, `fix: ...`)
2. **A description** that answers: what does this do, and why
3. **Tests** for any new logic — no feature ships without tests
4. **Passing CI** — all checks green before requesting review

### PR template

When opening a PR, include:

```
## What
Brief description of the change.

## Why
Why this change is needed.

## How to test
Steps to verify the change works correctly.

## Screenshots (if UI change)
Before / After if applicable.

## Checklist
- [ ] TypeScript strict — no `any`, no `@ts-ignore`
- [ ] Tests added/updated
- [ ] Loading and error states handled
- [ ] Responsive — tested at 375px, 768px, 1280px
- [ ] No secrets or API keys in code
- [ ] ARCHITECTURE.md updated if data model or API changed
```

### PR targets

| From | Target | Notes |
|---|---|---|
| `feature/*` or `fix/*` | `staging` | Default for all work |
| `staging` | `main` | Release only — Sumit decides |

---

## Code Standards

### TypeScript

- `strict: true` — always. No exceptions.
- No `any`. If you're reaching for `any`, model the type properly.
- No `// @ts-ignore`. Fix the type.
- No `as` casting to escape type errors — only use `as` when you genuinely know more than the type system.
- Zod for all runtime validation — API inputs, environment variables, external data. Never trust data that comes from outside the type system.

### React

- Functional components only — no class components.
- No `useEffect` for data fetching — use the established sync patterns in `lib/cloudSync.ts`.
- Every async operation has three states handled in UI: loading, success, error. No component ships with missing states.
- No inline styles — all styling via Tailwind classes.
- No hardcoded colours or spacing — use the design token system.

### API

- Every endpoint validates its inputs with Zod before touching the database.
- Every endpoint has explicit error handling — no empty catch blocks.
- No `console.log` in production code — use the logger in `artifacts/api-server/src/lib/logger.ts`.
- Auth is checked at the top of every protected handler before any logic runs.

### General

- No `console.log` left in committed code. Use logger or remove.
- No commented-out code — delete it, git history remembers.
- No TODO comments without a GitHub issue reference: `// TODO(#42): implement rate limiting`
- One component per file. Filename matches exported component name.
- Comment the *why*, not the *what*. The code says what.

### Secrets

- **Never** put API keys, database URLs, JWT secrets, or any credentials in code.
- All secrets live in Vercel environment variables or `.env` (which is gitignored).
- If a secret is accidentally committed: rotate it immediately, don't just delete from history.

---

## Testing

See [TESTING.md](./TESTING.md) for the full testing guide.

### The rule

Every PR that adds a feature includes tests for that feature. Every bug fix includes a regression test. Tests are not written retroactively — they ship with the code.

### What to test

| Type | Tool | What |
|---|---|---|
| Unit | Vitest | Pure functions, utilities, data transforms in `lib/` |
| Component | Vitest + Testing Library | UI behaviour — what users experience |
| E2E | Playwright | Critical user journeys against staging |

### Running tests

```bash
pnpm run test              # Unit + component (watch mode)
pnpm run test:run          # Unit + component (single run, for CI)
pnpm run test:coverage     # With coverage report
# E2E via Playwright is planned but not yet set up — see TESTING.md
```

---

## The Release Process

### Normal release (feature or fix)

```
1. Branch from staging
   git checkout staging && git pull
   git checkout -b feature/your-feature

2. Build and commit
   — write code
   — write tests
   — pnpm run typecheck (must pass)
   — pnpm run test:run (must pass)
   — git commit following convention

3. Open PR → staging
   — fill in PR template
   — CI must be green before review

4. Review and merge to staging
   — Sumit reviews
   — Merge when approved + CI green

5. Test on staging
   — Both Sumit and Meena verify the feature end to end on staging
   — Test on mobile (375px) and desktop
   — Test the critical flows: OTP, property add, invitation send/accept

6. Release to production
   — Open PR: staging → main
   — Title: "release: vX.Y — brief description"
   — Merge when approved
   — Vercel auto-deploys
   — Verify on production within 10 minutes of deploy
```

### Hotfix (urgent production fix)

```
1. Branch from main (not staging)
   git checkout main && git pull
   git checkout -b fix/urgent-description

2. Fix, test, commit

3. PR → main (bypasses staging given urgency)
   — Sumit approves
   — CI must still be green — no exceptions even for hotfixes

4. After deploy — immediately cherry-pick to staging
   git checkout staging
   git cherry-pick <commit-hash>
```

---

## Environment Setup for Contributors

### Sumit (product + engineering)

Full access. Works on features, reviews all PRs, makes all release decisions.

### Meena (developer)

Works on `feature/*` and `fix/*` branches. Opens PRs to `staging`. Does not merge to `main` directly.

### Cursor (AI agent)

Cursor follows this document exactly. Every change it makes must:
- Be on a feature or fix branch
- Pass typecheck before committing
- Include tests for any new logic
- Follow commit message conventions
- Never touch `.env` files or commit secrets
- Never push directly to `staging` or `main`

---

## Local Environment Checklist

Before starting work each session:

```bash
git checkout staging && git pull   # get latest staging
git checkout -b feature/your-work  # always work on a branch
pnpm install                        # in case deps changed
pnpm run typecheck                  # confirm clean baseline
```

Before opening a PR:

```bash
pnpm run typecheck   # must pass
pnpm run test:run    # must pass
```
