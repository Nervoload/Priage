# Backend testing guide

Use synthetic data and disposable infrastructure only. The commands below are
the current supported entrypoints; legacy aliases print a warning for one
release before removal.

| Goal | Command | Notes |
| --- | --- | --- |
| Compile and unit checks | `npm run build && npm run test:unit` | Includes safety, compatibility, and cleanup tests. |
| Static security and load invariants | `npm run test:security && npm run test:load && npm run test:assurance` | Source-level guardrails; not a replacement for integration tests. |
| Disposable safety stack | `./priage-cloud up && ./priage-cloud test && ./priage-cloud chaos && ./priage-cloud restore && ./priage-cloud down` | Runs synthetic tenant, worker, recovery, and capacity checks. |
| PostgreSQL event lease | `npm run test:event-lease:postgres` | Requires the disposable stack or another approved synthetic PostgreSQL database. |
| Unused-code review | `npm run check:unused` | New findings fail; reviewed exclusions live in `docs/CLEANUP_BASELINE.md`. |
| Documentation links | `npm run check:docs` | Validates local Markdown links without network access. |

`test:logging` and `demo:seed` are canonical commands. `test:logging:db`
and `seed:full` are temporary forwarding aliases; use the canonical names in
new automation and documentation.

Historical implementation notes remain available in the older files in this
directory. They are reference material, not the command source of truth.
