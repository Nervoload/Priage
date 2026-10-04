#!/usr/bin/env node
// Run after the communications service-level fixture, against a loopback mock API.
require('dotenv').config();
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const { readFileSync } = require('node:fs');
const { decrypt } = require('../dist/modules/notifications/notification-core');
const fixture = JSON.parse(readFileSync(process.env.CLINIC_RECOVERY_FIXTURE || '/tmp/priage-communications-fixture.json', 'utf8'));
const base = process.env.CLINIC_SMOKE_BASE_URL || 'http://localhost:3011';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname) || !['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname)) throw Error('Mock loopback only');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });
let demoCookie = '';
async function call(path, method = 'GET', body, cookie = '') {
  const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', Origin: process.env.CLINIC_SMOKE_PATIENT_ORIGIN || 'http://localhost:5186', Cookie: [demoCookie, cookie].filter(Boolean).join('; ') }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, response, data: await response.json() };
}
(async () => {
  if (process.env.DEMO_ACCESS_CODE) { const gate = await call('/demo-access', 'POST', { code: process.env.DEMO_ACCESS_CODE }); assert.equal(gate.status, 200); demoCookie = gate.response.headers.get('set-cookie').split(';')[0]; }
  const oldAlias = 'old-' + fixture.alias;
  await db.clinicEntryAlias.upsert({ where: { alias: oldAlias }, create: { alias: oldAlias, hospitalId: fixture.hospitalId }, update: {} });
  assert.equal((await call('/clinic-intake/entry/' + oldAlias)).data.alias, fixture.alias);
  assert.equal((await call('/clinic-intake/entry/clinic-1')).status, 404);
  const challenged = await call('/clinic-intake/entry/' + oldAlias + '/recovery/request', 'POST', { email: fixture.email, reference: fixture.reference }); assert.equal(challenged.status, 201);
  const row = await db.notificationOutbox.findUniqueOrThrow({ where: { challengeId: challenged.data.challengeId } });
  if (row.provider && row.provider !== 'capture') throw Error('Capture only');
  const code = row.secretEncrypted ? decrypt(row.secretEncrypted) : JSON.parse(decrypt(row.payloadEncrypted)).text.match(/code: (\d{6})/)[1];
  const verified = await call('/clinic-intake/entry/' + fixture.alias + '/recovery/verify', 'POST', { challengeId: challenged.data.challengeId, code }); assert.equal(verified.status, 201);
  const set = verified.response.headers.get('set-cookie'); assert.ok(set.includes('HttpOnly')); assert.ok(set.includes('Max-Age=86400')); assert.ok(!set.includes('patient_session'));
  const cookie = set.split(';')[0]; const state = await call('/clinic-intake/recovery/state', 'GET', null, cookie); assert.equal(state.status, 200); assert.equal(state.data.reference, fixture.reference); assert.ok(!JSON.stringify(state.data).includes('MOCK CLINICAL'));
  for (const path of ['/patient-auth/me', '/clinic-intake/visits/' + state.data.encounter.id + '/state', '/clinic-care/queue', '/clinic-notifications/settings']) assert.equal((await call(path, 'GET', null, cookie)).status, 401, path);
  assert.equal((await call('/clinic-intake/recovery/logout', 'POST', {}, cookie)).status, 201); assert.equal((await call('/clinic-intake/recovery/state', 'GET', null, cookie)).status, 401);
  console.log('PASS: separate HttpOnly 24-hour cookie, scheduling-only response, denied account/assessment/Care/staff access, revoked logout.');
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await db.$disconnect(); await pool.end(); });
