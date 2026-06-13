#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function check(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    console.error(error.message);
    process.exitCode = 1;
  }
}

function includes(file, value) {
  assert.ok(read(file).includes(value), `${file} should contain ${value}`);
}

check('database pools and production proxy mode are explicit', () => {
  includes('backend/src/common/config/database-pool.config.ts', 'DATABASE_POOL_MAX');
  includes('backend/src/common/config/database-pool.config.ts', 'DATABASE_PROXY_MODE');
  includes('backend/src/common/config/database-pool.config.ts', "settings.proxyMode === 'pgbouncer'");
  includes('backend/src/common/config/production-config.ts', 'pgbouncer');
  includes('backend/src/common/config/production-config.ts', 'rds-proxy');
});

check('cloud simulation includes edge, proxy, storage, scanner, and dashboards', () => {
  for (const service of ['pgbouncer:', 'minio:', 'scanner:', 'edge:', 'prometheus:', 'grafana:']) {
    includes('docker-compose.cloud.yml', service);
  }
  includes('infra/dev/edge/nginx.conf', 'X-Priage-Gateway-Token');
  includes('infra/dev/pgbouncer/pgbouncer.ini', 'pool_mode = transaction');
});

check('deployed stack load covers distinct users, sockets, writes, SSE, and uploads', () => {
  const file = 'backend/scripts/deployed-stack-load.js';
  includes(file, 'DEPLOYED_TEST_PATIENT_COUNT');
  includes(file, 'DEPLOYED_TEST_STAFF_COUNT');
  includes(file, 'patientSession.createMany');
  includes(file, '/patient/assets/intake/images');
  includes(file, 'new FormData()');
  includes(file, 'io(config.baseUrl');
  includes(file, '/events');
});

check('CI enforces security, integration, role, concurrency, chaos, and restore gates', () => {
  const assurance = '.github/workflows/assurance.yml';
  const capacity = '.github/workflows/deployed-capacity.yml';
  for (const value of ['test:unit', 'test:security', 'test:load', 'test:assurance', 'chaos', 'restore']) includes(assurance, value);
  includes(capacity, 'DEPLOYED_TEST_PATIENT_COUNT: 500');
  includes(capacity, 'test:deployed-stack');
});

check('operational policies cover lifecycle, SLOs, and clinical governance', () => {
  includes('docs/DATA_LIFECYCLE_AND_AUDIT_POLICY.md', 'Immutable Audit');
  includes('docs/SLO_AND_ALERT_POLICY.md', 'Event delivery lag');
  includes('docs/CLINICAL_GOVERNANCE.md', 'emergency escalation');
  includes('docs/FULL_STACK_SIMULATION.md', './priage-cloud');
});

check('frontend STAFF defaults exclude clinical waiting-room access', () => {
  includes('backend/src/modules/hospitals/hospital-config.ts', "[Role.STAFF]: ['admit', 'settings']");
  includes('Apps/HospitalApp/src/app/HospitalApp.tsx', "STAFF: ['admit', 'settings']");
  includes('Apps/HospitalApp/src/app/HospitalApp.tsx', '!encounter.clinicalFieldsRedacted');
});

check('request tracing and operational metrics are exposed', () => {
  includes('backend/src/common/telemetry/request-telemetry.interceptor.ts', 'durationMs');
  includes('backend/src/modules/health/health.service.ts', 'getPrometheusMetrics');
  includes('backend/src/modules/health/health.service.ts', 'breakGlassReads');
  includes('backend/src/modules/health/health.service.ts', 'event_lag');
});

check('sensitive read and break-glass ledgers have an immutable export path', () => {
  includes('backend/scripts/export-sensitive-audit.js', "ObjectLockMode: 'COMPLIANCE'");
  includes('backend/scripts/export-sensitive-audit.js', 'sensitiveReadAuditLog.findMany');
  includes('backend/scripts/export-sensitive-audit.js', 'breakGlassAccess.findMany');
  includes('infra/aws/production.tf', 'aws_s3_bucket_object_lock_configuration');
});

if (process.exitCode) process.exit(process.exitCode);
