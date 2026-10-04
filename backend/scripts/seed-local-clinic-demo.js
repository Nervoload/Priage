#!/usr/bin/env node
// Disposable clinic fixtures through the same intake and booking APIs used by the apps.
require('dotenv').config();

const { randomUUID } = require('node:crypto');
const { PATIENT_SESSION_COOKIE, STAFF_AUTH_COOKIE } = require('./lib/cookie-names');

const clinicId = Number(process.env.PILOT_CLINIC_ID);
const base = process.env.CLINIC_SEED_BASE_URL || 'http://localhost:3001';
const databaseUrl = new URL(process.env.DATABASE_URL || '');
if (process.env.NODE_ENV !== 'development' || !Number.isInteger(clinicId) || clinicId < 1
  || !['localhost', '127.0.0.1'].includes(new URL(base).hostname)
  || !['localhost', '127.0.0.1'].includes(databaseUrl.hostname)
  || !process.env.PRIAGE_DEV_ADMIN_EMAIL || !process.env.PRIAGE_DEV_ADMIN_PASSWORD
  || !process.env.PRIAGE_DEV_ADMIN_HOSPITAL_SLUG) {
  throw new Error('Clinic demo seed requires a loopback development clinic and its local admin credentials');
}

function cookieFrom(response, name) {
  const headers = response.headers.getSetCookie?.() || [response.headers.get('set-cookie') || ''];
  const match = headers.join(',').match(new RegExp(`(?:^|[, ])${name}=([^;]+)`));
  return match ? `${name}=${match[1]}` : '';
}

async function main() {
  let gateCookie = '';
  if (process.env.DEMO_ACCESS_CODE) {
    const gate = await fetch(`${base}/demo-access`, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: process.env.DEMO_ACCESS_CODE }) });
    if (!gate.ok) throw new Error(`Demo access returned ${gate.status}`);
    gateCookie = cookieFrom(gate, 'priage_demo_access');
  }
  async function call(path, method = 'GET', body, cookie = '') {
    const response = await fetch(`${base}${path}`, { method,
      headers: { 'content-type': 'application/json', cookie: [gateCookie, cookie].filter(Boolean).join('; ') },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(`${method} ${path} returned ${response.status}: ${JSON.stringify(data)}`);
    return { data, response };
  }
  const clinic = (await call('/clinic-intake/clinic')).data;
  if (clinic.id !== clinicId || clinic.slug !== process.env.PRIAGE_DEV_ADMIN_HOSPITAL_SLUG) {
    throw new Error('Clinic API does not match the selected local admin tenant');
  }
  const loggedIn = await call('/auth/login', 'POST', {
    email: process.env.PRIAGE_DEV_ADMIN_EMAIL, password: process.env.PRIAGE_DEV_ADMIN_PASSWORD,
    hospitalSlug: process.env.PRIAGE_DEV_ADMIN_HOSPITAL_SLUG,
  });
  const staffCookie = cookieFrom(loggedIn.response, STAFF_AUTH_COOKIE);
  if (!staffCookie) throw new Error('Local admin login did not issue a staff session');
  const entry = (await call('/clinic-intake/reception/entry-settings', 'GET', undefined, staffCookie)).data;
  const runId = randomUUID().slice(0, 8);
  async function startVisit(label, complaint) {
    const firstName = label.split(' ')[0];
    const lastName = label.split(' ').slice(1).join(' ');
    const started = await call('/clinic-intake/visits/guest', 'POST', {
      startKey: randomUUID(), firstName, lastName, chiefComplaint: complaint,
      contactEmail: `${firstName.toLowerCase()}-${runId}@example.test`,
    });
    const cookie = cookieFrom(started.response, PATIENT_SESSION_COOKIE);
    if (!cookie) throw new Error('Guest visit did not issue a patient session');
    return { id: started.data.id, cookie };
  }
  async function completeAssessment(visit) {
    let state = (await call(`/clinic-intake/visits/${visit.id}/interview/start`, 'POST', {}, visit.cookie)).data;
    for (let index = 0; index < 30 && state.status !== 'complete'; index += 1) {
      const question = state.currentQuestion;
      const answer = state.status === 'emergency_ack_required' ? { action: 'acknowledge_emergency' }
        : !question ? {} : question.inputType === 'boolean' ? { questionPublicId: question.publicId, valueBoolean: false }
          : question.inputType === 'number' ? { questionPublicId: question.publicId, valueNumber: 1 }
            : question.inputType === 'single_select' ? { questionPublicId: question.publicId, valueChoice: question.choices[0] }
              : { questionPublicId: question.publicId, valueText: 'Local mock assessment answer' };
      state = (await call(`/clinic-intake/visits/${visit.id}/interview/advance`, 'POST', answer, visit.cookie)).data;
    }
    if (state.status !== 'complete') throw new Error(`Assessment did not complete for visit ${visit.id}`);
  }

  const inProgress = await startVisit('Avery Morgan', 'Local mock follow-up request');
  const unbooked = await startVisit('Jamie Patel', 'Local mock recurring headache');
  await completeAssessment(unbooked);

  const availability = (await call('/clinic-intake/availability')).data;
  const legal = (await call('/clinic-intake/legal-documents')).data;
  const appointments = [];
  if (availability.slots?.length >= 2 && legal.ready) {
    const requested = await startVisit('Taylor Chen', 'Local mock knee discomfort');
    const confirmed = await startVisit('Robin Singh', 'Local mock persistent cough');
    await completeAssessment(requested);
    await completeAssessment(confirmed);
    for (const [visit, slot] of [[requested, availability.slots[0]], [confirmed, availability.slots[1]]]) {
      const result = await call(`/clinic-intake/visits/${visit.id}/appointment-request`, 'POST', {
        requestKey: randomUUID(), startAt: slot.startAt, termsDocumentId: legal.terms.id,
        privacyDocumentId: legal.privacy.id, accepted: true,
      }, visit.cookie);
      appointments.push(result.data.id);
    }
    await call(`/clinic-intake/reception/appointments/${appointments[1]}/confirm`, 'POST', { commandKey: randomUUID() }, staffCookie);
  } else {
    console.log('[dev-clinic] No two bookable slots or published mock legal documents; seeded assessment visits only.');
  }
  const walkIn = entry.acceptsWalkIns ? (await call('/clinic-intake/reception/walk-ins', 'POST', {
    startKey: randomUUID(), firstName: 'Casey', lastName: 'Rivera', chiefComplaint: 'Local mock walk-in assessment',
  }, staffCookie)).data : null;
  console.log(JSON.stringify({ result: 'seeded', clinicId, intakeVisitId: inProgress.id,
    completedAssessmentVisitId: unbooked.id, appointmentIds: appointments, walkInId: walkIn?.id ?? null }));
}

main().catch((error) => { console.error(`[dev-clinic] ${error.message}`); process.exitCode = 1; });
