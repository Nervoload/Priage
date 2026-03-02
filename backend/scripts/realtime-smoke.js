#!/usr/bin/env node
// backend/scripts/realtime-smoke.js
// Smoke test for websocket realtime delivery and Redis-backed cross-instance fanout.

require('dotenv').config();
const { io } = require('socket.io-client');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const BASE_URL_API = process.env.BASE_URL_API || BASE;
const BASE_URL_SOCKET = process.env.BASE_URL_SOCKET || BASE_URL_API;
const EMAIL = process.env.REALTIME_TEST_EMAIL || 'admin@priage.dev';
const PASSWORD = process.env.REALTIME_TEST_PASSWORD || 'password123';

async function api(path, options = {}) {
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

async function login() {
  const { res, json, text } = await api('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });

  if (!res.ok || !json?.access_token || !json?.user?.hospital?.slug) {
    throw new Error(`Login failed: ${res.status} ${text}`);
  }

  return json;
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
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(eventName, handleEvent);
      reject(new Error(`Timed out waiting for ${eventName}`));
    }, timeoutMs);

    const handleEvent = (payload) => {
      if (predicate && !predicate(payload)) {
        return;
      }

      clearTimeout(timer);
      socket.off(eventName, handleEvent);
      resolve(payload);
    };

    socket.on(eventName, handleEvent);
  });
}

async function main() {
  console.log(`API base: ${BASE_URL_API}`);
  console.log(`Socket base: ${BASE_URL_SOCKET}`);

  const auth = await login();
  const token = auth.access_token;
  const hospitalSlug = auth.user.hospital.slug;

  await expectRejectedSocket('', 'missing token');
  await expectRejectedSocket('invalid.token.value', 'invalid token');

  const socket = await connectAuthorizedSocket(token);
  console.log('Verified websocket connection with valid token');

  try {
    const encounterEventPromise = waitForEvent(
      socket,
      'encounter.updated',
      (payload) => payload?.metadata?.intake === 'confirmed',
      8000,
    );

    const encounter = await createEncounter(hospitalSlug);
    const encounterEvent = await encounterEventPromise;
    if (encounterEvent?.encounterId !== encounter.id) {
      throw new Error(`Expected encounter.updated for encounter ${encounter.id}`);
    }
    console.log(`Received encounter.updated for encounter ${encounter.id}`);

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
    socket.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
