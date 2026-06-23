const assert = require('node:assert/strict');
const test = require('node:test');

const { getEventDispatchConfig } = require('../../dist/modules/events/event-dispatch.config.js');

test('event dispatchers share bounded configuration defaults', () => {
  assert.deepEqual(getEventDispatchConfig({}), {
    claimTtlMs: 60_000,
    immediateDispatchGraceMs: 10_000,
    batchSize: 100,
    maxAttempts: 10,
  });
});

test('invalid event dispatch settings fail back to safety defaults', () => {
  const config = getEventDispatchConfig({
    EVENT_CLAIM_TTL_MS: '-1',
    EVENT_IMMEDIATE_DISPATCH_GRACE_MS: '0',
    EVENT_DISPATCH_BATCH_SIZE: 'not-a-number',
    EVENT_DISPATCH_MAX_ATTEMPTS: '3',
  });
  assert.equal(config.claimTtlMs, 60_000);
  assert.equal(config.immediateDispatchGraceMs, 10_000);
  assert.equal(config.batchSize, 100);
  assert.equal(config.maxAttempts, 3);
});
