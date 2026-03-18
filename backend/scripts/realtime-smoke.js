#!/usr/bin/env node
// backend/scripts/realtime-smoke.js
// Smoke test for websocket realtime delivery and Redis-backed cross-instance fanout.

require('dotenv').config();
const { io } = require('socket.io-client');
const { randomUUID } = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const { TestFixtureTracker } = require('./lib/test-fixtures');
const { demoCookieHeader, demoSocketHeaders } = require('./lib/demo-gate');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const BASE_URL_API = process.env.BASE_URL_API || BASE;
const BASE_URL_SOCKET = process.env.BASE_URL_SOCKET || BASE_URL_API;
const EMAIL = process.env.REALTIME_TEST_EMAIL || process.env.PRIAGE_DEV_ADMIN_EMAIL || '';
const PASSWORD = process.env.REALTIME_TEST_PASSWORD || process.env.PRIAGE_DEV_ADMIN_PASSWORD || process.env.DEMO_STAFF_PASSWORD || '';
const FIXTURE_PASSWORD = 'TestPassword123!';

let fixtureContext = null;

async function api(path, options = {}) {
  const demoCookie = demoCookieHeader();
  if (demoCookie) {
    options.headers = { ...(options.headers || {}), Cookie: demoCookie };
  }
  const res = await fetch(`${BASE_URL_API}${path}`, options);
  const text = await res.text();
  let json = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return { res, text, json };
}

async function login(email = EMAIL, password = PASSWORD) {
  if (!password) {
    throw new Error('REALTIME_TEST_PASSWORD or PRIAGE_DEV_ADMIN_PASSWORD must be set to log into an existing user');
  }

  const { res, json, text } = await api('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok || !json?.access_token || !json?.user?.hospital?.slug) {
    throw new Error(`Login failed: ${res.status} ${text}`);
  }

  return json;
}

async function getFixtureContext() {
  if (fixtureContext) {
    return fixtureContext;
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to create disposable realtime smoke fixtures');
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  fixtureContext = {
    pool,
    prisma,
    fixtures: new TestFixtureTracker(prisma, 'realtime'),
  };
  return fixtureContext;
}

async function cleanupFixtureContext() {
  if (!fixtureContext) {
    return;
  }
  try {
    await fixtureContext.fixtures.cleanup();
  } finally {
    await fixtureContext.prisma.$disconnect().catch(() => {});
    await fixtureContext.pool.end().catch(() => {});
    fixtureContext = null;
  }
}

async function createEphemeralRealtimeLogin() {
  const context = await getFixtureContext();
  const hospital = await context.fixtures.createHospital({
    namePrefix: 'Realtime Smoke Hospital',
    slugPrefix: 'realtime-smoke',
  });
  const user = await context.fixtures.createUser({
    hospitalId: hospital.id,
    password: FIXTURE_PASSWORD,
    role: 'ADMIN',
    emailPrefix: 'realtime-smoke',
  });

  return {
    email: user.email,
    password: FIXTURE_PASSWORD,
  };
}

async function loginWithFallback() {
  if (EMAIL && PASSWORD) {
    try {
      return await login();
    } catch (error) {
      console.warn(`Primary realtime login failed, creating disposable fallback credentials: ${error.message}`);
    }
  }

  const fixtureLogin = await createEphemeralRealtimeLogin();
  return login(fixtureLogin.email, fixtureLogin.password);
}

function buildInterviewAnswer(question) {
  const payload = { questionPublicId: question.publicId };

  switch (question.inputType) {
    case 'boolean':
      payload.valueBoolean = false;
      return payload;
    case 'number':
      payload.valueNumber = 3;
      return payload;
    case 'single_select':
      payload.valueChoice = question.choices?.[0] ?? 'No';
      return payload;
    case 'textarea':
    case 'text':
    default:
      payload.valueText = `Realtime smoke answer for ${question.publicId}`;
      return payload;
  }
}

async function completeInterviewForPatient(sessionToken) {
  const headers = { 'x-patient-token': sessionToken };
  let { res, json, text } = await api('/intake/interview/start', {
    method: 'POST',
    headers,
  });

  if (!res.ok) {
    throw new Error(`Failed to start intake interview: ${res.status} ${text}`);
  }

  for (let index = 0; index < 12; index += 1) {
    if (json?.status === 'complete') {
      if (!json.summaryPreview) {
        throw new Error('Interview completed without a summary preview');
      }
      return json;
    }

    if (json?.status === 'emergency_ack_required') {
      ({ res, json, text } = await api('/intake/interview/advance', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'acknowledge_emergency' }),
      }));
    } else {
      if (!json?.currentQuestion) {
        throw new Error(`Interview is ${json?.status ?? 'unknown'} but has no currentQuestion`);
      }

      ({ res, json, text } = await api('/intake/interview/advance', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(buildInterviewAnswer(json.currentQuestion)),
      }));
    }

    if (!res.ok) {
      throw new Error(`Failed to advance intake interview: ${res.status} ${text}`);
    }
  }

  throw new Error(`Interview did not complete after repeated answers; last status=${json?.status ?? 'unknown'}`);
}

