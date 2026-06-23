const assert = require('node:assert/strict');
const test = require('node:test');

const {
  isLegacyCompatibilityEnabled,
  legacyCompatibilityExpiry,
} = require('../../dist/common/config/legacy-compatibility.js');

const now = new Date('2026-06-23T12:00:00.000Z');

test('raw patient tokens require explicit, unexpired non-production migration mode', () => {
  const base = {
    NODE_ENV: 'development',
    PATIENT_LEGACY_TOKEN_MIGRATION_MODE: 'enabled',
    PATIENT_LEGACY_TOKEN_MIGRATION_UNTIL: '2026-07-23',
  };
  assert.equal(isLegacyCompatibilityEnabled('patient_raw_session_token', base, now), true);
  assert.equal(isLegacyCompatibilityEnabled('patient_raw_session_token', { ...base, NODE_ENV: 'production' }, now), false);
  assert.equal(isLegacyCompatibilityEnabled('patient_raw_session_token', { NODE_ENV: 'development' }, now), false);
  assert.equal(isLegacyCompatibilityEnabled('patient_raw_session_token', { ...base, PATIENT_LEGACY_TOKEN_MIGRATION_UNTIL: '2026-06-22' }, now), false);
});

test('legacy demo codes require an explicit future expiry and expose only that expiry', () => {
  const env = {
    NODE_ENV: 'production',
    DEMO_LEGACY_CODE_MIGRATION_MODE: 'enabled',
    DEMO_LEGACY_CODE_MIGRATION_UNTIL: '2026-07-23',
  };
  assert.equal(isLegacyCompatibilityEnabled('demo_static_access_code', env, now), true);
  assert.equal(legacyCompatibilityExpiry('demo_static_access_code', env), '2026-07-23T23:59:59.999Z');
  assert.equal(isLegacyCompatibilityEnabled('demo_static_access_code', { ...env, DEMO_LEGACY_CODE_MIGRATION_MODE: 'disabled' }, now), false);
});
