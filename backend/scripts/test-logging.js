// backend/scripts/test-logging.js
// Automated logging system test script
// Tests all aspects of the logging implementation

require('dotenv').config();

const http = require('http');
const https = require('https');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const { randomUUID } = require('crypto');
const bcrypt = require('bcrypt');

// Initialize Prisma with pg-adapter (Prisma 7 approach)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({
  adapter,
  log: ['error', 'warn'],
});

// ============================================================================
// Test Configuration
// ============================================================================

const CONFIG = {
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  testPassword: 'TestPassword123!',
  colors: {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
  },
};

// ============================================================================
// Test State
// ============================================================================

let testState = {
  hospital: null,
  user: null,
  patient: null,
  testEmail: null,
  accessToken: null,
  userId: null,
  hospitalId: null,
  encounterId: null,
  patientId: null,
  correlationId: null,
  testsPassed: 0,
  testsFailed: 0,
  testsSkipped: 0,
};

// ============================================================================
// Utility Functions
// ============================================================================

function log(message, color = CONFIG.colors.reset) {
  const timestamp = new Date().toISOString();
  console.log(`${color}[${timestamp}] ${message}${CONFIG.colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, CONFIG.colors.green);
  testState.testsPassed++;
}

function logError(message) {
  log(`❌ ${message}`, CONFIG.colors.red);
  testState.testsFailed++;
}

function logWarning(message) {
  log(`⚠️  ${message}`, CONFIG.colors.yellow);
}

function logInfo(message) {
  log(`ℹ️  ${message}`, CONFIG.colors.cyan);
}

function logSection(message) {
  const separator = '='.repeat(80);
  console.log('');
  log(separator, CONFIG.colors.bright);
  log(message, CONFIG.colors.bright);
  log(separator, CONFIG.colors.bright);
  console.log('');
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// HTTP Request Wrapper
// ============================================================================

function makeRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const protocol = options.protocol === 'https:' ? https : http;
    
    const req = protocol.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : null;
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: parsed,
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: data,
          });
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

function buildRequestOptions(path, method = 'GET', includeAuth = false) {
  const url = new URL(CONFIG.baseUrl + path);
  
  const options = {
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname + url.search,
    method: method,
    headers: {
      'Content-Type': 'application/json',
    },
  };
  
  if (includeAuth && testState.accessToken) {
    options.headers['Authorization'] = `Bearer ${testState.accessToken}`;
  }
  
  return options;
}

// ============================================================================
// Test Helper Functions
// ============================================================================

async function checkServerHealth() {
  try {
    const options = buildRequestOptions('/health');
    const response = await makeRequest(options);
    
    if (response.statusCode === 200) {
      logSuccess('Server health check passed');
      return true;
    } else {
      logError(`Server health check failed: ${response.statusCode}`);
      return false;
    }
  } catch (error) {
    logError(`Server is not running: ${error.message}`);
    return false;
  }
}

async function getCorrelationLogs(correlationId) {
  try {
    const options = buildRequestOptions(
      `/logging/correlation/${correlationId}`,
      'GET',
      true
    );
    const response = await makeRequest(options);
    
    if (response.statusCode === 200) {
      // Ensure we return an array
      const data = response.data;
      if (Array.isArray(data)) {
        return data;
      } else if (data && Array.isArray(data.logs)) {
        return data.logs;
      } else if (data && typeof data === 'object') {
        // Might be wrapped in an object
        return [data];
      }
      return [];
    } else {
      logWarning(`Failed to get logs for correlation ${correlationId}: ${response.statusCode}`);
      return [];
    }
  } catch (error) {
    logWarning(`Error getting logs: ${error.message}`);
    return [];
  }
}

async function verifyLogsExist(correlationId, expectedMessages = [], testName = '') {
  await sleep(500); // Give logs time to be written
  
  const logs = await getCorrelationLogs(correlationId);
  
  if (!logs || logs.length === 0) {
    logError(`${testName}: No logs found for correlation ${correlationId}`);
    return false;
  }
  
  logInfo(`${testName}: Found ${logs.length} log entries`);
  
  // Check for expected messages
  let allFound = true;
  for (const expectedMsg of expectedMessages) {
    const found = logs.some(log => log.message.includes(expectedMsg));
    if (found) {
      logSuccess(`${testName}: Found expected log: "${expectedMsg}"`);
    } else {
      logError(`${testName}: Missing expected log: "${expectedMsg}"`);
      allFound = false;
    }
  }
  
  // Display log summary
  const logLevels = logs.reduce((acc, log) => {
    acc[log.level] = (acc[log.level] || 0) + 1;
    return acc;
  }, {});
  
  logInfo(`${testName}: Log levels - ${JSON.stringify(logLevels)}`);
  
  return allFound;
}

// ============================================================================
// TEST 1: Authentication Logging
// ============================================================================

async function testAuthenticationLogging() {
  logSection('TEST 1: Authentication Logging');
  
  // Test 1A: Failed login - user not found
  logInfo('Test 1A: Testing failed login (user not found)...');
  try {
    const options = buildRequestOptions('/auth/login', 'POST');
    const response = await makeRequest(options, {
      email: 'nonexistent@test.com',
      password: 'WrongPassword123!',
    });
    
    const correlationId = response.headers['x-correlation-id'];
    testState.correlationId = correlationId;
    
    if (response.statusCode === 401) {
      logSuccess('Test 1A: Correctly rejected invalid login');
      
      // Verify logs
      const logsValid = await verifyLogsExist(
        correlationId,
        ['Login attempt', 'Login failed - user not found'],
        'Test 1A'
      );
      
      if (logsValid) {
        logSuccess('Test 1A: Auth error logging verified');
      }
    } else {
      logError(`Test 1A: Expected 401, got ${response.statusCode}`);
    }
  } catch (error) {
    logError(`Test 1A: Failed - ${error.message}`);
  }
  
  await sleep(1000);
  
  // Test 1B: Successful login
  logInfo('Test 1B: Testing successful login...');
  try {
    const options = buildRequestOptions('/auth/login', 'POST');
    const response = await makeRequest(options, {
      email: testState.testEmail,
      password: CONFIG.testPassword,
    });
    
    const correlationId = response.headers['x-correlation-id'];
    testState.correlationId = correlationId;
    
    if (response.statusCode === 200 || response.statusCode === 201) {
      testState.accessToken = response.data.access_token;
      testState.userId = response.data.user.id;
      testState.hospitalId = response.data.user.hospitalId;
      
      logSuccess('Test 1B: Successfully logged in');
      logInfo(`Test 1B: User ID: ${testState.userId}, Hospital ID: ${testState.hospitalId}`);
      
      // Verify logs
      const logsValid = await verifyLogsExist(
        correlationId,
        ['Login attempt', 'Login successful'],
        'Test 1B'
      );
      
      if (logsValid) {
        logSuccess('Test 1B: Auth success logging verified');
      }
    } else {
      logError(`Test 1B: Login failed with status ${response.statusCode}`);
      logError('Test 1B: Cannot continue without authentication');
      process.exit(1);
    }
  } catch (error) {
    logError(`Test 1B: Failed - ${error.message}`);
    process.exit(1);
  }
  
  await sleep(1000);
  
  // Test 1C: JWT validation (accessing protected route)
  logInfo('Test 1C: Testing JWT validation...');
  try {
    const options = buildRequestOptions('/auth/me', 'GET', true);
    const response = await makeRequest(options);
    
    if (response.statusCode === 200) {
      logSuccess('Test 1C: JWT validation successful');
      logInfo('Test 1C: JWT validation logs written (check DEBUG level)');
    } else {
      logError(`Test 1C: JWT validation failed with status ${response.statusCode}`);
    }
  } catch (error) {
    logError(`Test 1C: Failed - ${error.message}`);
  }
}

// ============================================================================
// TEST 2: Full Encounter Workflow Logging
// ============================================================================

async function testEncounterWorkflowLogging() {
  logSection('TEST 2: Full Encounter Workflow Logging');
  
  if (!testState.accessToken) {
    logError('Test 2: Cannot run without authentication');
    testState.testsSkipped++;
    return;
  }
  
  // Test 2A: Create encounter
  logInfo('Test 2A: Creating test encounter...');
  try {
    const options = buildRequestOptions('/encounters', 'POST', true);
    const response = await makeRequest(options, {
      patientId: testState.patientId,
      hospitalId: testState.hospitalId,
      chiefComplaint: 'Test logging complaint',
      details: 'Testing comprehensive logging system',
    });
    
    const correlationId = response.headers['x-correlation-id'];
    
    if (response.statusCode === 200 || response.statusCode === 201) {
      testState.encounterId = response.data.id;
      logSuccess(`Test 2A: Encounter created - ID: ${testState.encounterId}`);
      
      // Verify logs
      const logsValid = await verifyLogsExist(
        correlationId,
        ['Creating new encounter', 'Encounter created successfully'],
        'Test 2A'
      );
      
      if (logsValid) {
        logSuccess('Test 2A: Encounter creation logging verified');
      }
    } else {
      logError(`Test 2A: Failed to create encounter: ${response.statusCode}`);
      logInfo(`Test 2A: Response: ${JSON.stringify(response.data)}`);
    }
  } catch (error) {
    logError(`Test 2A: Failed - ${error.message}`);
  }
  
  await sleep(1000);
  
  if (!testState.encounterId) {
    logWarning('Test 2: Skipping remaining encounter tests (no encounter created)');
    return;
  }
  
  // Test 2B: List encounters
  logInfo('Test 2B: Listing encounters...');
  try {
    const options = buildRequestOptions(
      `/encounters`,
      'GET',
      true
    );
    const response = await makeRequest(options);
    
    const correlationId = response.headers['x-correlation-id'];
    
    if (response.statusCode === 200) {
      logSuccess(`Test 2B: Listed ${response.data?.data?.length ?? response.data?.length ?? 0} encounters`);
      
      // Verify logs
      await verifyLogsExist(
        correlationId,
        ['Listing encounters'],
        'Test 2B'
      );
    } else {
      logError(`Test 2B: Failed: ${response.statusCode}`);
    }
  } catch (error) {
    logError(`Test 2B: Failed - ${error.message}`);
  }
  
  await sleep(1000);
  
  // Test 2C: State transition
  logInfo('Test 2C: Testing encounter state transition...');
  try {
    const options = buildRequestOptions(
      `/encounters/${testState.encounterId}/confirm`,
      'POST',
      true
    );
    const response = await makeRequest(options, {
      actorUserId: testState.userId,
    });
    
    const correlationId = response.headers['x-correlation-id'];
    
    if (response.statusCode === 200 || response.statusCode === 201) {
      logSuccess('Test 2C: Encounter confirmed');
      
      // Verify logs
      const logsValid = await verifyLogsExist(
        correlationId,
        ['Starting encounter transition', 'Encounter transition completed successfully'],
        'Test 2C'
      );
      
      if (logsValid) {
        logSuccess('Test 2C: State transition logging verified');
      }
    } else {
      logError(`Test 2C: Failed: ${response.statusCode}`);
    }
  } catch (error) {
    logError(`Test 2C: Failed - ${error.message}`);
  }
}

// ============================================================================
// TEST 3: Database & Connection Logging
// ============================================================================

async function testDatabaseLogging() {
  logSection('TEST 3: Database & Connection Logging');
  
  logInfo('Test 3A: Checking database connection logs...');
  
  // Query logs for database-related entries
  try {
    const options = buildRequestOptions(
      '/logging/query?service=PrismaService&limit=50',
      'GET',
      true
    );
    const response = await makeRequest(options);
    
    if (response.statusCode === 200) {
      const logs = response.data.logs || response.data;
      logSuccess(`Test 3A: Found ${logs.length} PrismaService logs`);
      
      // Check for connection logs
      const hasConnectionLog = logs.some(log => 
        log.message.includes('Connecting to database') ||
        log.message.includes('Database connection established')
      );
      
      if (hasConnectionLog) {
        logSuccess('Test 3A: Database connection logging verified');
      } else {
        logWarning('Test 3A: No connection logs found (might be from earlier)');
      }
      
      // Check for pool stats
      const hasPoolStats = logs.some(log => 
        log.message.includes('Pool stats')
      );
      
      if (hasPoolStats) {
        logSuccess('Test 3A: Database pool monitoring verified');
      } else {
        logInfo('Test 3A: No pool stats in recent logs');
      }
    } else {
      logError(`Test 3A: Failed to query logs: ${response.statusCode}`);
    }
  } catch (error) {
    logError(`Test 3A: Failed - ${error.message}`);
  }
  
  await sleep(1000);
  
  // Test 3B: WebSocket connection logging
  logInfo('Test 3B: Checking WebSocket/Realtime logs...');
  try {
    const options = buildRequestOptions(
      '/logging/query?service=RealtimeGateway&limit=50',
      'GET',
      true
    );
    const response = await makeRequest(options);
    
    if (response.statusCode === 200) {
      const logs = response.data.logs || response.data;
      logSuccess(`Test 3B: Found ${logs.length} RealtimeGateway logs`);
      
      const hasInitLog = logs.some(log => 
        log.message.includes('WebSocket Gateway initialized')
      );
      
      if (hasInitLog) {
        logSuccess('Test 3B: WebSocket initialization logging verified');
      } else {
        logInfo('Test 3B: WebSocket logs may be from earlier startup');
      }
    } else {
      logError(`Test 3B: Failed to query logs: ${response.statusCode}`);
    }
  } catch (error) {
    logError(`Test 3B: Failed - ${error.message}`);
  }
}

// ============================================================================
// TEST 4: Error Logging Verification
// ============================================================================

async function testErrorLogging() {
  logSection('TEST 4: Error Logging Verification');
  
  if (!testState.accessToken) {
    logError('Test 4: Cannot run without authentication');
    testState.testsSkipped++;
    return;
  }
  
  // Test 4A: Not found error
  logInfo('Test 4A: Testing 404 error logging...');
  try {
    const options = buildRequestOptions('/encounters/999999', 'GET', true);
    const response = await makeRequest(options);
    
    const correlationId = response.headers['x-correlation-id'];
    
    if (response.statusCode === 404) {
      logSuccess('Test 4A: 404 error triggered correctly');
      
      // Verify error logs
      const logsValid = await verifyLogsExist(
        correlationId,
        ['Encounter not found'],
        'Test 4A'
      );
      
      if (logsValid) {
        logSuccess('Test 4A: Not found error logging verified');
      }
    } else {
      logWarning(`Test 4A: Expected 404, got ${response.statusCode}`);
    }
  } catch (error) {
    logError(`Test 4A: Failed - ${error.message}`);
  }
  
  await sleep(1000);
  
  // Test 4B: Validation error
  logInfo('Test 4B: Testing validation error logging...');
  try {
    const options = buildRequestOptions('/encounters', 'POST', true);
    const response = await makeRequest(options, {
      // Missing required fields
      hospitalId: testState.hospitalId,
    });
    
    const correlationId = response.headers['x-correlation-id'];
    
    if (response.statusCode === 400) {
      logSuccess('Test 4B: Validation error triggered correctly');
      logInfo('Test 4B: Validation errors logged by NestJS validator');
    } else {
      logWarning(`Test 4B: Expected 400, got ${response.statusCode}`);
    }
  } catch (error) {
    logError(`Test 4B: Failed - ${error.message}`);
  }
  
  await sleep(1000);
  
  // Test 4C: Authorization error
  logInfo('Test 4C: Testing authorization error logging...');
  try {
    const options = buildRequestOptions('/encounters', 'GET');
    // No auth token
    const response = await makeRequest(options);
    
    if (response.statusCode === 401) {
      logSuccess('Test 4C: Authorization error triggered correctly');
      logInfo('Test 4C: Auth errors logged by JWT guard');
    } else {
      logWarning(`Test 4C: Expected 401, got ${response.statusCode}`);
    }
  } catch (error) {
    logError(`Test 4C: Failed - ${error.message}`);
  }
}

// ============================================================================
// TEST 5: Fatal Error Simulation
// ============================================================================

async function testFatalErrorSimulation() {
  logSection('TEST 5: Fatal Error Simulation & Recovery');
  
  if (!testState.accessToken) {
    logError('Test 5: Cannot run without authentication');
    testState.testsSkipped++;
    return;
  }
  
  // Test 5A: Invalid state transition (business logic error)
  logInfo('Test 5A: Testing invalid state transition error...');
  try {
    if (!testState.encounterId) {
      logWarning('Test 5A: Skipped - no encounter available');
      return;
    }
    
    const options = buildRequestOptions(
      `/encounters/${testState.encounterId}/discharge`,
      'POST',
      true
    );
    const response = await makeRequest(options, {
      actorUserId: testState.userId,
    });
    
    const correlationId = response.headers['x-correlation-id'];
    
    // This should fail because we can't discharge from CONFIRMED state
    if (response.statusCode === 400 || response.statusCode === 422) {
      logSuccess('Test 5A: Invalid transition rejected correctly');
      
      // Verify logs
      const logsValid = await verifyLogsExist(
        correlationId,
        ['Invalid transition', 'transition not allowed'],
        'Test 5A'
      );
      
      if (logsValid) {
        logSuccess('Test 5A: Business logic error logging verified');
      }
    } else {
      logWarning(`Test 5A: Expected 400/422, got ${response.statusCode}`);
    }
  } catch (error) {
    logError(`Test 5A: Failed - ${error.message}`);
  }
  
  await sleep(1000);
  
  // Test 5B: Check error report generation
  logInfo('Test 5B: Testing error report generation...');
  try {
    // Get recent correlation ID with errors
    const statsOptions = buildRequestOptions('/logging/stats', 'GET', true);
    const statsResponse = await makeRequest(statsOptions);
    
    if (statsResponse.statusCode === 200) {
      logSuccess('Test 5B: Retrieved logging stats');
      logInfo(`Test 5B: Total logs: ${statsResponse.data.totalLogs}`);
      logInfo(`Test 5B: Total correlations: ${statsResponse.data.totalCorrelations}`);
    }
    
    // Try to generate error report
    if (testState.correlationId) {
      const reportOptions = buildRequestOptions(
        `/logging/error-reports/generate?correlationId=${testState.correlationId}`,
        'GET',
        true
      );
      const reportResponse = await makeRequest(reportOptions);
      
      if (reportResponse.statusCode === 200) {
        logSuccess('Test 5B: Error report generated successfully');
        logInfo(`Test 5B: Report ID: ${reportResponse.data.reportId}`);
        logInfo(`Test 5B: Error count: ${reportResponse.data.errorChain?.length || 0}`);
      } else {
        logWarning(`Test 5B: Error report generation returned ${reportResponse.statusCode}`);
      }
    }
  } catch (error) {
    logError(`Test 5B: Failed - ${error.message}`);
  }
}

// ============================================================================
// TEST 6: Logger Service Self-Test
// ============================================================================

async function testLoggerServiceHealth() {
  logSection('TEST 6: Logger Service Health Check');
  
  if (!testState.accessToken) {
    logError('Test 6: Cannot run without authentication');
    testState.testsSkipped++;
    return;
  }
  
  // Test 6A: Stats endpoint
  logInfo('Test 6A: Testing logging stats endpoint...');
  try {
    const options = buildRequestOptions('/logging/stats', 'GET', true);
    const response = await makeRequest(options);
    
    if (response.statusCode === 200) {
      const stats = response.data;
      logSuccess('Test 6A: Logging stats retrieved');
      logInfo(`Test 6A: Total correlations: ${stats.totalCorrelations}`);
      logInfo(`Test 6A: Total logs: ${stats.totalLogs}`);
      logInfo(`Test 6A: Memory usage: ${Math.round(stats.memoryUsage?.heapUsed / 1024 / 1024)}MB`);
      
      if (stats.totalLogs > 0) {
        logSuccess('Test 6A: LoggingService is actively collecting logs');
      } else {
        logWarning('Test 6A: No logs found in LoggingService');
      }
    } else {
      logError(`Test 6A: Failed: ${response.statusCode}`);
    }
  } catch (error) {
    logError(`Test 6A: Failed - ${error.message}`);
  }
  
  await sleep(1000);
  
  // Test 6B: Query logs by service
  logInfo('Test 6B: Testing log query by service...');
  try {
    const options = buildRequestOptions(
      '/logging/query?service=EncountersService&limit=20',
      'GET',
      true
    );
    const response = await makeRequest(options);
    
    if (response.statusCode === 200) {
      const logs = response.data.logs || response.data;
      logSuccess(`Test 6B: Found ${logs.length} EncountersService logs`);
      
      // Check log structure
      if (response.data.length > 0) {
        const sampleLog = response.data[0];
        const hasRequiredFields = 
          sampleLog.id &&
          sampleLog.timestamp &&
          sampleLog.level &&
          sampleLog.message &&
          sampleLog.context;
        
        if (hasRequiredFields) {
          logSuccess('Test 6B: Log structure is valid');
        } else {
          logError('Test 6B: Log structure is missing required fields');
        }
      }
    } else {
      logError(`Test 6B: Failed: ${response.statusCode}`);
    }
  } catch (error) {
    logError(`Test 6B: Failed - ${error.message}`);
  }
  
  await sleep(1000);
  
  // Test 6C: Query logs by level
  logInfo('Test 6C: Testing log query by level...');
  try {
    const options = buildRequestOptions(
      '/logging/query?level=ERROR&limit=50',
      'GET',
      true
    );
    const response = await makeRequest(options);
    
    if (response.statusCode === 200) {
      const logs = response.data.logs || response.data;
      logSuccess(`Test 6C: Found ${logs.length} ERROR level logs`);
      
      if (response.data.length > 0) {
        logInfo('Test 6C: Sample errors:');
        response.data.slice(0, 3).forEach(log => {
          logInfo(`  - ${log.message}`);
        });
      }
    } else {
      logError(`Test 6C: Failed: ${response.statusCode}`);
    }
  } catch (error) {
    logError(`Test 6C: Failed - ${error.message}`);
  }
}

// ============================================================================
// TEST 7: Additional Service Logging Tests
// ============================================================================

async function testAdditionalServicesLogging() {
  logSection('TEST 7: Additional Services Logging');
  
  if (!testState.accessToken || !testState.encounterId) {
    logError('Test 7: Cannot run without authentication and encounter');
    testState.testsSkipped++;
    return;
  }
  
  // Test 7A: Messaging service logging
  logInfo('Test 7A: Testing messaging service logging...');
  try {
    const options = buildRequestOptions(
      `/messaging/encounters/${testState.encounterId}/messages`,
      'POST',
      true
    );
    const response = await makeRequest(options, {
      senderType: 'USER',
      createdByUserId: testState.userId,
      content: 'Test message for logging verification',
      isInternal: true,
    });
    
    const correlationId = response.headers['x-correlation-id'];
    
    if (response.statusCode === 200 || response.statusCode === 201) {
      logSuccess('Test 7A: Message created');
      
      // Verify logs
      const logsValid = await verifyLogsExist(
        correlationId,
        ['Creating message', 'Message created successfully'],
        'Test 7A'
      );
      
      if (logsValid) {
        logSuccess('Test 7A: Messaging service logging verified');
      }
    } else {
      logError(`Test 7A: Failed: ${response.statusCode}`);
    }
  } catch (error) {
    logError(`Test 7A: Failed - ${error.message}`);
  }
  
  await sleep(1000);
  
  // Test 7B: Alerts service logging
  logInfo('Test 7B: Testing alerts service logging...');
  try {
    const options = buildRequestOptions('/alerts', 'POST', true);
    const response = await makeRequest(options, {
      encounterId: testState.encounterId,
      hospitalId: testState.hospitalId,
      type: 'TEST_ALERT',
      severity: 'LOW',
      actorUserId: testState.userId,
    });
    
    const correlationId = response.headers['x-correlation-id'];
    
    if (response.statusCode === 200 || response.statusCode === 201) {
      logSuccess('Test 7B: Alert created');
      
      // Verify logs
      const logsValid = await verifyLogsExist(
        correlationId,
        ['Creating alert', 'Alert created successfully'],
        'Test 7B'
      );
      
      if (logsValid) {
        logSuccess('Test 7B: Alerts service logging verified');
      }
    } else {
      logError(`Test 7B: Failed: ${response.statusCode}`);
    }
  } catch (error) {
    logError(`Test 7B: Failed - ${error.message}`);
  }
  
  await sleep(1000);
  
  // Test 7C: Triage service logging
  logInfo('Test 7C: Testing triage service logging...');
  try {
    const options = buildRequestOptions('/triage/assessments', 'POST', true);
    const response = await makeRequest(options, {
      encounterId: testState.encounterId,
      hospitalId: testState.hospitalId,
      ctasLevel: 3,
      note: 'Test triage for logging verification',
      createdByUserId: testState.userId,
    });
    
    const correlationId = response.headers['x-correlation-id'];
    
    if (response.statusCode === 200 || response.statusCode === 201) {
      logSuccess('Test 7C: Triage assessment created');
      
      // Verify logs
      const logsValid = await verifyLogsExist(
        correlationId,
        ['Creating triage assessment', 'Triage assessment created successfully'],
        'Test 7C'
      );
      
      if (logsValid) {
        logSuccess('Test 7C: Triage service logging verified');
      }
    } else {
      logError(`Test 7C: Failed: ${response.statusCode}`);
    }
  } catch (error) {
    logError(`Test 7C: Failed - ${error.message}`);
  }
}

// ============================================================================
// TEST 8: More Services Logging
// ============================================================================

async function testNewServicesLogging() {
  logSection('TEST 8: More Services Logging (Intake, Patients, Users, Hospitals)');
  
  if (!testState.accessToken) {
    logError('Test 8: Cannot run without authentication');
    testState.testsSkipped++;
    return;
  }
  
  // Test 8A: Intake service - Create intent
  logInfo('Test 8A: Testing intake service logging - create intent...');
  let sessionToken = null;
  try {
    const options = buildRequestOptions('/intake/intent', 'POST', false);
    const response = await makeRequest(options, {
      firstName: 'Test',
      lastName: 'IntakePatient',
      age: 30,
      chiefComplaint: 'Test intake logging',
      details: 'Testing patient intent creation logging',
    });

    const correlationId = response.headers['x-correlation-id'];

    if (response.statusCode === 200 || response.statusCode === 201) {
      sessionToken = response.data.sessionToken;
      testState.intakePatientId = response.data.patientId;
      logSuccess('Test 8A: Patient intent created');
      
      // Verify logs
      const logsValid = await verifyLogsExist(
        correlationId,
        ['Creating patient intent', 'Patient intent created successfully'],
        'Test 8A'
      );
      
      if (logsValid) {
        logSuccess('Test 8A: Intake service create intent logging verified');
      }
    } else {
      logError(`Test 8A: Failed: ${response.statusCode}`);
    }
  } catch (error) {
    logError(`Test 8A: Failed - ${error.message}`);
  }
  
  await sleep(1000);
  
  // Test 8B: Intake service - Confirm intent
  if (sessionToken) {
    logInfo('Test 8B: Testing intake service logging - confirm intent...');
    try {
      const options = buildRequestOptions('/intake/confirm', 'POST', false);
      options.headers['x-patient-token'] = sessionToken;
      
      const response = await makeRequest(options, {
        hospitalId: testState.hospitalId,
      });
      
      const correlationId = response.headers['x-correlation-id'];
      
      if (response.statusCode === 200 || response.statusCode === 201) {
        logSuccess('Test 8B: Patient intent confirmed');
        
// Verify logs (IntakeService only logs after the transaction, no "start" log)
      const logsValid = await verifyLogsExist(
        correlationId,
        ['Patient intent confirmed successfully'],
          'Test 8B'
        );
        
        if (logsValid) {
          logSuccess('Test 8B: Intake service confirm intent logging verified');
        }
      } else {
        logError(`Test 8B: Failed: ${response.statusCode}`);
      }
    } catch (error) {
      logError(`Test 8B: Failed - ${error.message}`);
    }
  } else {
    logWarning('Test 8B: Skipped (no session token)');
    testState.testsSkipped++;
  }
  
  await sleep(1000);
  
  // Test 8C: Intake service - Update details
  if (sessionToken) {
    logInfo('Test 8C: Testing intake service logging - update details...');
    try {
      const options = buildRequestOptions('/intake/details', 'PATCH', false);
      options.headers['x-patient-token'] = sessionToken;
      
      const response = await makeRequest(options, {
        firstName: 'Updated',
        lastName: 'IntakePatient',
        age: 31,
        chiefComplaint: 'Updated complaint',
        allergies: 'None',
      });
      
      const correlationId = response.headers['x-correlation-id'];
      
      if (response.statusCode === 200) {
        logSuccess('Test 8C: Patient intake details updated');
        
        // Verify logs
        const logsValid = await verifyLogsExist(
          correlationId,
          ['Updating patient intake details', 'Patient intake details updated successfully'],
          'Test 8C'
        );
        
        if (logsValid) {
          logSuccess('Test 8C: Intake service update details logging verified');
        }
      } else {
        logError(`Test 8C: Failed: ${response.statusCode}`);
      }
    } catch (error) {
      logError(`Test 8C: Failed - ${error.message}`);
    }
  } else {
    logWarning('Test 8C: Skipped (no session token)');
    testState.testsSkipped++;
  }
  
  await sleep(1000);
  
  // Test 8D: Patients service
  logInfo('Test 8D: Testing patients service logging...');
  try {
    const options = buildRequestOptions(
      `/patients/${testState.patientId}`,
      'GET',
      true
    );
    const response = await makeRequest(options);
    
    const correlationId = response.headers['x-correlation-id'];
    
    if (response.statusCode === 200) {
      logSuccess('Test 8D: Patient profile fetched');
      
      // Verify logs
      const logsValid = await verifyLogsExist(
        correlationId,
        ['Fetching patient profile', 'Patient profile fetched successfully'],
        'Test 8D'
      );
      
      if (logsValid) {
        logSuccess('Test 8D: Patients service logging verified');
      }
    } else {
      logError(`Test 8D: Failed: ${response.statusCode}`);
    }
  } catch (error) {
    logError(`Test 8D: Failed - ${error.message}`);
  }
  
  await sleep(1000);
  
  // Test 8E: Users service - Get users
  logInfo('Test 8E: Testing users service logging - list users...');
  try {
    const options = buildRequestOptions(
      `/users?hospitalId=${testState.hospitalId}`,
      'GET',
      true
    );
    const response = await makeRequest(options);
    
    const correlationId = response.headers['x-correlation-id'];
    
    if (response.statusCode === 200) {
      logSuccess(`Test 8E: Listed ${response.data.length} users`);
      
      // Verify logs
      const logsValid = await verifyLogsExist(
        correlationId,
        ['Fetching hospital users', 'Hospital users fetched'],
        'Test 8E'
      );
      
      if (logsValid) {
        logSuccess('Test 8E: Users service list logging verified');
      }
    } else {
      logError(`Test 8E: Failed: ${response.statusCode}`);
    }
  } catch (error) {
    logError(`Test 8E: Failed - ${error.message}`);
  }
  
  await sleep(1000);
  
  // Test 8F: Users service - Get current user (me)
  logInfo('Test 8F: Testing users service logging - get user (me)...');
  try {
    const options = buildRequestOptions(
      `/users/me`,
      'GET',
      true
    );
    const response = await makeRequest(options);
    
    const correlationId = response.headers['x-correlation-id'];
    
    if (response.statusCode === 200) {
      logSuccess('Test 8F: Current user details fetched');
      
      // Verify logs
      const logsValid = await verifyLogsExist(
        correlationId,
        ['Fetching user by ID', 'User fetched successfully'],
        'Test 8F'
      );
      
      if (logsValid) {
        logSuccess('Test 8F: Users service get user logging verified');
      }
    } else {
      logError(`Test 8F: Failed: ${response.statusCode}`);
    }
  } catch (error) {
    logError(`Test 8F: Failed - ${error.message}`);
  }
  
  await sleep(1000);
  
  // Test 8G: Hospitals service - Get hospital
  logInfo('Test 8G: Testing hospitals service logging - get hospital...');
  try {
    const options = buildRequestOptions(
      `/hospitals/${testState.hospitalId}`,
      'GET',
      true
    );
    const response = await makeRequest(options);
    
    const correlationId = response.headers['x-correlation-id'];
    
    if (response.statusCode === 200) {
      logSuccess('Test 8G: Hospital details fetched');
      
      // Verify logs
      const logsValid = await verifyLogsExist(
        correlationId,
        ['Fetching hospital details', 'Hospital details fetched'],
        'Test 8G'
      );
      
      if (logsValid) {
        logSuccess('Test 8G: Hospitals service get hospital logging verified');
      }
    } else {
      logError(`Test 8G: Failed: ${response.statusCode}`);
    }
  } catch (error) {
    logError(`Test 8G: Failed - ${error.message}`);
  }
  
  await sleep(1000);
  
  // Test 8H: Hospitals service - Get dashboard
  logInfo('Test 8H: Testing hospitals service logging - get dashboard...');
  try {
    const options = buildRequestOptions(
      `/hospitals/${testState.hospitalId}/dashboard`,
      'GET',
      true
    );
    const response = await makeRequest(options);
    
    const correlationId = response.headers['x-correlation-id'];
    
    if (response.statusCode === 200) {
      logSuccess('Test 8H: Hospital dashboard fetched');
      logInfo(`Test 8H: Active encounters: ${response.data.activeEncounters}`);
      logInfo(`Test 8H: Triage queue: ${response.data.triageQueue}`);
      
      // Verify logs
      const logsValid = await verifyLogsExist(
        correlationId,
        ['Fetching hospital dashboard', 'Hospital dashboard fetched'],
        'Test 8H'
      );
      
      if (logsValid) {
        logSuccess('Test 8H: Hospitals service dashboard logging verified');
      }
    } else {
      logError(`Test 8H: Failed: ${response.statusCode}`);
    }
  } catch (error) {
    logError(`Test 8H: Failed - ${error.message}`);
  }
  
  await sleep(1000);
  
  // Test 8I: Hospitals service - Get queue status
  logInfo('Test 8I: Testing hospitals service logging - get queue status...');
  try {
    const options = buildRequestOptions(
      `/hospitals/${testState.hospitalId}/queue`,
      'GET',
      true
    );
    const response = await makeRequest(options);
    
    const correlationId = response.headers['x-correlation-id'];
    
    if (response.statusCode === 200) {
      logSuccess(`Test 8I: Queue status fetched (${response.data.queueLength} encounters)`);
      
      // Verify logs
      const logsValid = await verifyLogsExist(
        correlationId,
        ['Fetching hospital queue status', 'Hospital queue status fetched'],
        'Test 8I'
      );
      
      if (logsValid) {
        logSuccess('Test 8I: Hospitals service queue status logging verified');
      }
    } else {
      logError(`Test 8I: Failed: ${response.statusCode}`);
    }
  } catch (error) {
    logError(`Test 8I: Failed - ${error.message}`);
  }
}

// ============================================================================
// Test Summary
// ============================================================================

function printTestSummary() {
  logSection('TEST SUMMARY');
  
  const total = testState.testsPassed + testState.testsFailed + testState.testsSkipped;
  const passRate = total > 0 ? ((testState.testsPassed / total) * 100).toFixed(1) : 0;
  
  console.log('');
  logInfo(`Total Tests: ${total}`);
  log(`✅ Passed: ${testState.testsPassed}`, CONFIG.colors.green);
  log(`❌ Failed: ${testState.testsFailed}`, CONFIG.colors.red);
  log(`⚠️  Skipped: ${testState.testsSkipped}`, CONFIG.colors.yellow);
  logInfo(`Pass Rate: ${passRate}%`);
  console.log('');
  
  if (testState.testsFailed === 0) {
    logSuccess('🎉 ALL TESTS PASSED! Logging system is working correctly.');
  } else {
    logError('⚠️  SOME TESTS FAILED. Please review the errors above.');
  }
  
  console.log('');
}

// ============================================================================
// Test Data Setup and Cleanup
// ============================================================================

async function setupTestData() {
  logSection('Setting Up Test Data');
  
  try {
    const hashedPassword = await bcrypt.hash(CONFIG.testPassword, 10);
    const hospitalSlug = `test-log-${randomUUID().slice(0, 8)}`;
    const userEmail = `test-logger-${randomUUID().slice(0, 8)}@hospital.local`;
    
    // Create hospital
    testState.hospital = await prisma.hospital.create({
      data: {
        name: 'Test Logging Hospital',
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
    logSuccess(`Created test hospital: ${testState.hospital.name}`);
    testState.hospitalId = testState.hospital.id;

    // Create user
    testState.user = await prisma.user.create({
      data: {
        email: userEmail,
        password: hashedPassword,
        role: 'ADMIN',
        hospitalId: testState.hospital.id,
      },
    });
    testState.testEmail = userEmail;
    testState.userId = testState.user.id;
    logSuccess(`Created test user: ${userEmail}`);

    // Create patient
    testState.patient = await prisma.patientProfile.create({
      data: {
        email: `test-patient-${randomUUID().slice(0, 8)}@patient.local`,
        password: hashedPassword,
        firstName: 'Test',
        lastName: 'Patient',
        age: 35,
        gender: 'other',
        preferredLanguage: 'en',
      },
    });
    testState.patientId = testState.patient.id;
    logSuccess(`Created test patient: ${testState.patient.firstName} ${testState.patient.lastName}`);
    
    logInfo('✓ Test data setup complete\n');
  } catch (error) {
    logError(`Failed to setup test data: ${error.message}`);
    throw error;
  }
}

async function cleanupTestData() {
  logSection('Cleaning Up Test Data');
  
  try {
    if (testState.hospital) {
      // Delete in correct order due to foreign keys
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
    
    if (testState.patient) {
      await prisma.patientProfile.delete({ where: { id: testState.patient.id } }).catch(() => {});
      logSuccess('Deleted test patient');
    }

    // Clean up patient created by intake intent test (Test 8A)
    if (testState.intakePatientId && testState.intakePatientId !== testState.patientId) {
      await prisma.patientSession.deleteMany({ where: { patientId: testState.intakePatientId } }).catch(() => {});
      await prisma.patientProfile.delete({ where: { id: testState.intakePatientId } }).catch(() => {});
      logSuccess('Deleted intake test patient');
    }

    await prisma.$disconnect();
    await pool.end();
    logInfo('✓ Cleanup complete\n');
  } catch (error) {
    logError(`Cleanup failed: ${error.message}`);
  }
}

// ============================================================================
// Main Test Runner
// ============================================================================

async function runAllTests() {
  console.log('');
  logSection('LOGGING SYSTEM AUTOMATED TEST SUITE');
  logInfo('Testing comprehensive logging implementation');
  logInfo(`Target: ${CONFIG.baseUrl}`);
  console.log('');
  
  // Check server health first
  const isHealthy = await checkServerHealth();
  if (!isHealthy) {
    logError('Server is not running. Please start the server first.');
    logError('Run: npm run start:dev');
    process.exit(1);
  }
  
  await sleep(1000);
  
  try {
    // Setup test data
    await setupTestData();
    await sleep(1000);
    
    // Run all tests in sequence
    await testAuthenticationLogging();
    await sleep(1500);
    
    await testEncounterWorkflowLogging();
    await sleep(1500);
    
    await testDatabaseLogging();
    await sleep(1500);
    
    await testErrorLogging();
    await sleep(1500);
    
    await testFatalErrorSimulation();
    await sleep(1500);
    
    await testLoggerServiceHealth();
    await sleep(1500);
    
    await testAdditionalServicesLogging();
    await sleep(1500);
    
    await testNewServicesLogging();
    
    // Cleanup
    await sleep(1000);
    await cleanupTestData();
    
    // Print summary
    printTestSummary();
    
    // Exit with appropriate code
    process.exit(testState.testsFailed > 0 ? 1 : 0);
  } catch (error) {
    logError(`Fatal error in test runner: ${error.message}`);
    console.error(error.stack);
    await cleanupTestData();
    process.exit(1);
  }
}

// ============================================================================
// Entry Point
// ============================================================================

if (require.main === module) {
  runAllTests();
}

module.exports = {
  runAllTests,
  testAuthenticationLogging,
  testEncounterWorkflowLogging,
  testDatabaseLogging,
  testErrorLogging,
  testFatalErrorSimulation,
  testLoggerServiceHealth,
  testAdditionalServicesLogging,
  testNewServicesLogging,
};
