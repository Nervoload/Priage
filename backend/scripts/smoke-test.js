require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const { randomUUID } = require('crypto');

// Verify DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

console.log('Connecting to database:', process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@'));

// Create PostgreSQL pool for the adapter
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: ['error', 'warn'],
});

const baseUrl = process.env.API_BASE_URL ?? 'http://localhost:3000';

// Test state
const testState = {
  hospital: null,
  user: null,
  patient: null,
  encounter: null,
  authToken: null,
  errors: [],
  warnings: [],
};

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers ?? {}),
  };
  
  // Add auth token if available
  if (testState.authToken) {
    headers['Authorization'] = `Bearer ${testState.authToken}`;
  }
  
  const response = await fetch(`${baseUrl}${path}`, {
    headers,
    ...options,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Request failed ${response.status} ${response.statusText}: ${text}`);
  }

  return response.json();
}

function logSuccess(message) {
  console.log(`  ✓ ${message}`);
}

function logError(message, error) {
  console.error(`  ✗ ${message}`);
  console.error(`    Error: ${error.message}`);
  testState.errors.push({ message, error: error.message });
}

function logWarning(message) {
  console.warn(`  ⚠ ${message}`);
  testState.warnings.push(message);
}

async function setupAuthentication() {
  console.log('\n=== Setting Up Authentication ===');
  
  try {
    // Try to login with existing test user
    const loginResponse = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nurse@test.com',
        password: 'password123',
      }),
    });
    
    if (loginResponse.ok) {
      const loginData = await loginResponse.json();
      testState.authToken = loginData.access_token;
      logSuccess(`Authenticated as ${loginData.user.email}`);
      logSuccess(`Role: ${loginData.user.role}, Hospital: ${loginData.user.hospital.name}`);
      
      // Use existing hospital and user info from login
      testState.hospital = loginData.user.hospital;
      testState.user = {
        id: loginData.user.id,
        email: loginData.user.email,
        role: loginData.user.role,
        hospitalId: loginData.user.hospitalId,
      };
      
      return true;
    } else {
      logWarning('Test user not found - will create new test data');
      return false;
    }
  } catch (error) {
    logWarning(`Authentication failed: ${error.message} - will create new test data`);
    return false;
  }
}

async function setupTestData() {
  console.log('\n=== Setting Up Test Data ===');
  
  try {
    // Create hospital
    const hospitalSlug = `test-hospital-${randomUUID().slice(0, 8)}`;
    testState.hospital = await prisma.hospital.create({
      data: {
        name: 'Test Hospital',
        slug: hospitalSlug,
        config: {
          create: {
            config: {
              triageReassessmentMinutes: 30,
              features: {
                messaging: true,
                alerts: true,
              },
            },
          },
        },
      },
      include: { config: true },
    });
    logSuccess(`Created hospital: ${testState.hospital.name} (ID: ${testState.hospital.id})`);

    // Create hospital user
    testState.user = await prisma.user.create({
      data: {
        email: `test-user-${randomUUID()}@hospital.local`,
        password: 'test-password',
        role: 'NURSE',
        hospitalId: testState.hospital.id,
      },
    });
    logSuccess(`Created user: ${testState.user.email} (ID: ${testState.user.id})`);

    // Create patient
    testState.patient = await prisma.patientProfile.create({
      data: {
        email: `test-patient-${randomUUID()}@patient.local`,
        password: 'test-password',
        firstName: 'Test',
        lastName: 'Patient',
        age: 35,
        gender: 'other',
        preferredLanguage: 'en',
      },
    });
    logSuccess(`Created patient: ${testState.patient.firstName} ${testState.patient.lastName} (ID: ${testState.patient.id})`);

  } catch (error) {
    logError('❌ Failed to setup test data', error);
    throw error;
  }
}

async function testEncounterCreation() {
  console.log('\n=== Testing Encounter Creation (API) ===');
  
  try {
    // Create a test patient if not already exists
    if (!testState.patient) {
      testState.patient = await prisma.patientProfile.create({
        data: {
          email: `test-patient-${randomUUID()}@patient.local`,
          password: 'test-password',
          firstName: 'Test',
          lastName: 'Patient',
          age: 35,
          gender: 'other',
          preferredLanguage: 'en',
        },
      });
      logSuccess(`Created test patient: ${testState.patient.firstName} ${testState.patient.lastName} (ID: ${testState.patient.id})`);
    }
    
    testState.encounter = await request('/encounters', {
      method: 'POST',
      body: JSON.stringify({
        patientId: testState.patient.id,
        hospitalId: testState.hospital.id,
        chiefComplaint: 'Severe headache and dizziness',
        details: 'Symptoms started 3 hours ago, progressively getting worse.',
      }),
    });
    logSuccess(`Created encounter via API: ${testState.encounter.id}`);
    logSuccess(`Status: ${testState.encounter.status}`);
    
    // Verify in database
    const dbEncounter = await prisma.encounter.findUnique({
      where: { id: testState.encounter.id },
      include: { events: true },
    });
    
    if (dbEncounter) {
      logSuccess(`Verified encounter in database`);
      logSuccess(`Found ${dbEncounter.events.length} initial events`);
    } else {
      logError('❌Encounter not found in database', new Error('Database verification failed'));
    }
    
  } catch (error) {
    logError('❌Encounter creation failed', error);
  }
}

async function testEncounterTransitions() {
  console.log('\n=== Testing Encounter State Transitions (API) ===');


  if (!testState.encounter) {
    logWarning('Skipping transitions - no encounter created');
    return;
  }

  const transitions = [
    { path: `/encounters/${testState.encounter.id}/arrived`, label: 'arrived', expectedStatus: 'ADMITTED' },
    { path: `/encounters/${testState.encounter.id}/start-exam`, label: 'start-exam', expectedStatus: 'TRIAGE' },
    { path: `/encounters/${testState.encounter.id}/waiting`, label: 'waiting', expectedStatus: 'WAITING' },
  ];

  for (const transition of transitions) {
    try {
      const updated = await request(transition.path, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      
      if (updated.status === transition.expectedStatus) {
        logSuccess(`Transitioned to ${updated.status} (${transition.label})`);
      } else {
        logWarning(`Expected status ${transition.expectedStatus} but got ${updated.status}`);
      }
      
      await sleep(100);
    } catch (error) {
      logError(`❌Transition ${transition.label} failed`, error);
    }
  }
  
  // Verify timestamps in database
  try {
    const dbEncounter = await prisma.encounter.findUnique({
      where: { id: testState.encounter.id },
    });
    
    if (dbEncounter.arrivedAt) logSuccess(`arrivedAt timestamp set: ${dbEncounter.arrivedAt.toISOString()}`);
    if (dbEncounter.triagedAt) logSuccess(`triagedAt timestamp set: ${dbEncounter.triagedAt.toISOString()}`);
    if (dbEncounter.waitingAt) logSuccess(`waitingAt timestamp set: ${dbEncounter.waitingAt.toISOString()}`);
  } catch (error) {
    logError('❌ Failed to verify timestamps', error);
  }
}

async function testTriageAssessment() {
  console.log('\n=== Testing Triage Assessment (Database) ===');
  
  if (!testState.encounter) {
    logWarning('Skipping triage assessment - no encounter created');
    return;
  }
  
  try {
    const triage = await prisma.triageAssessment.create({
      data: {
        encounterId: testState.encounter.id,
        hospitalId: testState.hospital.id,
        createdByUserId: testState.user.id,
        ctasLevel: 2,
        priorityScore: 85,
        note: 'Patient presents with severe headache, possible migraine. Vital signs stable.',
      },
    });
    logSuccess(`Created triage assessment: ID ${triage.id}`);
    logSuccess(`CTAS Level: ${triage.ctasLevel}, Priority Score: ${triage.priorityScore}`);
    
    // Update encounter with current triage
    await prisma.encounter.update({
      where: { id: testState.encounter.id },
      data: {
        currentTriageId: triage.id,
        currentCtasLevel: triage.ctasLevel,
        currentPriorityScore: triage.priorityScore,
      },
    });
    logSuccess('Linked triage to encounter as current assessment');
    
  } catch (error) {
    logError('❌ Triage assessment creation failed', error);
  }
}

async function testMessaging() {
  console.log('\n=== Testing Messaging System (Database) ===');
  
  if (!testState.encounter) {
    logWarning('Skipping messaging test - no encounter created');
    return;
  }
  
  try {
    // Patient message
    const patientMsg = await prisma.message.create({
      data: {
        encounterId: testState.encounter.id,
        hospitalId: testState.hospital.id,
        senderType: 'PATIENT',
        createdByPatientId: testState.patient.id,
        content: 'My headache is getting worse. How much longer?',
        language: 'en',
      },
    });
    logSuccess(`Created patient message: ID ${patientMsg.id}`);
    
    await sleep(50);
    
    // Staff response
    const staffMsg = await prisma.message.create({
      data: {
        encounterId: testState.encounter.id,
        hospitalId: testState.hospital.id,
        senderType: 'USER',
        createdByUserId: testState.user.id,
        content: 'A doctor will see you shortly. Please remain in the waiting area.',
        language: 'en',
      },
    });
    logSuccess(`Created staff message: ID ${staffMsg.id}`);
    
    // Verify message count
    const messageCount = await prisma.message.count({
      where: { encounterId: testState.encounter.id },
    });
    logSuccess(`Total messages for encounter: ${messageCount}`);
    
  } catch (error) {
    logError('❌ Messaging test failed', error);
  }
}

async function testEventProcessing() {
  console.log('\n=== Testing Event Processing (Database) ===');
  
  if (!testState.encounter) {
    logWarning('Skipping event processing test - no encounter created');
    return;
  }
  
  try {
    await sleep(500);
    
    const events = await prisma.encounterEvent.findMany({
      where: { encounterId: testState.encounter.id },
      orderBy: { createdAt: 'asc' },
    });

    logSuccess(`Found ${events.length} events for encounter:`);
    const eventTypes = {};
    for (const event of events) {
      eventTypes[event.type] = (eventTypes[event.type] || 0) + 1;
      console.log(`    - ${event.type} @ ${event.createdAt.toISOString()} ${event.processedAt ? '(processed)' : '(pending)'}`);
    }
    
    // Summary
    console.log('\n  Event type summary:');
    for (const [type, count] of Object.entries(eventTypes)) {
      console.log(`    ${type}: ${count}`);
    }
    
    // Check for unprocessed events
    const unprocessed = events.filter(e => !e.processedAt);
    if (unprocessed.length > 0) {
      logWarning(`${unprocessed.length} events are still unprocessed`);
    } else {
      logSuccess('All events have been processed');
    }
    
  } catch (error) {
    logError('❌ Event processing test failed', error);
  }
}

async function testAlertGeneration() {
  console.log('\n=== Testing Alert Generation (Database) ===');
  
  try {
    // Create an overdue triage encounter
    const oldPatient = await prisma.patientProfile.create({
      data: {
        email: `overdue-${randomUUID()}@patient.local`,
        password: 'test-password',
        firstName: 'Overdue',
        lastName: 'Patient',
      },
    });
    
    const oldDate = new Date(Date.now() - 45 * 60 * 1000); // 45 minutes ago
    
    const overdueEncounter = await prisma.encounter.create({
      data: {
        patientId: oldPatient.id,
        hospitalId: testState.hospital.id,
        status: 'TRIAGE',
        chiefComplaint: 'Chest pain',
        triagedAt: oldDate,
      },
    });
    logSuccess(`Created overdue encounter for alert test: ID ${overdueEncounter.id}`);
    logSuccess(`Triaged ${Math.round((Date.now() - oldDate.getTime()) / 60000)} minutes ago`);
    
    // Manually create alert (simulating what the job would do)
    const alert = await prisma.alert.create({
      data: {
        encounterId: overdueEncounter.id,
        hospitalId: testState.hospital.id,
        type: 'TRIAGE_REASSESSMENT_OVERDUE',
        severity: 'MEDIUM',
        metadata: { thresholdMinutes: 30 },
      },
    });
    logSuccess(`Created alert: ID ${alert.id}, Type: ${alert.type}, Severity: ${alert.severity}`);
    
    // Test alert acknowledgment
    await prisma.alert.update({
      where: { id: alert.id },
      data: {
        acknowledgedAt: new Date(),
        acknowledgedByUserId: testState.user.id,
      },
    });
    logSuccess(`Alert acknowledged by user ${testState.user.email}`);
    
    // Test alert resolution
    await prisma.alert.update({
      where: { id: alert.id },
      data: {
        resolvedAt: new Date(),
        resolvedByUserId: testState.user.id,
      },
    });
    logSuccess(`Alert resolved by user ${testState.user.email}`);
    
    // Count active alerts
    const activeAlerts = await prisma.alert.count({
      where: {
        hospitalId: testState.hospital.id,
        resolvedAt: null,
      },
    });
    logSuccess(`Active alerts for hospital: ${activeAlerts}`);
    
  } catch (error) {
    logError('❌ Alert generation test failed', error);
  }
}

async function testCompleteTriagePipeline() {
  console.log('\n=== Testing Complete Triage Pipeline ===');
  
  try {
    // Create a new patient for full pipeline
    const pipelinePatient = await prisma.patientProfile.create({
      data: {
        email: `pipeline-${randomUUID()}@patient.local`,
        password: 'test-password',
        firstName: 'Pipeline',
        lastName: 'Test',
        age: 42,
      },
    });
    logSuccess(`Created pipeline patient: ${pipelinePatient.firstName} ${pipelinePatient.lastName}`);
    
    // 1. EXPECTED -> Create encounter
    const pipelineEncounter = await request('/encounters', {
      method: 'POST',
      body: JSON.stringify({
        patientId: pipelinePatient.id,
        hospitalId: testState.hospital.id,
        chiefComplaint: 'Abdominal pain',
        details: 'Sharp pain in lower right abdomen for 6 hours.',
      }),
    });
    logSuccess(`Pipeline Step 1: Encounter created (EXPECTED) - ID ${pipelineEncounter.id}`);
    await sleep(200);
    
    // 2. ADMITTED -> Patient arrives
    await request(`/encounters/${pipelineEncounter.id}/arrived`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    logSuccess('Pipeline Step 2: Patient arrived (ADMITTED)');
    await sleep(200);
    
    // 3. TRIAGE -> Start triage
    await request(`/encounters/${pipelineEncounter.id}/start-exam`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    logSuccess('Pipeline Step 3: Triage started (TRIAGE)');
    await sleep(200);
    
    // Create triage assessment
    const pipelineTriage = await prisma.triageAssessment.create({
      data: {
        encounterId: pipelineEncounter.id,
        hospitalId: testState.hospital.id,
        createdByUserId: testState.user.id,
        ctasLevel: 3,
        priorityScore: 60,
        note: 'Possible appendicitis. Recommend immediate examination.',
      },
    });
    logSuccess(`Pipeline Step 4: Triage assessment completed (CTAS ${pipelineTriage.ctasLevel})`);
    await sleep(200);
    
    // 4. WAITING -> Move to waiting
    await request(`/encounters/${pipelineEncounter.id}/waiting`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    logSuccess('Pipeline Step 5: Patient waiting for doctor (WAITING)');
    await sleep(200);
    
    // 5. Examination (would be EXAMINING but not in current schema)
    // Simulate by adding messages
    await prisma.message.create({
      data: {
        encounterId: pipelineEncounter.id,
        hospitalId: testState.hospital.id,
        senderType: 'SYSTEM',
        content: 'Doctor has begun examination.',
        language: 'en',
      },
    });
    logSuccess('Pipeline Step 6: Doctor examination in progress');
    await sleep(200);
    
    // 6. COMPLETE -> Discharge
    await request(`/encounters/${pipelineEncounter.id}/discharge`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    logSuccess('Pipeline Step 7: Patient discharged (COMPLETE)');
    
    // Verify full pipeline in database
    const finalEncounter = await prisma.encounter.findUnique({
      where: { id: pipelineEncounter.id },
      include: {
        events: true,
        triageAssessments: true,
        messages: true,
      },
    });
    
    console.log('\n  Pipeline Summary:');
    console.log(`    Total Events: ${finalEncounter.events.length}`);
    console.log(`    Total Triage Assessments: ${finalEncounter.triageAssessments.length}`);
    console.log(`    Total Messages: ${finalEncounter.messages.length}`);
    console.log(`    Final Status: ${finalEncounter.status}`);
    console.log(`    Duration: ${Math.round((finalEncounter.departedAt - finalEncounter.expectedAt) / 1000 / 60)} minutes`);
    
  } catch (error) {
    logError('❌ Complete pipeline test failed', error);
  }
}

async function verifyDatabaseState() {
  console.log('\n=== Verifying Database State ===');
  
  try {
    const counts = {
      hospitals: await prisma.hospital.count(),
      users: await prisma.user.count(),
      patients: await prisma.patientProfile.count(),
      encounters: await prisma.encounter.count(),
      triageAssessments: await prisma.triageAssessment.count(),
      messages: await prisma.message.count(),
      events: await prisma.encounterEvent.count(),
      alerts: await prisma.alert.count(),
    };
    
    logSuccess('Database record counts:');
    for (const [table, count] of Object.entries(counts)) {
      console.log(`    ${table}: ${count}`);
    }
    
    // Verify test hospital's data
    const hospitalData = await prisma.hospital.findUnique({
      where: { id: testState.hospital.id },
      include: {
        users: true,
        encounters: {
          include: {
            events: true,
            triageAssessments: true,
            messages: true,
            alerts: true,
          },
        },
      },
    });
    
    logSuccess(`Test hospital has ${hospitalData.encounters.length} encounters`);
    logSuccess(`Total events across all encounters: ${hospitalData.encounters.reduce((sum, e) => sum + e.events.length, 0)}`);
    
  } catch (error) {
    logError('❌ Database verification failed', error);
  }
}

async function cleanupTestData() {
  console.log('\n=== Cleaning Up Test Data ===');
  
  try {
    // Delete in correct order due to foreign keys
    if (testState.hospital) {
      await prisma.alert.deleteMany({ where: { hospitalId: testState.hospital.id } });
      await prisma.message.deleteMany({ where: { hospitalId: testState.hospital.id } });
      await prisma.encounterEvent.deleteMany({ where: { hospitalId: testState.hospital.id } });
      await prisma.triageAssessment.deleteMany({ where: { hospitalId: testState.hospital.id } });
      await prisma.encounter.deleteMany({ where: { hospitalId: testState.hospital.id } });
      await prisma.user.deleteMany({ where: { hospitalId: testState.hospital.id } });
      await prisma.hospitalConfig.deleteMany({ where: { hospitalId: testState.hospital.id } });
      await prisma.hospital.delete({ where: { id: testState.hospital.id } });
      logSuccess('Deleted test hospital and related data');
    }
    
    // Delete test patients (encounters already deleted above)
    const testPatientEmails = [testState.patient?.email].filter(Boolean);
    if (testPatientEmails.length > 0) {
      await prisma.patientProfile.deleteMany({
        where: { email: { in: testPatientEmails } },
      });
      logSuccess('Deleted test patients');
    }
    
  } catch (error) {
    logError('❌ Cleanup failed (you may need to manually clean the database)', error);
  }
}

async function printSummary() {
  console.log('\n' + '='.repeat(70));
  console.log('TEST SUMMARY');
  console.log('='.repeat(70));
  
  if (testState.errors.length === 0 && testState.warnings.length === 0) {
    console.log('\n✓ ALL TESTS PASSED - No errors or warnings\n');
  } else {
    if (testState.errors.length > 0) {
      console.log(`\n✗ ERRORS: ${testState.errors.length}`);
      testState.errors.forEach((err, i) => {
        console.log(`  ${i + 1}. ${err.message}: ${err.error}`);
      });
    }
    
    if (testState.warnings.length > 0) {
      console.log(`\n⚠ WARNINGS: ${testState.warnings.length}`);
      testState.warnings.forEach((warn, i) => {
        console.log(`  ${i + 1}. ${warn}`);
      });
    }
    console.log();
  }
  
  console.log('='.repeat(70) + '\n');
}

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('PRIAGE BACKEND SMOKE TEST');
  console.log('='.repeat(70));
  console.log(`API Base URL: ${baseUrl}`);
  console.log(`Database: ${process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@')}`);
  console.log('='.repeat(70));

  try {
    // Try to authenticate with existing user first
    const authenticated = await setupAuthentication();
    
    // If no existing user, create test data
    if (!authenticated) {
      await setupTestData();
    }
    
    await testEncounterCreation();
    await testEncounterTransitions();
    await testTriageAssessment();
    await testMessaging();
    await testEventProcessing();
    await testAlertGeneration();
    await testCompleteTriagePipeline();
    await verifyDatabaseState();
    
  } catch (error) {
    console.error('\n!!! FATAL ERROR - Test suite aborted !!!');
    console.error(error);
  } finally {
    await cleanupTestData();
    await printSummary();
  }
}

main()
  .catch((error) => {
    console.error('\nUnhandled error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
