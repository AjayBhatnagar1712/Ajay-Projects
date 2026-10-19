Summary of deployment fix and hardening

What I changed

- Avoid server-only modules being bundled into browser builds by lazily importing server modules in `lib/sync-store/src/index.ts`.
  - Previously `@workspace/db` and `@workspace/db/client` were imported at module scope; those imports can pull `drizzle-orm` and `pg` into browser bundles and cause Vercel build failures.
  - The new implementation uses `import()` and runtime guards so bundlers won't include server-only code in client bundles.

Why this prevents future Vercel build failures

- Dynamic imports prevent static bundlers (Vite/Rollup) from resolving server-only modules into client bundles.
- The repo already includes a GitHub Actions workflow (`.github/workflows/ci.yml`) that runs `pnpm run typecheck:deploy` and `pnpm run build:deploy` on PRs and pushes to `main`, preventing regressions from merging.

Recommended follow-ups

- When adding new workspace packages, keep server-only code behind dynamic imports or conditional `exports` in `package.json`.
- Consider adding an automated check that scans for direct `drizzle-orm` / `pg` imports outside `lib/db` (we already have `scripts/check-drizzle-singleton.mjs` doing this).
- Optionally configure Vercel to run the same `buildCommand` as CI (already mirrored by `build:deploy`).

Files changed

- [lib/sync-store/src/index.ts](lib/sync-store/src/index.ts#L1-L200)

If you want, I can commit these changes and open a PR with the fix and the documentation, or I can proceed to add an automated lint rule to catch server-only imports in client packages.
