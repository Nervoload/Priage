const assert = require('node:assert/strict');
const test = require('node:test');
const { EventType } = require('@prisma/client');

// This test intentionally loads the compiled service. It proves the production
// implementation's lease protocol rather than a copied helper or source-text
// assertion. Run it through `npm run test:event-lease`, which builds first.
const { EventsService } = require('../../dist/modules/events/events.service.js');

function makeEvent(overrides = {}) {
  return {
    id: 41,
    type: EventType.STATUS_CHANGE,
    metadata: {},
    createdAt: new Date('2026-06-22T12:00:00.000Z'),
    actorUserId: 7,
    actorPatientId: null,
    processedAt: null,
    claimedAt: null,
    claimToken: null,
    attemptCount: 0,
    lastError: null,
    deadLetteredAt: null,
    encounterId: 13,
    hospitalId: 5,
    ...overrides,
  };
}

function makePrisma(event) {
  const state = { ...event };
  const isClaimable = () =>
    state.processedAt === null
    && state.deadLetteredAt === null
    && state.claimedAt === null;

  return {
    state,
    encounterEvent: {
      async updateMany({ where, data }) {
        if ('attemptCount' in data) {
          if (!isClaimable()) return { count: 0 };
          state.claimedAt = data.claimedAt;
          state.claimToken = data.claimToken;
          state.attemptCount += data.attemptCount.increment;
          return { count: 1 };
        }

        if ('processedAt' in data) {
          if (state.claimToken !== where.claimToken || state.processedAt !== null) return { count: 0 };
          state.processedAt = data.processedAt;
          state.claimedAt = data.claimedAt;
          state.claimToken = data.claimToken;
          state.lastError = data.lastError;
          return { count: 1 };
        }

        if ('lastError' in data) {
          if (state.claimToken !== where.claimToken || state.processedAt !== null) return { count: 0 };
          state.claimedAt = data.claimedAt;
          state.claimToken = data.claimToken;
          state.lastError = data.lastError;
          state.deadLetteredAt = data.deadLetteredAt;
          return { count: 1 };
        }

        throw new Error(`Unexpected update: ${JSON.stringify({ where, data })}`);
      },
      async findFirst({ where }) {
        if (where.id !== state.id || (where.claimToken && where.claimToken !== state.claimToken)) return null;
        return { ...state };
      },
      async findUnique({ where }) {
        return where.id === state.id ? { ...state } : null;
      },
    },
  };
}

function makeService({ emitEncounterUpdated } = {}) {
  const event = makeEvent();
  const prisma = makePrisma(event);
  let emissionCount = 0;
  const realtime = {
    async emitEncounterUpdated() {
      emissionCount += 1;
      if (emitEncounterUpdated) await emitEncounterUpdated();
    },
    async emitMessageCreated() {},
    async emitMessageRead() {},
    async emitAlertCreated() {},
    async emitAlertAcknowledged() {},
    async emitAlertResolved() {},
  };
  const logging = {
    debug() {}, info() {}, warn() {}, async error() {},
  };
  const patientRealtime = { async publish() {} };
  return {
    event,
    prisma,
    getEmissionCount: () => emissionCount,
    service: new EventsService(realtime, logging, prisma, patientRealtime),
  };
}

test('concurrent immediate dispatches lease one outbox event and emit it once', async () => {
  const fixture = makeService();

  const results = await Promise.all([
    fixture.service.dispatchEncounterEventAndMarkProcessed(fixture.event),
    fixture.service.dispatchEncounterEventAndMarkProcessed(fixture.event),
  ]);

  assert.deepEqual(results, [true, true]);
  assert.equal(fixture.getEmissionCount(), 1);
  assert.equal(fixture.prisma.state.attemptCount, 1);
  assert.ok(fixture.prisma.state.processedAt instanceof Date);
  assert.equal(fixture.prisma.state.claimedAt, null);
  assert.equal(fixture.prisma.state.claimToken, null);
});

test('a failed immediate dispatch releases its lease for polling recovery', async () => {
  const fixture = makeService({
    emitEncounterUpdated: async () => {
      throw new Error('simulated realtime outage');
    },
  });

  const result = await fixture.service.dispatchEncounterEventAndMarkProcessed(fixture.event);

  assert.equal(result, false);
  assert.equal(fixture.prisma.state.processedAt, null);
  assert.equal(fixture.prisma.state.claimedAt, null);
  assert.equal(fixture.prisma.state.claimToken, null);
  assert.match(fixture.prisma.state.lastError, /Realtime dispatch returned false/);
});
