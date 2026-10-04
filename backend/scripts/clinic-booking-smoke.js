#!/usr/bin/env node
// Local mock-data integration rehearsal. Never target a non-loopback API.
require('dotenv').config();
const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const bcrypt = require('bcrypt');
const { PrismaClient, Role } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const { STAFF_AUTH_COOKIE, PATIENT_SESSION_COOKIE } = require('./lib/cookie-names');

const base = process.env.CLINIC_SMOKE_BASE_URL || 'http://localhost:3001';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Clinic booking smoke runs only against loopback');
if (!process.env.PILOT_CLINIC_ID || !process.env.DATABASE_URL) throw new Error('PILOT_CLINIC_ID and DATABASE_URL are required');

function cookieFrom(response, name) {
  const headers = response.headers.getSetCookie?.() || [response.headers.get('set-cookie') || ''];
  const match = headers.join(',').match(new RegExp(`(?:^|[, ])${name}=([^;]+)`));
  return match ? `${name}=${match[1]}` : null;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });
  let restoreQuestionnaire = null;
  const clinicId = Number(process.env.PILOT_CLINIC_ID);
  const run = randomUUID().slice(0, 8);
  let gateCookie = '';
  try {
    if (process.env.DEMO_ACCESS_CODE) {
      const gate = await fetch(`${base}/demo-access`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: process.env.DEMO_ACCESS_CODE }) });
      assert.equal(gate.status, 200);
      gateCookie = cookieFrom(gate, 'priage_demo_access') || '';
    }
    async function call(path, method = 'GET', body, cookie = '') {
      const response = await fetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json', origin: base, cookie: [gateCookie, cookie].filter(Boolean).join('; ') },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      return { status: response.status, data: await response.json().catch(() => null), response };
    }
    const hospital = await db.hospital.findUniqueOrThrow({ where: { id: clinicId }, select: { slug: true } });
    const password = randomBytes(18).toString('base64url');
    const staff = await db.user.create({ data: { email: `booking-staff-${run}@example.ca`, password: await bcrypt.hash(password, 10), hospitalId: clinicId, role: Role.STAFF,
      hospitalMemberships: { create: { hospitalId: clinicId, role: Role.STAFF } } } });
    const login = await call('/auth/login', 'POST', { email: staff.email, password, hospitalSlug: hospital.slug });
    assert.equal(login.status, 201, JSON.stringify(login.data));
    const staffCookie = cookieFrom(login.response, STAFF_AUTH_COOKIE);
    assert.ok(staffCookie);
    const admin = await db.user.create({ data: { email: `booking-admin-${run}@example.ca`, password: await bcrypt.hash(password, 10), hospitalId: clinicId, role: Role.ADMIN,
      hospitalMemberships: { create: { hospitalId: clinicId, role: Role.ADMIN } } } });
    const adminLogin = await call('/auth/login', 'POST', { email: admin.email, password, hospitalSlug: hospital.slug });
    const adminCookie = cookieFrom(adminLogin.response, STAFF_AUTH_COOKIE);
    assert.equal(adminLogin.status, 201); assert.ok(adminCookie);
    const doctor = await db.user.create({ data: { email: `booking-doctor-${run}@example.ca`, password: await bcrypt.hash(password, 10), hospitalId: clinicId, role: Role.DOCTOR,
      hospitalMemberships: { create: { hospitalId: clinicId, role: Role.DOCTOR } } } });
    const doctorLogin = await call('/auth/login', 'POST', { email: doctor.email, password, hospitalSlug: hospital.slug });
    const doctorCookie = cookieFrom(doctorLogin.response, STAFF_AUTH_COOKIE);
    assert.equal(doctorLogin.status, 201); assert.ok(doctorCookie);
    const itAdmin = await db.user.create({ data: { email: `booking-it-${run}@example.ca`, password: await bcrypt.hash(password, 10), hospitalId: clinicId, role: Role.IT_ADMIN,
      hospitalMemberships: { create: { hospitalId: clinicId, role: Role.IT_ADMIN } } } });
    const itLogin = await call('/auth/login', 'POST', { email: itAdmin.email, password, hospitalSlug: hospital.slug });
    const itCookie = cookieFrom(itLogin.response, STAFF_AUTH_COOKIE);
    assert.equal(itLogin.status, 201); assert.ok(itCookie);
    assert.equal((await call('/clinic-intake/reception/schedule', 'GET', undefined, itCookie)).status, 200);
    assert.equal((await call('/clinic-intake/reception/appointments', 'GET', undefined, itCookie)).status, 403);
    const clinicTimezone = process.env.PRIAGE_DEV_CLINIC_TIMEZONE || 'America/Toronto';
    assert.equal((await call('/clinic-intake/reception/schedule', 'PUT', { timezone: clinicTimezone, slotMinutes: 30, capacity: 1, holdMinutes: 60, weeklyWindows: [] }, staffCookie)).status, 403);
    const weeklyWindows = Array.from({ length: 7 }, (_, day) => ({ day, start: '08:00', end: '20:00' }));
    const schedule = await call('/clinic-intake/reception/schedule', 'PUT', { timezone: clinicTimezone, slotMinutes: 30, capacity: 1, holdMinutes: 60, weeklyWindows }, adminCookie);
    assert.equal(schedule.status, 200, JSON.stringify(schedule.data));
    // The clinic's own questions follow the safety question. The run restores whatever the clinic had at the end.
    assert.equal((await call('/clinic-questionnaire', 'GET', undefined, staffCookie)).status, 403);
    const questionnaireBefore = await call('/clinic-questionnaire', 'GET', undefined, adminCookie);
    assert.equal(questionnaireBefore.status, 200, JSON.stringify(questionnaireBefore.data));
    const priorVersion = questionnaireBefore.data.current?.version ?? 0;
    const publishedQuestions = await call('/clinic-questionnaire', 'PUT', { expectedVersion: priorVersion, questions: questionnaireBefore.data.defaults }, adminCookie);
    assert.equal(publishedQuestions.status, 200, JSON.stringify(publishedQuestions.data));
    assert.equal((await call('/clinic-questionnaire', 'PUT', { expectedVersion: priorVersion, questions: [] }, adminCookie)).status, 409, 'a stale publish is refused');
    restoreQuestionnaire = () => call('/clinic-questionnaire', 'PUT', { expectedVersion: priorVersion + 1, questions: questionnaireBefore.data.current?.questions ?? [] }, adminCookie);
    const availability = await call('/clinic-intake/availability');
    assert.equal(availability.status, 200);
    assert.equal(availability.data.configured, true);
    assert.ok(availability.data.slots.length >= 6);
    const [slotA, slotB, slotC, slotD, slotE] = availability.data.slots;
    const docsBefore = await call('/clinic-intake/legal-documents');
    if (!docsBefore.data.ready) {
      for (const kind of ['TERMS', 'PRIVACY']) {
        const current = await db.legalDocumentVersion.findFirst({ where: { kind, version: 'local-mock-booking-v1' } });
        if (!current) await db.legalDocumentVersion.create({ data: { kind, version: 'local-mock-booking-v1', bodyMarkdown: `LOCAL MOCK ${kind} — not approved for patients.`, publishedAt: new Date() } });
      }
    }
    const docs = (await call('/clinic-intake/legal-documents')).data;
    assert.ok(docs.ready);

    async function visitWithCompletedAssessment(label, useAccount = false) {
      let accountCookie = '';
      if (useAccount) {
        const registered = await call('/patient-auth/register', 'POST', { email: `${label}-${run}@example.ca`, password: randomBytes(18).toString('hex') });
        assert.equal(registered.status, 201);
        accountCookie = cookieFrom(registered.response, PATIENT_SESSION_COOKIE) || '';
      }
      const start = await call(useAccount ? '/clinic-intake/visits/account' : '/clinic-intake/visits/guest', 'POST',
        { startKey: randomUUID(), firstName: label, chiefComplaint: 'Mock booking assessment', contactEmail: `${label}-${run}@example.ca` }, accountCookie);
      assert.equal(start.status, 201, JSON.stringify(start.data));
      const cookie = accountCookie || cookieFrom(start.response, PATIENT_SESSION_COOKIE);
      assert.ok(cookie);
      let state = (await call(`/clinic-intake/visits/${start.data.id}/interview/start`, 'POST', {}, cookie)).data;
      const asked = [];
      for (let i = 0; i < 30 && state.status !== 'complete'; i++) {
        const q = state.currentQuestion;
        if (q) asked.push(q.publicId);
        const payload = state.status === 'emergency_ack_required' ? { action: 'acknowledge_emergency' } : !q ? {} : q.inputType === 'boolean'
          ? { questionPublicId: q.publicId, valueBoolean: false } : q.inputType === 'number'
            ? { questionPublicId: q.publicId, valueNumber: 1 } : q.inputType === 'single_select'
              ? { questionPublicId: q.publicId, valueChoice: q.choices[0] } : { questionPublicId: q.publicId, valueText: 'Mock answer' };
        const next = await call(`/clinic-intake/visits/${start.data.id}/interview/advance`, 'POST', payload, cookie);
        assert.equal(next.status, 201, JSON.stringify(next.data));
        state = next.data;
      }
      assert.equal(state.status, 'complete');
      assert.deepEqual(asked.slice(0, 2), ['safety_immediate_danger', 'clinic:travel_14d'], 'the clinic’s questions follow the safety question');
      return { id: start.data.id, cookie };
    }

    const [first, second] = await Promise.all([visitWithCompletedAssessment('First'), visitWithCompletedAssessment('Second')]);
    const beforeQueue = await call('/clinic-intake/reception/appointments', 'GET', undefined, staffCookie);
    assert.equal(beforeQueue.status, 200);
    assert.ok(!beforeQueue.data.newAppointments.some((row) => row.encounterId === first.id || row.encounterId === second.id));
    const requestBody = (startAt, requestKey = randomUUID()) => ({ requestKey, startAt, termsDocumentId: docs.terms.id, privacyDocumentId: docs.privacy.id, accepted: true });
    const invalid = await call(`/clinic-intake/visits/${first.id}/appointment-request`, 'POST', { ...requestBody(slotA.startAt), accepted: false }, first.cookie);
    assert.equal(invalid.status, 400);
    const stale = await call(`/clinic-intake/visits/${first.id}/appointment-request`, 'POST', { ...requestBody(slotA.startAt), termsDocumentId: docs.terms.id + 99999 }, first.cookie);
    assert.equal(stale.status, 409);
    assert.equal((await db.visitAcceptance.count({ where: { encounterId: first.id } })), 0);
    const firstKey = randomUUID();
    const secondKey = randomUUID();
    const simultaneous = await Promise.all([
      call(`/clinic-intake/visits/${first.id}/appointment-request`, 'POST', requestBody(slotA.startAt, firstKey), first.cookie),
      call(`/clinic-intake/visits/${second.id}/appointment-request`, 'POST', requestBody(slotA.startAt, secondKey), second.cookie),
    ]);
    assert.deepEqual(simultaneous.map((result) => result.status).sort(), [201, 409]);
    const winner = simultaneous[0].status === 201 ? first : second;
    const loser = simultaneous[0].status === 201 ? second : first;
    const winningKey = simultaneous[0].status === 201 ? firstKey : secondKey;
    const appointment = simultaneous.find((result) => result.status === 201).data;
    assert.equal((await db.clinicAppointment.count({ where: { hospitalId: clinicId, requestedStartAt: new Date(slotA.startAt), status: 'REQUESTED' } })), 1);
    assert.equal((await db.encounter.findUniqueOrThrow({ where: { id: winner.id } })).status, 'REQUESTED');
    assert.equal((await db.visitAcceptance.count({ where: { encounterId: winner.id } })), 1);
    assert.equal((await db.visitAcceptance.count({ where: { encounterId: loser.id } })), 0);
    const retry = await call(`/clinic-intake/visits/${winner.id}/appointment-request`, 'POST', requestBody(slotA.startAt, winningKey), winner.cookie);
    assert.equal(retry.status, 201); assert.equal(retry.data.id, appointment.id);
    assert.equal((await call(`/clinic-intake/visits/${winner.id}/appointment-request`, 'POST',
      { ...requestBody(slotA.startAt, winningKey), accepted: false }, winner.cookie)).status, 409);
    assert.equal((await call(`/clinic-intake/visits/${winner.id}/appointment-request`, 'POST',
      { ...requestBody(slotA.startAt, winningKey), privacyDocumentId: docs.privacy.id + 99999 }, winner.cookie)).status, 409);
    assert.equal((await call(`/clinic-intake/visits/${loser.id}/appointment`, 'GET', undefined, loser.cookie)).data, null);
    const queue = await call('/clinic-intake/reception/appointments', 'GET', undefined, staffCookie);
    assert.ok(queue.data.newAppointments.some((row) => row.id === appointment.id));
    assert.ok(!queue.data.expected.some((row) => row.id === appointment.id));
    assert.equal((await call(`/clinic-intake/reception/appointments/${appointment.id}/confirm`, 'POST',
      { commandKey: randomUUID() }, doctorCookie)).status, 403);
    const confirmKey = randomUUID();
    const confirmed = await call(`/clinic-intake/reception/appointments/${appointment.id}/confirm`, 'POST', { commandKey: confirmKey }, staffCookie);
    assert.equal(confirmed.status, 201, JSON.stringify(confirmed.data));
    assert.equal(confirmed.data.status, 'CONFIRMED');
    assert.equal(confirmed.data.emailDeliveryAvailable, false);
    const stalePatientAction = await call(`/clinic-intake/visits/${winner.id}/appointment/cancel`, 'POST',
      { commandKey: randomUUID(), expectedRevision: appointment.revision }, winner.cookie);
    assert.equal(stalePatientAction.status, 409);
    assert.equal(stalePatientAction.data.visitState.appointment.revision, confirmed.data.revision);
    assert.equal((await call(`/clinic-intake/reception/appointments/${appointment.id}/confirm`, 'POST', { commandKey: confirmKey }, staffCookie)).status, 201);
    assert.equal((await db.encounter.findUniqueOrThrow({ where: { id: winner.id } })).status, 'EXPECTED');
    assert.equal((await call(`/clinic-intake/visits/${winner.id}/contact`, 'PATCH', { email: `corrected-${run}@example.ca` }, winner.cookie)).status, 200);
    const expectedQueue = await call('/clinic-intake/reception/appointments', 'GET', undefined, staffCookie);
    assert.ok(expectedQueue.data.expected.some((row) => row.id === appointment.id));
    const arrive = await call(`/clinic-intake/reception/appointments/${appointment.id}/arrive`, 'POST', { commandKey: randomUUID() }, staffCookie);
    assert.equal(arrive.status, 201); assert.equal((await db.encounter.findUniqueOrThrow({ where: { id: winner.id } })).status, 'ADMITTED');

    // Physician Care uses the same arrived visit and its recorded assessment.
    assert.equal((await call('/clinic-care/queue', 'GET', undefined, staffCookie)).status, 403);
    const beforeCare = await call('/clinic-care/queue', 'GET', undefined, doctorCookie);
    assert.equal(beforeCare.status, 200, JSON.stringify(beforeCare.data));
    assert.ok(beforeCare.data.some((row) => row.id === winner.id && row.assessmentStatus === 'complete'));
    const queueRow = beforeCare.data.find((row) => row.id === winner.id);
    assert.ok(['clear', 'caution', 'escalate'].includes(queueRow.urgency?.level), 'queue rows carry a clinic urgency level');
    assert.ok(typeof queueRow.briefing === 'string' && queueRow.briefing.length > 0);
    const initialCare = await call(`/clinic-care/encounters/${winner.id}`, 'GET', undefined, doctorCookie);
    assert.equal(initialCare.status, 200, JSON.stringify(initialCare.data));
    assert.equal(initialCare.data.snapshot.partial, false);
    assert.ok(initialCare.data.snapshot.content.answers.some((answer) => answer.questionId === 'safety_immediate_danger'));
    assert.ok(initialCare.data.snapshot.content.answers.some((answer) => answer.source === 'clinic'), 'Care shows the clinic’s questions');
    assert.equal(initialCare.data.snapshot.content.questionnaire.timing, 'in_interview');
    assert.ok(initialCare.data.snapshot.content.segments.length > 0);
    assert.equal(initialCare.data.snapshot.content.schemaVersion, 2, 'Care reads the v2 snapshot');
    assert.ok(['clear', 'caution', 'escalate'].includes(initialCare.data.snapshot.content.urgency.level));
    assert.ok(!/ctas/i.test(JSON.stringify(initialCare.data.snapshot.content)), 'clinic Care never shows CTAS');
    const segmentIds = new Set(initialCare.data.snapshot.content.segments.map((segment) => segment.id));
    for (const ref of initialCare.data.snapshot.content.askInRoom.flatMap((item) => item.basedOn)) assert.ok(segmentIds.has(ref), `ask-in-room ref ${ref} resolves`);
    const answeredPrompts = new Set(initialCare.data.snapshot.content.answers.map((answer) => answer.question.trim().replace(/\s+/g, ' ').toLowerCase()));
    const unaskedPrompts = initialCare.data.snapshot.content.unasked.map((item) => item.question.trim().replace(/\s+/g, ' ').toLowerCase());
    assert.equal(new Set(unaskedPrompts).size, unaskedPrompts.length, 'unasked prompts should be unique');
    assert.ok(unaskedPrompts.every((prompt) => !answeredPrompts.has(prompt)), 'an answered prompt should not appear as unasked');
    const startCareKey = randomUUID();
    const startedCare = await call(`/clinic-care/encounters/${winner.id}/start`, 'POST', { commandKey: startCareKey }, doctorCookie);
    assert.equal(startedCare.status, 201, JSON.stringify(startedCare.data));
    assert.equal(startedCare.data.encounter.status, 'CARE');
    assert.equal((await call(`/clinic-care/encounters/${winner.id}/start`, 'POST', { commandKey: startCareKey }, doctorCookie)).status, 201);
    assert.ok(!(await call('/clinic-intake/reception/appointments', 'GET', undefined, staffCookie)).data.arrived.some((row) => row.encounterId === winner.id));
    const note = await call(`/clinic-care/encounters/${winner.id}/note`, 'PUT', { text: 'Mock physician assessment and plan.', expectedVersion: 0 }, doctorCookie);
    assert.equal(note.status, 200, JSON.stringify(note.data));
    assert.equal(note.data.note.version, 1);
    assert.equal((await call(`/clinic-care/encounters/${winner.id}/note`, 'PUT', { text: 'Stale overwrite', expectedVersion: 0 }, doctorCookie)).status, 409);
    const firstSegment = note.data.snapshot.content.segments.find((segment) => segment.text.length >= 5);
    assert.ok(firstSegment);
    const commentKey = randomUUID();
    const commentPayload = { commandKey: commentKey, snapshotId: note.data.snapshot.id, segmentId: firstSegment.id, startOffset: 0, endOffset: 5, quote: firstSegment.text.slice(0, 5), text: 'Mock anchored clinician comment.' };
    assert.equal((await call(`/clinic-care/encounters/${winner.id}/comments`, 'POST', { ...commentPayload, quote: 'wrong' }, doctorCookie)).status, 400);
    const commented = await call(`/clinic-care/encounters/${winner.id}/comments`, 'POST', commentPayload, doctorCookie);
    assert.equal(commented.status, 201, JSON.stringify(commented.data));
    assert.equal(commented.data.comments.length, 1);
    assert.equal((await call(`/clinic-care/encounters/${winner.id}/comments`, 'POST', commentPayload, doctorCookie)).data.comments.length, 1);
    const question = await call(`/clinic-care/encounters/${winner.id}/open-questions`, 'POST', { commandKey: randomUUID(), text: 'Clarify the symptom timeline.' }, doctorCookie);
    assert.equal(question.status, 201, JSON.stringify(question.data));
    assert.equal(question.data.openQuestions.length, 1);
    const generated = note.data.snapshot.content.segments.find((segment) => segment.voice === 'generated' && segment.section === 'summary');
    const feedback = await call(`/clinic-care/encounters/${winner.id}/feedback`, 'PUT', { snapshotId: note.data.snapshot.id, kind: 'NOT_RIGHT', segmentId: generated.id, note: 'Mock reviewer note' }, doctorCookie);
    assert.equal(feedback.status, 200);
    assert.deepEqual(feedback.data.myFeedback.map((item) => [item.targetKey, item.kind]), [[generated.id, 'NOT_RIGHT']], 'feedback is stored once per clinician and item');
    assert.equal((await call(`/clinic-care/encounters/${winner.id}/feedback`, 'PUT', { snapshotId: note.data.snapshot.id, kind: 'USEFUL', segmentId: 'answer:missing' }, doctorCookie)).status, 400);
    assert.equal((await call(`/clinic-care/encounters/${winner.id}/feedback?snapshotId=${note.data.snapshot.id}&targetKey=${encodeURIComponent(generated.id)}`, 'DELETE', undefined, doctorCookie)).data.myFeedback.length, 0);
    const askSegment = note.data.snapshot.content.segments.find((segment) => /^ask:\d+$/.test(segment.id));
    if (askSegment) {
      const ticked = await call(`/clinic-care/encounters/${winner.id}/open-questions`, 'POST', { commandKey: randomUUID(), text: askSegment.text, snapshotId: note.data.snapshot.id, sourceSegmentId: askSegment.id, addressed: true }, doctorCookie);
      const asked = ticked.data.openQuestions.find((item) => item.sourceSegmentId === askSegment.id);
      assert.ok(asked && asked.addressedAt, 'a ticked Ask in the room item is recorded as asked');
    }
    assert.equal((await call(`/clinic-care/encounters/${winner.id}/copy-audit`, 'POST', { section: 'question_answer', snapshotId: note.data.snapshot.id }, doctorCookie)).status, 201);
    const chart = await call(`/clinic-care/encounters/${winner.id}/export`, 'GET', undefined, doctorCookie);
    assert.equal(chart.status, 200, JSON.stringify(chart.data));
    assert.ok(chart.data.text.includes('Mock physician assessment and plan.'));
    assert.ok(chart.data.text.includes('PATIENT ASSESSMENT QUESTIONS AND ANSWERS'));
    assert.equal((await call(`/clinic-care/encounters/${winner.id}/finish`, 'POST', { commandKey: randomUUID(), noteVersion: 0 }, doctorCookie)).status, 409);
    const finishedCare = await call(`/clinic-care/encounters/${winner.id}/finish`, 'POST', { commandKey: randomUUID(), noteVersion: 1 }, doctorCookie);
    assert.equal(finishedCare.status, 201, JSON.stringify(finishedCare.data));
    assert.equal(finishedCare.data.encounter.status, 'COMPLETE');
    assert.equal((await db.clinicAppointment.findUniqueOrThrow({ where: { id: appointment.id } })).status, 'COMPLETED');
    assert.equal((await call(`/clinic-care/encounters/${winner.id}/note`, 'PUT', { text: 'Amended plan', expectedVersion: finishedCare.data.note.version }, doctorCookie)).status, 400);
    assert.equal((await call(`/clinic-care/encounters/${winner.id}/note`, 'PUT', { text: 'Amended plan', expectedVersion: finishedCare.data.note.version, amendmentReason: 'Correcting mock transcription' }, doctorCookie)).status, 200);
    const reception = await call('/clinic-intake/reception', 'GET', undefined, staffCookie);
    if (reception.data.acceptsWalkIns) {
      const walkIn = await call('/clinic-intake/reception/walk-ins', 'POST', { startKey: randomUUID(), firstName: 'Urgent', lastName: 'Mock', chiefComplaint: 'Mock urgent walk-in' }, staffCookie);
      assert.equal(walkIn.status, 201, JSON.stringify(walkIn.data));
      assert.equal((await call(`/clinic-care/encounters/${walkIn.data.id}/start`, 'POST', { commandKey: randomUUID() }, doctorCookie)).status, 409);
      const reason = 'Mock urgent clinician override before assessment completion';
      const urgent = await call(`/clinic-care/encounters/${walkIn.data.id}/start`, 'POST', { commandKey: randomUUID(), urgentOverrideReason: reason }, doctorCookie);
      assert.equal(urgent.status, 201, JSON.stringify(urgent.data));
      assert.equal(urgent.data.snapshot.partial, true);
      assert.equal(urgent.data.handoffOverride.reason, reason);
      const event = await db.encounterEvent.findFirst({ where: { encounterId: walkIn.data.id, type: 'STATUS_CHANGE' }, orderBy: { id: 'desc' } });
      assert.ok(event); assert.ok(!JSON.stringify(event.metadata).includes(reason));
    }

    const loserRequest = await call(`/clinic-intake/visits/${loser.id}/appointment-request`, 'POST', requestBody(slotB.startAt), loser.cookie);
    assert.equal(loserRequest.status, 201);
    const rescheduled = await call(`/clinic-intake/visits/${loser.id}/appointment/reschedule`, 'POST', { commandKey: randomUUID(), startAt: slotC.startAt }, loser.cookie);
    assert.equal(rescheduled.status, 201, JSON.stringify(rescheduled.data));
    assert.equal(rescheduled.data.requestedStartAt, slotC.startAt);
    const declined = await call(`/clinic-intake/reception/appointments/${rescheduled.data.id}/decline`, 'POST', { commandKey: randomUUID() }, staffCookie);
    assert.equal(declined.status, 201);
    assert.equal((await db.encounter.findUniqueOrThrow({ where: { id: loser.id } })).status, 'CANCELLED');

    const account = await visitWithCompletedAssessment('Registered', true);
    const accountRequest = await call(`/clinic-intake/visits/${account.id}/appointment-request`, 'POST', requestBody(slotD.startAt), account.cookie);
    assert.equal(accountRequest.status, 201);
    const cancelled = await call(`/clinic-intake/visits/${account.id}/appointment/cancel`, 'POST', { commandKey: randomUUID() }, account.cookie);
    assert.equal(cancelled.status, 201);
    assert.equal(cancelled.data.status, 'CANCELLED');
    assert.equal((await db.encounter.findUniqueOrThrow({ where: { id: account.id } })).status, 'CANCELLED');

    const noShowVisit = await visitWithCompletedAssessment('NoShow');
    const noShowRequest = await call(`/clinic-intake/visits/${noShowVisit.id}/appointment-request`, 'POST', requestBody(slotD.startAt), noShowVisit.cookie);
    assert.equal(noShowRequest.status, 201);
    const noShowConfirmed = await call(`/clinic-intake/reception/appointments/${noShowRequest.data.id}/confirm`, 'POST', { commandKey: randomUUID() }, staffCookie);
    assert.equal(noShowConfirmed.status, 201);
    const beforeEnd = await call('/clinic-intake/reception/appointments', 'GET', undefined, staffCookie);
    assert.ok(!beforeEnd.data.expected.find((row) => row.id === noShowRequest.data.id).allowedActions.includes('no-show'));
    assert.equal((await call(`/clinic-intake/reception/appointments/${noShowRequest.data.id}/no-show`, 'POST', { commandKey: randomUUID() }, staffCookie)).status, 409);
    // Move the mock appointment as a whole into the past to exercise the time gate without waiting days.
    const pastStart = new Date(Date.now() - 31 * 60_000);
    await db.clinicAppointment.update({ where: { id: noShowRequest.data.id }, data: {
      requestedStartAt: pastStart, confirmedStartAt: pastStart, endAt: new Date(Date.now() - 60_000),
    } });
    const afterEnd = await call('/clinic-intake/reception/appointments', 'GET', undefined, staffCookie);
    assert.ok(afterEnd.data.expected.find((row) => row.id === noShowRequest.data.id).allowedActions.includes('no-show'));
    assert.equal((await call(`/clinic-intake/reception/appointments/${noShowRequest.data.id}/no-show`, 'POST', { commandKey: randomUUID() }, staffCookie)).status, 201);
    assert.equal((await db.encounter.findUniqueOrThrow({ where: { id: noShowVisit.id } })).status, 'UNRESOLVED');

    const expiring = await visitWithCompletedAssessment('Expiring');
    const expiringRequest = await call(`/clinic-intake/visits/${expiring.id}/appointment-request`, 'POST', requestBody(slotE.startAt), expiring.cookie);
    assert.equal(expiringRequest.status, 201);
    await db.clinicAppointment.update({ where: { id: expiringRequest.data.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const expired = await call(`/clinic-intake/visits/${expiring.id}/appointment`, 'GET', undefined, expiring.cookie);
    assert.equal(expired.status, 200);
    assert.equal(expired.data.status, 'EXPIRED');
    assert.equal((await db.encounter.findUniqueOrThrow({ where: { id: expiring.id } })).status, 'CANCELLED');
    assert.ok((await call('/clinic-intake/availability')).data.slots.some((slot) => slot.startAt === slotE.startAt));
    console.log(JSON.stringify({ result: 'passed', clinicId, winnerEncounterId: winner.id, confirmedAppointmentId: appointment.id, capacityConflict: true }));
  } finally { if (restoreQuestionnaire) await restoreQuestionnaire().catch(() => undefined); await db.$disconnect(); await pool.end(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
