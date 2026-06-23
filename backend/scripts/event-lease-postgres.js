#!/usr/bin/env node

// Disposable-stack integration proof for the encounter-event lease protocol.
// It creates only fixture-marked rows and the tracker removes them on exit.

require('dotenv').config();

const assert = require('node:assert/strict');
const { PrismaClient, EventType } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const { TestFixtureTracker } = require('./lib/test-fixtures');
const { EventsService } = require('../dist/modules/events/events.service.js');
const { EventsProcessor } = require('../dist/modules/jobs/processors/events.processor.js');

const databaseUrl = process.env.EVENT_LEASE_TEST_DATABASE_URL
  || process.env.DATABASE_URL
  || 'postgresql://priage:priage@localhost:6432/priage?schema=public';
const pool = new Pool({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const fixtures = new TestFixtureTracker(prisma, 'event-lease-postgres');
const deliveries = [];
const failingEventIds = new Set();

const realtime = {
  async emitEncounterUpdated(_hospitalId, _encounterId, payload) {
    if (failingEventIds.has(payload.eventId)) throw new Error('simulated realtime outage');
    deliveries.push(payload.eventId);
  },
  async emitMessageCreated(_hospitalId, _encounterId, payload) {
    if (failingEventIds.has(payload.eventId)) throw new Error('simulated realtime outage');
    deliveries.push(payload.eventId);
  },
  async emitMessageRead() {},
  async emitAlertCreated() {},
  async emitAlertAcknowledged() {},
  async emitAlertResolved() {},
};
const logging = {
  async debug() {}, async info() {}, async warn() {}, async error() {},
};
const patientRealtime = {
  async publish(event) {
    if (failingEventIds.has(event.id)) throw new Error('simulated patient realtime outage');
  },
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await fixtures.cleanup().catch((error) => console.error('Fixture cleanup failed:', error.message));
  await prisma.$disconnect().catch(() => {});
  await pool.end().catch(() => {});
});

async function main() {
  await prisma.$queryRaw`SELECT 1`;
  const hospital = await fixtures.createHospital({ namePrefix: 'Event Lease', slugPrefix: 'event-lease' });
  const patient = await fixtures.createPatient({ emailPrefix: 'event-lease-patient' });
  const encounter = await fixtures.createEncounter({ hospitalId: hospital.id, patientId: patient.id, status: 'WAITING' });
  const first = new EventsService(realtime, logging, prisma, patientRealtime);
  const second = new EventsService(realtime, logging, prisma, patientRealtime);

  const concurrent = await createEvent(hospital.id, encounter.id);
  const concurrentResult = await Promise.all([
    first.dispatchEncounterEventAndMarkProcessed(concurrent),
    second.dispatchEncounterEventAndMarkProcessed(concurrent),
  ]);
  assert.deepEqual(concurrentResult, [true, true]);
  assert.equal(deliveries.filter((id) => id === concurrent.id).length, 1);
  await assertProcessed(concurrent.id, 1);
  console.log('ok - concurrent immediate dispatch emits exactly once under PostgreSQL contention');

  const pollClaim = await createEvent(hospital.id, encounter.id, { createdAt: new Date(Date.now() - 20_000) });
  const processor = new EventsProcessor(prisma, second, logging);
  const claimed = await processor.claimEvents('polling-lease', new Date(Date.now() - 10_000), 10);
  assert.equal(claimed.length, 1);
  assert.equal(claimed[0].id, pollClaim.id);
  assert.equal(await first.dispatchEncounterEventAndMarkProcessed(pollClaim), true);
  assert.equal(deliveries.filter((id) => id === pollClaim.id).length, 0);
  assert.equal(await second.dispatchClaimedEncounterEvent(claimed[0], 'polling-lease'), true);
  assert.equal(deliveries.filter((id) => id === pollClaim.id).length, 1);
  await assertProcessed(pollClaim.id, 1);
  console.log('ok - polling lease prevents concurrent immediate duplicate dispatch');

  const stale = await createEvent(hospital.id, encounter.id, {
    claimedAt: new Date(Date.now() - 61_000),
    claimToken: 'abandoned-process',
    attemptCount: 1,
  });
  assert.equal(await first.dispatchEncounterEventAndMarkProcessed(stale), true);
  assert.equal(deliveries.filter((id) => id === stale.id).length, 1);
  await assertProcessed(stale.id, 2);
  console.log('ok - stale lease is reclaimed and completed');

  const previousAttempts = process.env.EVENT_DISPATCH_MAX_ATTEMPTS;
  process.env.EVENT_DISPATCH_MAX_ATTEMPTS = '2';
  const failed = await createEvent(hospital.id, encounter.id);
  failingEventIds.add(failed.id);
  assert.equal(await first.dispatchEncounterEventAndMarkProcessed(failed), false);
  assert.equal(await first.dispatchEncounterEventAndMarkProcessed(failed), false);
  failingEventIds.delete(failed.id);
  const failedRow = await prisma.encounterEvent.findUnique({ where: { id: failed.id } });
  assert.ok(failedRow.deadLetteredAt);
  assert.equal(failedRow.attemptCount, 2);
  assert.equal(await first.dispatchEncounterEventAndMarkProcessed(failedRow), true);
  assert.equal(deliveries.filter((id) => id === failed.id).length, 0);
  if (previousAttempts === undefined) delete process.env.EVENT_DISPATCH_MAX_ATTEMPTS;
  else process.env.EVENT_DISPATCH_MAX_ATTEMPTS = previousAttempts;
  console.log('ok - failed dispatch reaches a visible dead letter and is not sent again');

  const postSendCrash = await createEvent(hospital.id, encounter.id);
  await prisma.encounterEvent.update({
    where: { id: postSendCrash.id },
    data: { claimedAt: new Date(), claimToken: 'crashed-dispatcher', attemptCount: 1 },
  });
  await first.dispatchEncounterEvent(postSendCrash);
  // Model a process dying after the irreversible realtime send but before its
  // database acknowledgement. The next worker sees the abandoned lease.
  await prisma.encounterEvent.update({
    where: { id: postSendCrash.id },
    data: { claimedAt: new Date(Date.now() - 61_000) },
  });
  assert.equal(await second.dispatchEncounterEventAndMarkProcessed(postSendCrash), true);
  const duplicateDeliveries = deliveries.filter((id) => id === postSendCrash.id);
  assert.deepEqual(duplicateDeliveries, [postSendCrash.id, postSendCrash.id]);
  await assertProcessed(postSendCrash.id, 2);
  console.log('ok - post-send/pre-ack recovery is at-least-once with a stable eventId for client deduplication');
}

async function createEvent(hospitalId, encounterId, overrides = {}) {
  return prisma.encounterEvent.create({
    data: {
      hospitalId,
      encounterId,
      type: EventType.STATUS_CHANGE,
      metadata: { fixture: 'event-lease-postgres' },
      ...overrides,
    },
  });
}

async function assertProcessed(eventId, attemptCount) {
  const row = await prisma.encounterEvent.findUnique({ where: { id: eventId } });
  assert.ok(row.processedAt, `event ${eventId} should be processed`);
  assert.equal(row.claimedAt, null);
  assert.equal(row.claimToken, null);
  assert.equal(row.attemptCount, attemptCount);
}
