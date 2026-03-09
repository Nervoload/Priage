#!/usr/bin/env node
// backend/scripts/smoke-test-v2.js
// Comprehensive Priage Backend Smoke Test
// Tests full encounter lifecycle: intent → confirm → admission → triage → waiting → discharge
//
// Usage: node scripts/smoke-test-v2.js [options]
// For full documentation, see: docs/SMOKE_TEST_README.md
//
// Written by: John Surette
// Date Created: Jan 20 2026
// Last Modified: Feb 15 2026 (updated for guarded endpoints)

require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const { randomUUID } = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  databaseUrl: process.env.DATABASE_URL,
  testPassword: 'TestPassword123!',
  colors: {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
  },
};

// Parse command-line arguments
const args = process.argv.slice(2);
const options = {
  verbose: args.includes('--verbose') || args.includes('-v'),
  skipCleanup: args.includes('--skip-cleanup') || args.includes('-s'),
  testAuth: args.includes('--test-auth') || args.includes('-a'),
  testIntake: args.includes('--test-intake') || args.includes('-i'),
  testEncounters: args.includes('--test-encounters') || args.includes('-e'),
  testTriage: args.includes('--test-triage') || args.includes('-t'),
  testMessaging: args.includes('--test-messaging') || args.includes('-m'),
  testAlerts: args.includes('--test-alerts'),
  help: args.includes('--help') || args.includes('-h'),
};

// If no specific tests selected, run all
const runAll = !options.testAuth && !options.testIntake && !options.testEncounters && 
               !options.testTriage && !options.testMessaging && !options.testAlerts;

if (runAll) {
  options.testAuth = true;
  options.testIntake = true;
  options.testEncounters = true;
  options.testTriage = true;
  options.testMessaging = true;
  options.testAlerts = true;
}

// ============================================================================
// DATABASE SETUP
// ============================================================================

if (!CONFIG.databaseUrl) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

const pool = new Pool({ connectionString: CONFIG.databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({
  adapter,
  log: options.verbose ? ['query', 'error', 'warn'] : ['error', 'warn'],
});

// ============================================================================
// TEST STATE
// ============================================================================

const testState = {
  // Test entities
  hospital: null,
  staffUser: null,
  nurseUser: null,
  doctorUser: null,
  patient: null,         // Patient created via DB setup (fallback for encounters)
  intakePatient: null,   // Patient created through intake flow
  encounter: null,
  patientSession: null,
  triageAssessment: null,
  message: null,
  alert: null,
  internalMessage: null,
  patientWorseningMessage: null,
  cancelledEncounter: null,
  intruderEncounterId: null,
  
  // Auth tokens
  staffToken: null,
  nurseToken: null,
  doctorToken: null,
  patientToken: null,    // x-patient-token from intake intent
  
  // Tracking
  correlationId: null,
  testsPassed: 0,
  testsFailed: 0,
  testsSkipped: 0,
  startTime: Date.now(),
  errors: [],
  extraHospitalIds: [],
  extraPatientIds: [],
  extraUserIds: [],
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function log(message, color = CONFIG.colors.reset) {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
  console.log(`${color}[${timestamp}] ${message}${CONFIG.colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, CONFIG.colors.green);
  testState.testsPassed++;
}

function logError(message, error) {
  const errorMsg = error?.message || error || 'Unknown error';
  log(`❌ ${message}: ${errorMsg}`, CONFIG.colors.red);
  testState.testsFailed++;
  testState.errors.push({ message, error: errorMsg });
}

function logWarning(message) {
  log(`⚠️  ${message}`, CONFIG.colors.yellow);
}

function logInfo(message) {
  log(`ℹ️  ${message}`, CONFIG.colors.cyan);
}

function logVerbose(message) {
  if (options.verbose) {
    log(`  ${message}`, CONFIG.colors.dim);
  }
}

function logSection(message) {
  const separator = '═'.repeat(80);
  console.log('');
  log(separator, CONFIG.colors.bright);
  log(`  ${message}`, CONFIG.colors.bright);
  log(separator, CONFIG.colors.bright);
  console.log('');
}

function logSubSection(message) {
  console.log('');
  log(`─── ${message} ───`, CONFIG.colors.cyan);
}

function generateCorrelationId() {
  return `smoke-test-${randomUUID()}`;
}

/**
 * Make an HTTP request. Supports both staff (Bearer) and patient (x-patient-token) auth.
 */
async function makeRequest(method, path, opts = {}) {
  const url = `${CONFIG.baseUrl}${path}`;
  const correlationId = generateCorrelationId();
  testState.correlationId = correlationId;
  
  const headers = {
    'Content-Type': 'application/json',
    'X-Correlation-ID': correlationId,
    ...(opts.headers || {}),
  };
  
  logVerbose(`${method} ${path}`);
  
  const response = await fetch(url, {
    method,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  
  const responseText = await response.text();
  let data;
  try {
    data = responseText ? JSON.parse(responseText) : null;
  } catch {
    data = responseText;
  }
  
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${responseText}`);
  }
  
  logVerbose(`  → ${response.status} ${response.statusText}`);
  return data;
}

/** Helper: staff auth header */
function staffAuth(token) {
  return { Authorization: `Bearer ${token}` };
}

/** Helper: patient auth header */
function patientAuth(token) {
  return { 'x-patient-token': token };
}

function pushUnique(list, value) {
  if (value && !list.includes(value)) {
    list.push(value);
  }
}

function buildIntentPayload(overrides = {}) {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-10);
  return {
    firstName: 'Smoke',
    lastName: 'TestPatient',
    phone: `+1555${suffix.slice(-7)}`,
    age: 45,
    chiefComplaint: 'Chest pain and shortness of breath',
    details: 'Pain started 2 hours ago',
    preferredLanguage: 'en',
    ...overrides,
  };
}

function createExpiredJwt(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is not set');
  }

  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      hospitalId: user.hospitalId,
    },
    process.env.JWT_SECRET,
    { expiresIn: -10 },
  );
}

async function expectRequestFailure(requestFactory, expectedFragments, unexpectedSuccessMessage) {
  try {
    await requestFactory();
  } catch (error) {
    const message = String(error.message || error);
    if (expectedFragments.some((fragment) => message.includes(fragment))) {
      return message;
    }
    throw error;
  }

  throw new Error(unexpectedSuccessMessage);
}

async function createTrackedGuestEncounter(intentOverrides = {}) {
  const intent = await makeRequest('POST', '/intake/intent', {
    body: buildIntentPayload(intentOverrides),
  });
  const patient = await prisma.patientProfile.findUnique({
    where: { id: intent.patientId },
  });
  if (patient) {
    pushUnique(testState.extraPatientIds, patient.id);
  }

  const encounter = await makeRequest('POST', '/intake/confirm', {
    headers: patientAuth(intent.sessionToken),
    body: { hospitalId: testState.hospital.id },
  });

  return { intent, patient, encounter };
}

