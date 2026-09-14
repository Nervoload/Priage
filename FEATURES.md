# Priage feature map

Priage is an encounter-centred hospital workflow system. The source of truth
is the backend service and Prisma domain model; both browser apps consume
authenticated API and realtime surfaces rather than maintaining clinical state
locally.

## Patient flow

1. A patient begins a draft intake and receives an opaque cookie-backed
   session.
2. Intake details and interview context accumulate on the draft.
3. Confirmation creates or reuses a hospital encounter through durable,
   idempotent workflow commands.
4. The patient can view their own encounter, queue state, messages, assets,
   and realtime updates. Ownership and session expiry are enforced server-side.

## Hospital flow

- Staff authenticate into a hospital-scoped session.
- Admittance, triage, waiting-room, messaging, alerts, analytics, and settings
  all load from hospital-scoped backend APIs.
- Clinical fields require care-team assignment or break-glass access, with
  sensitive reads recorded in the audit ledger.
- Socket and SSE updates complement bounded refreshes; they do not bypass the
  REST authorization boundary.

## Platform and operations

- Partner intake uses scoped credentials, external-reference claims, and
  idempotent commands.
- Outbox events are leased, retried, dead-lettered, and reconciled by workers.
- Private assets use scanning, lifecycle states, and deletion reconciliation.
- The disposable stack provides synthetic security, load, chaos, restore, and
  event-lease evidence. See [the safety audit](docs/SAFETY_AUDIT.md) and
  [backend testing guide](backend/docs/TESTING.md).

Feature-specific implementation details belong beside the owning module or in
the safety/operations documentation. Do not add client-only mock workflow
instructions here; they drift from the clinical backend contract.
