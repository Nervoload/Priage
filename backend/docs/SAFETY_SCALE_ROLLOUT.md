# Safety and scale rollout

This runbook covers the operational steps that cannot be completed safely as a
source-code change. Consent and Azure infrastructure are outside this rollout.

## 1. Validate the release

Run clean installs in `backend`, `Apps/HospitalApp`, and `Apps/PatientApp`, then
run the Assurance workflow. The backend install must be followed by
`npm run prisma:generate` and `npx prisma validate`.

Keep these production settings in force:

- `NODE_ENV=production`
- `TRIAGE_INTERVIEW_MODE=deterministic`
- no `TRIAGE_AI_API_KEY` or `TRIAGE_AI_BASE_URL`
- `ALERT_RULE_ENGINE_MODE=shadow`
- a dedicated 32-byte `WEBHOOK_SECRET_ENCRYPTION_KEY`
- exact webhook hostnames in `WEBHOOK_ALLOWED_HOSTS`
- a generic credential-free HTTPS `HOSPITAL_DASHBOARD_URL`

## 2. Apply expand migrations

Apply the four migrations introduced by this release. They add alert rule state,
the webhook outbox, hospital memberships, and alert-escalation exceptions. The
membership migration backfills one membership from each user's existing
hospital and role, and backfills existing staff sessions where possible.

Use the non-interactive provisioning command to link a global identity to
another hospital:

```sh
npm run staff:provision -- --email operator@example.ca --hospital-slug pilot-clinic --role IT_ADMIN
```

For a new identity, also pass `--password-file /secure/path/password`. The
identity and first membership are created in one transaction; the password is
never supplied on the command line.

## 3. Classify legacy administrators

Prepare the mapping outside the repository and do not commit it:

```json
[
  {
    "email": "operator@example.ca",
    "hospitalSlug": "pilot-clinic",
    "role": "IT_ADMIN"
  },
  {
    "email": "clinical-lead@example.ca",
    "hospitalSlug": "pilot-clinic",
    "role": "CLINICAL_ADMIN"
  }
]
```

Run:

```sh
npm run staff:classify-admins -- --mapping /secure/path/admin-classification.json
node scripts/verify-staff-cutover.js
```

The classifier rejects missing, duplicate, unknown, or ineligible entries,
records the changes in the audit log, and revokes affected sessions. Production
cutover remains blocked while any `ADMIN` membership or active legacy session
without a membership remains.

After one compatibility release has proven membership-scoped authentication,
create the contract migration that removes `User.hospitalId`, `User.role`, the
legacy `ADMIN` enum value, and nullable legacy session compatibility. Do not
create or apply that contract migration before classification succeeds.

## 4. Prove runtime behavior

Against the deployed test stack, provide the documented `RUNTIME_TEST_*`,
database, and Redis environment variables and run:

```sh
npm run test:runtime-shutdown
npm run test:realtime
```

Configure `BASE_URL_SOCKET_SECONDARY` for the realtime test so it connects to a
second backend replica. The test verifies cross-replica broadcast, WebSocket
reconnect, and REST reconciliation. The shutdown test sends SIGTERM and checks
Socket.IO disconnect plus Prisma, Redis, and BullMQ connection cleanup.

## 5. Configure escalation targets

For every pilot hospital, create a webhook in Hospital Settings, store the
one-time signing secret in the receiver, send a test, and confirm the delivery
is successful. If a target cannot be provided temporarily, record a reason and
expiry through the readiness exception endpoint.

Run `npm run alerts:verify-activation`. It must report every hospital ready
before alert activation.

## 6. Shadow and activate alerts

Leave `ALERT_RULE_ENGINE_MODE=shadow` for at least 24 hours of pilot traffic.
Compare rule matches with the seeded exact-boundary fixtures and review:

- evaluation latency and missing lifecycle timestamps;
- sweep duration, pages, and evaluated encounters;
- active alerts by severity and dedupe conflicts;
- webhook backlog age, retries, and permanent failures;
- hospitals without a tested escalation target.

After clinical sign-off and a successful readiness gate, set
`ALERT_RULE_ENGINE_MODE=active` and deploy. Continue monitoring the same metrics.
Do not activate keyword-based complaint or profile-review rules.

## 7. Repository hygiene

The working branch is `azure`; its name does not authorize Azure changes. Do not
delete or prune branches without explicit approval. Reconcile the release branch
with `main` before opening collaborative feature branches, preserving the
pre-existing realtime work.
