#!/usr/bin/env node
// Static security regression checks for patient/cloud hardening invariants.

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

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

function includes(file, expected, message) {
  assert.ok(read(file).includes(expected), message || `${file} should contain ${expected}`);
}

function matches(file, pattern, message) {
  assert.match(read(file), pattern, message || `${file} should match ${pattern}`);
}

async function request(baseUrl, method, route, { token, bearerToken, headers = {}, body } = {}) {
  const gatewayToken = process.env.SECURITY_TEST_GATEWAY_TOKEN;
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Cookie: `priage_patient_session=${token}` } : {}),
      ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
      ...(token ? { Origin: process.env.SECURITY_TEST_ORIGIN || baseUrl } : {}),
      ...(gatewayToken ? { 'x-priage-gateway-token': gatewayToken } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  return { status: response.status, body: text };
}

function requireEnv(name) {
  const value = process.env[name];
  assert.ok(value, `${name} is required`);
  return value;
}

function expectBlocked(response, label) {
  assert.ok(
    [401, 403, 404].includes(response.status),
    `${label} should be blocked with 401/403/404, got ${response.status}`,
  );
}

async function runLiveSecurityChecks() {
  const baseUrl = process.env.SECURITY_TEST_BASE_URL || process.env.BASE_URL || 'http://localhost:3000';
  const patientAToken = requireEnv('SECURITY_TEST_PATIENT_A_TOKEN');
  const patientAEncounterId = requireEnv('SECURITY_TEST_PATIENT_A_ENCOUNTER_ID');
  const patientBEncounterId = requireEnv('SECURITY_TEST_PATIENT_B_ENCOUNTER_ID');

  await checkAsync('live IDOR blocks patient A from patient B encounter', async () => {
    const response = await request(
      baseUrl,
      'GET',
      `/patient/encounters/${patientBEncounterId}`,
      { token: patientAToken },
    );
    expectBlocked(response, 'cross-patient encounter read');
  });

  await checkAsync('live IDOR blocks cross-patient message send retry path', async () => {
    const response = await request(
      baseUrl,
      'POST',
      `/patient/encounters/${patientBEncounterId}/messages`,
      {
        token: patientAToken,
        headers: { 'Idempotency-Key': `security-smoke-${Date.now()}` },
        body: { content: 'security smoke should not be accepted' },
      },
    );
    expectBlocked(response, 'cross-patient message write');
  });

  await checkAsync('live unauthenticated clinical read is blocked', async () => {
    const response = await request(baseUrl, 'GET', '/messaging/encounters/1/messages');
    expectBlocked(response, 'unauthenticated staff message read');
  });

  await checkAsync('live critical patient write rejects a missing idempotency key', async () => {
    const response = await request(
      baseUrl,
      'POST',
      `/patient/encounters/${patientAEncounterId}/cancel`,
      { token: patientAToken, body: {} },
    );
    assert.equal(response.status, 400, `missing idempotency key should return 400, got ${response.status}`);
  });

  const staffToken = process.env.SECURITY_TEST_STAFF_TOKEN;
  const staffCookie = process.env.SECURITY_TEST_STAFF_COOKIE;
  const staffAuth = staffCookie
    ? { headers: { Cookie: staffCookie } }
    : { bearerToken: staffToken };
  const staffEncounterId = process.env.SECURITY_TEST_STAFF_ENCOUNTER_ID;
  const staffHospitalId = process.env.SECURITY_TEST_STAFF_HOSPITAL_ID;
  if ((staffToken || staffCookie) && staffEncounterId) {
    await checkAsync('live STAFF encounter detail excludes clinical fields', async () => {
      const response = await request(baseUrl, 'GET', `/encounters/${staffEncounterId}`, staffAuth);
      assert.equal(response.status, 200);
      const body = JSON.parse(response.body);
      for (const field of ['chiefComplaint', 'details', 'currentCtasLevel', 'currentPriorityScore', 'priagePreview']) {
        assert.ok(body[field] === undefined || body[field] === null, `STAFF response exposed ${field}`);
      }
      assert.deepEqual(body.triageAssessments, []);
      assert.deepEqual(body.messages, []);
    });
  }

  if ((staffToken || staffCookie) && staffHospitalId) {
    await checkAsync('live STAFF queue excludes triage notes and priority fields', async () => {
      const response = await request(baseUrl, 'GET', `/hospitals/${staffHospitalId}/queue`, staffAuth);
      assert.equal(response.status, 200);
      for (const encounter of JSON.parse(response.body).encounters || []) {
        for (const field of ['currentCtasLevel', 'currentPriorityScore', 'triageAssessments', 'note']) {
          assert.ok(encounter[field] === undefined, `STAFF queue exposed ${field}`);
        }
      }
    });
  }

  const unassignedClinicalToken = process.env.SECURITY_TEST_UNASSIGNED_CLINICAL_TOKEN;
  const unassignedClinicalCookie = process.env.SECURITY_TEST_UNASSIGNED_CLINICAL_COOKIE;
  if ((unassignedClinicalToken || unassignedClinicalCookie) && staffEncounterId) {
    await checkAsync('live care-team rule blocks unassigned clinical thread access', async () => {
      const response = await request(
        baseUrl,
        'GET',
        `/messaging/encounters/${staffEncounterId}/messages`,
        unassignedClinicalCookie
          ? { headers: { Cookie: unassignedClinicalCookie } }
          : { bearerToken: unassignedClinicalToken },
      );
      expectBlocked(response, 'unassigned clinical message read');
    });
  }
}

