# Safety Audit Evidence

This document records a safety-first code audit. It is not a clinical safety certification and does not replace privacy, security, or clinical-owner sign-off.

## Scope and baseline

- Scope: backend controllers/services/Prisma schema and migrations; BullMQ/Redis/Socket.IO; cloud simulation and CI; HospitalApp and PatientApp request paths.
- Dynamic checks use only the disposable local stack and synthetic fixtures.
- The audit began with an intentionally dirty worktree containing active demo-session and HospitalApp work. Those files were reviewed as risk surface but were not altered by this audit.
- Refresh the route inventory before each release with `npm run audit:inventory` from `backend`. It reports route declarations and client route references; it does **not** prove authorization.
- Refresh the deletion/cascade inventory with `npm run audit:migration-ledger` and complete the [migration and deletion ledger](MIGRATION_DELETION_LEDGER.md) for any affected path.

## Severity and evidence standard

| Severity | Meaning | Release rule |
| --- | --- | --- |
| P0 | PHI exposure or an immediate patient-safety hazard | Stop release; mitigate and obtain explicit sign-off. |
| P1 | Lost/corrupt clinical workflow, incorrect authorization, or unrecoverable audit gap | Block release until fixed and regression-tested. |
| P2 | Availability, scaling, recovery, or monitoring defect | Fix before the affected deployment or accept with an owner and deadline. |
| P3 | Maintainability, dead code, duplication, or documentation drift | Track; remove only with proof of non-use. |

Every finding needs: exact path/route, reproducible trigger, affected data or user, expected versus actual behavior, a fix owner, and an automated regression test.

## Route-to-data review matrix

| Surface | Ingress and scope proof | Clinical data boundary | Required evidence |
| --- | --- | --- | --- |
| Staff REST (`/encounters`, triage, messages, alerts, assets) | Staff session guard, role check, hospital-scoped query; clinical routes also call care-team/break-glass access checks | Staff receives operational fields unless a clinical scope is granted | Cross-tenant and unassigned-care-team denial; redaction assertion; sensitive-read ledger assertion. |
| Patient REST and SSE | Patient cookie/session guard plus patient ownership in service queries | Internal messages, triage, alerts, and staff-only assets remain absent | Patient A cannot read/write Patient B; expired session rejected; SSE ownership and connection cap exercised. |
| WebSocket | Revalidated staff session; hospital room plus encounter clinical room only after access check | Operational event payload is redacted; clinical events require a clinical room | Cross-hospital subscription rejection and unassigned-clinician room denial. |
| Partner platform API | Partner credential/scope plus idempotency and tenant-bound intake lookup | Partner context is stored untrusted until confirmation/policy permits projection | Replay, fingerprint conflict, reference race, cancellation, and tenant-isolation tests. |
| Workers and assets | Transactional outbox, Redis/BullMQ claim, asset status lifecycle | Event/asset rows remain recoverable until dispatch/deletion completes | Worker/Redis interruption, stale claim recovery, dead-letter/requeue, and `DELETE_PENDING` reconciliation. |

## Confirmed findings and remediation

| ID | Severity | Finding | Evidence and disposition |
| --- | --- | --- | --- |
| SA-001 | P1 — fixed; PostgreSQL gate required | An immediate post-commit event dispatch could send an unclaimed row while the polling worker later claimed the same unprocessed event. | Immediate dispatch now obtains a durable claim token before emitting, only its lease holder marks completion, and a failed dispatch releases the lease for retry/dead-letter handling. `npm run test:event-lease` covers unit behavior; `npm run test:event-lease:postgres` proves row-level contention, poll claims, stale recovery, dead letters, and stable at-least-once event IDs in the disposable stack. |
| SA-002 | P1 — fixed | Patient registration created the profile and initial session in separate writes; a session failure could leave a partial account. Concurrent registrations could also surface as an unhandled unique violation. | Profile creation and first session now share one transaction; database uniqueness races return the intended conflict response. |
| SA-003 | P2 — hardened | Future call sites could pass patient identifiers or clinical text to logging metadata. | The logger already allowlists operational fields; call sites no longer pass email/complaint text and `logging-sanitization.test.js` verifies that identifiers and free text are dropped. |
| SA-004 | P1 — fixed | Development maintenance scripts could open an arbitrary `DATABASE_URL` and issue broad deletion queries. | Cleanup now refuses non-loopback and non-development/test targets before a pool is created, defaults to a count manifest, and requires marker + `--apply` + exact target confirmation. |
| SA-005 | P1 — fixed | Legacy raw patient-session tokens were enabled by an implicit non-production default; legacy static demo codes had no mandatory expiry. | Both are now explicit, dated migration modes. Valid use records only compatibility-path telemetry, never the credential; raw patient tokens remain forbidden in production. Remove after 30 consecutive zero-use days in the next release. |

## Required release evidence

1. `npm run build`, `npm run test:unit`, `npm run test:event-lease`, `npm run test:security`, `npm run test:load`, and `npm run test:assurance` pass. In the disposable stack, `npm run test:event-lease:postgres` also passes.
2. In the disposable stack: `./priage-cloud up`, `./priage-cloud test`, `./priage-cloud chaos`, `./priage-cloud restore`, then `./priage-cloud down`.
3. Run the capacity workflow at the 500-patient baseline before releases that alter queries, sockets, queues, assets, or rate limits; capture p95/error-rate/event-lag evidence. The harness records transport failures as `status: 0` samples rather than aborting a partially completed run.
   The disposable stack raises only its staff-login throttle so many synthetic staff identities behind one Docker IP can reach post-login capacity paths; it does not relax production controls. Test setup bounds fresh-login concurrency while retaining the configured concurrent socket storm.
4. No P0/P1 findings remain open. P2/P3 exceptions have an owner, expiry, and documented clinical/privacy approval where relevant.

## Measured disposable-stack evidence

- The 500-patient/25-staff baseline passed after the socket-listener race was fixed: 1,545 requests, 75 socket connections, 50 SSE streams, 20 uploads, zero unexpected errors, and p95 372 ms.
- The Redis and PgBouncer interruption drill passed; the logical restore drill preserved `Hospital`, `Encounter`, and `SensitiveReadAuditLog` counts.
- A larger 1,000-patient/50-staff attempt surfaced and fixed two load-harness artifacts (eager socket listeners and unbounded setup logins). A final rerun was inconclusive because the local Docker host could no longer connect to the freshly reported-healthy PgBouncer after a Docker registry outage. Re-run the scheduled capacity workflow in CI or a clean runner before making a capacity claim above the 500-patient baseline.

## Hygiene backlog rules

- `Apps/HospitalApp/src/features/triage/useTriageEncounters.ts` is an explicit unused-hook candidate. Do not delete it until route/UI reachability and import analysis prove it is unused.
- Destructive scripts are test/dev tooling only. They must keep a narrow fixture predicate, print a manifest/count before mutation, and never become a production cleanup mechanism.
- Do not remove duplicated authorization or idempotency code solely because it looks similar; prove equivalent semantics with tests first.
