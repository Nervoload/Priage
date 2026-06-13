#!/usr/bin/env node

require('dotenv').config();

const assert = require('assert');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const { TestFixtureTracker } = require('./lib/test-fixtures');
const { buildPatientCookieHeader } = require('./lib/session-cookies');

const baseUrl = process.env.DEPLOYED_TEST_BASE_URL || process.env.BASE_URL || 'http://localhost:8080';
const databaseUrl = process.env.DATABASE_URL || 'postgresql://priage:priage@localhost:6432/priage?schema=public';
const pool = new Pool({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const fixtures = new TestFixtureTracker(prisma, 'deployed-security');
const password = 'SecurityTestPassword123!';

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await fixtures.cleanup().catch((error) => console.error('Fixture cleanup failed:', error.message));
  await prisma.$disconnect().catch(() => {});
  await pool.end().catch(() => {});
});

async function main() {
  const hospitalA = await fixtures.createHospital({ namePrefix: 'Security A', slugPrefix: 'security-a' });
  const hospitalB = await fixtures.createHospital({ namePrefix: 'Security B', slugPrefix: 'security-b' });
  const adminA = await fixtures.createUser({ hospitalId: hospitalA.id, password, role: 'ADMIN', emailPrefix: 'admin-a' });
  const staffA = await fixtures.createUser({ hospitalId: hospitalA.id, password, role: 'STAFF', emailPrefix: 'staff-a' });
  const nurseA = await fixtures.createUser({ hospitalId: hospitalA.id, password, role: 'NURSE', emailPrefix: 'nurse-a' });
  const nurseB = await fixtures.createUser({ hospitalId: hospitalB.id, password, role: 'NURSE', emailPrefix: 'nurse-b' });
  const patientA = await fixtures.createPatient({ password, emailPrefix: 'patient-a' });
  const patientB = await fixtures.createPatient({ password, emailPrefix: 'patient-b' });
  const encounterA = await fixtures.createEncounter({
    hospitalId: hospitalA.id,
    patientId: patientA.id,
    status: 'WAITING',
    chiefComplaint: 'Sensitive complaint A',
    details: 'Sensitive detail A',
  });
  const encounterB = await fixtures.createEncounter({
    hospitalId: hospitalB.id,
    patientId: patientB.id,
    status: 'WAITING',
    chiefComplaint: 'Sensitive complaint B',
    details: 'Sensitive detail B',
  });
  const patientSessionA = await fixtures.createPatientSession({ patientId: patientA.id, encounterId: encounterA.id });
  const patientCookieA = buildPatientCookieHeader(patientSessionA.token);
  const [adminCookie, staffCookie, nurseACookie, nurseBCookie] = await Promise.all([
    login(adminA.email),
    login(staffA.email),
    login(nurseA.email),
    login(nurseB.email),
  ]);

  await check('unauthenticated encounter detail is blocked', async () => {
    expectBlocked(await api(`/encounters/${encounterA.id}`));
  });
  await check('patient IDOR is blocked across patient records', async () => {
    expectBlocked(await api(`/patient/encounters/${encounterB.id}`, { cookie: patientCookieA }));
  });
  await check('staff tenant isolation blocks another hospital encounter', async () => {
    expectBlocked(await api(`/encounters/${encounterB.id}`, { cookie: staffCookie, staff: true }));
  });
  await check('staff encounter read is operationally redacted', async () => {
    const response = await api(`/encounters/${encounterA.id}`, { cookie: staffCookie, staff: true });
    assert.equal(response.status, 200);
    for (const field of ['chiefComplaint', 'details', 'currentCtasLevel', 'currentPriorityScore']) {
      assert.ok(response.json[field] == null, `STAFF response exposed ${field}`);
    }
    assert.equal(response.json.clinicalFieldsRedacted, true);
  });
  await check('staff cannot read clinical messages', async () => {
    expectBlocked(await api(`/messaging/encounters/${encounterA.id}/messages`, { cookie: staffCookie, staff: true }));
  });
  await check('unassigned nurse cannot read a clinical thread', async () => {
    expectBlocked(await api(`/messaging/encounters/${encounterA.id}/messages`, { cookie: nurseACookie, staff: true }));
  });

  await prisma.staffEncounterAccess.create({
    data: {
      encounterId: encounterA.id,
      hospitalId: hospitalA.id,
      userId: nurseA.id,
      grantedByUserId: adminA.id,
      reason: 'deployed security test',
    },
  });
  await check('assigned nurse can read a clinical thread and cross-tenant nurse cannot', async () => {
    assert.equal((await api(`/messaging/encounters/${encounterA.id}/messages`, { cookie: nurseACookie, staff: true })).status, 200);
    expectBlocked(await api(`/messaging/encounters/${encounterA.id}/messages`, { cookie: nurseBCookie, staff: true }));
  });
  await check('cookie-authenticated write requires a trusted origin', async () => {
    const response = await api('/patient-auth/profile', {
      method: 'PATCH',
      cookie: patientCookieA,
      noOrigin: true,
      headers: { 'Idempotency-Key': 'security-origin-test' },
      body: { firstName: 'Blocked' },
    });
    assert.equal(response.status, 403);
  });
  await check('critical patient write is durable and idempotent', async () => {
    const options = {
      method: 'PATCH',
      cookie: patientCookieA,
      headers: { 'Idempotency-Key': 'security-idempotency-test' },
      body: { firstName: 'Idempotent' },
    };
    const first = await api('/patient-auth/profile', options);
    const second = await api('/patient-auth/profile', options);
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.deepEqual(second.json, first.json);
    assert.equal(await prisma.patientIdempotencyRecord.count({
      where: { patientId: patientA.id, idempotencyKey: 'security-idempotency-test' },
    }), 1);
  });
  await check('hospital list results remain tenant scoped', async () => {
    const response = await api('/encounters?limit=100', { cookie: adminCookie, staff: true });
    assert.equal(response.status, 200);
    assert.ok(response.json.data.every((encounter) => encounter.hospitalId === hospitalA.id));
  });
}

async function login(email) {
  const response = await api('/auth/login', {
    method: 'POST',
    body: { email, password },
    staff: true,
  });
  assert.ok(response.status >= 200 && response.status < 300, `login failed for ${email}: ${response.status}`);
  return response.cookies;
}

async function api(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || 'GET',
    headers: {
      ...(options.cookie ? { Cookie: options.cookie } : {}),
      ...(!options.noOrigin && (options.cookie || options.staff)
        ? { Origin: options.staff ? 'http://localhost:8081' : 'http://localhost:8082' }
        : {}),
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  const cookies = (typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie') || ''])
    .map((value) => value.split(';')[0])
    .filter(Boolean)
    .join('; ');
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: response.status, json, cookies };
}

function expectBlocked(response) {
  assert.ok([401, 403, 404].includes(response.status), `expected blocked response, received ${response.status}`);
}

async function check(name, fn) {
  await fn();
  console.log(`ok - ${name}`);
}
