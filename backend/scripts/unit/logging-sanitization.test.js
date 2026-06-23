const assert = require('node:assert/strict');
const test = require('node:test');

// Uses the compiled logging implementation. The allowlist must remain the last
// line of defence if a future call site accidentally includes patient text.
const { LoggingService } = require('../../dist/modules/logging/logging.service.js');

function makeLoggingService() {
  const moduleRef = { get: () => null };
  const correlationBuffer = { isEnabled: () => false };
  return new LoggingService(moduleRef, correlationBuffer);
}

test('operational logging drops patient identifiers and clinical free text', () => {
  const logging = makeLoggingService();
  const data = logging.sanitizePersistedData({
    hasDetails: true,
    messageCount: 3,
    status: 'WAITING',
    email: 'patient@example.test',
    patientName: 'Patient Example',
    chiefComplaint: 'Chest pain and shortness of breath',
    details: 'Free-text clinical history',
    message: 'Patient supplied content',
    allergies: 'Medication details',
  }, 'AuditTest', 'loggingSanitization');

  assert.deepEqual(data, {
    hasDetails: true,
    messageCount: 3,
    status: 'WAITING',
  });
});
