# Production Operations

## Required Deployment Boundary

- Expose the backend only through a regional API Gateway or ALB associated with the WAF in `infra/aws/production.tf`.
- Set `GATEWAY_SHARED_SECRET` on the backend and inject the same value as `x-priage-gateway-token` at the trusted gateway. The gateway must strip any client-supplied copy before injecting it, and security groups must deny direct public origin access.
- Use managed PostgreSQL with encryption, automated PITR, Multi-AZ, and a connection proxy.
- Use managed Redis with encryption in transit/at rest and authentication.
- Store application secrets in the configured secrets manager. Never place production credentials in `.env` files or container images.
- Keep `CARE_TEAM_ACCESS_REQUIRED=true`; nurses, doctors, and admins then need an active assignment or audited break-glass grant for clinical reads.
- Treat Redis loss as a readiness failure. Production realtime and distributed limits intentionally fail closed instead of falling back to process-local state.

## Restore Drill

Run quarterly and after database/storage topology changes:

1. Restore the latest database recovery point into an isolated network.
2. Restore a representative encrypted asset version into an isolated quarantine bucket.
3. deploy the matching application release with outbound notifications disabled.
4. Run migrations in validation mode, `npm run test:smoke`, `npm run test:security`, and integrity counts.
5. Record recovery point, recovery time, failed checks, and corrective actions.
6. Destroy the isolated restore after approval.

The drill fails if the measured RPO/RTO exceeds the hospital-approved targets or any audit/encounter/asset relationship cannot be reconciled.

## Incident Runbook

1. Declare severity and incident commander; preserve correlation IDs, WAF samples, auth audit records, and sensitive-read logs.
2. Contain by revoking affected staff sessions, rotating gateway/SSO/storage credentials, and tightening WAF rules.
3. For suspected PHI access, export the immutable read ledger and break-glass records before remediation.
4. For queue/realtime failure, keep Postgres writes available, pause dispatch workers if duplication is suspected, and inspect dead-letter/backlog metrics.
5. For object-storage scanning failure, keep uploads quarantined and disable signed access.
6. Restore from a known-good recovery point only after corruption scope is understood.
7. Complete regulatory/customer notification and a blameless corrective-action review.

## Production Gates

- `NODE_ENV=production`
- `ASSET_STORAGE_PROVIDER=s3`, private bucket, `ASSET_S3_KMS_KEY_ID`, and `ASSET_SCANNER_URL`
- `STAFF_MFA_REQUIRED=true`, `STAFF_MFA_ENCRYPTION_KEY`, SSO issuer/audience/public key
- `CARE_TEAM_ACCESS_REQUIRED=true`
- `STAFF_DEVICE_BINDING_REQUIRED=true`
- `SENSITIVE_READ_AUDIT_FAIL_CLOSED=true`
- `REDIS_TLS=true` and `REDIS_PASSWORD` supplied from secrets manager
- `DATABASE_URL` uses `sslmode=require` or stricter
- WAF/API gateway configured and direct origin access denied
- successful restore drill within the approved RPO/RTO
- successful live IDOR, role-matrix, and 500-user load tests
- successful migration rehearsal with `pgcrypto` available so legacy patient sessions are hashed in place
