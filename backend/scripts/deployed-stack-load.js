#!/usr/bin/env node

require('dotenv').config();

const assert = require('assert');
const bcrypt = require('bcrypt');
const { randomUUID } = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const { io } = require('socket.io-client');
const { TestFixtureTracker } = require('./lib/test-fixtures');
const {
  buildPatientCookieHeader,
  generatePatientSessionToken,
  hashPatientSessionToken,
} = require('./lib/session-cookies');

const config = {
  baseUrl: process.env.DEPLOYED_TEST_BASE_URL || process.env.BASE_URL || 'http://localhost:8080',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://priage:priage@localhost:6432/priage?schema=public',
  patientCount: readInt('DEPLOYED_TEST_PATIENT_COUNT', 500),
  staffCount: readInt('DEPLOYED_TEST_STAFF_COUNT', 25),
  uploadCount: readInt('DEPLOYED_TEST_UPLOAD_COUNT', 20),
  sseCount: readInt('DEPLOYED_TEST_SSE_COUNT', 50),
  reconnectRounds: readInt('DEPLOYED_TEST_RECONNECT_ROUNDS', 3),
  maxP95Ms: readInt('DEPLOYED_TEST_MAX_P95_MS', 2500),
  maxErrorRate: Number.parseFloat(process.env.DEPLOYED_TEST_MAX_ERROR_RATE || '0'),
  keepFixtures: process.env.DEPLOYED_TEST_KEEP_FIXTURES === '1',
};

const pool = new Pool({ connectionString: config.databaseUrl, max: 25 });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const fixtures = new TestFixtureTracker(prisma, 'deployed-load');
const timings = [];
let requests = 0;
let errors = 0;
const errorSamples = [];

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  if (!config.keepFixtures) {
    await fixtures.cleanup().catch((error) => console.error('Fixture cleanup failed:', error.message));
  }
  await prisma.$disconnect().catch(() => {});
  await pool.end().catch(() => {});
});

