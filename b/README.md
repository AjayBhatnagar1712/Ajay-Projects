# TrustKeyper

Property management platform for NRI and remote owners of Indian residential property. Owners manage tenants, rent, documents, and maintenance — entirely remotely.

**Marketing site:** [trustkeyper.com](https://trustkeyper.com)  
**Live app:** [app.trustkeyper.com](https://app.trustkeyper.com)

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite 7 + TypeScript + Tailwind 4 |
| Routing | Wouter |
| Backend | Vercel serverless functions (`api/`) |
| Local dev server | Express (`artifacts/api-server/`) |
| Database | Supabase PostgreSQL + Drizzle ORM |
| Auth | Supabase Phone OTP (SMS via Twilio Verify; Indian DLT registered) |
| Email | Resend |
| Session recording | Microsoft Clarity |
| Monorepo | pnpm workspaces |
| CI/CD | GitHub Actions → Vercel |

---

## Monorepo Structure

```
/
├── api/                        # Vercel serverless functions (production)
│   ├── sync.ts                 # Data sync endpoints
│   ├── invitations.ts          # Tenant invitation endpoints
│   ├── feedback.ts             # Feedback + Gemini analysis
│   ├── managed-interest.ts     # Managed plan interest email
│   └── admin/                  # Admin-only endpoints
├── artifacts/
│   ├── trustkeyper/            # App SPA (React + Vite) → app.trustkeyper.com
│   │   └── src/
│   │       ├── pages/          # Route-level page components
│   │       ├── components/     # Shared UI components
│   │       └── lib/            # Auth, sync, storage utilities
│   ├── website/                # Marketing site (React + Vite) → trustkeyper.com
│   │   └── src/
│   │       ├── pages/          # Marketing + auth entry pages
│   │       ├── components/     # Marketing UI + auth modal
│   │       └── lib/            # Marketing auth, handoff, contact form
│   └── api-server/             # Express server (local dev mirror)
├── lib/
│   ├── db/                     # Drizzle schema + migrations
│   ├── auth-server/            # JWT verification helpers
│   ├── sync-store/             # Storage backend abstraction
│   └── invitations-store/      # Invitation persistence
└── supabase/
    └── migrations/             # SQL migration files
```

### Two Vercel projects

The monorepo deploys as **two separate Vercel projects** (not one combined deploy):

| Project | Source | Production domain | Production branch |
|---|---|---|---|
| `trustkeyper` | `artifacts/trustkeyper` + `api/` | app.trustkeyper.com | `main` |
| `trustkeyper-website` | `artifacts/website` | trustkeyper.com | `staging` |

**Why separate:** Marketing Production must track `staging` (so redesigned pages can ship and iterate before the app release train), while the app Production stays on `main`. A single Vercel project can only have one Production branch, so a combined deploy was rejected.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for cross-origin API, CORS, and marketing→app auth handoff.

---

## Prerequisites

- Node.js 22+
- pnpm 11.10.0 (`corepack prepare pnpm@11.10.0 --activate`)
- A Supabase project (for auth — phone OTP)

---

## Local Development Setup

### 1. Clone and install

```bash
git clone https://github.com/desicode-blip/TrustKeyper.git
cd Trustkeyper
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Open `.env` and fill in:

```env
# Database — leave as "local" for PGLite (no Docker needed)
DATABASE_URL=local
PGLITE_DATA_DIR=../../.data/pglite

# Server
PORT=8080

# Supabase (server-side JWT verification)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Admin phone numbers (comma-separated, 10 digits, no +91)
ADMIN_PHONES=9999999999
```

Create `artifacts/trustkeyper/.env.local` for Vite:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_ADMIN_PHONES=9999999999
VITE_API_URL=http://localhost:8080/api
```

### 3. Start development

```bash
# Recommended: PGLite (no Docker, data persists in .data/)
pnpm run dev:local

# Alternative: Docker Postgres
pnpm run db:up
pnpm run dev:local:docker
```

This starts:
- Frontend at `http://localhost:5173`
- API server at `http://localhost:8080`

---

## Environment Variables Reference

### Server-side (`.env`)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | `local` for PGLite, or a PostgreSQL connection string |
| `PGLITE_DATA_DIR` | If local | Path for PGLite data files |
| `PORT` / `API_PORT` | Yes | API server port (default 8080) |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase anon key (for JWT verification) |
| `ADMIN_PHONES` | Yes | Comma-separated 10-digit admin phone numbers |
| `RESEND_API_KEY` | For email | Resend API key |
| `FEEDBACK_FROM_EMAIL` | For email | Sender address for feedback notifications |
| `FEEDBACK_NOTIFY_EMAIL` | For email | Recipient for feedback notifications |
| `GEMINI_API_KEY` | For AI | Gemini API key for feedback analysis |
| `GOOGLE_PLACES_API_KEY` | For mobile onboarding location search | Server-only Google Places API (New) key; never expose as `VITE_*` / `EXPO_PUBLIC_*`. Proxied via `/api/v1/location-autocomplete` and `/api/v1/location-details`. |
| `INVITE_EXPIRY_DAYS` | Optional | Days before invitation expires (default: 7) |
| `SYNC_AUTH_DISABLED` | Dev only | Set to `1` to skip JWT checks locally |

### Frontend (`.env.local`)

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `VITE_ADMIN_PHONES` | Yes | Comma-separated admin phone numbers |
| `VITE_API_URL` | Dev only | API base URL including `/api` (e.g. `http://localhost:8080/api`; omit in production to use same-origin `/api`) |

---

## Available Scripts

```bash
# Development
pnpm run dev:local          # Start full stack with PGLite
pnpm run dev:local:docker   # Start full stack with Docker Postgres
pnpm run dev:web            # Frontend only
pnpm run dev:api            # API server only

# Type checking
pnpm run typecheck          # Check everything
pnpm run typecheck:deploy   # Check only what deploys to Vercel

# Database
pnpm run db:push            # Apply schema to local DB
pnpm run db:up              # Start Docker Postgres
pnpm run db:down            # Stop Docker Postgres

# Build
pnpm run build:deploy       # Production build (mirrors Vercel)

# Testing
pnpm run test:run           # Run unit + component tests (Vitest, single run — use in CI)
pnpm run test               # Same tests in watch mode
# E2E via Playwright is planned but not yet set up — see TESTING.md
pnpm run test:coverage      # Run tests with coverage report
```

---

## Branching and Release Process

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full workflow.

Short version:
- Work on `feature/*` or `fix/*` branches
- PRs target `staging` first
- `staging` → `main` is a deliberate release decision

**Never push directly to `main`.**

---

## Database Schema

The database uses a hybrid approach:

- `user_data` — key/value blob store for all user data (profile, properties, tenants, agreements, maintenance). Primary key: `(phone, role, data_key)`.
- `tenant_invitations` — normalised relational table for invitation lifecycle management.
- `feedback` — feedback submissions with optional AI analysis.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for full schema details.

---

## Deployment

Deployments are handled automatically by Vercel across **two projects**:

### App (`trustkeyper`)

| Branch | Environment | URL |
|---|---|---|
| `main` | Production | app.trustkeyper.com |
| `staging` | Staging | staging.app.trustkeyper.com |
| Any PR | Preview | auto-generated Vercel URL |

### Marketing (`trustkeyper-website`)

| Branch | Environment | URL |
|---|---|---|
| `staging` | Production (marketing) | trustkeyper.com |
| Other / PR | Preview | auto-generated Vercel URL |

App production deploys require all CI checks to pass and a PR approval. Marketing production tracks `staging` so marketing can ship independently of the app release to `main`.

---

## Admin Portal

Available at `/admin/login`. Access requires:
1. A phone number listed in `ADMIN_PHONES` / `VITE_ADMIN_PHONES`
2. OTP verification via the same Supabase auth flow

The admin portal shows platform stats, all users, all properties, and all feedback.