async function checkAsync(name, fn) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    console.error(error.message);
    process.exitCode = 1;
  }
}

check('patient sessions are generated opaque and stored hashed', () => {
  includes(
    'backend/src/modules/patient-auth/patient-session-token.util.ts',
    "randomBytes(32).toString('base64url')",
  );
  includes(
    'backend/src/modules/patient-auth/patient-auth.service.ts',
    'token: hashPatientSessionToken(token)',
  );
  includes(
    'backend/src/modules/auth/guards/patient.guard.ts',
    'const tokenHash = hashPatientSessionToken(token)',
  );
  includes(
    'backend/prisma/migrations/20260612120000_production_hardening/migration.sql',
    'encode(digest("token", \'sha256\'), \'hex\')',
  );
  includes('backend/scripts/lib/test-fixtures.js', 'hashPatientSessionToken(token)');
  includes('backend/scripts/demo-seed.js', 'hashPatientSessionToken(generatePatientSessionToken())');
});

check('legacy patient session tokens are migrated instead of accepted forever raw', () => {
  includes(
    'backend/src/modules/auth/guards/patient.guard.ts',
    'where: { token }',
  );
  includes(
    'backend/src/modules/auth/guards/patient.guard.ts',
    'data: { token: tokenHash }',
  );
  includes(
    'backend/src/modules/auth/guards/patient.guard.ts',
    "!== 'production'",
  );
  includes(
    'backend/src/common/config/production-config.ts',
    'ALLOW_LEGACY_RAW_PATIENT_TOKENS cannot be enabled in production',
  );
});

check('cookie-auth mutating routes have origin/csrf guard registered globally', () => {
  includes('backend/src/common/http/origin-csrf.guard.ts', 'SAFE_METHODS');
  includes('backend/src/common/http/origin-csrf.guard.ts', 'Request origin is not allowed');
  includes('backend/src/app.module.ts', 'useClass: OriginCsrfGuard');
});

check('patient routes use Redis-backed patient/session/write/upload quotas', () => {
  includes('backend/src/modules/auth/guards/patient-rate-limit.guard.ts', 'this.redis.eval');
  includes('backend/src/modules/auth/guards/patient-rate-limit.guard.ts', 'PATIENT_GLOBAL_RATE_LIMIT_PER_MINUTE');
  includes('backend/src/modules/auth/guards/patient-rate-limit.guard.ts', 'PATIENT_WRITE_RATE_LIMIT_PER_MINUTE');
  includes('backend/src/modules/auth/guards/patient-rate-limit.guard.ts', 'PATIENT_UPLOAD_RATE_LIMIT_PER_MINUTE');
  matches(
    'backend/src/modules/messaging/patient-messaging.controller.ts',
    /@UseGuards\(PatientGuard,\s*PatientRateLimitGuard\)/,
  );
});

