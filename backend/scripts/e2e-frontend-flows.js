#!/usr/bin/env node
// backend/scripts/e2e-frontend-flows.js
// End-to-end test simulating the HospitalApp frontend flows against the live backend.
// Tests the exact API calls the frontend makes, in the order the UI triggers them.
//
// Prerequisites:
//   - Backend running on localhost:3000 with a PostgreSQL database
//   - At least one hospital + user seeded (or use --seed to create them)
//
// Usage:
//   node scripts/e2e-frontend-flows.js          # run all flows
//   node scripts/e2e-frontend-flows.js --seed    # create test user first
//   node scripts/e2e-frontend-flows.js --verbose # show response bodies
//
// Flow: Login → List Encounters → Create Patient (via intake) → Confirm →
//       Start Triage → Create Assessment → Move to Waiting → Send Message →
//       List Alerts → Discharge → Verify Terminal State

require('dotenv').config();
const { io } = require('socket.io-client');
const { randomUUID } = require('crypto');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const VERBOSE = process.argv.includes('--verbose');
const SEED = process.argv.includes('--seed');

// When --seed is used, the script creates its own e2e user.
// Otherwise, use the standard credentials from `node scripts/seed.js`.
const TEST_EMAIL = SEED ? 'e2e@priage.test' : 'admin@priage.dev';
const TEST_PASSWORD = SEED ? 'TestPassword123!' : 'password123';

const C = {
  reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m',
  yellow: '\x1b[33m', cyan: '\x1b[36m', dim: '\x1b[2m', bold: '\x1b[1m',
};

let passed = 0;
let failed = 0;
let token = null;
let socket = null;

function patientHeaders(sessionToken) {
  return { 'x-patient-token': sessionToken };
}

function deriveCriticalComplaint(encounter) {
  const complaint = encounter?.chiefComplaint?.toLowerCase() ?? '';
  if (!complaint) return null;
  if (encounter?.status !== 'EXPECTED' && encounter?.status !== 'ADMITTED') return null;
  const criticalKeywords = ['chest pain', 'difficulty breathing', 'shortness of breath'];
  return criticalKeywords.some((keyword) => complaint.includes(keyword))
    ? 'CRITICAL_COMPLAINT'
    : null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function api(method, path, body, auth = true, extraHeaders = {}) {
  const headers = { 'Content-Type': 'application/json', ...extraHeaders };
  if (auth && token && !extraHeaders['x-patient-token']) headers['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* plain text */ }

  if (VERBOSE) {
    console.log(`  ${C.dim}${method} ${path} → ${res.status}${C.reset}`);
    if (json) console.log(`  ${C.dim}${JSON.stringify(json).slice(0, 200)}${C.reset}`);
  }

  return { status: res.status, json, text };
}

function assert(label, condition) {
  if (condition) {
    console.log(`  ${C.green}✓${C.reset} ${label}`);
    passed++;
  } else {
    console.log(`  ${C.red}✗${C.reset} ${label}`);
    failed++;
  }
}

function section(name) {
  console.log(`\n${C.cyan}${C.bold}── ${name} ──${C.reset}`);
}

async function connectSocket() {
  if (socket?.connected) {
    return socket;
  }

  socket = io(BASE, {
    auth: { token },
    transports: ['websocket'],
    autoConnect: false,
  });

  await new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
    socket.connect();
  });

  return socket;
}

// ─── Seed (optional) ────────────────────────────────────────────────────────

