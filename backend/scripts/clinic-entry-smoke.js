#!/usr/bin/env node
// Local mock-data rehearsal for the general patient directory and clinic handoff.
require('dotenv').config();
const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const bcrypt = require('bcrypt');
const { PrismaClient, Role } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const { STAFF_AUTH_COOKIE, PATIENT_SESSION_COOKIE } = require('./lib/cookie-names');

const base = process.env.CLINIC_SMOKE_BASE_URL || 'http://localhost:3002';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Clinic entry smoke runs only against loopback');
if (!process.env.CLINIC_PREVIEW_TENANT_IDS || !process.env.DATABASE_URL) throw new Error('CLINIC_PREVIEW_TENANT_IDS and DATABASE_URL are required');

function cookieFrom(response, name) {
  const headers = response.headers.getSetCookie?.() || [response.headers.get('set-cookie') || ''];
  const match = headers.join(',').match(new RegExp(`(?:^|[, ])${name}=([^;]+)`));
  return match ? `${name}=${match[1]}` : null;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });
  const clinicId = Number(process.env.CLINIC_PREVIEW_TENANT_IDS.split(',')[0]);
  const run = randomUUID().slice(0, 8);
  let gateCookie = '';
  let originalSettings;
  try {
    if (process.env.DEMO_ACCESS_CODE) {
      const gate = await fetch(`${base}/demo-access`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: process.env.DEMO_ACCESS_CODE }) });
      assert.equal(gate.status, 200);
      gateCookie = cookieFrom(gate, 'priage_demo_access') || '';
    }
    async function call(path, method = 'GET', body, cookie = '', key) {
      const response = await fetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json', origin: base, cookie: [gateCookie, cookie].filter(Boolean).join('; '), ...(key ? { 'idempotency-key': key } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      return { status: response.status, data: await response.json().catch(() => null), response };
    }
    const hospital = await db.hospital.findUniqueOrThrow({ where: { id: clinicId }, select: { slug: true } });
    originalSettings = await db.clinicEntrySettings.findUniqueOrThrow({ where: { hospitalId: clinicId } });
    const password = randomBytes(18).toString('base64url');
    const admin = await db.user.create({ data: { email: `entry-admin-${run}@example.ca`, password: await bcrypt.hash(password, 10), hospitalId: clinicId, role: Role.ADMIN,
      hospitalMemberships: { create: { hospitalId: clinicId, role: Role.ADMIN } } } });
    const login = await call('/auth/login', 'POST', { email: admin.email, password, hospitalSlug: hospital.slug });
    assert.equal(login.status, 201, JSON.stringify(login.data));
    const adminCookie = cookieFrom(login.response, STAFF_AUTH_COOKIE);
    assert.ok(adminCookie);
    assert.equal((await call('/clinic-intake/availability')).status, 404);
    assert.equal((await call('/clinic-intake/reception/availability', 'GET', undefined, adminCookie)).status, 200);
    const alias = `entry-${run}`;
    const nextAlias = `entry-next-${run}`;
    const settings = (canonicalAlias, directoryListed, acceptsWalkIns = true) => ({ canonicalAlias, directoryListed, acceptsWalkIns });
    assert.equal((await call('/clinic-intake/reception/entry-settings', 'PUT', settings(alias, false), adminCookie)).status, 200);
    const hidden = await call('/patient/priage/hospitals');
    assert.equal(hidden.status, 200);
    assert.ok(!hidden.data.some((item) => item.id === clinicId));
    assert.equal((await call(`/clinic-intake/entry/${alias}`)).status, 200);
    assert.equal((await call('/clinic-intake/entry/not-enabled-here')).status, 404);
    assert.equal((await call('/clinic-intake/reception/entry-settings', 'PUT', settings(nextAlias, true), adminCookie)).status, 200);
    const oldLink = await call(`/clinic-intake/entry/${alias}`);
    assert.equal(oldLink.status, 200);
    assert.equal(oldLink.data.startPath, `/${nextAlias}/start`);
    const listed = await call('/patient/priage/hospitals');
    assert.equal(listed.status, 200);
    const directoryClinic = listed.data.find((item) => item.id === clinicId);
    assert.equal(directoryClinic.entryPath, `/${nextAlias}/start`);
    assert.equal(directoryClinic.workflowProfile, 'CLINIC_APPOINTMENT');
    assert.equal(directoryClinic.appointmentBookingAvailable, true);

    const direct = await call(`/clinic-intake/entry/${nextAlias}/visits/guest`, 'POST', {
      startKey: randomUUID(), contactEmail: `direct-${run}@example.ca`, chiefComplaint: 'Mock direct assessment', firstName: 'Direct', hospitalId: clinicId,
    });
    assert.equal(direct.status, 400); // The tenant is resolved from the alias, never supplied by the browser.
    const directStart = await call(`/clinic-intake/entry/${nextAlias}/visits/guest`, 'POST', {
      startKey: randomUUID(), contactEmail: `direct-${run}@example.ca`, chiefComplaint: 'Mock direct assessment', firstName: 'Direct',
    });
    assert.equal(directStart.status, 201, JSON.stringify(directStart.data));
    assert.equal((await db.encounter.findUniqueOrThrow({ where: { id: directStart.data.id } })).hospitalId, clinicId);
    const directCookie = cookieFrom(directStart.response, PATIENT_SESSION_COOKIE);
    assert.ok(directCookie);
    const directState = await call(`/clinic-intake/visits/${directStart.data.id}/state`, 'GET', undefined, directCookie);
    assert.equal(directState.status, 200);
    assert.equal(directState.data.canonicalAlias, nextAlias);
    assert.equal((await call(`/clinic-intake/visits/${directStart.data.id}/availability`, 'GET', undefined, directCookie)).status, 200);
    assert.equal((await call(`/clinic-intake/visits/${directStart.data.id}/legal-documents`, 'GET', undefined, directCookie)).status, 200);

    const missingEmail = await call('/intake/intent', 'POST', { firstName: 'General', phone: '5555555555', chiefComplaint: 'Mock general intake' });
    assert.equal(missingEmail.status, 400);
    const intent = await call('/intake/intent', 'POST', { firstName: 'General', phone: '5555555555', chiefComplaint: 'Mock general intake', contactEmail: `general-${run}@example.ca` });
    assert.equal(intent.status, 201, JSON.stringify(intent.data));
    const patientCookie = cookieFrom(intent.response, PATIENT_SESSION_COOKIE);
    assert.ok(patientCookie);
    assert.equal((await call(`/clinic-intake/visits/${directStart.data.id}/availability`, 'GET', undefined, patientCookie)).status, 404);
    const draft = await db.intakeSession.findFirstOrThrow({ where: { patientId: intent.data.patientId } });
    assert.equal(draft.contactEmail, `general-${run}@example.ca`);
    let state = (await call('/intake/interview/start', 'POST', {}, patientCookie)).data;
    for (let i = 0; i < 30 && state.status !== 'complete'; i++) {
      const q = state.currentQuestion;
      const payload = state.status === 'emergency_ack_required' ? { action: 'acknowledge_emergency' } : !q ? {} : q.inputType === 'boolean'
        ? { questionPublicId: q.publicId, valueBoolean: false } : q.inputType === 'number'
          ? { questionPublicId: q.publicId, valueNumber: 1 } : q.inputType === 'single_select'
            ? { questionPublicId: q.publicId, valueChoice: q.choices[0] } : { questionPublicId: q.publicId, valueText: 'Mock answer' };
      const next = await call('/intake/interview/advance', 'POST', payload, patientCookie, randomUUID());
      assert.equal(next.status, 201, JSON.stringify(next.data));
      state = next.data;
    }
    assert.equal(state.status, 'complete');
    const answerCount = await db.contextItem.count({ where: { intakeSessionId: draft.id, itemType: 'ai_interview_answer' } });
    assert.ok(answerCount > 0);
    const summaryCount = await db.summaryProjection.count({ where: { intakeSessionId: draft.id, kind: 'AI_DERIVED', active: true } });
    assert.ok(summaryCount > 0);
    const commandKey = randomUUID();
    const attached = await call('/intake/clinic-attach', 'POST', { clinicAlias: nextAlias }, patientCookie, commandKey);
    assert.equal(attached.status, 201, JSON.stringify(attached.data));
    assert.equal(attached.data.status, 'INTAKE');
    assert.equal(attached.data.hospitalId, clinicId);
    const retry = await call('/intake/clinic-attach', 'POST', { clinicAlias: nextAlias }, patientCookie, commandKey);
    assert.equal(retry.status, 201);
    assert.equal(retry.data.id, attached.data.id);
    assert.equal((await db.encounterContact.findUniqueOrThrow({ where: { encounterId: attached.data.id } })).email, `general-${run}@example.ca`);
    assert.equal((await db.contextItem.count({ where: { encounterId: attached.data.id, itemType: 'ai_interview_answer' } })), answerCount);
    assert.equal((await db.summaryProjection.count({ where: { encounterId: attached.data.id, kind: 'AI_DERIVED', active: true } })), summaryCount);
    const visitState = await call(`/clinic-intake/visits/${attached.data.id}/state`, 'GET', undefined, patientCookie);
    assert.equal(visitState.status, 200);
    assert.equal(visitState.data.interviewStatus, 'complete');
    assert.equal(visitState.data.canonicalAlias, nextAlias);
    assert.ok(visitState.data.allowedActions.includes('request'));
    assert.equal((await call(`/clinic-intake/visits/${attached.data.id}/availability`, 'GET', undefined, patientCookie)).status, 200);
    console.log(JSON.stringify({ result: 'passed', clinicId, directEncounterId: directStart.data.id, generalEncounterId: attached.data.id, answerCount }));
  } finally {
    if (originalSettings) await db.clinicEntrySettings.update({ where: { hospitalId: clinicId }, data: {
      canonicalAlias: originalSettings.canonicalAlias, directoryListed: originalSettings.directoryListed, acceptsWalkIns: originalSettings.acceptsWalkIns,
    } });
    await db.$disconnect();
    await pool.end();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
