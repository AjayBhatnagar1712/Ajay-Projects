# Project Housekeeping

- Fetch and compare `origin/staging` and `origin/main` before new work. Their
  intentional differences are not permission to merge or deploy.
- Start new feature/fix branches from current staging. Continue existing PR
  branches for fixes to that feature, bringing staging into them as needed.
- Never work directly on staging or main. Keep one feature/fix per branch.
- Test and review the complete change before opening/updating its PR. Feature
  PRs target staging. Read the actual diff before any merge.
- Promotion from staging to main is a separate reviewed release after staging
  validation; production schema changes are a separate step.
- Migrations are staging-first and additive. Do not run destructive migrations,
  production writes, credential changes, or production releases without explicit
  user approval of the concrete operation.
- Ajay has restricted deployments and billable actions. Having account credentials
  or a handoff document does not remove that restriction. Check whether a push
  will trigger an automatic deployment before publishing changes.
- Keep secrets in local secret stores/environment variables. Never commit or echo
  passwords, API keys, private keys, tokens, or the credentials handoff document.
- Check environment targets without printing credentials before running servers,
  migrations, seeds, payment calls, or other operations that can write data.
- Payment tests use staging and test-mode Razorpay. The new consultancy-fee/rent
  flow requires Aman's business/compliance sign-off before real-money launch.
- Keep eSign's manual admin upload fallback. Provider integration requires the
  Phase A decision before Phase B implementation.
- Inventory document extraction is inventory-only and requires broker review and
  explicit save. Do not broaden it to full agreement extraction.
- Preserve unrelated local changes. Use `docs/handoff-status.md` and verified
  code/dashboard evidence to resolve stale notes in `docs/open-items.md`.
