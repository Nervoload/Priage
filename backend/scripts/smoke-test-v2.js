#!/usr/bin/env node
// backend/scripts/smoke-test-v2.js
// Comprehensive Priage Backend Smoke Test
// Tests full encounter lifecycle: creation → admission → triage → waiting → discharge
//
// Usage: node scripts/smoke-test-v2.js [options]
// For full documentation, see: docs/SMOKE_TEST_README.md
//
// Written by: John Surette
// Date Created: Jan 20 2026
// Last Modified: Jan 20 2026

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
  patient: null,
  intakePatient: null, // Patient created through intake flow
  encounter: null,
  patientSession: null,
  triageAssessment: null,
  message: null,
  alert: null,
  
  // Auth tokens
  staffToken: null,
  nurseToken: null,
  doctorToken: null,
  patientToken: null,
  
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

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function generateCorrelationId() {
  return `smoke-test-${randomUUID()}`;
}

async function makeRequest(method, path, options = {}) {
  const url = `${CONFIG.baseUrl}${path}`;
  const correlationId = generateCorrelationId();
  testState.correlationId = correlationId;
  
  const headers = {
    'Content-Type': 'application/json',
    'X-Correlation-ID': correlationId,
    ...(options.headers || {}),
  };
  
  logVerbose(`${method} ${path}`);
  
  const response = await fetch(url, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
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

// ============================================================================
// HELP TEXT
// ============================================================================

function showHelp() {
  console.log(`
${CONFIG.colors.bright}Priage Backend Smoke Test${CONFIG.colors.reset}
${CONFIG.colors.dim}Comprehensive end-to-end testing of the Priage backend API${CONFIG.colors.reset}

${CONFIG.colors.cyan}USAGE:${CONFIG.colors.reset}
  node scripts/smoke-test-v2.js [options]

${CONFIG.colors.cyan}OPTIONS:${CONFIG.colors.reset}
  -h, --help              Show this help message
  -v, --verbose           Enable verbose logging (includes all API calls)
  -s, --skip-cleanup      Skip cleanup of test data after completion
  
  ${CONFIG.colors.yellow}Test Selection (run specific tests):${CONFIG.colors.reset}
  -a, --test-auth         Test authentication only
  -i, --test-intake       Test patient intake only
  -e, --test-encounters   Test encounter management only
  -t, --test-triage       Test triage assessments only
  -m, --test-messaging    Test messaging only
      --test-alerts       Test alerts only
  
  ${CONFIG.colors.dim}Note: If no specific tests are selected, all tests will run${CONFIG.colors.reset}

${CONFIG.colors.cyan}EXAMPLES:${CONFIG.colors.reset}
  # Run all tests
  node scripts/smoke-test-v2.js
  
  # Run with verbose output
  node scripts/smoke-test-v2.js --verbose
  
  # Test only authentication and encounters
  node scripts/smoke-test-v2.js --test-auth --test-encounters
  
  # Run all tests and keep test data for inspection
  node scripts/smoke-test-v2.js --skip-cleanup --verbose

${CONFIG.colors.cyan}ENVIRONMENT:${CONFIG.colors.reset}
  DATABASE_URL            PostgreSQL connection string (required)
  BASE_URL                API base URL (default: http://localhost:3000)

${CONFIG.colors.cyan}DOCUMENTATION:${CONFIG.colors.reset}
  See docs/SMOKE_TEST_README.md for full documentation
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
      return entity.email && (
        entity.email.includes('@test.com') || 
        entity.email.includes('@intake.local')
      );
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
  
  if (testState.staffUser) {
    checks.push({
      entity: 'staff user',
      safe: isTestData(testState.staffUser, 'user'),
      details: testState.staffUser.email,
    });
  }
  
  if (testState.nurseUser) {
    checks.push({
      entity: 'nurse user',
      safe: isTestData(testState.nurseUser, 'user'),
      details: testState.nurseUser.email,
    });
  }
  
  if (testState.doctorUser) {
    checks.push({
      entity: 'doctor user',
      safe: isTestData(testState.doctorUser, 'user'),
      details: testState.doctorUser.email,
    });
  }
  
  if (testState.patient) {
    checks.push({
      entity: 'patient',
      safe: isTestData(testState.patient, 'patient'),
      details: testState.patient.email,
    });
  }
  
  if (testState.intakePatient) {
    checks.push({
      entity: 'intake patient',
      safe: isTestData(testState.intakePatient, 'patient'),
      details: testState.intakePatient.email,
    });
  }
  
  const unsafeItems = checks.filter(check => !check.safe);
  
  if (unsafeItems.length > 0) {
    logError('SAFETY CHECK FAILED: Found entities that may not be test data:');
    unsafeItems.forEach(item => {
      logError(`  ${item.entity}: ${item.details}`);
    });
    throw new Error('Refusing to cleanup - unsafe entities detected');
  }
  
  logSuccess(`Safety check passed - all ${checks.length} entities verified as test data`);
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
      data: {
        name: 'Test Hospital',
        slug: hospitalSlug,
      },
    });
    logSuccess(`Hospital created: ${testState.hospital.name} (ID: ${testState.hospital.id})`);
    
    // Create test users
    logInfo('Creating test users (staff, nurse, doctor)...');
    const hashedPassword = await bcrypt.hash(CONFIG.testPassword, 10);
    const emailSuffix = randomUUID().slice(0, 8);
    
    testState.staffUser = await prisma.user.create({
      data: {
        email: `staff-${emailSuffix}@test.com`,
        password: hashedPassword,
        role: 'STAFF',
        hospitalId: testState.hospital.id,
      },
    });
    
    testState.nurseUser = await prisma.user.create({
      data: {
        email: `nurse-${emailSuffix}@test.com`,
        password: hashedPassword,
        role: 'NURSE',
        hospitalId: testState.hospital.id,
      },
    });
    
    testState.doctorUser = await prisma.user.create({
      data: {
        email: `doctor-${emailSuffix}@test.com`,
        password: hashedPassword,
        role: 'DOCTOR',
        hospitalId: testState.hospital.id,
      },
    });
    
    logSuccess(`Staff user created: ${testState.staffUser.email}`);
    logSuccess(`Nurse user created: ${testState.nurseUser.email}`);
    logSuccess(`Doctor user created: ${testState.doctorUser.email}`);
    
    // Create test patient
    logInfo('Creating test patient...');
    testState.patient = await prisma.patientProfile.create({
      data: {
        email: `patient-${emailSuffix}@test.com`,
        password: hashedPassword,
        firstName: 'Test',
        lastName: 'Patient',
        age: 35,
        gender: 'Other',
        preferredLanguage: 'en',
      },
    });
    logSuccess(`Patient created: ${testState.patient.email} (ID: ${testState.patient.id})`);
    
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
    // Perform safety checks before any deletion
    await safetyCheckBeforeCleanup();
    
    // Only delete encounter if we created it
    if (testState.encounter) {
      logInfo('Deleting encounter and related data...');
      await prisma.encounter.delete({
        where: { id: testState.encounter.id },
      });
      logSuccess('Encounter deleted');
    }
    
    // Only delete the specific patients we created, using exact IDs
    if (testState.patient) {
      logInfo('Deleting original patient...');
      await prisma.patientProfile.delete({
        where: { id: testState.patient.id },
      });
      logSuccess('Original patient deleted');
    }
    
    if (testState.intakePatient && testState.intakePatient.id !== testState.patient?.id) {
      logInfo('Deleting intake patient...');
      await prisma.patientProfile.delete({
        where: { id: testState.intakePatient.id },
      });
      logSuccess('Intake patient deleted');
    }
    
    // Safe user deletion: only delete the specific users we created
    if (testState.hospital) {
      const userIdsToDelete = [
        testState.staffUser?.id,
        testState.nurseUser?.id, 
        testState.doctorUser?.id,
      ].filter(Boolean); // Remove any undefined values
      
      if (userIdsToDelete.length > 0) {
        logInfo(`Deleting ${userIdsToDelete.length} test users...`);
        await prisma.user.deleteMany({
          where: {
            id: { in: userIdsToDelete },
            // Double safety check: ensure they're in our test hospital
            hospitalId: testState.hospital.id,
            // Triple safety check: ensure email contains our test suffix
            email: { contains: '@test.com' },
          },
        });
        logSuccess('Test users deleted');
      }
      
      // Only delete the specific hospital we created
      logInfo('Deleting test hospital...');
      await prisma.hospital.delete({
        where: { 
          id: testState.hospital.id,
        },
      });
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
    // Test staff login
    logSubSection('1A: Staff User Login');
    const staffLogin = await makeRequest('POST', '/auth/login', {
      body: {
        email: testState.staffUser.email,
        password: CONFIG.testPassword,
      },
    });
    
    if (!staffLogin.access_token) {
      throw new Error('No access token returned');
    }
    
    testState.staffToken = staffLogin.access_token;
    logSuccess('Staff user authenticated');
    logVerbose(`  Token: ${staffLogin.access_token.substring(0, 30)}...`);
    
    // Test nurse login
    logSubSection('1B: Nurse User Login');
    const nurseLogin = await makeRequest('POST', '/auth/login', {
      body: {
        email: testState.nurseUser.email,
        password: CONFIG.testPassword,
      },
    });
    
    testState.nurseToken = nurseLogin.access_token;
    logSuccess('Nurse user authenticated');
    
    // Test doctor login
    logSubSection('1C: Doctor User Login');
    const doctorLogin = await makeRequest('POST', '/auth/login', {
      body: {
        email: testState.doctorUser.email,
        password: CONFIG.testPassword,
      },
    });
    
    testState.doctorToken = doctorLogin.access_token;
    logSuccess('Doctor user authenticated');
    
    // Verify token works on protected route
    logSubSection('1D: Protected Route Access');
    const meData = await makeRequest('GET', '/auth/me', {
      headers: { Authorization: `Bearer ${testState.staffToken}` },
    });
    
    if (meData.userId !== testState.staffUser.id) {
      throw new Error(`Token returned wrong user: expected ${testState.staffUser.id}, got ${meData.userId}`);
    }
    
    logSuccess('Protected route access verified');
    
    // Test invalid credentials
    logSubSection('1E: Invalid Credentials (Expected Failure)');
    try {
      await makeRequest('POST', '/auth/login', {
        body: {
          email: testState.staffUser.email,
          password: 'wrong-password',
        },
      });
      logError('Should have rejected invalid credentials', 'No error thrown');
    } catch (error) {
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        logSuccess('Invalid credentials correctly rejected');
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
    // Create intent (patient side, creates new patient and encounter)
    logSubSection('2A: Create Patient Intent');
    const intent = await makeRequest('POST', '/intake/intent', {
      body: {
        firstName: 'John',
        lastName: 'Doe',
        age: 45,
        chiefComplaint: 'Chest pain and shortness of breath',
        details: 'Pain started 2 hours ago',
        preferredLanguage: 'en',
      },
    });
    
    if (!intent.encounterId || !intent.sessionToken) {
      throw new Error('Intent creation did not return encounterId or sessionToken');
    }
    
    testState.patientToken = intent.sessionToken;
    testState.encounter = await prisma.encounter.findUnique({
      where: { id: intent.encounterId },
      include: { patient: true },
    });
    
    // Update testState.patient to the newly created patient from intake
    if (testState.encounter.patient) {
      // Keep the old patient for cleanup but use the new one for the encounter
      testState.intakePatient = testState.encounter.patient;
    }
    
    logSuccess(`Intent created - Encounter ID: ${intent.encounterId}`);
    logVerbose(`  Status: ${testState.encounter.status}`);
    logVerbose(`  Chief Complaint: ${testState.encounter.chiefComplaint}`);
    logVerbose(`  Patient: ${testState.encounter.patient.firstName} ${testState.encounter.patient.lastName}`);
    
    // Verify patient session was created
    logSubSection('2B: Verify Patient Session Token');
    testState.patientSession = await prisma.patientSession.findFirst({
      where: {
        token: testState.patientToken,
        encounterId: testState.encounter.id,
      },
    });
    
    if (!testState.patientSession) {
      throw new Error('No patient session found with returned token');
    }
    
    logSuccess('Patient session token verified');
    logVerbose(`  Token: ${testState.patientToken.substring(0, 30)}...`);
    
    // Confirm intent and assign to hospital
    logSubSection('2C: Confirm Intent and Assign Hospital');
    const confirmedEncounter = await makeRequest('POST', '/intake/confirm', {
      headers: { 'x-patient-token': testState.patientToken },
      body: {
        hospitalId: testState.hospital.id,
      },
    });
    
    if (!confirmedEncounter.hospitalId) {
      throw new Error('Hospital not assigned to encounter');
    }
    
    testState.encounter = confirmedEncounter;
    logSuccess('Intent confirmed and hospital assigned');
    logVerbose(`  Hospital ID: ${confirmedEncounter.hospitalId}`);
    
    // Update intake details (patient adds more information)
    logSubSection('2D: Update Intake Details');
    await makeRequest('PATCH', '/intake/details', {
      headers: { 'x-patient-token': testState.patientToken },
      body: {
        details: 'Pain started 2 hours ago, radiating to left arm. No previous heart issues.',
      },
    });
    
    const updatedEncounter = await prisma.encounter.findUnique({
      where: { id: testState.encounter.id },
    });
    
    if (!updatedEncounter.details || !updatedEncounter.details.includes('radiating to left arm')) {
      throw new Error('Details not updated correctly');
    }
    
    testState.encounter = updatedEncounter;
    logSuccess('Intake details updated');
    logVerbose(`  Details: ${updatedEncounter.details}`);
    
    // Record location (patient en route)
    logSubSection('2E: Record Patient Location');
    await makeRequest('POST', '/intake/location', {
      headers: { 'x-patient-token': testState.patientToken },
      body: {
        latitude: 43.6532,
        longitude: -79.3832,
        estimatedArrivalMinutes: 15,
      },
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
    // List encounters (staff view)
    logSubSection('3A: List Hospital Encounters');
    const encounters = await makeRequest('GET', `/encounters?hospitalId=${testState.hospital.id}`, {
      headers: { Authorization: `Bearer ${testState.staffToken}` },
    });
    
    if (!Array.isArray(encounters.data)) {
      throw new Error('Encounters list not returned as expected');
    }
    
    logSuccess(`Listed ${encounters.data.length} encounter(s)`);
    
    // Get specific encounter
    logSubSection('3B: Get Encounter Details');
    const encounter = await makeRequest('GET', `/encounters/${testState.encounter.id}`, {
      headers: { Authorization: `Bearer ${testState.staffToken}` },
    });
    
    if (encounter.id !== testState.encounter.id) {
      throw new Error('Wrong encounter returned');
    }
    
    logSuccess('Encounter details retrieved');
    logVerbose(`  Status: ${encounter.status}`);
    logVerbose(`  Patient: ${encounter.patient?.firstName} ${encounter.patient?.lastName}`);
    
    // Mark patient as arrived (staff action)
    logSubSection('3C: Mark Patient Arrived');
    const arrivedEncounter = await makeRequest('POST', `/encounters/${testState.encounter.id}/arrived`, {
      headers: { Authorization: `Bearer ${testState.staffToken}` },
      body: {
        actorUserId: testState.staffUser.id,
      },
    });
    
    if (arrivedEncounter.status !== 'ADMITTED') {
      throw new Error(`Expected status ADMITTED, got ${arrivedEncounter.status}`);
    }
    
    if (!arrivedEncounter.arrivedAt) {
      throw new Error('arrivedAt timestamp not set');
    }
    
    testState.encounter = arrivedEncounter;
    logSuccess('Patient marked as arrived → ADMITTED');
    logVerbose(`  Arrived at: ${arrivedEncounter.arrivedAt}`);
    
    // Verify encounter event was created
    const events = await prisma.encounterEvent.findMany({
      where: { encounterId: testState.encounter.id },
      orderBy: { createdAt: 'desc' },
    });
    
    if (events.length === 0) {
      logWarning('No encounter events found (expected at least one)');
    } else {
      logSuccess(`${events.length} encounter event(s) recorded`);
      logVerbose(`  Latest event type: ${events[0].type}`);
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
    // Nurse starts triage
    logSubSection('4A: Start Triage Exam');
    const triageStarted = await makeRequest('POST', `/encounters/${testState.encounter.id}/start-exam`, {
      headers: { Authorization: `Bearer ${testState.nurseToken}` },
      body: {
        actorUserId: testState.nurseUser.id,
      },
    });
    
    if (triageStarted.status !== 'TRIAGE') {
      throw new Error(`Expected status TRIAGE, got ${triageStarted.status}`);
    }
    
    testState.encounter = triageStarted;
    logSuccess('Triage exam started → TRIAGE');
    logVerbose(`  Triaged at: ${triageStarted.triagedAt}`);
    
    // Create triage assessment
    logSubSection('4B: Create Triage Assessment');
    const assessment = await makeRequest('POST', '/triage/assessments', {
      headers: { Authorization: `Bearer ${testState.nurseToken}` },
      body: {
        encounterId: testState.encounter.id,
        hospitalId: testState.encounter.hospitalId,
        ctasLevel: 2, // CTAS 2 = Emergent (15 min)
        note: 'Patient presenting with chest pain, radiating to left arm. Vital signs: BP 145/92, HR 98, SpO2 96%. EKG ordered.',
        createdByUserId: testState.nurseUser.id,
      },
    });
    
    if (!assessment.id) {
      throw new Error('Assessment not created');
    }
    
    testState.triageAssessment = assessment;
    logSuccess('Triage assessment created');
    logVerbose(`  CTAS Level: ${assessment.ctasLevel}`);
    logVerbose(`  Priority Score: ${assessment.priorityScore}`);
    logVerbose(`  Note: ${assessment.note.substring(0, 50)}...`);
    
    // List assessments for encounter
    logSubSection('4C: List Triage Assessments');
    const assessments = await makeRequest('GET', `/triage/encounters/${testState.encounter.id}/assessments`, {
      headers: { Authorization: `Bearer ${testState.nurseToken}` },
    });
    
    if (!Array.isArray(assessments) || assessments.length === 0) {
      throw new Error('Assessments not listed correctly');
    }
    
    logSuccess(`Listed ${assessments.length} assessment(s)`);
    
    // Verify encounter was updated with triage data
    const updatedEncounter = await prisma.encounter.findUnique({
      where: { id: testState.encounter.id },
    });
    
    if (updatedEncounter.currentCtasLevel !== 2) {
      logWarning('Encounter CTAS level not updated');
    } else {
      logSuccess('Encounter updated with triage data');
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
    // Staff sends message to patient
    logSubSection('5A: Send Message to Patient');
    const message = await makeRequest('POST', `/messaging/encounters/${testState.encounter.id}/messages`, {
      headers: { Authorization: `Bearer ${testState.nurseToken}` },
      body: {
        content: 'Your EKG results look stable. The doctor will see you shortly.',
        senderType: 'USER',
        createdByUserId: testState.nurseUser.id,
      },
    });
    
    if (!message.id) {
      throw new Error('Message not created');
    }
    
    testState.message = message;
    logSuccess('Message sent to patient');
    logVerbose(`  Content: ${message.content}`);
    
    // List messages for encounter
    logSubSection('5B: List Encounter Messages');
    const messages = await makeRequest('GET', `/messaging/encounters/${testState.encounter.id}/messages`, {
      headers: { Authorization: `Bearer ${testState.staffToken}` },
    });
    
    if (!Array.isArray(messages.data)) {
      throw new Error('Messages not listed correctly');
    }
    
    logSuccess(`Listed ${messages.data.length} message(s)`);
    
    // Mark message as read (simulating patient reading it)
    logSubSection('5C: Mark Message as Read');
    // Note: In real app, patient would mark it read, but we'll use staff token for testing
    await makeRequest('POST', `/messaging/messages/${message.id}/read`, {
      headers: { Authorization: `Bearer ${testState.staffToken}` },
      body: {
        actorUserId: testState.staffUser.id,
      },
    });
    
    logSuccess('Message marked as read');
    
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
    // Create alert
    logSubSection('6A: Create Alert');
    const alert = await makeRequest('POST', '/alerts', {
      headers: { Authorization: `Bearer ${testState.nurseToken}` },
      body: {
        encounterId: testState.encounter.id,
        hospitalId: testState.encounter.hospitalId,
        type: 'WAIT_TIME_EXCEEDED',
        severity: 'MEDIUM',
        actorUserId: testState.nurseUser.id,
        metadata: {
          waitTimeMinutes: 45,
          threshold: 30,
        },
      },
    });
    
    if (!alert.id) {
      throw new Error('Alert not created');
    }
    
    testState.alert = alert;
    logSuccess('Alert created');
    logVerbose(`  Type: ${alert.type}`);
    logVerbose(`  Severity: ${alert.severity}`);
    
    // List unacknowledged alerts
    logSubSection('6B: List Unacknowledged Alerts');
    const unacknowledgedAlerts = await makeRequest('GET', `/alerts/hospitals/${testState.hospital.id}/unacknowledged`, {
      headers: { Authorization: `Bearer ${testState.staffToken}` },
    });
    
    if (!Array.isArray(unacknowledgedAlerts)) {
      throw new Error('Alerts not listed correctly');
    }
    
    logSuccess(`Listed ${unacknowledgedAlerts.length} unacknowledged alert(s)`);
    
    // Acknowledge alert
    logSubSection('6C: Acknowledge Alert');
    await makeRequest('POST', `/alerts/${alert.id}/acknowledge`, {
      headers: { Authorization: `Bearer ${testState.staffToken}` },
      body: {
        actorUserId: testState.staffUser.id,
      },
    });
    
    logSuccess('Alert acknowledged');
    
    // Resolve alert
    logSubSection('6D: Resolve Alert');
    await makeRequest('POST', `/alerts/${alert.id}/resolve`, {
      headers: { Authorization: `Bearer ${testState.nurseToken}` },
      body: {
        actorUserId: testState.nurseUser.id,
      },
    });
    
    logSuccess('Alert resolved');
    
    // List alerts for encounter
    logSubSection('6E: List Encounter Alerts');
    const encounterAlerts = await makeRequest('GET', `/alerts/encounters/${testState.encounter.id}`, {
      headers: { Authorization: `Bearer ${testState.staffToken}` },
    });
    
    if (!Array.isArray(encounterAlerts)) {
      throw new Error('Encounter alerts not listed correctly');
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
    // Move to waiting room
    logSubSection('7A: Move to Waiting Room');
    const waitingEncounter = await makeRequest('POST', `/encounters/${testState.encounter.id}/waiting`, {
      headers: { Authorization: `Bearer ${testState.nurseToken}` },
      body: {
        actorUserId: testState.nurseUser.id,
      },
    });
    
    if (waitingEncounter.status !== 'WAITING') {
      throw new Error(`Expected status WAITING, got ${waitingEncounter.status}`);
    }
    
    testState.encounter = waitingEncounter;
    logSuccess('Patient moved to waiting room → WAITING');
    logVerbose(`  Waiting since: ${waitingEncounter.waitingAt}`);
    
    // Discharge patient
    logSubSection('7B: Discharge Patient');
    const dischargedEncounter = await makeRequest('POST', `/encounters/${testState.encounter.id}/discharge`, {
      headers: { Authorization: `Bearer ${testState.doctorToken}` },
      body: {
        actorUserId: testState.doctorUser.id,
      },
    });
    
    if (dischargedEncounter.status !== 'COMPLETE') {
      throw new Error(`Expected status COMPLETE, got ${dischargedEncounter.status}`);
    }
    
    if (!dischargedEncounter.departedAt) {
      throw new Error('departedAt timestamp not set');
    }
    
    testState.encounter = dischargedEncounter;
    logSuccess('Patient discharged → COMPLETE');
    logVerbose(`  Departed at: ${dischargedEncounter.departedAt}`);
    
    // Calculate encounter duration
    const createdAt = new Date(testState.encounter.createdAt);
    const departedAt = new Date(dischargedEncounter.departedAt);
    const durationMs = departedAt - createdAt;
    const durationSec = Math.round(durationMs / 1000);
    
    logInfo(`Total encounter duration: ${durationSec} seconds`);
    
    // Verify final state
    logSubSection('7C: Verify Final State');
    const finalEncounter = await prisma.encounter.findUnique({
      where: { id: testState.encounter.id },
      include: {
        triageAssessments: true,
        messages: true,
        alerts: true,
        events: true,
      },
    });
    
    logSuccess('Final encounter state verified');
    logVerbose(`  Status: ${finalEncounter.status}`);
    logVerbose(`  Triage Assessments: ${finalEncounter.triageAssessments.length}`);
    logVerbose(`  Messages: ${finalEncounter.messages.length}`);
    logVerbose(`  Alerts: ${finalEncounter.alerts.length}`);
    logVerbose(`  Events: ${finalEncounter.events.length}`);
    
  } catch (error) {
    logError('Encounter completion test failed', error);
    throw error;
  }
}

// ============================================================================
// SUMMARY REPORT
// ============================================================================

function printSummary() {
  const duration = ((Date.now() - testState.startTime) / 1000).toFixed(2);
  const total = testState.testsPassed + testState.testsFailed;
  const passRate = total > 0 ? ((testState.testsPassed / total) * 100).toFixed(1) : 0;
  
  logSection('TEST SUMMARY');
  
  console.log(`${CONFIG.colors.cyan}Duration:${CONFIG.colors.reset} ${duration}s`);
  console.log(`${CONFIG.colors.green}Passed:${CONFIG.colors.reset}   ${testState.testsPassed}`);
  console.log(`${CONFIG.colors.red}Failed:${CONFIG.colors.reset}   ${testState.testsFailed}`);
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
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('');
  log('╔═══════════════════════════════════════════════════════════════════════════╗', CONFIG.colors.bright);
  log('║                   PRIAGE BACKEND SMOKE TEST                                ║', CONFIG.colors.bright);
  log('║                   Comprehensive End-to-End Testing                         ║', CONFIG.colors.bright);
  log('╚═══════════════════════════════════════════════════════════════════════════╝', CONFIG.colors.bright);
  console.log('');
  
  logInfo(`Base URL: ${CONFIG.baseUrl}`);
  logInfo(`Database: ${CONFIG.databaseUrl.replace(/:[^:@]+@/, ':****@')}`);
  
  if (options.verbose) {
    logInfo('Verbose mode enabled');
  }
  if (options.skipCleanup) {
    logInfo('Cleanup will be skipped');
  }
  
  const testsToRun = [];
  if (options.testAuth) testsToRun.push('Authentication');
  if (options.testIntake) testsToRun.push('Intake');
  if (options.testEncounters) testsToRun.push('Encounters');
  if (options.testTriage) testsToRun.push('Triage');
  if (options.testMessaging) testsToRun.push('Messaging');
  if (options.testAlerts) testsToRun.push('Alerts');
  
  logInfo(`Tests to run: ${testsToRun.join(', ')}`);
  
  try {
    // Setup
    await setupTestData();
    
    // Run tests
    if (options.testAuth) {
      await testAuthentication();
    }
    
    if (options.testIntake) {
      await testPatientIntake();
    }
    
    if (options.testEncounters) {
      await testEncounterManagement();
    }
    
    if (options.testTriage) {
      await testTriageAssessment();
    }
    
    if (options.testMessaging) {
      await testMessaging();
    }
    
    if (options.testAlerts) {
      await testAlerts();
    }
    
    // Completion test (only if we ran encounter tests)
    if (options.testEncounters && testState.encounter) {
      await testEncounterCompletion();
    }
    
    // Cleanup
    await cleanupTestData();
    
  } catch (error) {
    logError('Test execution failed', error);
    if (options.verbose) {
      console.error(error);
    }
  } finally {
    // Disconnect
    await prisma.$disconnect();
    await pool.end();
    
    // Print summary
    printSummary();
    
    // Exit with appropriate code
    process.exit(testState.testsFailed > 0 ? 1 : 0);
  }
}

// ============================================================================
// RUN
// ============================================================================

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