async function createExternalEncounter() {
  const hospital = await prisma.hospital.create({
    data: {
      name: 'External Smoke Hospital',
      slug: `test-hospital-external-${randomUUID().slice(0, 8)}`,
    },
  });
  pushUnique(testState.extraHospitalIds, hospital.id);

  const patient = await prisma.patientProfile.create({
    data: {
      email: `external-${randomUUID().slice(0, 8)}@test.com`,
      password: randomUUID(),
      firstName: 'Smoke',
      lastName: 'External',
      preferredLanguage: 'fr',
    },
  });
  pushUnique(testState.extraPatientIds, patient.id);

  const encounter = await prisma.encounter.create({
    data: {
      publicId: `enc_${randomUUID()}`,
      hospitalId: hospital.id,
      patientId: patient.id,
      chiefComplaint: 'External complaint',
    },
  });

  return { hospital, patient, encounter };
}

// ============================================================================
// HELP TEXT
// ============================================================================

function showHelp() {
  console.log(`
${CONFIG.colors.bright}Priage Backend Smoke Test v2${CONFIG.colors.reset}
${CONFIG.colors.dim}Comprehensive end-to-end testing of the Priage backend API${CONFIG.colors.reset}

${CONFIG.colors.cyan}USAGE:${CONFIG.colors.reset}
  node scripts/smoke-test-v2.js [options]

${CONFIG.colors.cyan}OPTIONS:${CONFIG.colors.reset}
  -h, --help              Show this help message
  -v, --verbose           Enable verbose logging
  -s, --skip-cleanup      Skip cleanup of test data after completion
  
  ${CONFIG.colors.yellow}Test Selection:${CONFIG.colors.reset}
  -a, --test-auth         Test authentication only
  -i, --test-intake       Test patient intake only
  -e, --test-encounters   Test encounter management only
  -t, --test-triage       Test triage assessments only
  -m, --test-messaging    Test messaging only
      --test-alerts       Test alerts only
  
  ${CONFIG.colors.dim}If no specific tests selected, all tests run${CONFIG.colors.reset}

${CONFIG.colors.cyan}ENVIRONMENT:${CONFIG.colors.reset}
  DATABASE_URL            PostgreSQL connection string (required)
  BASE_URL                API base URL (default: http://localhost:3000)
`);
  process.exit(0);
}

if (options.help) {
  showHelp();
}

// ============================================================================
// SAFETY FUNCTIONS
// ============================================================================

function isTestData(entity, type) {
  if (!entity) return false;
  switch (type) {
    case 'hospital':
      return entity.slug && entity.slug.startsWith('test-hospital-');
    case 'user':
      return entity.email && entity.email.includes('@test.com');
    case 'patient':
      return entity.firstName === 'Test' || entity.firstName === 'Smoke';
    default:
      return false;
  }
}

async function safetyCheckBeforeCleanup() {
  logInfo('Performing safety checks before cleanup...');
  
  const checks = [];
  
  if (testState.hospital) {
    checks.push({
      entity: 'hospital',
      safe: isTestData(testState.hospital, 'hospital'),
      details: `${testState.hospital.name} (${testState.hospital.slug})`,
    });
  }
  
  for (const [label, user] of [['staff', testState.staffUser], ['nurse', testState.nurseUser], ['doctor', testState.doctorUser]]) {
    if (user) {
      checks.push({
        entity: `${label} user`,
        safe: isTestData(user, 'user'),
        details: user.email,
      });
    }
  }
  
  const unsafeItems = checks.filter(c => !c.safe);
  if (unsafeItems.length > 0) {
    logError('SAFETY CHECK FAILED:');
    unsafeItems.forEach(item => logError(`  ${item.entity}: ${item.details}`));
    throw new Error('Refusing to cleanup — unsafe entities detected');
  }
  
  logSuccess(`Safety check passed — all ${checks.length} entities verified as test data`);
}

// ============================================================================
// SETUP & TEARDOWN
// ============================================================================

async function setupTestData() {
  logSection('SETUP: Creating Test Data');
  
  try {
    // Create test hospital
    logInfo('Creating test hospital...');
    const hospitalSlug = `test-hospital-${randomUUID().slice(0, 8)}`;
    testState.hospital = await prisma.hospital.create({
      data: { name: 'Smoke Test Hospital', slug: hospitalSlug },
    });
    logSuccess(`Hospital created: ${testState.hospital.name} (ID: ${testState.hospital.id})`);
    
    // Create test users
    logInfo('Creating test users (staff, nurse, doctor)...');
    const hashedPassword = await bcrypt.hash(CONFIG.testPassword, 10);
    const emailSuffix = randomUUID().slice(0, 8);
    
    testState.staffUser = await prisma.user.create({
      data: { email: `staff-${emailSuffix}@test.com`, password: hashedPassword, role: 'STAFF', hospitalId: testState.hospital.id },
    });
    testState.nurseUser = await prisma.user.create({
      data: { email: `nurse-${emailSuffix}@test.com`, password: hashedPassword, role: 'NURSE', hospitalId: testState.hospital.id },
    });
    testState.doctorUser = await prisma.user.create({
      data: { email: `doctor-${emailSuffix}@test.com`, password: hashedPassword, role: 'DOCTOR', hospitalId: testState.hospital.id },
    });
    
    logSuccess(`Staff: ${testState.staffUser.email}`);
    logSuccess(`Nurse: ${testState.nurseUser.email}`);
    logSuccess(`Doctor: ${testState.doctorUser.email}`);
    
    // Create test patient profile (fallback for staff-created encounters)
    logInfo('Creating test patient profile...');
    testState.patient = await prisma.patientProfile.create({
      data: { email: `patient-${emailSuffix}@test.com`, password: hashedPassword, firstName: 'Test', lastName: 'Patient', age: 35, gender: 'Other', preferredLanguage: 'en' },
    });
    logSuccess(`Patient: ${testState.patient.firstName} ${testState.patient.lastName} (ID: ${testState.patient.id})`);
    
  } catch (error) {
    logError('Failed to create test data', error);
    throw error;
  }
}