async function seedTestUser() {
  section('Seeding test user');
  const { PrismaClient } = require('@prisma/client');
  const { PrismaPg } = require('@prisma/adapter-pg');
  const { Pool } = require('pg');
  const bcrypt = require('bcrypt');

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    let hospital = await prisma.hospital.findFirst();
    if (!hospital) {
      hospital = await prisma.hospital.create({
        data: { name: 'E2E Test Hospital', slug: 'e2e-test' },
      });
      console.log(`  Created hospital: ${hospital.name} (id=${hospital.id})`);
    }

    const email = 'e2e@priage.test';
    const hash = await bcrypt.hash('TestPassword123!', 10);
    await prisma.user.upsert({
      where: { email },
      update: { password: hash, hospitalId: hospital.id, role: 'ADMIN' },
      create: { email, password: hash, role: 'ADMIN', hospitalId: hospital.id },
    });
    console.log(`  Seeded user: ${email}`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

// ─── Flows ──────────────────────────────────────────────────────────────────

async function flowLogin() {
  section('1. Login (POST /auth/login)');
  console.log(`  ${C.dim}Using: ${TEST_EMAIL}${C.reset}`);
  const { status, json } = await api('POST', '/auth/login', {
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  }, false);

  assert('Returns 201/200', status === 201 || status === 200);
  assert('Has access_token', !!json?.access_token);
  assert('Has user.id', typeof json?.user?.id === 'number');
  assert('Has user.hospitalId', typeof json?.user?.hospitalId === 'number');
  assert('Has user.hospital.name', typeof json?.user?.hospital?.name === 'string');

  token = json?.access_token;
  return json?.user;
}

async function flowGetMe() {
  section('2. Token rehydration (GET /auth/me)');
  const { status, json } = await api('GET', '/auth/me');
  assert('Returns 200', status === 200);
  assert('Has userId', typeof json?.userId === 'number');
  assert('Has email', typeof json?.email === 'string');
  assert('Has hospitalId', typeof json?.hospitalId === 'number');
}

async function flowListEncounters() {
  section('3. List encounters (GET /encounters)');
  const { status, json } = await api('GET', '/encounters');
  assert('Returns 200', status === 200);
  assert('Has data array', Array.isArray(json?.data));
  assert('Has total count', typeof json?.total === 'number');
  return json;
}

async function flowCreatePatientAndEncounter(hospitalSlug) {
  section('4. Create patient via intake (POST /intake/intent)');
  const phone = `+1555${Date.now().toString().slice(-7)}`;
  const { status: s1, json: intent } = await api('POST', '/intake/intent', {
    phone,
    firstName: 'E2E',
    lastName: 'TestPatient',
    age: 30,
    chiefComplaint: 'Chest pain and shortness of breath',
    details: 'Symptoms escalated over the last hour.',
  }, false);

  assert('Intent returns 201', s1 === 201);
  assert('Has patientId', typeof intent?.patientId === 'number');
  assert('Has sessionToken', typeof intent?.sessionToken === 'string');

  // Confirm the encounter using the patient session token (x-patient-token header)
  section('5. Confirm encounter (POST /intake/confirm)');
  const { status: s2, json: confirm } = await api('POST', '/intake/confirm', {
    hospitalSlug,
  }, false, { 'x-patient-token': intent?.sessionToken });

  assert('Confirm returns 201', s2 === 201);
  assert('Has encounter id', typeof confirm?.id === 'number');
  assert('Status is EXPECTED', confirm?.status === 'EXPECTED');

  return {
    encounter: confirm,
    patientToken: intent?.sessionToken,
  };
}

async function flowPatientEncounterApis(encounterId, patientToken) {
  section('5A. Patient encounter APIs');

  const headers = patientHeaders(patientToken);
  const { status: listStatus, json: encounters } = await api('GET', '/patient/encounters', null, false, headers);
  assert('Patient encounter list returns 200', listStatus === 200);
  assert('Patient encounter list is an array', Array.isArray(encounters));
  assert('Patient encounter list includes active encounter', encounters?.some((encounter) => encounter.id === encounterId));

  const { status: detailStatus, json: encounter } = await api('GET', `/patient/encounters/${encounterId}`, null, false, headers);
  assert('Patient encounter detail returns 200', detailStatus === 200);
  assert('Patient encounter detail matches encounter id', encounter?.id === encounterId);
  assert('Patient encounter detail includes non-internal messages array', Array.isArray(encounter?.messages));

  const { status: queueStatus, json: queue } = await api('GET', `/patient/encounters/${encounterId}/queue`, null, false, headers);
  assert('Patient queue returns 200', queueStatus === 200);
  assert('Patient queue exposes numeric position', typeof queue?.position === 'number');
  assert('Patient queue exposes numeric estimate', typeof queue?.estimatedMinutes === 'number');
  assert('Patient queue exposes numeric totalInQueue', typeof queue?.totalInQueue === 'number');
}

async function flowDerivedAlertRule(encounterId) {
  section('5B. Derived alert rule check');
  const { status, json } = await api('GET', `/encounters/${encounterId}`);
  assert('Encounter detail returns 200', status === 200);
  assert('Critical complaint rule would fire for this encounter', deriveCriticalComplaint(json) === 'CRITICAL_COMPLAINT');
}

async function flowPatientCancel(hospitalSlug) {
  section('5C. Patient cancel flow');
  const suffix = randomUUID().slice(0, 8);
  const { status: intentStatus, json: intent } = await api('POST', '/intake/intent', {
    phone: `+1555${Date.now().toString().slice(-7)}`,
    firstName: 'Cancel',
    lastName: suffix,
    chiefComplaint: 'Abdominal pain',
  }, false);
  assert('Cancel-flow intent returns 201', intentStatus === 201);

  const headers = patientHeaders(intent?.sessionToken);
  const { status: confirmStatus, json: encounter } = await api('POST', '/intake/confirm', {
    hospitalSlug,
  }, false, headers);
  assert('Cancel-flow confirm returns 201', confirmStatus === 201);

  const { status: cancelStatus, json: cancelled } = await api('POST', `/patient/encounters/${encounter?.id}/cancel`, null, false, headers);
  assert('Patient cancel returns 200/201', cancelStatus === 200 || cancelStatus === 201);
  assert('Cancelled encounter is terminal', cancelled?.status === 'CANCELLED');
}

async function flowConfirmArrival(encounterId) {
  section('6. Confirm arrival (POST /encounters/:id/confirm)');
  const { status, json } = await api('POST', `/encounters/${encounterId}/confirm`);
  assert('Returns 200/201', status === 200 || status === 201);
  assert('Status is ADMITTED', json?.status === 'ADMITTED');
  assert('Has arrivedAt timestamp', !!json?.arrivedAt);
  return json;
}

async function flowStartExam(encounterId) {
  section('7. Start triage exam (POST /encounters/:id/start-exam)');
  const { status, json } = await api('POST', `/encounters/${encounterId}/start-exam`);
  assert('Returns 200/201', status === 200 || status === 201);
  assert('Status is TRIAGE', json?.status === 'TRIAGE');
  assert('Has triagedAt timestamp', !!json?.triagedAt);
  return json;
}

async function flowCreateAssessment(encounterId) {
  section('8. Create triage assessment (POST /triage/assessments)');
  const { status, json } = await api('POST', '/triage/assessments', {
    encounterId,
    ctasLevel: 3,
    painLevel: 5,
    chiefComplaint: 'E2E test - headache and dizziness',
    vitalSigns: {
      bloodPressure: '120/80',
      heartRate: 72,
      temperature: 37.2,
      respiratoryRate: 16,
      oxygenSaturation: 98,
    },
    note: 'E2E automated test assessment',
  });

  assert('Returns 201', status === 201);
  assert('Has assessment id', typeof json?.id === 'number');
  assert('CTAS level = 3', json?.ctasLevel === 3);
  assert('Pain level = 5', json?.painLevel === 5);
  assert('Has vitalSigns', !!json?.vitalSigns);
  return json;
}

async function flowListAssessments(encounterId) {
  section('9. List assessments (GET /triage/encounters/:id/assessments)');
  const { status, json } = await api('GET', `/triage/encounters/${encounterId}/assessments`);
  assert('Returns 200', status === 200);
  assert('Is array with >= 1 entry', Array.isArray(json) && json.length >= 1);
}

async function flowMoveToWaiting(encounterId) {
  section('10. Move to waiting (POST /encounters/:id/waiting)');
  const { status, json } = await api('POST', `/encounters/${encounterId}/waiting`);
  assert('Returns 200/201', status === 200 || status === 201);
  assert('Status is WAITING', json?.status === 'WAITING');
  assert('Has waitingAt timestamp', !!json?.waitingAt);
}

async function flowSendMessage(encounterId) {
  section('11. Send message (Socket.IO message.send)');
  const realtime = await connectSocket();
  const outgoing = 'E2E socket message: how are you feeling?';

  const messageCreated = new Promise((resolve, reject) => {
    let lastPayload = null;
    const timeout = setTimeout(() => {
      realtime.off('message.created', handleCreated);
      const suffix = lastPayload ? `; last payload=${JSON.stringify(lastPayload)}` : '';
      reject(new Error(`Timed out waiting for message.created${suffix}`));
    }, 5000);

    const handleCreated = (payload) => {
      lastPayload = payload;
      if (payload?.encounterId !== encounterId) {
        return;
      }
      clearTimeout(timeout);
      realtime.off('message.created', handleCreated);
      resolve(payload);
    };

    realtime.on('message.created', handleCreated);
  });

  const ack = await new Promise((resolve) => {
    realtime.emit('message.send', {
      encounterId,
      content: outgoing,
      isInternal: false,
    }, resolve);
  });

  if (VERBOSE) {
    console.log(`  ${C.dim}socket ack: ${JSON.stringify(ack)}${C.reset}`);
  }

  assert('Ack returns ok=true', ack?.ok === true);
  assert('Ack includes created message', typeof ack?.message?.id === 'number');
  assert('Ack message content matches', ack?.message?.content === outgoing);

  const createdPayload = await messageCreated;
  assert('Receives message.created event', createdPayload?.metadata?.messageId === ack?.message?.id);

  section('12. Reject invalid socket message payload');
  const invalidAck = await new Promise((resolve) => {
    realtime.emit('message.send', {
      encounterId,
      content: '   ',
      isInternal: false,
    }, resolve);
  });
  assert('Invalid payload returns ok=false', invalidAck?.ok === false);
  assert('Invalid payload code is VALIDATION_ERROR', invalidAck?.error?.code === 'VALIDATION_ERROR');

  section('13. List messages (GET /messaging/encounters/:id/messages)');
  const { status: s2, json: list } = await api('GET', `/messaging/encounters/${encounterId}/messages`);
  assert('Returns 200', s2 === 200);
  assert('Has data array', Array.isArray(list?.data));
  assert('Has at least 1 message', list?.data?.length >= 1);
  assert('Persisted socket message appears in history', list?.data?.some((item) => item.id === ack?.message?.id));

  if (ack?.message?.id) {
    section('14. Mark message read (POST /messaging/messages/:id/read)');
    const { status: initialReadStateStatus, json: initialReadState } = await api('GET', `/messaging/encounters/${encounterId}/read-state`);
    assert('Initial read-state returns 200', initialReadStateStatus === 200);
    assert('Initial read-state is empty', initialReadState?.lastReadMessageId == null);

    const { status: s3, json: readRes } = await api('POST', `/messaging/messages/${ack.message.id}/read`);
    assert('Returns 200/201', s3 === 200 || s3 === 201);
    assert('Returns { ok: true }', readRes?.ok === true);

    const { status: finalReadStateStatus, json: finalReadState } = await api('GET', `/messaging/encounters/${encounterId}/read-state`);
    assert('Updated read-state returns 200', finalReadStateStatus === 200);
    assert('Read-state points at the message just read', finalReadState?.lastReadMessageId === ack.message.id);
  }
}

async function flowAlerts(hospitalId) {
  section('15. List alerts (GET /alerts/hospitals/:hospitalId/unacknowledged)');
  const { status, json } = await api('GET', `/alerts/hospitals/${hospitalId}/unacknowledged`);
  assert('Returns 200', status === 200);
  assert('Is array', Array.isArray(json));
}

async function flowDischarge(encounterId) {
  section('16. Discharge (POST /encounters/:id/discharge)');
  const { status, json } = await api('POST', `/encounters/${encounterId}/discharge`);
  assert('Returns 200/201', status === 200 || status === 201);
  assert('Status is COMPLETE', json?.status === 'COMPLETE');
  assert('Has departedAt timestamp', !!json?.departedAt);
}

async function flowTokenExpired() {
  section('17. Token expiration handling (GET /auth/me with bad token)');
  const savedToken = token;
  token = 'expired.invalid.token';
  const { status } = await api('GET', '/auth/me');
  assert('Returns 401', status === 401);
  token = savedToken;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${C.bold}${C.cyan}╔════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.bold}${C.cyan}║   Priage E2E Frontend Flow Test        ║${C.reset}`);
  console.log(`${C.bold}${C.cyan}╚════════════════════════════════════════╝${C.reset}`);
  console.log(`${C.dim}Target: ${BASE}${C.reset}`);

  try {
    if (SEED) await seedTestUser();

    const user = await flowLogin();
    if (!token) {
      console.log(`\n${C.red}${C.bold}Login failed — cannot continue.${C.reset}`);
      process.exit(1);
    }

    await flowGetMe();
    await flowListEncounters();

    const { encounter, patientToken } = await flowCreatePatientAndEncounter(user.hospital.slug);
    if (!encounter?.id || !patientToken) {
      console.log(`\n${C.red}${C.bold}Could not create encounter — cannot continue.${C.reset}`);
      process.exit(1);
    }

    await flowPatientEncounterApis(encounter.id, patientToken);
    await flowDerivedAlertRule(encounter.id);
    await flowPatientCancel(user.hospital.slug);
    await flowConfirmArrival(encounter.id);
    await flowStartExam(encounter.id);
    await flowCreateAssessment(encounter.id);
    await flowListAssessments(encounter.id);
    await flowMoveToWaiting(encounter.id);
    await flowSendMessage(encounter.id);
    await flowAlerts(user.hospitalId);
    await flowDischarge(encounter.id);
    await flowTokenExpired();

    // Summary
    console.log(`\n${C.bold}════════════════════════════════════════${C.reset}`);
    console.log(`${C.green}${C.bold}  Passed: ${passed}${C.reset}`);
    if (failed > 0) {
      console.log(`${C.red}${C.bold}  Failed: ${failed}${C.reset}`);
    }
    console.log(`${C.bold}════════════════════════════════════════${C.reset}\n`);

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error(`\n${C.red}${C.bold}Fatal error:${C.reset}`, err);
    process.exit(1);
  } finally {
    if (socket) {
      socket.disconnect();
    }
  }
}

main();
