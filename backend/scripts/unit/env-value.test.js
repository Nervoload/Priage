const assert = require('node:assert/strict');
const test = require('node:test');

const {
  parsePositiveInteger,
  readBooleanEnv,
  readPositiveIntegerEnv,
} = require('../../dist/common/config/env-value.util.js');

test('positive integer config parser preserves legacy integer fallback behavior', () => {
  const fallback = 42;
  for (const [value, expected] of [
    [undefined, fallback], ['', fallback], ['0', fallback], ['-5', fallback], ['nope', fallback], ['  ', fallback],
    ['12', 12], [' 12 ', 12], ['12.8', 12], ['12ms', 12],
  ]) {
    assert.equal(parsePositiveInteger(value, fallback), expected, String(value));
  }
  assert.equal(readPositiveIntegerEnv('LIMIT', fallback, { LIMIT: '9' }), 9);
});

test('boolean config parser preserves empty fallback and accepted true values', () => {
  assert.equal(readBooleanEnv('FLAG', true, {}), true);
  assert.equal(readBooleanEnv('FLAG', true, { FLAG: '  ' }), true);
  for (const value of ['1', 'true', 'yes', 'on', ' TRUE ']) {
    assert.equal(readBooleanEnv('FLAG', false, { FLAG: value }), true, value);
  }
  for (const value of ['0', 'false', 'no', 'off', 'unexpected']) {
    assert.equal(readBooleanEnv('FLAG', true, { FLAG: value }), false, value);
  }
});