async function cleanupTestData() {
  if (options.skipCleanup) {
    logWarning('Skipping cleanup (--skip-cleanup flag set)');
    logInfo(`Hospital ID: ${testState.hospital?.id}`);
    logInfo(`Patient ID: ${testState.patient?.id}`);
    logInfo(`Encounter ID: ${testState.encounter?.id}`);
    return;
  }
  
  logSection('CLEANUP: Removing Test Data');
  
  try {
    await safetyCheckBeforeCleanup();

    const hospitalIds = [testState.hospital?.id, ...testState.extraHospitalIds].filter(Boolean);
    if (hospitalIds.length > 0) {
      logInfo(`Deleting encounters for ${hospitalIds.length} hospital(s)...`);
      await prisma.encounter.deleteMany({
        where: { hospitalId: { in: hospitalIds } },
      });
      logSuccess('Encounter records deleted');
    }

    const patientIds = [
      testState.patient?.id,
      testState.intakePatient?.id,
      ...testState.extraPatientIds,
    ].filter(Boolean);
    if (patientIds.length > 0) {
      await prisma.patientSession.deleteMany({
        where: { patientId: { in: patientIds } },
      });
      logSuccess('Patient sessions deleted');

      logInfo(`Deleting ${patientIds.length} patient profile(s)...`);
      await prisma.patientProfile.deleteMany({
        where: { id: { in: patientIds } },
      });
      logSuccess('Patient profiles deleted');
    }

    const userIds = [
      testState.staffUser?.id,
      testState.nurseUser?.id,
      testState.doctorUser?.id,
      ...testState.extraUserIds,
    ].filter(Boolean);
    if (userIds.length > 0) {
      logInfo(`Deleting ${userIds.length} test user(s)...`);
      await prisma.user.deleteMany({
        where: { id: { in: userIds } },
      });
      logSuccess('Test users deleted');
    }

    for (const hospitalId of testState.extraHospitalIds) {
      logInfo(`Deleting external test hospital ${hospitalId}...`);
      await prisma.hospital.delete({ where: { id: hospitalId } });
    }

    if (testState.hospital) {
      logInfo('Deleting test hospital...');
      await prisma.hospital.delete({ where: { id: testState.hospital.id } });
      logSuccess('Test hospital deleted');
    }
    
  } catch (error) {
    logError('Failed to cleanup test data', error);
  }
}

// ============================================================================
// TEST 1: AUTHENTICATION
// ============================================================================

async function testAuthentication() {
  logSection('TEST 1: Authentication');
  
  try {
    logSubSection('1A: Staff User Login');
    const staffLogin = await makeRequest('POST', '/auth/login', {
      body: { email: testState.staffUser.email, password: CONFIG.testPassword },
    });
    if (!staffLogin.access_token) throw new Error('No access token returned');
    testState.staffToken = staffLogin.access_token;
    logSuccess('Staff user authenticated');
    logVerbose(`  Token: ${staffLogin.access_token.substring(0, 30)}...`);
    
    // 1B: Nurse login
    logSubSection('1B: Nurse User Login');
    const nurseLogin = await makeRequest('POST', '/auth/login', {
      body: { email: testState.nurseUser.email, password: CONFIG.testPassword },
    });
    testState.nurseToken = nurseLogin.access_token;
    logSuccess('Nurse user authenticated');
    
    // 1C: Doctor login
    logSubSection('1C: Doctor User Login');
    const doctorLogin = await makeRequest('POST', '/auth/login', {
      body: { email: testState.doctorUser.email, password: CONFIG.testPassword },
    });
    testState.doctorToken = doctorLogin.access_token;
    logSuccess('Doctor user authenticated');
    
    // 1D: Protected route
    logSubSection('1D: Protected Route (GET /auth/me)');
    const meData = await makeRequest('GET', '/auth/me', {
      headers: staffAuth(testState.staffToken),
    });
    if (meData.userId !== testState.staffUser.id) {
      throw new Error(`Expected userId ${testState.staffUser.id}, got ${meData.userId}`);
    }
    logSuccess('Protected route access verified');
    
    logSubSection('1E: Invalid Credentials (Expected 401)');
    await expectRequestFailure(
      () => makeRequest('POST', '/auth/login', {
        body: { email: testState.staffUser.email, password: 'wrong-password' },
      }),
      ['401', 'Unauthorized'],
      'Invalid credentials unexpectedly succeeded',
    );
    logSuccess('Invalid credentials correctly rejected');
    
    logSubSection('1F: Unauthenticated Request (Expected 401)');
    await expectRequestFailure(
      () => makeRequest('GET', '/encounters'),
      ['401', 'Unauthorized'],
      'Unauthenticated request unexpectedly succeeded',
    );
    logSuccess('Unauthenticated request correctly rejected');

    logSubSection('1G: Expired JWT Request (Expected 401)');
    const expiredToken = createExpiredJwt(testState.staffUser);
    await expectRequestFailure(
      () => makeRequest('GET', '/encounters', {
        headers: staffAuth(expiredToken),
      }),
      ['401', 'Unauthorized', 'jwt expired'],
      'Expired JWT unexpectedly succeeded',
    );
    logSuccess('Expired JWT correctly rejected');
    
  } catch (error) {
    logError('Authentication test failed', error);
    throw error;
  }
}

// ============================================================================
// TEST 2: PATIENT INTAKE
// ============================================================================

