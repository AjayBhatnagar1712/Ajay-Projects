# Vercel prototype database (mock mode)

For demos and trials without Postgres or Vercel Blob, the API uses an **in-memory fake database** preloaded with demo accounts.

## When it activates

Mock mode is used when **any** of these is true:

1. `USE_MOCK_DB=1` in environment variables
2. `DATABASE_URL=mock`
3. **Vercel deploy** with no `DATABASE_URL` (or `local` / `pglite`) and no `BLOB_READ_WRITE_TOKEN`

## Demo accounts (pre-seeded)

| Role   | Phone      | Login / signup                         |
|--------|------------|----------------------------------------|
| Owner  | 9876543210 | Any 4-digit OTP; includes 1 demo property |
| Broker | 9876543211 | Any 4-digit OTP                        |

After login, use **Pull from cloud** implicitly on login — data loads from the mock API.

## Vercel setup

1. Deploy the repo to Vercel (no database required for trial).
2. Optional: add env var `USE_MOCK_DB=1` to force mock mode even if other vars exist.
3. Open the site → **Login** or **Sign up** with a demo phone above, or register a new number (stored until the serverless function cold-starts).

## Local testing with mock DB

```bash
# In .env
USE_MOCK_DB=1
PORT=8080

pnpm run dev:api
# separate terminal
pnpm --filter @workspace/trustkeyper run dev
```

Or seed the file-based store (persists on disk):

```bash
node scripts/seed-prototype-db.mjs
pnpm run dev:local
```

## Limitations

- **Not persistent** on Vercel: each cold start reloads seed data; new signups may disappear later.
- For persistent trials, use [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres) or set `BLOB_READ_WRITE_TOKEN` for JSON blob storage.
