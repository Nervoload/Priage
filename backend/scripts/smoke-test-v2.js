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
// Last Modified: Feb 2026 (updated for guarded endpoints)

require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const { randomUUID } = require('crypto');
const bcrypt = require('bcrypt');

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
    
    // Delete encounter (cascade handles events, messages, alerts, triage, sessions, assets)
    if (testState.encounter) {
      logInfo('Deleting encounter and related data...');
      await prisma.encounter.delete({ where: { id: testState.encounter.id } });
      logSuccess('Encounter deleted');
    }
    
    // Delete remaining patient sessions from intake
    if (testState.intakePatient) {
      await prisma.patientSession.deleteMany({ where: { patientId: testState.intakePatient.id } });
    }
    
    // Delete patients
    if (testState.patient) {
      logInfo('Deleting test patient...');
      await prisma.patientProfile.delete({ where: { id: testState.patient.id } });
      logSuccess('Test patient deleted');
    }
    if (testState.intakePatient && testState.intakePatient.id !== testState.patient?.id) {
      logInfo('Deleting intake patient...');
      await prisma.patientProfile.delete({ where: { id: testState.intakePatient.id } });
      logSuccess('Intake patient deleted');
    }
    
    // Delete users + hospital
    if (testState.hospital) {
      const userIds = [testState.staffUser?.id, testState.nurseUser?.id, testState.doctorUser?.id].filter(Boolean);
      if (userIds.length > 0) {
        logInfo(`Deleting ${userIds.length} test users...`);
        await prisma.user.deleteMany({
          where: { id: { in: userIds }, hospitalId: testState.hospital.id, email: { contains: '@test.com' } },
        });
        logSuccess('Test users deleted');
      }
      
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
    // 1A: Staff login
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
    
    // 1E: Invalid credentials
    logSubSection('1E: Invalid Credentials (Expected 401)');
    try {
      await makeRequest('POST', '/auth/login', {
        body: { email: testState.staffUser.email, password: 'wrong-password' },
      });
      logError('Should have rejected invalid credentials', 'No error thrown');
    } catch (error) {
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        logSuccess('Invalid credentials correctly rejected');
      } else {
        throw error;
      }
    }
    
    // 1F: Unauthenticated request to guarded endpoint
    logSubSection('1F: Unauthenticated Request (Expected 401)');
    try {
      await makeRequest('GET', '/encounters');
      logError('Should have rejected unauthenticated request', 'No error thrown');
    } catch (error) {
      if (error.message.includes('401')) {
        logSuccess('Unauthenticated request correctly rejected');
      } else {
        throw error;
      }
    }
    
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
    // 2A: Create intent (public — no auth)
    // Returns { sessionToken, patientId, encounterId: null }
    // Encounter is NOT created until confirmIntent
    logSubSection('2A: Create Patient Intent (POST /intake/intent)');
    const intent = await makeRequest('POST', '/intake/intent', {
      body: {
        firstName: 'Smoke',
        lastName: 'TestPatient',
        age: 45,
        chiefComplaint: 'Chest pain and shortness of breath',
        details: 'Pain started 2 hours ago',
        preferredLanguage: 'en',
      },
    });
    
    if (!intent.sessionToken) throw new Error('No sessionToken returned');
    if (!intent.patientId) throw new Error('No patientId returned');
    
    testState.patientToken = intent.sessionToken;
    testState.intakePatient = await prisma.patientProfile.findUnique({
      where: { id: intent.patientId },
    });
    
    logSuccess(`Intent created — patientId: ${intent.patientId}, encounterId: ${intent.encounterId ?? 'null (expected)'}`);
    logVerbose(`  Token: ${intent.sessionToken.substring(0, 30)}...`);
    
    // 2B: Verify session in DB
    logSubSection('2B: Verify Patient Session Token');
    testState.patientSession = await prisma.patientSession.findFirst({
      where: { token: testState.patientToken },
    });
    if (!testState.patientSession) throw new Error('No patient session found');
    logSuccess('Patient session token verified in database');
    logVerbose(`  Session ID: ${testState.patientSession.id}`);
    
    // 2C: Confirm intent → creates encounter and assigns hospital
    logSubSection('2C: Confirm Intent (POST /intake/confirm)');
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
    
    // 2D: Update intake details
    logSubSection('2D: Update Intake Details (PATCH /intake/details)');
    await makeRequest('PATCH', '/intake/details', {
      headers: patientAuth(testState.patientToken),
      body: {
        details: 'Pain started 2 hours ago, radiating to left arm. No previous heart issues.',
        allergies: 'Penicillin',
      },
    });
    logSuccess('Intake details updated');
    
    // 2E: Record location
    logSubSection('2E: Record Patient Location (POST /intake/location)');
    await makeRequest('POST', '/intake/location', {
      headers: patientAuth(testState.patientToken),
      body: { latitude: 43.6532, longitude: -79.3832 },
    });
    logSuccess('Patient location recorded');
    
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
    // If intake test didn't run, create encounter via staff
    if (!testState.encounter) {
      logSubSection('3-SETUP: Create Encounter (staff)');
      testState.encounter = await makeRequest('POST', '/encounters', {
        headers: staffAuth(testState.staffToken),
        body: { patientId: testState.patient.id, chiefComplaint: 'Smoke test encounter' },
      });
      logSuccess(`Encounter created: ID ${testState.encounter.id}`);
    }
    
    // 3A: List encounters (hospitalId comes from JWT — no query param needed)
    logSubSection('3A: List Encounters (GET /encounters)');
    const encounters = await makeRequest('GET', '/encounters', {
      headers: staffAuth(testState.staffToken),
    });
    
    if (!encounters.data || !Array.isArray(encounters.data)) {
      throw new Error('Expected { data: [...] } response');
    }
    logSuccess(`Listed ${encounters.data.length} encounter(s), total: ${encounters.total}`);
    
    // 3B: Get specific encounter
    logSubSection('3B: Get Encounter Details (GET /encounters/:id)');
    const encounter = await makeRequest('GET', `/encounters/${testState.encounter.id}`, {
      headers: staffAuth(testState.staffToken),
    });
    if (encounter.id !== testState.encounter.id) throw new Error('Wrong encounter returned');
    logSuccess('Encounter details retrieved');
    logVerbose(`  Status: ${encounter.status}`);
    logVerbose(`  Patient: ${encounter.patient?.firstName} ${encounter.patient?.lastName}`);
    
    // 3C: Mark arrived → ADMITTED
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
    
    // Verify events
    const events = await prisma.encounterEvent.findMany({
      where: { encounterId: testState.encounter.id },
      orderBy: { createdAt: 'desc' },
    });
    if (events.length === 0) {
      logWarning('No encounter events found');
    } else {
      logSuccess(`${events.length} encounter event(s) recorded`);
      logVerbose(`  Latest: ${events[0].type}`);
    }
    
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
    // 4A: Start exam → TRIAGE
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
    
    // 4B: Create assessment
    // DTO only accepts: encounterId, ctasLevel, note
    // hospitalId + createdByUserId come from JWT via controller
    logSubSection('4B: Create Triage Assessment (POST /triage/assessments)');
    const assessment = await makeRequest('POST', '/triage/assessments', {
      headers: staffAuth(testState.nurseToken),
      body: {
        encounterId: testState.encounter.id,
        ctasLevel: 2,
        note: 'Chest pain, radiating to left arm. BP 145/92, HR 98, SpO2 96%. EKG ordered.',
      },
    });
    if (!assessment.id) throw new Error('Assessment not created');
    testState.triageAssessment = assessment;
    logSuccess('Triage assessment created');
    logVerbose(`  CTAS Level: ${assessment.ctasLevel}, Priority Score: ${assessment.priorityScore}`);
    
    // 4C: List assessments
    logSubSection('4C: List Assessments (GET /triage/encounters/:id/assessments)');
    const assessments = await makeRequest('GET', `/triage/encounters/${testState.encounter.id}/assessments`, {
      headers: staffAuth(testState.nurseToken),
    });
    if (!Array.isArray(assessments) || assessments.length === 0) {
      throw new Error('Assessments not listed correctly');
    }
    logSuccess(`Listed ${assessments.length} assessment(s)`);
    
    // 4D: Verify encounter triage data
    logSubSection('4D: Verify Encounter Triage Data');
    const updated = await prisma.encounter.findUnique({ where: { id: testState.encounter.id } });
    if (updated.currentCtasLevel !== 2) {
      logWarning(`CTAS not updated (got ${updated.currentCtasLevel})`);
    } else {
      logSuccess('Encounter updated with CTAS level');
    }
    
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
    // 5A: Staff sends message
    // DTO: { senderType, content, isInternal?, isWorsening? }
    logSubSection('5A: Nurse Sends Message');
    const message = await makeRequest('POST', `/messaging/encounters/${testState.encounter.id}/messages`, {
      headers: staffAuth(testState.nurseToken),
      body: {
        content: 'Your EKG results look stable. The doctor will see you shortly.',
        senderType: 'USER',
      },
    });
    if (!message.id) throw new Error('Message not created');
    testState.message = message;
    logSuccess('Message sent');
    logVerbose(`  ID: ${message.id}, Content: ${message.content}`);
    
    // 5B: List messages (staff — paginated)
    logSubSection('5B: List Encounter Messages');
    const messages = await makeRequest('GET', `/messaging/encounters/${testState.encounter.id}/messages`, {
      headers: staffAuth(testState.staffToken),
    });
    if (!messages.data || !Array.isArray(messages.data)) {
      throw new Error('Expected paginated { data: [...] }');
    }
    logSuccess(`Listed ${messages.data.length} message(s)`);
    
    // 5C: Mark message as read
    logSubSection('5C: Mark Message as Read');
    await makeRequest('POST', `/messaging/messages/${message.id}/read`, {
      headers: staffAuth(testState.staffToken),
    });
    logSuccess('Message marked as read');
    
    // 5D: Patient sends message (via patient endpoint)
    if (testState.patientToken && testState.encounter) {
      logSubSection('5D: Patient Sends Message');
      const patientMsg = await makeRequest('POST', `/patient/encounters/${testState.encounter.id}/messages`, {
        headers: patientAuth(testState.patientToken),
        body: { content: 'The pain is getting worse, please hurry.', isWorsening: true },
      });
      if (!patientMsg.id) throw new Error('Patient message not created');
      logSuccess('Patient message sent (with worsening flag)');
      
      // 5E: Patient lists own messages
      logSubSection('5E: Patient Lists Messages');
      const patientMessages = await makeRequest('GET', `/patient/encounters/${testState.encounter.id}/messages`, {
        headers: patientAuth(testState.patientToken),
      });
      if (!Array.isArray(patientMessages)) {
        throw new Error('Expected array of messages');
      }
      logSuccess(`Patient sees ${patientMessages.length} message(s)`);
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
    // 6A: Create alert
    // DTO: { encounterId, type, severity?, metadata? }
    // hospitalId + actorUserId come from JWT
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
    
    // 6B: List unacknowledged
    logSubSection('6B: List Unacknowledged Alerts');
    const unacked = await makeRequest('GET', `/alerts/hospitals/${testState.hospital.id}/unacknowledged`, {
      headers: staffAuth(testState.staffToken),
    });
    if (!Array.isArray(unacked)) throw new Error('Alerts not listed correctly');
    logSuccess(`Listed ${unacked.length} unacknowledged alert(s)`);
    
    // 6C: Acknowledge
    logSubSection('6C: Acknowledge Alert');
    await makeRequest('POST', `/alerts/${alert.id}/acknowledge`, {
      headers: staffAuth(testState.staffToken),
    });
    logSuccess('Alert acknowledged');
    
    // 6D: Resolve
    logSubSection('6D: Resolve Alert');
    await makeRequest('POST', `/alerts/${alert.id}/resolve`, {
      headers: staffAuth(testState.nurseToken),
    });
    logSuccess('Alert resolved');
    
    // 6E: List encounter alerts
    logSubSection('6E: List Encounter Alerts');
    const encounterAlerts = await makeRequest('GET', `/alerts/encounters/${testState.encounter.id}`, {
      headers: staffAuth(testState.staffToken),
    });
    if (!Array.isArray(encounterAlerts)) throw new Error('Not listed correctly');
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
    // 7A: Move to waiting → WAITING
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
    
    // 7B: Discharge → COMPLETE
    logSubSection('7B: Discharge Patient');
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
    
    // 7C: Verify final state
    logSubSection('7C: Verify Final State');
    const final = await prisma.encounter.findUnique({
      where: { id: testState.encounter.id },
      include: { triageAssessments: true, messages: true, alerts: true, events: true },
    });
    logSuccess('Final encounter state verified');
    logVerbose(`  Status: ${final.status}`);
    logVerbose(`  Assessments: ${final.triageAssessments.length}, Messages: ${final.messages.length}`);
    logVerbose(`  Alerts: ${final.alerts.length}, Events: ${final.events.length}`);
    
    // 7D: Terminal status protection
    logSubSection('7D: Terminal Status Protection');
    try {
      await makeRequest('POST', `/encounters/${testState.encounter.id}/cancel`, {
        headers: staffAuth(testState.nurseToken),
      });
      logError('Should have rejected transition from COMPLETE', 'No error');
    } catch (error) {
      if (error.message.includes('409') || error.message.includes('400') || error.message.includes('Conflict')) {
        logSuccess('Terminal status protected — cannot transition from COMPLETE');
      } else {
        throw error;
      }
    }
    
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
