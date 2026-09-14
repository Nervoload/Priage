# Cleanup baseline

`npm run check:unused` runs Knip in each workspace. The scan is configured
with explicit application and script entrypoints; it is a gate against *new*
unreviewed dead code, not an instruction to delete public-looking helpers.

## Reviewed exclusions

- HospitalApp API, queue, showcase, and UI helper exports remain available to
  independently loaded views and demo tours. They require route-level browser
  coverage before any removal.
- PatientApp API, session, durable-command, and encounter exports remain
  available to recovery flows and direct navigation paths. They require
  patient-session and offline-retry coverage before any removal.
- `Apps/PatientApp/src/shared/api/assets.ts` is intentionally retained as the
  durable-upload contract asserted by the security regression, even while its
  direct UI call sites are feature-gated.
- The role-field authorization matrix is intentionally exported for security
  review and regression evidence; runtime capability checks remain the
  enforcement point.
- `tailwindcss` is currently retained as a reviewed HospitalApp tooling
  dependency. Knip sees no direct import; remove it only in a separately
  approved dependency change after a clean plugin build verifies resolution.

Every exclusion must be removed from the relevant `knip.json` before deleting
the corresponding code. New Knip findings fail CI and must be either removed
with proof or added here with a concrete runtime reason.

## Classified maintenance scripts

| Category | Scripts | Rule |
| --- | --- | --- |
| Supported local maintenance | `bootstrap-dev-accounts`, `create-test-user`, `reseed-dev`, `cleanup-orphaned-tests` | Explicitly invoked; destructive scripts retain their dry-run and target guards. |
| CI/manual integration | `e2e-frontend-flows`, `seed` | Keep until a disposable-stack replacement proves equivalent coverage. |
| Canonical aliases | `test:logging`, `demo:seed` | Use these commands in docs and automation. |
| Deprecated aliases | `test:logging:db`, `seed:full` | Warn and forward for one release, then remove. |