async function createEncounter(hospitalSlug) {
  const suffix = String(Date.now()).slice(-7);
  const { res: intentRes, json: intent, text: intentText } = await api('/intake/intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: `+1555${suffix}`,
      firstName: 'Realtime',
      lastName: 'Smoke',
      age: 29,
      chiefComplaint: 'Headache',
      details: 'Realtime smoke test encounter',
    }),
  });
  if (!intentRes.ok || !intent?.sessionToken) {
    throw new Error(`Failed to create intake intent: ${intentRes.status} ${intentText}`);
  }
  if (fixtureContext) {
    fixtureContext.fixtures.trackPatient(intent.patientId);
  }

  await completeInterviewForPatient(intent.sessionToken);

  const { res: confirmRes, json: encounter, text: confirmText } = await api('/intake/confirm', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-patient-token': intent.sessionToken,
    },
    body: JSON.stringify({ hospitalSlug }),
  });
  if (!confirmRes.ok || !encounter?.id) {
    throw new Error(`Failed to confirm intake: ${confirmRes.status} ${confirmText}`);
  }

  return encounter;
}

async function createAlert(encounterId, token) {
  const { res, json, text } = await api('/alerts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      encounterId,
      type: 'REALTIME_SMOKE',
      severity: 'HIGH',
      metadata: { source: 'realtime-smoke' },
    }),
  });

  if (!res.ok || !json?.id) {
    throw new Error(`Failed to create alert: ${res.status} ${text}`);
  }

  return json;
}

async function acknowledgeAlert(alertId, token) {
  const { res, json, text } = await api(`/alerts/${alertId}/acknowledge`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok || !json?.id) {
    throw new Error(`Failed to acknowledge alert: ${res.status} ${text}`);
  }

  return json;
}