check('patient write routes are backed by durable idempotency records', () => {
  includes('backend/prisma/schema.prisma', 'model PatientIdempotencyRecord');
  includes('backend/src/modules/auth/patient-idempotency.service.ts', 'patientId_command_idempotencyKey');
  includes('backend/src/modules/auth/patient-idempotency.service.ts', 'requestFingerprint');
  includes('backend/src/modules/auth/patient-idempotency.service.ts', 'Idempotency-Key must be');
  includes('backend/src/modules/messaging/patient-messaging.controller.ts', 'PatientIdempotencyService');
  includes('backend/src/modules/intake/intake.controller.ts', 'patient.intake.confirm');
  includes('backend/src/main.ts', 'Idempotency-Key');
  includes('backend/src/modules/auth/patient-idempotency.service.ts', 'Idempotency-Key is required');
  includes('backend/src/modules/auth/patient-idempotency.service.ts', 'PATIENT_IDEMPOTENCY_STALE_AFTER_MS');
});

check('patient app has a durable browser outbox and retries with stable idempotency keys', () => {
  includes('Apps/PatientApp/src/shared/patientOutbox.ts', 'localStorage');
  includes('Apps/PatientApp/src/shared/patientOutbox.ts', 'sendPatientMessageReliable');
  includes('Apps/PatientApp/src/shared/patientOutbox.ts', 'flushPatientMessageOutbox');
  includes('Apps/PatientApp/src/shared/patientOutbox.ts', 'patient-message:${crypto.randomUUID()}');
  includes('Apps/PatientApp/src/shared/api/encounters.ts', "'Idempotency-Key'");
  includes('Apps/PatientApp/src/shared/patientCommandOutbox.ts', 'indexedDB.open');
  includes('Apps/PatientApp/src/shared/patientCommandOutbox.ts', 'sendDurablePatientUpload');
  includes('Apps/PatientApp/src/shared/api/assets.ts', 'sendDurablePatientUpload');
  includes('Apps/PatientApp/src/shared/api/intake.ts', 'sendDurablePatientCommand');
  includes('Apps/PatientApp/src/shared/api/priage.ts', 'sendDurablePatientCommand');
});

check('staff clinical reads exclude STAFF role on high-risk resources', () => {
  const files = [
    'backend/src/modules/messaging/messaging.controller.ts',
    'backend/src/modules/assets/assets.controller.ts',
    'backend/src/modules/patients/patients.controller.ts',
    'backend/src/modules/triage/triage.controller.ts',
    'backend/src/modules/alerts/alerts.controller.ts',
  ];

  for (const file of files) {
    assert.ok(!read(file).includes('@Roles(Role.STAFF'), `${file} should not grant STAFF clinical reads`);
  }
});

check('sensitive read audit ledger exists for chart/profile/message/triage/asset access', () => {
  includes('backend/prisma/schema.prisma', 'model SensitiveReadAuditLog');
  includes('backend/src/modules/audit/sensitive-read-audit.service.ts', 'sensitiveReadAuditLog.create');
  includes('backend/src/modules/encounters/encounters.service.ts', "resource: 'ENCOUNTER_DETAIL'");
  includes('backend/src/modules/patients/patients.service.ts', "resource: 'PATIENT_PROFILE'");
  includes('backend/src/modules/messaging/messaging.service.ts', "resource: 'MESSAGE_THREAD'");
  includes('backend/src/modules/triage/triage.service.ts', "resource: 'TRIAGE_ASSESSMENT'");
  includes('backend/src/modules/assets/assets.service.ts', "resource: 'ASSET_CONTENT'");
  includes('backend/src/modules/encounters/encounters.service.ts', "resource: 'ENCOUNTER_LIST'");
  includes('backend/src/modules/hospitals/hospitals.service.ts', "resource: 'HOSPITAL_QUEUE'");
});

