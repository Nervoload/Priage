const assert = require('node:assert/strict');
const test = require('node:test');

const { DemoSessionsService } = require('../../dist/modules/demo-sessions/demo-sessions.service.js');

function makeService() {
  return new DemoSessionsService({}, {}, {}, {}, { warn() { return Promise.resolve(); } });
}

test('a configured legacy demo code without its explicit migration mode still keeps the gate closed', () => {
  const previous = {
    code: process.env.DEMO_ACCESS_CODE,
    mode: process.env.DEMO_LEGACY_CODE_MIGRATION_MODE,
    until: process.env.DEMO_LEGACY_CODE_MIGRATION_UNTIL,
    required: process.env.DEMO_SESSIONS_REQUIRED,
  };
  process.env.DEMO_ACCESS_CODE = 'legacy-code';
  delete process.env.DEMO_LEGACY_CODE_MIGRATION_MODE;
  delete process.env.DEMO_LEGACY_CODE_MIGRATION_UNTIL;
  process.env.DEMO_SESSIONS_REQUIRED = 'false';
  const service = makeService();
  assert.equal(service.isDemoGateRequired(), true);
  assert.equal(service.isLegacyCodeCookieValid('priage_demo_access=legacy-code'), false);
  restore(previous);
});

function restore(previous) {
  for (const [name, value] of Object.entries({
    DEMO_ACCESS_CODE: previous.code,
    DEMO_LEGACY_CODE_MIGRATION_MODE: previous.mode,
    DEMO_LEGACY_CODE_MIGRATION_UNTIL: previous.until,
    DEMO_SESSIONS_REQUIRED: previous.required,
  })) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}