async function testPatientIntake() {
  logSection('TEST 2: Patient Intake');
  
  try {
    logSubSection('2A: Missing Required Guest Fields (Expected 400)');
    const missingFieldMessage = await expectRequestFailure(
      () => makeRequest('POST', '/intake/intent', {
        body: { lastName: 'OnlyLastName' },
      }),
      ['400', 'firstName', 'phone', 'chiefComplaint'],
      'Intent creation unexpectedly succeeded without required fields',
    );
    for (const requiredField of ['400', 'firstName', 'phone', 'chiefComplaint']) {
      if (!missingFieldMessage.includes(requiredField)) {
        throw new Error(`Guest intake validation response missing ${requiredField}: ${missingFieldMessage}`);
      }
    }
    logSuccess('Guest intake requires firstName, phone, and chiefComplaint');

    logSubSection('2B: Create Patient Intent (POST /intake/intent)');
    const intent = await makeRequest('POST', '/intake/intent', {
      body: buildIntentPayload(),
    });
    
    if (!intent.sessionToken) throw new Error('No sessionToken returned');
    if (!intent.patientId) throw new Error('No patientId returned');
    
    testState.patientToken = intent.sessionToken;
    testState.intakePatient = await prisma.patientProfile.findUnique({
      where: { id: intent.patientId },
    });
    
    logSuccess(`Intent created — patientId: ${intent.patientId}, encounterId: ${intent.encounterId ?? 'null (expected)'}`);
    logVerbose(`  Token: ${intent.sessionToken.substring(0, 30)}...`);
    
    logSubSection('2C: Verify Patient Session Token');
    testState.patientSession = await prisma.patientSession.findFirst({
      where: { token: testState.patientToken },
    });
    if (!testState.patientSession) throw new Error('No patient session found');
    logSuccess('Patient session token verified in database');
    logVerbose(`  Session ID: ${testState.patientSession.id}`);
    
    logSubSection('2D: Invalid Patient Token (Expected 401)');
    await expectRequestFailure(
      () => makeRequest('POST', '/intake/confirm', {
        headers: patientAuth('invalid-patient-token'),
        body: { hospitalId: testState.hospital.id },
      }),
      ['401', 'Invalid patient session token', 'Unauthorized'],
      'Invalid patient token unexpectedly succeeded',
    );
    logSuccess('Invalid patient token correctly rejected');

    logSubSection('2E: Invalid Hospital Slug (Expected 404)');
    await expectRequestFailure(
      () => makeRequest('POST', '/intake/confirm', {
        headers: patientAuth(testState.patientToken),
        body: { hospitalSlug: 'does-not-exist' },
      }),
      ['404', 'Hospital not found'],
      'Intent confirmation unexpectedly succeeded with invalid hospital slug',
    );
    logSuccess('Invalid hospital slug correctly rejected');

    logSubSection('2F: Expired Patient Token (Expected 401)');
    const expiredIntent = await makeRequest('POST', '/intake/intent', {
      body: buildIntentPayload({
        firstName: 'Expired',
        lastName: 'Guest',
        chiefComplaint: 'Dizziness',
      }),
    });
    pushUnique(testState.extraPatientIds, expiredIntent.patientId);
    await prisma.patientSession.update({
      where: { token: expiredIntent.sessionToken },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    await expectRequestFailure(
      () => makeRequest('POST', '/intake/confirm', {
        headers: patientAuth(expiredIntent.sessionToken),
        body: { hospitalId: testState.hospital.id },
      }),
      ['401', 'expired', 'Unauthorized'],
      'Expired patient token unexpectedly succeeded',
    );
    logSuccess('Expired patient token correctly rejected');

    logSubSection('2G: Confirm Intent (POST /intake/confirm)');
    const confirmedEncounter = await makeRequest('POST', '/intake/confirm', {
      headers: patientAuth(testState.patientToken),
      body: { hospitalId: testState.hospital.id },
    });
    
    if (!confirmedEncounter.id) throw new Error('Confirm did not return encounter');
    if (confirmedEncounter.hospitalId !== testState.hospital.id) {
      throw new Error(`Hospital not assigned: expected ${testState.hospital.id}, got ${confirmedEncounter.hospitalId}`);
    }
    
    testState.encounter = confirmedEncounter;
    logSuccess(`Intent confirmed — Encounter ID: ${confirmedEncounter.id}, status: ${confirmedEncounter.status}`);
    
    logSubSection('2H: Update Intake Details (PATCH /intake/details)');
    await makeRequest('PATCH', '/intake/details', {
      headers: patientAuth(testState.patientToken),
      body: {
        details: 'Pain started 2 hours ago, radiating to left arm. No previous heart issues.',
        allergies: 'Penicillin',
      },
    });
    logSuccess('Intake details updated');
    
    logSubSection('2I: Record Patient Location (POST /intake/location)');
    await makeRequest('POST', '/intake/location', {
      headers: patientAuth(testState.patientToken),
      body: { latitude: 43.6532, longitude: -79.3832 },
    });
    logSuccess('Patient location recorded');

    logSubSection('2J: Patient Lists Own Encounters');
    const patientEncounters = await makeRequest('GET', '/patient/encounters', {
      headers: patientAuth(testState.patientToken),
    });
    if (!Array.isArray(patientEncounters) || !patientEncounters.some((encounter) => encounter.id === testState.encounter.id)) {
      throw new Error('Patient encounter list does not include the confirmed encounter');
    }
    logSuccess('Patient encounter list includes the active encounter');

    logSubSection('2K: Patient Reads Encounter Detail');
    const patientEncounterDetail = await makeRequest('GET', `/patient/encounters/${testState.encounter.id}`, {
      headers: patientAuth(testState.patientToken),
    });
    if (patientEncounterDetail.id !== testState.encounter.id) {
      throw new Error('Patient encounter detail returned the wrong encounter');
    }
    if (patientEncounterDetail.details !== 'Pain started 2 hours ago, radiating to left arm. No previous heart issues.') {
      throw new Error('Patient encounter detail did not reflect updated details');
    }
    logSuccess('Patient encounter detail matches the confirmed visit');

    logSubSection('2L: Patient Queue Before Waiting');
    const initialQueue = await makeRequest('GET', `/patient/encounters/${testState.encounter.id}/queue`, {
      headers: patientAuth(testState.patientToken),
    });
    if (initialQueue.position !== 0 || initialQueue.estimatedMinutes !== 0 || initialQueue.totalInQueue !== 0) {
      throw new Error(`Expected empty queue before WAITING, got ${JSON.stringify(initialQueue)}`);
    }
    logSuccess('Patient queue is empty before WAITING');

    logSubSection('2M: Patient Cancel Flow on Fresh Encounter');
    const cancelFlow = await createTrackedGuestEncounter({
      firstName: 'Cancel',
      lastName: 'Flow',
      chiefComplaint: 'Migraine',
      details: 'Temporary encounter to verify cancel flow.',
    });
    const cancelledEncounter = await makeRequest('POST', `/patient/encounters/${cancelFlow.encounter.id}/cancel`, {
      headers: patientAuth(cancelFlow.intent.sessionToken),
    });
    if (cancelledEncounter.status !== 'CANCELLED' || !cancelledEncounter.cancelledAt) {
      throw new Error('Patient cancel flow did not persist CANCELLED state');
    }
    testState.cancelledEncounter = cancelledEncounter;
    logSuccess('Patient cancel flow works on a fresh encounter');

    logSubSection('2N: Patient Ownership Enforcement');
    const intruderFlow = await createTrackedGuestEncounter({
      firstName: 'Other',
      lastName: 'Guest',
      chiefComplaint: 'Sprained ankle',
      details: 'Separate patient to verify ownership rules.',
    });
    testState.intruderEncounterId = intruderFlow.encounter.id;

    await expectRequestFailure(
      () => makeRequest('GET', `/patient/encounters/${intruderFlow.encounter.id}`, {
        headers: patientAuth(testState.patientToken),
      }),
      ['403', 'own encounters'],
      'Primary patient unexpectedly read another patient encounter',
    );
    logSuccess('Patient cannot read another patient encounter');

    await expectRequestFailure(
      () => makeRequest('POST', `/patient/encounters/${intruderFlow.encounter.id}/cancel`, {
        headers: patientAuth(testState.patientToken),
      }),
      ['403', 'own encounter'],
      'Primary patient unexpectedly cancelled another patient encounter',
    );
    logSuccess('Patient cannot cancel another patient encounter');
    
  } catch (error) {
    logError('Patient intake test failed', error);
    throw error;
  }
}

// ============================================================================
// TEST 3: ENCOUNTER MANAGEMENT
// ============================================================================

async function testEncounterManagement() {
  logSection('TEST 3: Encounter Management');
  
  try {
    if (!testState.encounter) {
      logSubSection('3-SETUP: Create Encounter (staff)');
      testState.encounter = await makeRequest('POST', '/encounters', {
        headers: staffAuth(testState.staffToken),
        body: { patientId: testState.patient.id, chiefComplaint: 'Smoke test encounter' },
      });
      logSuccess(`Encounter created: ID ${testState.encounter.id}`);
    }
    
    logSubSection('3A: List Encounters (GET /encounters)');
    const encounters = await makeRequest('GET', '/encounters', {
      headers: staffAuth(testState.staffToken),
    });
    
    if (!encounters.data || !Array.isArray(encounters.data)) {
      throw new Error('Expected { data: [...] } response');
    }
    if (!encounters.data.some((encounter) => encounter.id === testState.encounter.id)) {
      throw new Error('Encounter list does not include the active encounter');
    }
    logSuccess(`Listed ${encounters.data.length} encounter(s), total: ${encounters.total}`);

    logSubSection('3A.1: List Patients (GET /patients)');
    const patients = await makeRequest('GET', '/patients', {
      headers: staffAuth(testState.staffToken),
    });
    if (!patients.data || !Array.isArray(patients.data) || !patients.meta) {
      throw new Error('Expected paginated patient response');
    }
    const expectedListedPatientId = testState.intakePatient?.id ?? testState.patient?.id;
    const listedPatient = patients.data.find((patient) => patient.id === expectedListedPatientId);
    if (!listedPatient) {
      throw new Error(`Expected patient ${expectedListedPatientId} in /patients response`);
    }
    if (listedPatient.preferredLanguage !== 'en') {
      throw new Error(`Expected preferredLanguage=en, got ${listedPatient.preferredLanguage}`);
    }
    logSuccess(`Listed ${patients.data.length} patient(s), total: ${patients.meta.total}`);

    logSubSection('3A.2: Filter Patients by Encounter Status');
    const filteredPatients = await makeRequest('GET', '/patients?status=EXPECTED', {
      headers: staffAuth(testState.staffToken),
    });
    if (!filteredPatients.data.some((patient) => patient.id === testState.patient.id || patient.id === testState.intakePatient?.id)) {
      throw new Error('Expected at least one EXPECTED patient in filtered results');
    }
    logSuccess(`Filtered patients by status, ${filteredPatients.data.length} result(s)`);

    logSubSection('3A.3: Wrong-Hospital Scoping');
    const external = await createExternalEncounter();
    const scopedPatients = await makeRequest('GET', '/patients', {
      headers: staffAuth(testState.staffToken),
    });
    if (scopedPatients.data.some((patient) => patient.id === external.patient.id)) {
      throw new Error('Found patient from another hospital in results');
    }
    await expectRequestFailure(
      () => makeRequest('GET', `/encounters/${external.encounter.id}`, {
        headers: staffAuth(testState.staffToken),
      }),
      ['404', 'not found'],
      'Staff unexpectedly fetched an encounter from another hospital',
    );
    logSuccess('Staff encounter reads are hospital scoped');

    logSubSection('3A.4: Reject Invalid Patient Query');
    await expectRequestFailure(
      () => makeRequest('GET', '/patients?limit=0', {
        headers: staffAuth(testState.staffToken),
      }),
      ['400'],
      'Invalid patient query unexpectedly succeeded',
    );
    logSuccess('Invalid patient query rejected with 400');
    
    logSubSection('3B: Get Encounter Details (GET /encounters/:id)');
    const encounter = await makeRequest('GET', `/encounters/${testState.encounter.id}`, {
      headers: staffAuth(testState.staffToken),
    });
    if (encounter.id !== testState.encounter.id) throw new Error('Wrong encounter returned');
    logSuccess('Encounter details retrieved');
    logVerbose(`  Status: ${encounter.status}`);
    logVerbose(`  Patient: ${encounter.patient?.firstName} ${encounter.patient?.lastName}`);
    
    logSubSection('3C: Role Guard on Waiting Transition (Expected 403)');
    await expectRequestFailure(
      () => makeRequest('POST', `/encounters/${testState.encounter.id}/waiting`, {
        headers: staffAuth(testState.staffToken),
      }),
      ['403', 'Forbidden'],
      'Staff role unexpectedly transitioned encounter to WAITING',
    );
    logSuccess('Role guard blocks staff-only WAITING transition');

    logSubSection('3C: Mark Patient Arrived (POST /encounters/:id/arrived)');
    const arrivedEncounter = await makeRequest('POST', `/encounters/${testState.encounter.id}/arrived`, {
      headers: staffAuth(testState.staffToken),
    });
    if (arrivedEncounter.status !== 'ADMITTED') {
      throw new Error(`Expected ADMITTED, got ${arrivedEncounter.status}`);
    }
    if (!arrivedEncounter.arrivedAt) throw new Error('arrivedAt not set');
    testState.encounter = arrivedEncounter;
    logSuccess('Patient marked as arrived → ADMITTED');
    logVerbose(`  Arrived at: ${arrivedEncounter.arrivedAt}`);
    
    logSubSection('3D: Verify Encounter Events');
    const events = await prisma.encounterEvent.findMany({
      where: { encounterId: testState.encounter.id },
      orderBy: { createdAt: 'desc' },
    });
    const eventTypes = new Set(events.map((event) => event.type));
    if (!eventTypes.has('ENCOUNTER_CREATED') || !eventTypes.has('STATUS_CHANGE')) {
      throw new Error(`Expected ENCOUNTER_CREATED and STATUS_CHANGE events, got ${Array.from(eventTypes).join(', ')}`);
    }
    logSuccess(`${events.length} encounter event(s) recorded with expected transition types`);
    
  } catch (error) {
    logError('Encounter management test failed', error);
    throw error;
  }
}

// ============================================================================
// TEST 4: TRIAGE ASSESSMENT
// ============================================================================

async function testTriageAssessment() {
  logSection('TEST 4: Triage Assessment');
  
  try {
    logSubSection('4A: Invalid Status Rejection');
    const expectedOnlyEncounter = await makeRequest('POST', '/encounters', {
      headers: staffAuth(testState.staffToken),
      body: { patientId: testState.patient.id, chiefComplaint: 'Expected status only' },
    });
    await expectRequestFailure(
      () => makeRequest('POST', '/triage/assessments', {
        headers: staffAuth(testState.nurseToken),
        body: {
          encounterId: expectedOnlyEncounter.id,
          ctasLevel: 3,
          painLevel: 2,
        },
      }),
      ['400', 'cannot be triaged while in status EXPECTED'],
      'Triage assessment unexpectedly succeeded for EXPECTED encounter',
    );
    logSuccess('Triage assessment rejects invalid encounter status');

    logSubSection('4A: Start Triage Exam (POST /encounters/:id/start-exam)');
    const triageStarted = await makeRequest('POST', `/encounters/${testState.encounter.id}/start-exam`, {
      headers: staffAuth(testState.nurseToken),
    });
    if (triageStarted.status !== 'TRIAGE') {
      throw new Error(`Expected TRIAGE, got ${triageStarted.status}`);
    }
    testState.encounter = triageStarted;
    logSuccess('Triage exam started → TRIAGE');
    logVerbose(`  Triaged at: ${triageStarted.triagedAt}`);
    
    logSubSection('4B: Triage Role Guard (Expected 403)');
    await expectRequestFailure(
      () => makeRequest('POST', '/triage/assessments', {
        headers: staffAuth(testState.staffToken),
        body: {
          encounterId: testState.encounter.id,
          ctasLevel: 2,
          painLevel: 7,
        },
      }),
      ['403', 'Forbidden'],
      'Staff role unexpectedly created a triage assessment',
    );
    logSuccess('Role guard blocks staff triage creation');

    logSubSection('4B: Create Triage Assessment (POST /triage/assessments)');
    const assessment = await makeRequest('POST', '/triage/assessments', {
      headers: staffAuth(testState.nurseToken),
      body: {
        encounterId: testState.encounter.id,
        ctasLevel: 2,
        painLevel: 7,
        chiefComplaint: 'Crushing chest pain',
        vitalSigns: {
          bloodPressure: '145/92',
          heartRate: 98,
          temperature: 37.1,
          respiratoryRate: 24,
          oxygenSaturation: 96,
        },
        note: 'Chest pain, radiating to left arm. EKG ordered.',
      },
    });
    if (!assessment.id) throw new Error('Assessment not created');
    if (assessment.painLevel !== 7 || assessment.chiefComplaint !== 'Crushing chest pain') {
      throw new Error('Assessment payload fields were not persisted');
    }
    if (!assessment.vitalSigns || assessment.vitalSigns.heartRate !== 98 || assessment.vitalSigns.bloodPressure !== '145/92') {
      throw new Error('Assessment vital signs were not persisted');
    }
    testState.triageAssessment = assessment;
    logSuccess('Triage assessment created');
    logVerbose(`  CTAS Level: ${assessment.ctasLevel}, Priority Score: ${assessment.priorityScore}`);
    
    logSubSection('4C: List Assessments (GET /triage/encounters/:id/assessments)');
    const assessments = await makeRequest('GET', `/triage/encounters/${testState.encounter.id}/assessments`, {
      headers: staffAuth(testState.nurseToken),
    });
    const listedAssessment = Array.isArray(assessments)
      ? assessments.find((entry) => entry.id === assessment.id)
      : null;
    if (!listedAssessment) {
      throw new Error('Assessments not listed correctly');
    }
    if (listedAssessment.painLevel !== 7 || listedAssessment.vitalSigns?.oxygenSaturation !== 96) {
      throw new Error('Assessment list did not return the full triage payload');
    }
    logSuccess(`Listed ${assessments.length} assessment(s)`);
    
    logSubSection('4D: Verify Encounter Triage Data');
    const updated = await prisma.encounter.findUnique({ where: { id: testState.encounter.id } });
    if (updated.currentCtasLevel !== 2 || updated.currentPriorityScore !== assessment.priorityScore) {
      throw new Error(`Encounter triage state mismatch: ${JSON.stringify(updated)}`);
    }
    logSuccess('Encounter updated with triage level and priority score');
    
  } catch (error) {
    logError('Triage assessment test failed', error);
    throw error;
  }
}

// ============================================================================
// TEST 5: MESSAGING
// ============================================================================

async function testMessaging() {
  logSection('TEST 5: Messaging');
  
  try {
    logSubSection('5A: Messaging Role Guard (Expected 403)');
    await expectRequestFailure(
      () => makeRequest('POST', `/messaging/encounters/${testState.encounter.id}/messages`, {
        headers: staffAuth(testState.staffToken),
        body: {
          content: 'Staff role should not be able to send this.',
        },
      }),
      ['403', 'Forbidden'],
      'Staff role unexpectedly sent a staff message',
    );
    logSuccess('Role guard blocks staff messaging create');

    logSubSection('5B: Nurse Sends Public Message');
    const message = await makeRequest('POST', `/messaging/encounters/${testState.encounter.id}/messages`, {
      headers: staffAuth(testState.nurseToken),
      body: {
        content: 'Your EKG results look stable. The doctor will see you shortly.',
      },
    });
    if (!message.id) throw new Error('Message not created');
    testState.message = message;
    logSuccess('Message sent');
    logVerbose(`  ID: ${message.id}, Content: ${message.content}`);

    logSubSection('5C: Nurse Sends Internal Message');
    const internalMessage = await makeRequest('POST', `/messaging/encounters/${testState.encounter.id}/messages`, {
      headers: staffAuth(testState.nurseToken),
      body: {
        content: 'Internal note: patient calm, bed 4 ready.',
        isInternal: true,
      },
    });
    if (!internalMessage.id || internalMessage.isInternal !== true) {
      throw new Error('Internal message not created correctly');
    }
    testState.internalMessage = internalMessage;
    logSuccess('Internal staff message sent');
    
    logSubSection('5D: List Encounter Messages');
    const messages = await makeRequest('GET', `/messaging/encounters/${testState.encounter.id}/messages`, {
      headers: staffAuth(testState.staffToken),
    });
    if (!messages.data || !Array.isArray(messages.data)) {
      throw new Error('Expected paginated { data: [...] }');
    }
    if (!messages.data.some((entry) => entry.id === message.id) || !messages.data.some((entry) => entry.id === internalMessage.id)) {
      throw new Error('Staff message history is missing public or internal messages');
    }
    logSuccess(`Listed ${messages.data.length} message(s)`);
    
    logSubSection('5E: Initial Read State');
    const initialReadState = await makeRequest('GET', `/messaging/encounters/${testState.encounter.id}/read-state`, {
      headers: staffAuth(testState.staffToken),
    });
    if (initialReadState.lastReadMessageId !== null) {
      throw new Error(`Expected null lastReadMessageId before reading, got ${initialReadState.lastReadMessageId}`);
    }
    logSuccess('Initial read-state is empty');

    logSubSection('5F: Mark Message as Read');
    const readResult = await makeRequest('POST', `/messaging/messages/${message.id}/read`, {
      headers: staffAuth(testState.staffToken),
    });
    if (readResult.ok !== true || readResult.lastReadMessageId !== message.id) {
      throw new Error('Read acknowledgement did not persist the expected cursor');
    }
    logSuccess('Message marked as read');

    logSubSection('5G: Read State After Read');
    const readState = await makeRequest('GET', `/messaging/encounters/${testState.encounter.id}/read-state`, {
      headers: staffAuth(testState.staffToken),
    });
    if (readState.lastReadMessageId !== message.id || !readState.lastReadAt) {
      throw new Error('Encounter read-state did not update after reading the message');
    }
    logSuccess('Encounter read-state updated');
    
    if (testState.patientToken && testState.encounter) {
      logSubSection('5H: Patient Sends Worsening Message');
      const patientMsg = await makeRequest('POST', `/patient/encounters/${testState.encounter.id}/messages`, {
        headers: patientAuth(testState.patientToken),
        body: { content: 'The pain is getting worse, please hurry.', isWorsening: true },
      });
      if (!patientMsg.id) throw new Error('Patient message not created');
      testState.patientWorseningMessage = patientMsg;
      logSuccess('Patient message sent (with worsening flag)');
      
      logSubSection('5I: Patient Lists Messages');
      const patientMessages = await makeRequest('GET', `/patient/encounters/${testState.encounter.id}/messages`, {
        headers: patientAuth(testState.patientToken),
      });
      if (!Array.isArray(patientMessages)) {
        throw new Error('Expected array of messages');
      }
      if (!patientMessages.some((entry) => entry.id === message.id) || !patientMessages.some((entry) => entry.id === patientMsg.id)) {
        throw new Error('Patient-visible messages are missing public or patient-authored content');
      }
      if (patientMessages.some((entry) => entry.id === internalMessage.id || entry.isInternal)) {
        throw new Error('Patient-visible messages leaked internal staff content');
      }
      logSuccess(`Patient sees ${patientMessages.length} message(s)`);

      if (testState.intruderEncounterId) {
        logSubSection('5J: Patient Ownership Guard on Messaging');
        await expectRequestFailure(
          () => makeRequest('GET', `/patient/encounters/${testState.intruderEncounterId}/messages`, {
            headers: patientAuth(testState.patientToken),
          }),
          ['403', 'own encounters'],
          'Patient unexpectedly read another patient message thread',
        );
        logSuccess('Patient cannot read another patient message thread');
      }
    } else {
      logWarning('Skipping patient messaging — no patient token');
      testState.testsSkipped++;
    }
    
  } catch (error) {
    logError('Messaging test failed', error);
    throw error;
  }
}

// ============================================================================
// TEST 6: ALERTS
// ============================================================================

async function testAlerts() {
  logSection('TEST 6: Alerts');
  
  try {
    logSubSection('6A: Create Alert');
    const alert = await makeRequest('POST', '/alerts', {
      headers: staffAuth(testState.nurseToken),
      body: {
        encounterId: testState.encounter.id,
        type: 'WAIT_TIME_EXCEEDED',
        severity: 'MEDIUM',
        metadata: { waitTimeMinutes: 45, threshold: 30 },
      },
    });
    if (!alert.id) throw new Error('Alert not created');
    testState.alert = alert;
    logSuccess('Alert created');
    logVerbose(`  ID: ${alert.id}, Type: ${alert.type}, Severity: ${alert.severity}`);
    
    logSubSection('6B: List Unacknowledged Alerts');
    const unacked = await makeRequest('GET', `/alerts/hospitals/${testState.hospital.id}/unacknowledged`, {
      headers: staffAuth(testState.staffToken),
    });
    if (!Array.isArray(unacked)) throw new Error('Alerts not listed correctly');
    if (!unacked.some((entry) => entry.id === alert.id)) {
      throw new Error('Created alert missing from unacknowledged list');
    }
    if (!unacked.some((entry) => entry.type === 'PATIENT_WORSENING')) {
      throw new Error('Patient worsening alert missing from unacknowledged list');
    }
    logSuccess(`Listed ${unacked.length} unacknowledged alert(s)`);
    
    logSubSection('6C: Acknowledge Alert');
    const acknowledged = await makeRequest('POST', `/alerts/${alert.id}/acknowledge`, {
      headers: staffAuth(testState.staffToken),
    });
    if (!acknowledged.acknowledgedAt) {
      throw new Error('Acknowledged alert did not persist acknowledgedAt');
    }
    logSuccess('Alert acknowledged');
    
    logSubSection('6D: Resolve Alert');
    const resolved = await makeRequest('POST', `/alerts/${alert.id}/resolve`, {
      headers: staffAuth(testState.nurseToken),
    });
    if (!resolved.resolvedAt) {
      throw new Error('Resolved alert did not persist resolvedAt');
    }
    logSuccess('Alert resolved');
    
    logSubSection('6E: List Encounter Alerts');
    const encounterAlerts = await makeRequest('GET', `/alerts/encounters/${testState.encounter.id}`, {
      headers: staffAuth(testState.staffToken),
    });
    if (!Array.isArray(encounterAlerts)) throw new Error('Not listed correctly');
    const resolvedAlert = encounterAlerts.find((entry) => entry.id === alert.id);
    const worseningAlert = encounterAlerts.find((entry) => entry.type === 'PATIENT_WORSENING');
    if (!resolvedAlert?.acknowledgedAt || !resolvedAlert?.resolvedAt) {
      throw new Error('Encounter alerts did not return the resolved alert state');
    }
    if (!worseningAlert || worseningAlert.severity !== 'HIGH') {
      throw new Error('Encounter alerts did not include the expected patient worsening alert');
    }
    logSuccess(`Listed ${encounterAlerts.length} alert(s) for encounter`);
    
  } catch (error) {
    logError('Alerts test failed', error);
    throw error;
  }
}

// ============================================================================
// TEST 7: ENCOUNTER COMPLETION
// ============================================================================

async function testEncounterCompletion() {
  logSection('TEST 7: Encounter Completion');
  
  try {
    logSubSection('7A: Move to Waiting Room');
    const waitingEncounter = await makeRequest('POST', `/encounters/${testState.encounter.id}/waiting`, {
      headers: staffAuth(testState.nurseToken),
    });
    if (waitingEncounter.status !== 'WAITING') {
      throw new Error(`Expected WAITING, got ${waitingEncounter.status}`);
    }
    testState.encounter = waitingEncounter;
    logSuccess('Patient moved to waiting room → WAITING');
    logVerbose(`  Waiting since: ${waitingEncounter.waitingAt}`);
    
    logSubSection('7B: Verify Patient Queue While Waiting');
    const queue = await makeRequest('GET', `/patient/encounters/${testState.encounter.id}/queue`, {
      headers: patientAuth(testState.patientToken),
    });
    if (queue.position !== 1 || queue.estimatedMinutes !== 15 || queue.totalInQueue < 1) {
      throw new Error(`Unexpected waiting queue state: ${JSON.stringify(queue)}`);
    }
    logSuccess('Patient queue reflects WAITING semantics');

    logSubSection('7C: Discharge Patient');
    const discharged = await makeRequest('POST', `/encounters/${testState.encounter.id}/discharge`, {
      headers: staffAuth(testState.doctorToken),
    });
    if (discharged.status !== 'COMPLETE') {
      throw new Error(`Expected COMPLETE, got ${discharged.status}`);
    }
    if (!discharged.departedAt) throw new Error('departedAt not set');
    testState.encounter = discharged;
    logSuccess('Patient discharged → COMPLETE');
    logVerbose(`  Departed at: ${discharged.departedAt}`);
    
    const durationSec = Math.round((new Date(discharged.departedAt) - new Date(discharged.createdAt)) / 1000);
    logInfo(`Encounter duration: ${durationSec}s`);
    
    logSubSection('7D: Verify Final State');
    const final = await prisma.encounter.findUnique({
      where: { id: testState.encounter.id },
      include: { triageAssessments: true, messages: true, alerts: true, events: true },
    });
    if (!final || final.status !== 'COMPLETE' || !final.departedAt || !final.waitingAt || !final.triagedAt || !final.arrivedAt) {
      throw new Error('Final encounter state is missing expected COMPLETE timestamps');
    }
    if (!final.triageAssessments.some((entry) => entry.id === testState.triageAssessment.id)) {
      throw new Error('Final encounter state is missing the created triage assessment');
    }
    if (!final.messages.some((entry) => entry.id === testState.message.id)
      || !final.messages.some((entry) => entry.id === testState.internalMessage.id)
      || !final.messages.some((entry) => entry.id === testState.patientWorseningMessage.id)) {
      throw new Error('Final encounter state is missing expected messages');
    }
    if (!final.alerts.some((entry) => entry.id === testState.alert.id)
      || !final.alerts.some((entry) => entry.type === 'PATIENT_WORSENING')) {
      throw new Error('Final encounter state is missing expected alerts');
    }
    const finalEventTypes = new Set(final.events.map((event) => event.type));
    for (const eventType of ['STATUS_CHANGE', 'TRIAGE_CREATED', 'MESSAGE_CREATED', 'MESSAGE_READ', 'ALERT_CREATED']) {
      if (!finalEventTypes.has(eventType)) {
        throw new Error(`Final encounter state is missing event type ${eventType}`);
      }
    }
    logSuccess('Final encounter state verified');
    logVerbose(`  Status: ${final.status}`);
    logVerbose(`  Assessments: ${final.triageAssessments.length}, Messages: ${final.messages.length}`);
    logVerbose(`  Alerts: ${final.alerts.length}, Events: ${final.events.length}`);
    
    logSubSection('7E: Terminal Status Protection');
    await expectRequestFailure(
      () => makeRequest('POST', `/encounters/${testState.encounter.id}/cancel`, {
        headers: staffAuth(testState.nurseToken),
      }),
      ['400', '409', 'terminal', 'Conflict'],
      'Terminal encounter unexpectedly accepted a new transition',
    );
    logSuccess('Terminal status protected — cannot transition from COMPLETE');

    logSubSection('7F: Patient Session Hidden After Terminal Status');
    await expectRequestFailure(
      () => makeRequest('GET', `/patient/encounters/${testState.encounter.id}`, {
        headers: patientAuth(testState.patientToken),
      }),
      ['401', 'no longer active', 'Unauthorized'],
      'Completed encounter unexpectedly remained patient-visible',
    );
    logSuccess('Completed encounter is hidden behind an inactive patient session');
    
  } catch (error) {
    logError('Encounter completion test failed', error);
    throw error;
  }
}

// ============================================================================
// SUMMARY
// ============================================================================

function printSummary() {
  const duration = ((Date.now() - testState.startTime) / 1000).toFixed(2);
  const total = testState.testsPassed + testState.testsFailed;
  const passRate = total > 0 ? ((testState.testsPassed / total) * 100).toFixed(1) : 0;
  
  logSection('TEST SUMMARY');
  
  console.log(`${CONFIG.colors.cyan}Duration:${CONFIG.colors.reset} ${duration}s`);
  console.log(`${CONFIG.colors.green}Passed:${CONFIG.colors.reset}   ${testState.testsPassed}`);
  console.log(`${CONFIG.colors.red}Failed:${CONFIG.colors.reset}   ${testState.testsFailed}`);
  if (testState.testsSkipped > 0) {
    console.log(`${CONFIG.colors.yellow}Skipped:${CONFIG.colors.reset}  ${testState.testsSkipped}`);
  }
  console.log(`${CONFIG.colors.blue}Total:${CONFIG.colors.reset}    ${total}`);
  console.log(`${CONFIG.colors.magenta}Pass Rate:${CONFIG.colors.reset} ${passRate}%`);
  
  if (testState.errors.length > 0) {
    console.log('');
    log('ERRORS:', CONFIG.colors.red);
    testState.errors.forEach((err, i) => {
      console.log(`${CONFIG.colors.red}  ${i + 1}. ${err.message}${CONFIG.colors.reset}`);
      console.log(`${CONFIG.colors.dim}     ${err.error}${CONFIG.colors.reset}`);
    });
  }
  
  console.log('');
  if (testState.testsFailed === 0) {
    log('✨ All tests passed! ✨', CONFIG.colors.bright + CONFIG.colors.green);
  } else {
    log('⚠️  Some tests failed. Check errors above.', CONFIG.colors.yellow);
  }
  console.log('');
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('');
  log('╔════════════════════════════════════════════════════════════════════════╗', CONFIG.colors.bright);
  log('║                   PRIAGE BACKEND SMOKE TEST v2                       ║', CONFIG.colors.bright);
  log('║                   End-to-End Lifecycle Testing                       ║', CONFIG.colors.bright);
  log('╚════════════════════════════════════════════════════════════════════════╝', CONFIG.colors.bright);
  console.log('');
  
  logInfo(`Base URL: ${CONFIG.baseUrl}`);
  logInfo(`Database: ${CONFIG.databaseUrl.replace(/:[^:@]+@/, ':****@')}`);
  if (options.verbose) logInfo('Verbose mode enabled');
  if (options.skipCleanup) logInfo('Cleanup will be skipped');
  
  const testsToRun = [];
  if (options.testAuth) testsToRun.push('Auth');
  if (options.testIntake) testsToRun.push('Intake');
  if (options.testEncounters) testsToRun.push('Encounters');
  if (options.testTriage) testsToRun.push('Triage');
  if (options.testMessaging) testsToRun.push('Messaging');
  if (options.testAlerts) testsToRun.push('Alerts');
  logInfo(`Tests: ${testsToRun.join(', ')}`);
  
  try {
    await setupTestData();
    
    if (options.testAuth) await testAuthentication();
    if (options.testIntake) await testPatientIntake();
    if (options.testEncounters) await testEncounterManagement();
    if (options.testTriage) await testTriageAssessment();
    if (options.testMessaging) await testMessaging();
    if (options.testAlerts) await testAlerts();
    if (options.testEncounters && testState.encounter) await testEncounterCompletion();
    
    await cleanupTestData();
    
  } catch (error) {
    logError('Test execution failed', error);
    if (options.verbose) console.error(error);
    
    try { await cleanupTestData(); } catch { /* best effort */ }
  } finally {
    await prisma.$disconnect();
    await pool.end();
    printSummary();
    process.exit(testState.testsFailed > 0 ? 1 : 0);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