check('explicit clinical field matrix redacts STAFF and supports care-team/break-glass access', () => {
  const policy = read('backend/src/modules/clinical-access/clinical-access.policy.ts');
  const staffCapabilities = policy.match(/\[Role\.STAFF\]: new Set\(\[([\s\S]*?)\]\)/)?.[1] || '';
  const staffFields = policy.match(/STAFF_OPERATIONAL_ENCOUNTER_FIELDS = Object\.freeze\(\[([\s\S]*?)\] as const\)/)?.[1] || '';
  assert.ok(staffCapabilities, 'STAFF capabilities must be explicitly defined');
  assert.ok(!staffCapabilities.includes('.clinical'), 'STAFF must not have clinical capabilities');
  for (const field of ['chiefComplaint', 'details', 'currentCtasLevel', 'currentPriorityScore', 'triageAssessments', 'note']) {
    assert.ok(!staffFields.includes(`'${field}'`), `STAFF operational field matrix exposed ${field}`);
  }
  includes('backend/src/modules/clinical-access/clinical-access.policy.ts', 'STAFF_OPERATIONAL_ENCOUNTER_FIELDS');
  includes('backend/src/modules/clinical-access/clinical-access.policy.ts', 'ROLE_FIELD_AUTHORIZATION');
  includes('backend/src/modules/clinical-access/clinical-access.policy.ts', 'CLINICAL_ENCOUNTER_FIELDS');
  includes('backend/src/modules/clinical-access/clinical-access.policy.ts', "[Role.STAFF]");
  includes('backend/src/modules/encounters/encounters.service.ts', 'toOperationalEncounter');
  includes('backend/src/modules/hospitals/hospitals.service.ts', 'clinicalFieldsRedacted');
  includes('backend/src/modules/clinical-access/clinical-access.service.ts', 'staffEncounterAccess');
  includes('backend/src/modules/clinical-access/clinical-access.service.ts', 'createBreakGlassAccess');
  includes('backend/src/modules/clinical-access/clinical-access.service.ts', 'assertClinicalAssetAccess');
  includes('backend/src/modules/clinical-access/clinical-access.service.ts', 'assertClinicalMessageAccess');
  includes('backend/src/modules/clinical-access/clinical-access.service.ts', 'assertClinicalPatientAccess');
  includes('backend/src/modules/clinical-access/clinical-access.service.ts', 'assertClinicalAlertAccess');
  includes('backend/src/modules/realtime/realtime.gateway.ts', 'toOperationalEncounterUpdatePayload');
  includes('backend/src/modules/encounters/encounters.controller.ts', 'redactStaffWriteResponse');
  assert.ok(
    !read('backend/src/modules/clinical-access/clinical-access.service.ts').includes('context.role === Role.ADMIN'),
    'ADMIN must not bypass care-team or break-glass access when care-team enforcement is enabled',
  );
  includes('backend/src/modules/encounters/patient-encounters.controller.ts', 'toPatientEventMetadata');
});

check('staff sessions support MFA, SSO, device binding, and session caps', () => {
  includes('backend/src/modules/auth/staff-mfa.service.ts', 'otpauth://totp');
  includes('backend/src/modules/auth/auth.service.ts', 'loginWithSso');
  includes('backend/src/modules/auth/auth.service.ts', 'STAFF_DEVICE_BINDING_REQUIRED');
  includes('backend/src/modules/auth/auth.service.ts', 'STAFF_MAX_ACTIVE_SESSIONS');
  includes('backend/src/modules/auth/auth.service.ts', 'STAFF_SESSION_IDLE_TIMEOUT_MS');
});

