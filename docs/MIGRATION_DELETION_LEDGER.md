# Migration and deletion ledger

This is the release-review ledger for paths that can remove, cascade, orphan,
or make clinical data unreachable. It is not permission to run those paths.

Run `npm run audit:migration-ledger` in `backend` for the complete read-only
inventory. CI records its summary on every change. Before merging a migration,
retention task, cleanup script, or object-storage deletion change, add an entry
to its pull-request description containing:

| Required evidence | Standard |
| --- | --- |
| Scope | Exact tenant/fixture predicate; unscoped mutation is a P1 finding. |
| Impact | Pre/post counts for every affected table and object-store prefix. |
| Relationship behavior | All cascades and `SET NULL` effects, including audit retention. |
| Recovery | Forward-only migration, backup/restore rehearsal, and rollback plan. |
| Verification | Synthetic integration test plus reconciliation after fault injection. |
| Ownership | Clinical/data owner, security reviewer, and expiry for any exception. |

## Existing high-risk operational paths

| Path | Risk control | Status |
| --- | --- | --- |
| `backend/scripts/reseed-dev.js` | Loopback development/test target only; default dry-run; explicit marker, `--apply`, and database-name confirmation. | Guarded; regression-tested. |
| `backend/scripts/cleanup-orphaned-tests.js` | Fixture-prefixed hospitals only; default dry-run; same target and confirmation gate. | Guarded; regression-tested. |
| Asset delete/retry lifecycle | Review database status transition and object deletion as one recoverable operation; reconcile `DELETE_PENDING` after worker/object failures. | Requires fault-injection evidence per change. |
| Prisma migrations with drops/cascades | Never edit an applied migration; add a forward-only migration with impact/recovery evidence. | Required release evidence. |

No script may use an unrestricted production `DATABASE_URL` for cleanup. A
destructive failure, unexpected cascade, orphaned private object, or unscoped
tenant deletion is P1 until resolved.