async function main() {
  console.log(`Preparing ${config.patientCount} patients and ${config.staffCount} staff users`);
  const testId = randomUUID().slice(0, 8);
  const password = 'DeployTestPassword123!';
  const passwordHash = await bcrypt.hash(password, 10);
  const hospital = await fixtures.createHospital({
    namePrefix: 'Deployed Stack Hospital',
    slugPrefix: `deployed-stack-${testId}`,
  });
  const staff = [];
  for (let index = 0; index < config.staffCount; index += 1) {
    staff.push(await fixtures.createUser({
      hospitalId: hospital.id,
      password,
      role: index === 0 ? 'ADMIN' : index % 2 === 0 ? 'DOCTOR' : 'NURSE',
      emailPrefix: `deployed-staff-${testId}-${index}`,
    }));
  }

  const patientRows = Array.from({ length: config.patientCount }, (_, index) => ({
    email: `deployed-patient-${testId}-${index}@patient.test`,
    password: passwordHash,
    firstName: 'Load',
    lastName: `Patient ${index}`,
    phone: `555${String(index).padStart(7, '0')}`,
    preferredLanguage: 'en',
  }));
  await prisma.patientProfile.createMany({ data: patientRows });
  const patients = await prisma.patientProfile.findMany({
    where: { email: { startsWith: `deployed-patient-${testId}-` } },
    orderBy: { id: 'asc' },
  });
  patients.forEach((patient) => fixtures.trackPatient(patient.id));

  await prisma.encounter.createMany({
    data: patients.map((patient, index) => ({
      publicId: `load_${testId}_${index}_${randomUUID()}`,
      hospitalId: hospital.id,
      patientId: patient.id,
      status: 'WAITING',
      chiefComplaint: 'Deployed stack capacity test',
      details: 'Synthetic non-clinical load fixture',
      expectedAt: new Date(),
      arrivedAt: new Date(),
      triagedAt: new Date(),
      waitingAt: new Date(),
    })),
  });
  const encounters = await prisma.encounter.findMany({
    where: { hospitalId: hospital.id },
    orderBy: { id: 'asc' },
  });
  const tokens = patients.map(() => generatePatientSessionToken());
  await prisma.patientSession.createMany({
    data: patients.map((patient, index) => ({
      token: hashPatientSessionToken(tokens[index]),
      patientId: patient.id,
      encounterId: encounters[index].id,
      expiresAt: new Date(Date.now() + 60 * 60_000),
    })),
  });
  await prisma.staffEncounterAccess.createMany({
    data: staff.flatMap((user) => encounters.slice(0, 25).map((encounter) => ({
      encounterId: encounter.id,
      hospitalId: hospital.id,
      userId: user.id,
      grantedByUserId: staff[0].id,
      reason: 'deployed stack load test',
    }))),
  });

  console.log('Running distinct-patient reads and idempotent writes');
  await runConcurrent(patients.map((patient, index) => async () => {
    const cookie = buildPatientCookieHeader(tokens[index]);
    const testClient = `patient-${patient.id}`;
    await measuredFetch(`/patient/encounters/${encounters[index].id}`, { cookie, testClient });
    await measuredFetch('/patient-auth/profile', {
      method: 'PATCH',
      cookie,
      testClient,
      headers: { 'Idempotency-Key': `load-profile-${testId}-${patient.id}` },
      body: { preferredLanguage: index % 2 === 0 ? 'en' : 'fr' },
    });
    await measuredFetch(`/patient/encounters/${encounters[index].id}/messages`, {
      method: 'POST',
      cookie,
      testClient,
      headers: { 'Idempotency-Key': `load-message-${testId}-${patient.id}` },
      body: { content: `Synthetic load message ${index}` },
    });
  }), 50);

  console.log(`Running ${Math.min(config.uploadCount, patients.length)} private object uploads`);
  await runConcurrent(patients.slice(0, config.uploadCount).map((patient, index) => async () => {
    const form = new FormData();
    form.append('files', new Blob([onePixelPng()], { type: 'image/png' }), `load-${index}.png`);
    await measuredFetch('/patient/assets/intake/images', {
      method: 'POST',
      cookie: buildPatientCookieHeader(tokens[index]),
      testClient: `patient-${patient.id}`,
      headers: { 'Idempotency-Key': `load-upload-${testId}-${patient.id}` },
      form,
    });
  }), 10);

  console.log('Opening distributed patient SSE streams');
  const sseAbort = new AbortController();
  const sseStreams = patients.slice(0, config.sseCount).map((_, index) =>
    fetch(`${config.baseUrl}/patient/encounters/${encounters[index].id}/events`, {
      headers: {
        Cookie: buildPatientCookieHeader(tokens[index]),
        Origin: 'http://localhost:8082',
        'X-Priage-Test-Client': `patient-${patients[index].id}`,
      },
      signal: sseAbort.signal,
    }).catch(() => null),
  );
  await sleep(1500);
  sseAbort.abort();
  await Promise.allSettled(sseStreams);

  console.log('Running distinct-staff socket reconnect storm and list reads');
  const staffCookies = await Promise.all(staff.map((user) => loginStaff(user.email, password, user.id)));
  for (let index = 0; index < staffCookies.length; index += 1) {
    await measuredFetch('/encounters?limit=25', {
      cookie: staffCookies[index],
      origin: 'http://localhost:8081',
      testClient: `staff-${staff[index].id}`,
    });
  }
  for (let round = 0; round < config.reconnectRounds; round += 1) {
    const sockets = staffCookies.map((cookie, index) => io(config.baseUrl, {
      transports: ['websocket'],
      extraHeaders: {
        Cookie: cookie,
        Origin: 'http://localhost:8081',
        'X-Priage-Test-Client': `staff-${staff[index].id}`,
      },
      reconnection: false,
      timeout: 7000,
    }));
    try {
      await Promise.all(sockets.map(waitForSocket));
    } finally {
      sockets.forEach((socket) => socket.disconnect());
    }
  }

  const p95Ms = percentile(timings, 95);
  const errorRate = requests === 0 ? 1 : errors / requests;
  const result = {
    patients: patients.length,
    staff: staff.length,
    requests,
    errors,
    errorRate: Number(errorRate.toFixed(4)),
    p95Ms,
    socketsAttempted: staff.length * config.reconnectRounds,
    uploadsAttempted: Math.min(config.uploadCount, patients.length),
    sseAttempted: Math.min(config.sseCount, patients.length),
    errorSamples,
  };
  console.log(JSON.stringify(result, null, 2));
  assert.ok(errorRate <= config.maxErrorRate, `error rate ${errorRate} exceeded ${config.maxErrorRate}`);
  assert.ok(p95Ms <= config.maxP95Ms, `p95 ${p95Ms}ms exceeded ${config.maxP95Ms}ms`);
}

async function measuredFetch(path, options = {}) {
  const startedAt = Date.now();
  requests += 1;
  const response = await fetch(`${config.baseUrl}${path}`, {
    method: options.method || 'GET',
    headers: {
      ...(options.cookie ? { Cookie: options.cookie } : {}),
      ...(options.origin || options.cookie ? { Origin: options.origin || 'http://localhost:8082' } : {}),
      ...(options.testClient ? { 'X-Priage-Test-Client': options.testClient } : {}),
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
    body: options.form || (options.body ? JSON.stringify(options.body) : undefined),
  });
  const responseBody = await response.text().catch(() => '');
  timings.push(Date.now() - startedAt);
  if (response.status >= 500 || response.status === 429) {
    errors += 1;
    if (errorSamples.length < 20) {
      errorSamples.push({
        path,
        status: response.status,
        body: responseBody.slice(0, 500),
      });
    }
  }
  return response;
}

async function loginStaff(email, password, userId) {
  const response = await fetch(`${config.baseUrl}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:8081',
      'X-Priage-Test-Client': `staff-${userId}`,
    },
    body: JSON.stringify({ email, password }),
  });
  assert.ok(response.ok, `staff login failed with ${response.status}`);
  const setCookies = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie') || ''];
  return setCookies.map((value) => value.split(';')[0]).filter(Boolean).join('; ');
}

function waitForSocket(socket) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('socket connection timed out')), 8000);
    socket.once('connect', () => {
      clearTimeout(timer);
      resolve();
    });
    socket.once('connect_error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

async function runConcurrent(tasks, concurrency) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
    while (next < tasks.length) {
      const index = next;
      next += 1;
      await tasks[index]();
    }
  }));
}

function percentile(values, value) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor((value / 100) * sorted.length))] || 0;
}

function onePixelPng() {
  return Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
}

function readInt(name, fallback) {
  const parsed = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