check('patient session tokens stay cookie-only in production', () => {
  includes('backend/src/modules/patient-auth/patient-auth.controller.ts', 'const { sessionToken: _, ...responseBody }');
  includes('backend/src/modules/intake/intake.controller.ts', 'const { sessionToken: _, ...responseBody }');
  includes('backend/src/modules/auth/guards/patient.guard.ts', 'ALLOW_PATIENT_TOKEN_HEADER');
});

check('edge limiter protects public and invalid-token traffic before application auth', () => {
  includes('backend/src/common/http/edge-rate-limit.guard.ts', 'EDGE_PUBLIC_AUTH_LIMIT');
  includes('backend/src/common/http/edge-rate-limit.guard.ts', 'EDGE_TOKEN_ATTEMPT_LIMIT');
  includes('backend/src/common/http/edge-rate-limit.guard.ts', 'token-attempt');
  includes('backend/src/common/http/edge-rate-limit.guard.ts', 'GATEWAY_SHARED_SECRET');
  includes('backend/src/app.module.ts', 'useClass: EdgeRateLimitGuard');
  includes('backend/src/realtime/realtime.gateway.ts'.replace('/realtime/', '/modules/realtime/'), 'SOCKET_CONNECTIONS_PER_USER');
  includes('backend/src/modules/realtime/realtime-redis-adapter.service.ts', "NODE_ENV || '').trim().toLowerCase() === 'production'");
});

check('asset storage uses official SDK, KMS, malware scanning, and deletion reconciliation', () => {
  includes('backend/prisma/schema.prisma', 'enum AssetStorageProvider');
  includes('backend/prisma/schema.prisma', 'enum AssetAccessMode');
  includes('backend/src/modules/assets/asset-storage.service.ts', 'ASSET_STORAGE_PROVIDER');
  includes('backend/src/modules/assets/asset-storage.service.ts', 'createSignedReadUrl');
  includes('backend/src/modules/assets/asset-storage.service.ts', '@aws-sdk/client-s3');
  includes('backend/src/modules/assets/asset-storage.service.ts', 'ASSET_S3_KMS_KEY_ID');
  includes('backend/src/modules/assets/asset-storage.service.ts', 'promoteFromQuarantine');
  includes('backend/src/modules/assets/asset-scan.service.ts', 'ASSET_SCANNER_URL');
  includes('backend/src/modules/assets/assets.service.ts', 'reconcilePendingDeletes');
  includes('backend/src/modules/assets/assets.service.ts', 'accessMode: stored.accessMode');
  includes('backend/src/modules/assets/assets.service.ts', "kind: 'redirect'");
});

check('production infrastructure defines WAF, private KMS assets, PITR backup, secrets, and restore runbook', () => {
  includes('infra/aws/production.tf', 'aws_wafv2_web_acl');
  includes('infra/aws/production.tf', 'aws_s3_bucket_public_access_block');
  includes('infra/aws/production.tf', 'DenyInsecureTransport');
  includes('infra/aws/production.tf', 'expire-quarantine');
  includes('infra/aws/production.tf', 'enable_continuous_backup = true');
  includes('infra/aws/production.tf', 'aws_backup_vault_lock_configuration');
  includes('infra/aws/production.tf', 'aws_secretsmanager_secret');
  includes('docs/PRODUCTION_OPERATIONS.md', 'Restore Drill');
  includes('docs/PRODUCTION_OPERATIONS.md', 'Incident Runbook');
});

check('patient-owned reads use server-side ownership checks instead of URL-only identifiers', () => {
  includes('backend/src/modules/encounters/encounters.service.ts', 'assertPatientOwnsEncounter');
  includes('backend/src/modules/assets/assets.service.ts', 'asset.encounter?.patientId === patientId');
  includes('backend/src/modules/messaging/messaging.service.ts', 'listMessagesForPatient');
});

(async () => {
  if (!process.exitCode && process.env.RUN_LIVE_SECURITY_TEST === '1') {
    await runLiveSecurityChecks();
  }

  if (process.exitCode) {
    process.exit(process.exitCode);
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