async function resolveAlert(alertId, token) {
  const { res, json, text } = await api(`/alerts/${alertId}/resolve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok || !json?.id) {
    throw new Error(`Failed to resolve alert: ${res.status} ${text}`);
  }

  return json;
}

function openSocket(token) {
  return io(BASE_URL_SOCKET, {
    auth: token ? { token } : {},
    extraHeaders: demoSocketHeaders(),
    transports: ['websocket'],
    autoConnect: false,
    reconnection: false,
    timeout: 5000,
  });
}

async function expectRejectedSocket(token, label) {
  const socket = openSocket(token);

  const outcome = await new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };

    const timer = setTimeout(() => finish({ type: 'timeout', connected: socket.connected }), 1500);

    socket.once('connect_error', (error) => finish({
      type: 'connect_error',
      message: error instanceof Error ? error.message : String(error),
    }));

    socket.once('disconnect', (reason) => finish({ type: 'disconnect', reason }));

    socket.once('connect', () => {
      setTimeout(() => finish({ type: 'post_connect', connected: socket.connected }), 300);
    });

    socket.connect();
  });

  socket.close();

  if (outcome.type === 'post_connect' && outcome.connected) {
    throw new Error(`${label} unexpectedly remained connected`);
  }

  console.log(`Verified websocket rejection for ${label}`);
}

async function connectAuthorizedSocket(token) {
  const socket = openSocket(token);

  await new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', (error) => {
      reject(error instanceof Error ? error : new Error(String(error)));
    });
    socket.connect();
  });

  return socket;
}

function waitForEvent(socket, eventName, predicate, timeoutMs = 5000) {
  let cleanup = () => {};
  const promise = new Promise((resolve, reject) => {
    let lastPayload = null;
    let settled = false;
    const timer = setTimeout(() => {
      cleanup();
      const suffix = lastPayload ? `; last payload=${JSON.stringify(lastPayload)}` : '';
      settled = true;
      reject(new Error(`Timed out waiting for ${eventName}${suffix}`));
    }, timeoutMs);

    const handleDisconnect = () => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(new Error(`Socket disconnected while waiting for ${eventName}`));
    };

    const handleEvent = (payload) => {
      lastPayload = payload;
      if (predicate && !predicate(payload)) {
        return;
      }

      settled = true;
      cleanup();
      resolve(payload);
    };

    cleanup = () => {
      clearTimeout(timer);
      socket.off(eventName, handleEvent);
      socket.off('disconnect', handleDisconnect);
    };

    socket.on(eventName, handleEvent);
    socket.on('disconnect', handleDisconnect);
  });

  promise.cancel = () => {
    cleanup();
  };

  return promise;
}

async function sendStaffMessage(socket, encounterId) {
  const outgoing = 'Realtime smoke socket message';
  const createdPromise = waitForEvent(
    socket,
    'message.created',
    (payload) => payload?.encounterId === encounterId,
  );

  const ack = await new Promise((resolve) => {
    socket.emit(
      'message.send',
      { encounterId, content: outgoing, isInternal: false },
      resolve,
    );
  });

  if (!ack?.ok || ack?.message?.content !== outgoing) {
    throw new Error('Expected successful message.send acknowledgement');
  }

  const created = await createdPromise;
  if (created?.metadata?.messageId !== ack.message.id) {
    throw new Error(`Expected message.created for message ${ack.message.id}`);
  }

  console.log(`Received message.created for message ${ack.message.id}`);
}

async function main() {
  console.log(`API base: ${BASE_URL_API}`);
  console.log(`Socket base: ${BASE_URL_SOCKET}`);

  const auth = await loginWithFallback();
  const token = auth.access_token;
  const hospitalSlug = auth.user.hospital.slug;

  await expectRejectedSocket('', 'missing token');
  await expectRejectedSocket('invalid.token.value', 'invalid token');

  const socket = await connectAuthorizedSocket(token);
  console.log('Verified websocket connection with valid token');

  let encounterEventPromise = null;
  try {
    encounterEventPromise = waitForEvent(
      socket,
      'encounter.updated',
      (payload) => (
        payload?.encounterId &&
        payload?.metadata?.status === 'EXPECTED' &&
        payload?.metadata?.source === 'patient_intake'
      ),
      8000,
    );

    const encounter = await createEncounter(hospitalSlug);
    const encounterEvent = await encounterEventPromise;
    if (encounterEvent?.encounterId !== encounter.id) {
      throw new Error(`Expected encounter.updated for encounter ${encounter.id}`);
    }
    console.log(`Received encounter.updated for encounter ${encounter.id}`);

    await sendStaffMessage(socket, encounter.id);

    const alertCreatedPromise = waitForEvent(
      socket,
      'alert.created',
      (payload) => payload?.encounterId === encounter.id && payload?.metadata?.type === 'REALTIME_SMOKE',
    );
    const createdAlert = await createAlert(encounter.id, token);
    const createdEvent = await alertCreatedPromise;
    if (createdEvent?.metadata?.alertId !== createdAlert.id) {
      throw new Error(`Expected alert.created for alert ${createdAlert.id}`);
    }
    console.log(`Received alert.created for alert ${createdAlert.id}`);

    const alertAcknowledgedPromise = waitForEvent(
      socket,
      'alert.acknowledged',
      (payload) => payload?.metadata?.alertId === createdAlert.id,
    );
    await acknowledgeAlert(createdAlert.id, token);
    await alertAcknowledgedPromise;
    console.log(`Received alert.acknowledged for alert ${createdAlert.id}`);

    const alertResolvedPromise = waitForEvent(
      socket,
      'alert.resolved',
      (payload) => payload?.metadata?.alertId === createdAlert.id,
    );
    await resolveAlert(createdAlert.id, token);
    await alertResolvedPromise;
    console.log(`Received alert.resolved for alert ${createdAlert.id}`);
  } finally {
    encounterEventPromise?.cancel?.();
    socket.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await cleanupFixtureContext();
});
