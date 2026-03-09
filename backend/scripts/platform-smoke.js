#!/usr/bin/env node

require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const { createHash, randomUUID } = require('crypto');

const CONFIG = {
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  databaseUrl: process.env.DATABASE_URL,
};

if (!CONFIG.databaseUrl) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const pool = new Pool({ connectionString: CONFIG.databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ['error', 'warn'] });

const state = {
  hospitalId: null,
  partnerId: null,
  credentialId: null,
  patientIds: new Set(),
  patientSessionIds: new Set(),
};

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function request(method, path, { headers = {}, body, expectJson = true } = {}) {
  let response;
  try {
    response = await fetch(`${CONFIG.baseUrl}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        'X-Correlation-ID': `platform-smoke-${randomUUID()}`,
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    throw new Error(`Request to ${path} failed. Is the API running at ${CONFIG.baseUrl}? ${error.message}`);
  }

  const text = await response.text();
  const parsed = expectJson && text
    ? (() => {
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    })()
    : text;

  return {
    status: response.status,
    ok: response.ok,
    body: parsed,
  };
}

function partnerHeaders(rawKey, idempotencyKey) {
  return {
    'x-partner-key': rawKey,
    ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
  };
}

function patientHeaders(sessionToken) {
  return {
    'x-patient-token': sessionToken,
  };
}

async function setupPartner() {
  const suffix = randomUUID().slice(0, 8);
  const rawKey = `ptk_${randomUUID()}`;
  const keyHash = createHash('sha256').update(rawKey).digest('hex');

  const hospital = await prisma.hospital.create({
    data: {
      name: `Platform Smoke ${suffix}`,
      slug: `platform-smoke-${suffix}`,
    },
  });

  const partner = await prisma.partner.create({
    data: {
      name: `Platform Partner ${suffix}`,
      slug: `platform-partner-${suffix}`,
    },
  });

  const credential = await prisma.partnerCredential.create({
    data: {
      partnerId: partner.id,
      hospitalId: hospital.id,
      label: 'platform-smoke',
      keyPrefix: rawKey.slice(0, 12),
      keyHash,
      scopes: ['intake:create', 'intake:write', 'intake:confirm', 'intake:read', 'encounter:read'],
      trustPolicy: {
        create: {
          defaultTrustTier: 'PARTNER_SUBMITTED',
          defaultVisibilityScope: 'STORED_ONLY',
          requirePatientConfirmation: false,
          allowPreConfirmOperationalUse: false,
        },
      },
    },
  });

  state.hospitalId = hospital.id;
  state.partnerId = partner.id;
  state.credentialId = credential.id;

  return { rawKey, hospital, partner, credential };
}

async function cleanup() {
  try {
    if (state.hospitalId) {
      await prisma.summaryProjection.deleteMany({ where: { intakeSession: { hospitalId: state.hospitalId } } });
      const contextFilters = [{ hospitalId: state.hospitalId }];
      if (state.partnerId) {
        contextFilters.push({ partnerId: state.partnerId });
      }
      await prisma.contextItem.deleteMany({ where: { OR: contextFilters } });
      await prisma.asset.deleteMany({ where: { OR: [{ hospitalId: state.hospitalId }, { intakeSession: { hospitalId: state.hospitalId } }] } });
      await prisma.encounterEvent.deleteMany({ where: { hospitalId: state.hospitalId } });
      await prisma.encounter.deleteMany({ where: { hospitalId: state.hospitalId } });
      await prisma.intakeSession.deleteMany({ where: { OR: [{ hospitalId: state.hospitalId }, { authSessionId: { in: Array.from(state.patientSessionIds) } }] } });
    }

    if (state.credentialId) {
      await prisma.idempotencyRecord.deleteMany({ where: { partnerCredentialId: state.credentialId } });
      await prisma.commandResult.deleteMany({ where: { partnerCredentialId: state.credentialId } });
      await prisma.webhookSubscription.deleteMany({ where: { partnerCredentialId: state.credentialId } });
      await prisma.partnerTrustPolicy.deleteMany({ where: { partnerCredentialId: state.credentialId } });
      await prisma.partnerCredential.deleteMany({ where: { id: state.credentialId } });
    }

    if (state.partnerId) {
      await prisma.partnerReference.deleteMany({ where: { partnerId: state.partnerId } });
      await prisma.partner.deleteMany({ where: { id: state.partnerId } });
    }

    if (state.patientSessionIds.size > 0) {
      await prisma.patientSession.deleteMany({ where: { id: { in: Array.from(state.patientSessionIds) } } });
    }

    if (state.patientIds.size > 0) {
      await prisma.patientProfile.deleteMany({ where: { id: { in: Array.from(state.patientIds) } } });
    }

    if (state.hospitalId) {
      await prisma.hospital.deleteMany({ where: { id: state.hospitalId } });
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

async function createPlatformDraft(rawKey, payload, idempotencyKey) {
  return request('POST', '/platform/v1/intake-sessions', {
    headers: partnerHeaders(rawKey, idempotencyKey),
    body: payload,
  });
}

async function confirmPlatformDraft(rawKey, publicId, payload, idempotencyKey) {
  return request('POST', `/platform/v1/intake-sessions/${publicId}/confirm`, {
    headers: partnerHeaders(rawKey, idempotencyKey),
    body: payload,
  });
}

async function cancelPlatformDraft(rawKey, publicId, idempotencyKey) {
  return request('POST', `/platform/v1/intake-sessions/${publicId}/cancel`, {
    headers: partnerHeaders(rawKey, idempotencyKey),
  });
}

async function getPlatformDraft(rawKey, publicId) {
  return request('GET', `/platform/v1/intake-sessions/${publicId}`, {
    headers: partnerHeaders(rawKey),
  });
}

async function run() {
  const { rawKey } = await setupPartner();

  const initialContext = {
    itemType: 'partner_intake',
    schemaVersion: 'v1',
    payload: {
      firstName: 'Pat',
      lastName: 'Partner',
      phone: '555-0100',
      chiefComplaint: 'Chest discomfort',
      details: 'Started two hours ago',
    },
  };

  const missingCreateKey = await createPlatformDraft(rawKey, {
    externalReferenceId: `missing-key-${randomUUID()}`,
    initialContext,
  });
  assert(missingCreateKey.status === 400, 'create should require Idempotency-Key');

  const draftPayload = {
    externalReferenceId: `replay-${randomUUID()}`,
    initialContext,
  };

  const created = await createPlatformDraft(rawKey, draftPayload, 'create-replay-key');
  assert(created.status === 201, `expected create 201, got ${created.status}`);
  assert(created.body.publicId, 'create should return publicId');
  const createdPublicId = created.body.publicId;

  const replayedCreate = await createPlatformDraft(rawKey, draftPayload, 'create-replay-key');
  assert(replayedCreate.status === 201, `expected replayed create 201, got ${replayedCreate.status}`);
  assert(replayedCreate.body.publicId === createdPublicId, 'replayed create should return the same intake session');

  const conflictingCreate = await createPlatformDraft(rawKey, {
    externalReferenceId: `different-${randomUUID()}`,
    initialContext,
  }, 'create-replay-key');
  assert(conflictingCreate.status === 409, 'same idempotency key with different fingerprint should conflict');

  const preconfirmSession = await getPlatformDraft(rawKey, createdPublicId);
  assert(preconfirmSession.status === 200, 'preconfirm read should succeed');
  assert(preconfirmSession.body.storedContextItems.length >= 1, 'preconfirm context should be stored');
  assert(preconfirmSession.body.operationalContextItems.length === 0, 'preconfirm context should not be operational');

  const missingConfirmKey = await confirmPlatformDraft(rawKey, createdPublicId, { patientConfirmed: true }, undefined);
  assert(missingConfirmKey.status === 400, 'confirm should require Idempotency-Key');

  const confirmReplayPayload = {
    patientConfirmed: true,
    encounterReferenceId: `enc-replay-${randomUUID()}`,
  };
  const confirmed = await confirmPlatformDraft(rawKey, createdPublicId, {
    ...confirmReplayPayload,
  }, 'confirm-replay-key');
  assert(confirmed.status === 200, `expected confirm 200, got ${confirmed.status}`);
  assert(confirmed.body.publicId, 'confirm should return encounter publicId');

  const replayedConfirm = await confirmPlatformDraft(rawKey, createdPublicId, confirmReplayPayload, 'confirm-replay-key');
  assert(replayedConfirm.status === 200, `expected replayed confirm 200, got ${replayedConfirm.status}`);
  assert(replayedConfirm.body.publicId === confirmed.body.publicId, 'replayed confirm should return same encounter');

  const confirmFingerprintConflict = await confirmPlatformDraft(rawKey, createdPublicId, {
    patientConfirmed: false,
  }, 'confirm-replay-key');
  assert(confirmFingerprintConflict.status === 409, 'same confirm idempotency key with different fingerprint should conflict');

  const confirmedEncounter = await prisma.encounter.findUnique({
    where: { publicId: confirmed.body.publicId },
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
        },
      },
    },
  });
  assert(confirmedEncounter, 'confirmed encounter should exist in DB');
  state.patientIds.add(confirmedEncounter.patientId);
  assert(confirmedEncounter.chiefComplaint === 'Chest discomfort', 'promoted operational context should populate encounter');
  assert(confirmedEncounter.patient.firstName === null, 'partner context should not bind patient firstName');
  assert(confirmedEncounter.patient.lastName === null, 'partner context should not bind patient lastName');
  assert(confirmedEncounter.patient.phone === null, 'partner context should not bind patient phone');

  const cancelDraft = await createPlatformDraft(rawKey, {
    externalReferenceId: `cancel-${randomUUID()}`,
    initialContext,
  }, 'cancel-create-key');
  assert(cancelDraft.status === 201, 'cancel test draft should create');

  const cancelResult = await cancelPlatformDraft(rawKey, cancelDraft.body.publicId, 'cancel-key');
  assert(cancelResult.status === 200, 'cancel should return 200');
  const cancelReplay = await cancelPlatformDraft(rawKey, cancelDraft.body.publicId, 'cancel-key');
  assert(cancelReplay.status === 200, 'cancel replay should preserve 200');

  const createCountBefore = await prisma.intakeSession.count({ where: { hospitalId: state.hospitalId } });
  const sharedReferencePayload = {
    externalReferenceId: `shared-ref-${randomUUID()}`,
    initialContext,
  };
  const [concurrentCreateA, concurrentCreateB] = await Promise.all([
    createPlatformDraft(rawKey, sharedReferencePayload, 'shared-ref-key-a'),
    createPlatformDraft(rawKey, sharedReferencePayload, 'shared-ref-key-b'),
  ]);
  const createStatuses = [concurrentCreateA.status, concurrentCreateB.status].sort((a, b) => a - b);
  assert(
    JSON.stringify(createStatuses) === JSON.stringify([200, 201])
      || JSON.stringify(createStatuses) === JSON.stringify([201, 409]),
    `unexpected concurrent create statuses: ${createStatuses.join(',')}`,
  );
  const createCountAfter = await prisma.intakeSession.count({ where: { hospitalId: state.hospitalId } });
  assert(createCountAfter === createCountBefore + 1, 'same externalReferenceId should not create orphan drafts');

  const confirmRaceDraft = await createPlatformDraft(rawKey, {
    externalReferenceId: `confirm-race-${randomUUID()}`,
    initialContext,
  }, 'confirm-race-create-key');
  assert(confirmRaceDraft.status === 201, 'confirm race draft should create');
  const encounterCountBefore = await prisma.encounter.count({ where: { hospitalId: state.hospitalId } });
  const confirmPayload = {
    patientConfirmed: true,
    encounterReferenceId: `confirm-race-enc-${randomUUID()}`,
  };
  const [concurrentConfirmA, concurrentConfirmB] = await Promise.all([
    confirmPlatformDraft(rawKey, confirmRaceDraft.body.publicId, confirmPayload, 'confirm-race-key'),
    confirmPlatformDraft(rawKey, confirmRaceDraft.body.publicId, confirmPayload, 'confirm-race-key'),
  ]);
  const confirmStatuses = [concurrentConfirmA.status, concurrentConfirmB.status].sort((a, b) => a - b);
  assert(
    JSON.stringify(confirmStatuses) === JSON.stringify([200, 200])
      || JSON.stringify(confirmStatuses) === JSON.stringify([200, 409]),
    `unexpected concurrent confirm statuses: ${confirmStatuses.join(',')}`,
  );
  const encounterCountAfter = await prisma.encounter.count({ where: { hospitalId: state.hospitalId } });
  assert(encounterCountAfter === encounterCountBefore + 1, 'concurrent confirm should create exactly one encounter');
  const confirmedRacePublicId = [concurrentConfirmA.body?.publicId, concurrentConfirmB.body?.publicId].find(Boolean);
  if (confirmedRacePublicId) {
    const confirmedRaceEncounter = await prisma.encounter.findUnique({
      where: { publicId: confirmedRacePublicId },
      select: { patientId: true },
    });
    if (confirmedRaceEncounter) {
      state.patientIds.add(confirmedRaceEncounter.patientId);
    }
  }

  const patientIntent = await request('POST', '/intake/intent', {
    body: {
      firstName: 'Repeat',
      lastName: 'Draft',
      chiefComplaint: 'Headache',
      details: 'Started this morning',
    },
  });
  assert(patientIntent.status === 201 || patientIntent.status === 200, 'patient intent should succeed');
  assert(patientIntent.body.sessionToken, 'patient intent should return session token');

  const patientSession = await prisma.patientSession.findUnique({
    where: { token: patientIntent.body.sessionToken },
    select: { id: true, patientId: true },
  });
  assert(patientSession, 'patient session should exist');
  state.patientSessionIds.add(patientSession.id);
  state.patientIds.add(patientSession.patientId);

  await prisma.intakeSession.updateMany({
    where: {
      authSessionId: patientSession.id,
      status: 'DRAFT',
    },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
    },
  });

  const patientUpdate = await request('PATCH', '/intake/details', {
    headers: patientHeaders(patientIntent.body.sessionToken),
    body: {
      details: 'Pain is worse tonight',
    },
  });
  assert(patientUpdate.status === 200, 'patient intake update should succeed after cancelling prior draft');

  const patientDrafts = await prisma.intakeSession.findMany({
    where: { authSessionId: patientSession.id },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true, status: true },
  });
  assert(patientDrafts.length >= 2, 'repeat draft flow should preserve history and create a new draft');
  assert(patientDrafts[patientDrafts.length - 1].status === 'DRAFT', 'latest repeat-draft session should be active');

  console.log('platform smoke passed');
}

run()
  .catch(async (error) => {
    console.error(`platform smoke failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
  });
