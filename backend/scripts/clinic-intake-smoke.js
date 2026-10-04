#!/usr/bin/env node
// Rehearse the gated clinic intake slice on a local mock tenant.
require('dotenv').config();
const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const bcrypt = require('bcrypt');
const { PrismaClient, Role } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const { STAFF_AUTH_COOKIE, PATIENT_SESSION_COOKIE, CLINIC_ASSESSMENT_COOKIE } = require('./lib/cookie-names');

const base = process.env.CLINIC_SMOKE_BASE_URL || 'http://localhost:3001';
const url = new URL(base);
if (!['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('This smoke test only runs against loopback');
if (!process.env.PILOT_CLINIC_ID || !process.env.DATABASE_URL) throw new Error('PILOT_CLINIC_ID and DATABASE_URL are required');

function cookieFrom(response, name) {
  const headers = response.headers.getSetCookie?.() || [response.headers.get('set-cookie') || ''];
  const match = headers.join(',').match(new RegExp(`(?:^|[, ])${name}=([^;]+)`));
  return match ? `${name}=${match[1]}` : null;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });
  const run = randomUUID().slice(0, 8);
  let demoCookie = '';
  try {
    if (process.env.DEMO_ACCESS_CODE) {
      const gate = await fetch(`${base}/demo-access`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: process.env.DEMO_ACCESS_CODE }) });
      assert.equal(gate.status, 200);
      demoCookie = cookieFrom(gate, 'priage_demo_access') || '';
      assert.ok(demoCookie);
    }
    async function call(path, method = 'GET', body, cookie = '') {
      const response = await fetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json', origin: base, cookie: [demoCookie, cookie].filter(Boolean).join('; ') }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      const data = await response.json().catch(() => null);
      return { status: response.status, data, response };
    }
    const clinic = await call('/clinic-intake/clinic');
    assert.equal(clinic.status, 200);
    assert.equal(clinic.data.id, Number(process.env.PILOT_CLINIC_ID));
    const directory = await call('/patient/priage/hospitals');
    assert.equal(directory.status, 200);
    assert.deepEqual(directory.data.map((item) => item.id), [clinic.data.id]);
    assert.equal((await call('/intake/intent', 'POST', {})).status, 404);
    assert.equal((await call('/encounters/admit', 'POST', {})).status, 404);
    assert.equal((await call('/triage/assessments', 'POST', {})).status, 404);
    const startKey = randomUUID();
    const visitBody = { startKey, firstName: 'Mock', lastName: 'Patient', chiefComplaint: 'Mock headache', contactEmail: `visit-${run}@example.ca` };
    assert.equal((await call('/clinic-intake/visits/guest', 'POST', { ...visitBody, contactEmail: undefined })).status, 400);
    assert.equal((await call('/clinic-intake/visits/guest', 'POST', { ...visitBody, hospitalId: 1 })).status, 400);
    const guestStart = await call('/clinic-intake/visits/guest', 'POST', visitBody);
    assert.equal(guestStart.status, 201, JSON.stringify(guestStart.data));
    assert.equal(guestStart.data.status, 'INTAKE');
    const patientCookie = cookieFrom(guestStart.response, PATIENT_SESSION_COOKIE);
    assert.ok(patientCookie);
    const retry = await call('/clinic-intake/visits/guest', 'POST', visitBody, patientCookie);
    assert.equal(retry.status, 201);
    assert.equal(retry.data.id, guestStart.data.id);
    assert.equal((await call('/clinic-intake/visits/guest', 'POST', { ...visitBody, startKey: randomUUID() }, patientCookie)).status, 409);
    assert.equal((await call('/clinic-intake/visits/account', 'POST', { ...visitBody, startKey: randomUUID() }, patientCookie)).status, 403);
    const visitId = guestStart.data.id;
    const contact = await db.encounterContact.findUniqueOrThrow({ where: { encounterId: visitId } });
    assert.equal(contact.email, visitBody.contactEmail);
    assert.equal(contact.verifiedAt, null);
    const correction = await call(`/clinic-intake/visits/${visitId}/contact`, 'PATCH', { email: `corrected-${run}@example.ca` }, patientCookie);
    assert.equal(correction.status, 200);
    assert.equal(correction.data.verifiedAt, null);
    assert.equal((await call(`/clinic-intake/visits/${visitId}`, 'GET', undefined, patientCookie)).data.status, 'INTAKE');

    const accountEmail = `account-${run}@example.ca`;
    const registered = await call('/patient-auth/register', 'POST', { email: accountEmail, password: randomBytes(16).toString('hex') });
    assert.equal(registered.status, 201, JSON.stringify(registered.data));
    const accountCookie = cookieFrom(registered.response, PATIENT_SESSION_COOKIE);
    assert.ok(accountCookie);
    const accountStart = await call('/clinic-intake/visits/account', 'POST', { ...visitBody, startKey: randomUUID(), contactEmail: `contact-${run}@example.ca` }, accountCookie);
    assert.equal(accountStart.status, 201, JSON.stringify(accountStart.data));
    assert.equal((await call('/clinic-intake/visits/account', 'POST', { ...visitBody, startKey: randomUUID() }, accountCookie)).status, 409);
    assert.equal((await call('/clinic-intake/visits/guest', 'POST', { ...visitBody, startKey: randomUUID() }, accountCookie)).status, 409);
    assert.equal((await db.encounterContact.findUniqueOrThrow({ where: { encounterId: accountStart.data.id } })).email, `contact-${run}@example.ca`);

    async function answer(path, cookie, state, valueOverride) {
      if (state.status === 'emergency_ack_required') return call(path, 'POST', { action: 'acknowledge_emergency' }, cookie);
      const q = state.currentQuestion;
      if (!q) return call(path, 'POST', {}, cookie);
      const payload = { questionPublicId: q.publicId };
      if (q.inputType === 'boolean') payload.valueBoolean = valueOverride ?? false;
      else if (q.inputType === 'single_select') payload.valueChoice = q.choices[0];
      else if (q.inputType === 'number') payload.valueNumber = 1;
      else payload.valueText = 'Mock assessment answer';
      return call(path, 'POST', payload, cookie);
    }
    let state = (await call(`/clinic-intake/visits/${visitId}/interview/start`, 'POST', {}, patientCookie)).data;
    for (let i = 0; i < 30 && state.status !== 'complete'; i++) {
      const next = await answer(`/clinic-intake/visits/${visitId}/interview/advance`, patientCookie, state);
      assert.equal(next.status, 201, JSON.stringify(next.data));
      state = next.data;
    }
    assert.equal(state.status, 'complete');

    const password = randomBytes(18).toString('base64url');
    async function createStaff(hospitalId, label, expectedLoginStatus = 201) {
      const user = await db.user.create({ data: { email: `${label}-${run}@example.ca`, password: await bcrypt.hash(password, 10), hospitalId, role: Role.STAFF,
        hospitalMemberships: { create: { hospitalId, role: Role.STAFF } } }, select: { id: true, email: true } });
      const hospital = await db.hospital.findUniqueOrThrow({ where: { id: hospitalId }, select: { slug: true } });
      const login = await call('/auth/login', 'POST', { email: user.email, password, hospitalSlug: hospital.slug });
      assert.equal(login.status, expectedLoginStatus, JSON.stringify(login.data));
      return { ...user, cookie: cookieFrom(login.response, STAFF_AUTH_COOKIE) };
    }
    const clinicStaff = await createStaff(clinic.data.id, 'clinic-staff');
    const otherHospital = await db.hospital.findFirst({ where: { id: { not: clinic.data.id } }, select: { id: true } });
    if (otherHospital) {
      await createStaff(otherHospital.id, 'other-staff', 401);
      const otherSlug = await db.hospital.findUniqueOrThrow({ where: { id: otherHospital.id }, select: { slug: true } });
      assert.equal((await call('/auth/login', 'POST', { email: clinicStaff.email, password, hospitalSlug: otherSlug.slug })).status, 401);
    }
    const reception = await call('/clinic-intake/reception', 'GET', undefined, clinicStaff.cookie);
    assert.equal(reception.status, 200, JSON.stringify(reception.data));
    assert.ok(reception.data.completedPrevisits.some((row) => row.id === visitId));
    const walkInBody = { startKey: randomUUID(), firstName: 'Mock', chiefComplaint: 'Mock walk-in' };
    const entrySettings = await db.clinicEntrySettings.findUniqueOrThrow({ where: { hospitalId: clinic.data.id } });
    if (!entrySettings.acceptsWalkIns) {
      assert.equal((await call('/clinic-intake/reception/walk-ins', 'POST', walkInBody, clinicStaff.cookie)).status, 409);
      console.log(JSON.stringify({ result: 'passed', clinicId: clinic.data.id,
        guestVisitId: visitId, accountVisitId: accountStart.data.id, walkIns: 'disabled' }));
      return;
    }
    const walkIn = await call('/clinic-intake/reception/walk-ins', 'POST', walkInBody, clinicStaff.cookie);
    assert.equal(walkIn.status, 201, JSON.stringify(walkIn.data));
    assert.equal(walkIn.data.status, 'ADMITTED');
    assert.equal((await call('/clinic-intake/reception/walk-ins', 'POST', walkInBody, clinicStaff.cookie)).data.id, walkIn.data.id);
    assert.equal((await db.encounterContact.findUniqueOrThrow({ where: { encounterId: walkIn.data.id } })).email, null);
    const staffStart = await call(`/clinic-intake/reception/walk-ins/${walkIn.data.id}/interview/start`, 'POST', {}, clinicStaff.cookie);
    assert.equal(staffStart.status, 201);
    const assisted = await answer(`/clinic-intake/reception/walk-ins/${walkIn.data.id}/interview/advance`, clinicStaff.cookie, staffStart.data);
    assert.equal(assisted.status, 201);
    const assistedAnswer = await db.contextItem.findFirstOrThrow({ where: { encounterId: walkIn.data.id, itemType: 'ai_interview_answer' } });
    assert.equal(assistedAnswer.answerEntryMode, 'STAFF_ASSISTED');
    assert.equal(assistedAnswer.enteredByUserId, clinicStaff.id);

    const revoked = await call(`/clinic-intake/reception/walk-ins/${walkIn.data.id}/grants`, 'POST', {}, clinicStaff.cookie);
    assert.equal(revoked.status, 201);
    assert.equal((await call(`/clinic-intake/reception/grants/${revoked.data.grantId}/revoke`, 'POST', {}, clinicStaff.cookie)).status, 201);
    assert.equal((await call('/clinic-intake/desk/exchange', 'POST', { token: revoked.data.token })).status, 401);
    const expired = await call(`/clinic-intake/reception/walk-ins/${walkIn.data.id}/grants`, 'POST', {}, clinicStaff.cookie);
    await db.clinicAssessmentGrant.update({ where: { id: expired.data.grantId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    assert.equal((await call('/clinic-intake/desk/exchange', 'POST', { token: expired.data.token })).status, 401);

    const selfWalkIn = await call('/clinic-intake/reception/walk-ins', 'POST', { startKey: randomUUID(), chiefComplaint: 'Mock concurrent walk-in' }, clinicStaff.cookie);
    const grant = await call(`/clinic-intake/reception/walk-ins/${selfWalkIn.data.id}/grants`, 'POST', {}, clinicStaff.cookie);
    const exchange = await call('/clinic-intake/desk/exchange', 'POST', { token: grant.data.token });
    assert.equal(exchange.status, 201);
    assert.equal((await call('/clinic-intake/desk/exchange', 'POST', { token: grant.data.token })).status, 401);
    const deskCookie = cookieFrom(exchange.response, CLINIC_ASSESSMENT_COOKIE);
    assert.ok(deskCookie);
    const deskStart = await call('/clinic-intake/desk/interview/start', 'POST', {}, deskCookie);
    assert.equal(deskStart.status, 201);
    const q = deskStart.data.currentQuestion;
    assert.ok(q);
    const advances = await Promise.all([
      call('/clinic-intake/desk/interview/advance', 'POST', { questionPublicId: q.publicId, valueBoolean: false }, deskCookie),
      call('/clinic-intake/desk/interview/advance', 'POST', { questionPublicId: q.publicId, valueBoolean: true }, deskCookie),
    ]);
    assert.deepEqual(advances.map((result) => result.status).sort(), [201, 400]);
    assert.equal(await db.contextItem.count({ where: { encounterId: selfWalkIn.data.id, itemType: 'ai_interview_answer' } }), 1);
    const selfAnswer = await db.contextItem.findFirstOrThrow({ where: { encounterId: selfWalkIn.data.id, itemType: 'ai_interview_answer' } });
    assert.equal(selfAnswer.answerEntryMode, 'WALKIN_SELF');
    console.log(JSON.stringify({ result: 'passed', clinicId: clinic.data.id, guestVisitId: visitId, accountVisitId: accountStart.data.id, walkInId: walkIn.data.id, concurrentWalkInId: selfWalkIn.data.id }));
  } finally { await db.$disconnect(); await pool.end(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
