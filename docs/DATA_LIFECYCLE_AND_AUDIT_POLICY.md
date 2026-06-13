# Data Lifecycle And Audit Policy

## Storage Classes

| Data | Hot operational store | Cold or immutable store | Minimum retention | Deletion behavior |
| --- | --- | --- | --- | --- |
| Active encounters, triage, and messages | Encrypted PostgreSQL primary and replicas | Encrypted backup/PITR | Hospital policy plus legal requirement | Tombstone first, reconcile related assets, then approved purge |
| Closed encounter history | PostgreSQL for the active clinical lookback window | Encrypted archive after 365 days | Hospital and jurisdiction specific | Two-person approved archive deletion |
| Clean clinical assets | Private KMS-encrypted object storage | Infrequent access after 90 days, archive after 365 days | Match parent encounter | Database marks `DELETE_PENDING`; reconciler confirms object deletion |
| Quarantined or rejected assets | Private quarantine prefix | None | 30 days maximum | Scanner or reconciliation job removes object and records outcome |
| Application logs | PostgreSQL for 30 days | Sanitized centralized log platform | 365 days unless policy requires longer | No PHI payloads; automated lifecycle |
| Sensitive-read and break-glass audit | PostgreSQL append-only application path | Daily export to WORM/Object Lock storage | 7 years by default, subject to hospital policy | No application deletion; legal hold overrides lifecycle |
| Backups | Encrypted managed backup vault with PITR | Vault lock and cold tier | 365 days default | Vault-lock lifecycle only |

## Required Controls

- Production databases, backups, archives, and object storage use separate KMS keys with rotation and least-privilege grants.
- Active records are never moved cold while an encounter is open, under legal hold, or has unresolved deletion reconciliation.
- Every deletion request produces a correlation ID, actor, reason, affected-record manifest, and reconciliation result.
- Object deletion is asynchronous and retryable. Database records remain `DELETE_PENDING` until storage confirms deletion.
- Restore drills verify encounter, message, asset, sensitive-read, and audit relationship counts.

## Immutable Audit

`SensitiveReadAuditLog` and break-glass records are append-only from the application. Production must export them at least daily to WORM storage with Object Lock/compliance retention. The export manifest includes record counts and SHA-256 hashes and is validated during restore drills. Application database credentials must not have permission to delete WORM audit exports.

Run `npm run audit:export` from a restricted scheduled task at least hourly. It writes SHA-256-manifested JSONL objects with compliance Object Lock to `AUDIT_ARCHIVE_BUCKET`. The scheduled task records its output key and manifest hash in the centralized operations log.

## Ownership

The hospital privacy officer approves retention and legal holds. Platform operations owns lifecycle automation and reconciliation. Security owns audit-export integrity. Clinical governance approves any retention change that could affect the clinical record.
