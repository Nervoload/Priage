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

async function request(baseUrl, method, route, { token, headers = {}, body } = {}) {
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { 'x-patient-token': token } : {}),
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
});

check('patient app has a durable browser outbox and retries with stable idempotency keys', () => {
  includes('Apps/PatientApp/src/shared/patientOutbox.ts', 'localStorage');
  includes('Apps/PatientApp/src/shared/patientOutbox.ts', 'sendPatientMessageReliable');
  includes('Apps/PatientApp/src/shared/patientOutbox.ts', 'flushPatientMessageOutbox');
  includes('Apps/PatientApp/src/shared/patientOutbox.ts', 'patient-message:${crypto.randomUUID()}');
  includes('Apps/PatientApp/src/shared/api/encounters.ts', "'Idempotency-Key'");
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
});

check('asset storage supports object storage metadata and signed access', () => {
  includes('backend/prisma/schema.prisma', 'enum AssetStorageProvider');
  includes('backend/prisma/schema.prisma', 'enum AssetAccessMode');
  includes('backend/src/modules/assets/asset-storage.service.ts', 'ASSET_STORAGE_PROVIDER');
  includes('backend/src/modules/assets/asset-storage.service.ts', 'createSignedReadUrl');
  includes('backend/src/modules/assets/asset-storage.service.ts', 'X-Amz-Signature');
  includes('backend/src/modules/assets/assets.service.ts', 'accessMode: stored.accessMode');
  includes('backend/src/modules/assets/assets.service.ts', "kind: 'redirect'");
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
