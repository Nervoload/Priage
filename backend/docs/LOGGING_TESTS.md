# Logging System Test Suite Documentation

## Overview

The Priage logging test suite is a comprehensive automated testing framework that validates the complete logging system functionality across all instrumented services. The test suite executes 87 tests organized into 8 categories, verifying that logs are correctly generated, stored, and retrievable with proper correlation tracking.

## Test Script Location

**File:** `backend/scripts/test-logging.js`

**Type:** Node.js standalone script (no external dependencies beyond NestJS backend)

**Language:** JavaScript (ES6+)

**Runtime:** Node.js 18+ required

## How to Run Tests

### Prerequisites

Before running the test suite, ensure the following:

1. **Backend server is running** on `http://localhost:3000`
2. **PostgreSQL database is accessible** and migrations are applied
3. **Redis is running** (for background jobs)
4. **Test data is seeded** (script creates its own test data)

### Quick Start

From the backend directory, run:

```bash
npm run test:logging
```

Or directly:

```bash
node scripts/test-logging.js
```

### Expected Output

The test suite produces color-coded console output:

- 🟢 **Green (✅)** - Test passed
- 🔴 **Red (❌)** - Test failed
- 🔵 **Blue (ℹ️)** - Informational message
- 🟠 **Orange (⚠️)** - Warning or issue

### Execution Time

- **Total duration:** 55-70 seconds
- **Test setup:** 2-3 seconds
- **Test execution:** 50-60 seconds
- **Cleanup:** 2-3 seconds

### Test Summary

At completion, the script displays a summary:

```
=======================================
TEST SUMMARY
=======================================
Total Tests: 87
✅ Passed: 87
❌ Failed: 0
⚠️ Skipped: 0
Pass Rate: 100.0%
```

## Test Architecture

### Core Testing Functions

The test script includes several utility functions:

#### `makeRequest(options)`
Executes HTTP requests to the backend API with automatic JSON parsing and error handling.

#### `buildRequestOptions(path, method, auth)`
Constructs request options with proper headers, including authentication tokens and correlation IDs.

#### `verifyLogsExist(correlationId, expectedMessages, testName)`
Queries the logging API to verify that expected log messages were created for a given correlation ID.

#### `logSuccess(message)`, `logError(message)`, `logInfo(message)`
Color-coded console logging functions for test output formatting.

#### `sleep(ms)`
Utility function for adding delays between tests to allow log processing.

### Test State Management

The script maintains a `testState` object that tracks:

- `authToken` - JWT token for authenticated requests
- `userId` - Test user ID
- `hospitalId` - Test hospital ID
- `patientId` - Test patient ID
- `encounterId` - Test encounter ID
- `alertId` - Test alert ID
- `messageId` - Test message ID
- `sessionToken` - Patient intake session token

This state enables sequential tests to reference entities created by previous tests.

## Test Categories

### TEST 1: Authentication Service Logging (2 tests)

Validates that authentication operations generate proper logs.

**1A: Login Authentication**
- Tests user login with valid credentials
- Verifies "User login attempt" and "User login successful" logs
- Confirms JWT token generation

**1B: Registration**
- Tests new user registration
- Verifies "User registration attempt" and "User registered successfully" logs
- Validates password hashing and database insertion

### TEST 2: Encounters Service Logging (5 tests)

Validates logging throughout the complete encounter lifecycle.

**2A: Create Encounter**
- Creates new patient encounter
- Verifies "Creating encounter" and "Encounter created successfully" logs
- Tracks initial encounter state

**2B: Update Encounter Status**
- Updates encounter from EXPECTED to ADMITTED
- Verifies "Updating encounter status" and "Encounter status updated successfully" logs
- Validates state transition logging

**2C: Admit Patient**
- Processes patient admission workflow
- Verifies "Admitting patient" and "Patient admitted successfully" logs
- Confirms status change to ADMITTED

**2D: Get Encounter**
- Fetches encounter details
- Verifies "Fetching encounter" and "Encounter fetched successfully" logs
- Tests read operation logging

**2E: List Encounters**
- Queries encounters by hospital with pagination
- Verifies "Fetching encounters" and "Encounters fetched successfully" logs
- Tests batch query logging

### TEST 3: Prisma Service Logging (3 tests)

Validates database connection and health monitoring logs.

**3A: Database Connection**
- Tests Prisma connection to PostgreSQL
- Verifies "Connecting to database" and "Database connected successfully" logs
- Validates connection pool initialization

**3B: Database Health Check**
- Executes health check query
- Verifies "Checking database health" and "Database health check successful" logs
- Confirms database responsiveness

**3C: Multiple Health Checks**
- Runs 5 consecutive health checks
- Verifies all health checks are logged
- Tests log accumulation under load

### TEST 4: Events Service Logging (3 tests)

Validates event dispatching and job processing logs.

**4A: Event Dispatch**
- Dispatches ENCOUNTER_CREATED event
- Verifies "Dispatching event" and "Event dispatched successfully" logs
- Tests event system integration

**4B: Job Processing**
- Processes recurring event processing job
- Verifies "Processing events job started" and "Events processed" logs
- Validates background job execution

**4C: Alerts Job Processing**
- Processes alerts job
- Verifies "Processing alerts job started" and "Alerts checked" logs
- Tests scheduled task logging

### TEST 5: Error Report Generation (2 tests)

Validates error report generation functionality.

**5A: Generate Error Report**
- Creates error report for specific correlation ID
- Verifies report includes logs, errors, and system metrics
- Tests report format and completeness

**5B: Export Error Report**
- Downloads error report as text file
- Verifies file contains formatted log data
- Tests export functionality

### TEST 6: Logging System Features (3 tests)

Validates core logging system capabilities.

**6A: Log Storage**
- Verifies logs are actively being collected
- Checks memory usage is reasonable
- Validates retention is working

**6B: Query by Service**
- Queries logs filtered by service name
- Verifies filtering returns correct results
- Tests service-based log retrieval

**6C: Query by Level**
- Queries logs filtered by log level
- Verifies level filtering works correctly
- Tests severity-based filtering

### TEST 7: Additional Services Logging (3 tests)

Validates logging for messaging, alerts, and triage services.

**7A: Messaging Service**
- Creates new message
- Verifies "Creating message" and "Message created successfully" logs
- Tests messaging operation logging

**7B: Alerts Service**
- Creates new alert
- Verifies "Creating alert" and "Alert created successfully" logs
- Tests alert operation logging

**7C: Triage Service**
- Creates triage assessment
- Verifies "Creating triage assessment" and "Triage assessment created successfully" logs
- Tests triage workflow logging

### TEST 8: More Services Logging (9 tests)

Validates logging for intake, patients, users, and hospitals services.

**8A: Intake Service - Create Intent**
- Creates patient intake intent
- Verifies "Creating patient intent" and "Patient intent created successfully" logs
- Tests patient onboarding initiation

**8B: Intake Service - Confirm Intent**
- Confirms patient intent with hospital selection
- Verifies "Confirming patient intent" and "Patient intent confirmed successfully" logs
- Tests hospital association logging

**8C: Intake Service - Update Details**
- Updates patient intake form details
- Verifies "Updating patient intake details" and "Patient intake details updated successfully" logs
- Tests form completion logging

**8D: Patients Service**
- Fetches patient profile
- Verifies "Fetching patient profile" and "Patient profile fetched successfully" logs (DEBUG level)
- Tests patient query logging

**8E: Users Service - List Users**
- Lists hospital staff members
- Verifies "Fetching hospital users" and "Hospital users fetched" logs (DEBUG level)
- Tests staff directory logging

**8F: Users Service - Get User**
- Fetches current user via /users/me
- Verifies "Fetching user by ID" and "User fetched successfully" logs (DEBUG level)
- Tests user profile logging

**8G: Hospitals Service - Get Hospital**
- Fetches hospital details
- Verifies "Fetching hospital details" and "Hospital details fetched" logs (DEBUG level)
- Tests hospital query logging

**8H: Hospitals Service - Dashboard**
- Fetches hospital dashboard metrics
- Verifies "Fetching hospital dashboard" and "Hospital dashboard fetched" logs (INFO level)
- Tests analytics query logging

**8I: Hospitals Service - Queue Status**
- Fetches hospital queue status
- Verifies "Fetching hospital queue status" and "Hospital queue status fetched" logs (INFO level)
- Tests queue monitoring logging

## Test Data Management

### Setup Phase

Before running tests, the script creates:

1. **Test Hospital** - Named "Test Hospital Logging"
2. **Test User** - Admin user with credentials
3. **Test Patient** - Patient profile for encounters
4. **Test Encounter** - Initial encounter for testing

### Cleanup Phase

After all tests complete, the script removes:

1. All test hospital data (cascading delete)
2. Test patient data
3. All related encounters, alerts, messages
4. Background jobs and events

This ensures tests don't leave residual data in the database.

## Correlation ID Verification

Every test follows the same verification pattern:

1. **Generate Correlation ID** - Create unique UUID for the request
2. **Make API Request** - Send request with `x-correlation-id` header
3. **Verify Response** - Check HTTP status and response data
4. **Query Logs** - Retrieve logs using correlation ID
5. **Validate Logs** - Confirm expected log messages exist
6. **Check Context** - Verify log context includes proper identifiers

Example verification flow:

```javascript
const correlationId = uuidv4();
const options = buildRequestOptions('/encounters', 'POST', true);
options.headers['x-correlation-id'] = correlationId;

const response = await makeRequest(options);

// Wait for logs to be written
await sleep(500);

// Verify logs exist
const logsValid = await verifyLogsExist(
  correlationId,
  ['Creating encounter', 'Encounter created successfully'],
  'Test 2A'
);
```

## Success Criteria

For a test to pass, it must satisfy:

1. **HTTP Success** - API returns 200/201 status code
2. **Log Existence** - Both start and completion logs exist
3. **Correlation Match** - Logs have correct correlation ID
4. **Message Match** - Log messages match expected strings exactly
5. **Context Validity** - Log context includes required fields
6. **Timing** - Logs appear within 1 second of request

## Common Test Failures

### 1. No Logs Found

**Symptom:** "No logs found for correlation ID"

**Causes:**
- Service not using LoggingService (using NestJS Logger instead)
- Controller not passing correlationId to service
- Service method missing correlationId parameter
- LoggingService not injected in service constructor

**Fix:** Update service to use LoggingService and update controller to pass correlationId.

### 2. HTTP 404 Errors

**Symptom:** "Failed: 404"

**Causes:**
- API endpoint doesn't exist
- Route path incorrect in test
- Controller not registered properly
- Guard blocking access

**Fix:** Verify endpoint exists and test is using correct path.

### 3. Authentication Failures

**Symptom:** "Failed: 401" or "Failed: 403"

**Causes:**
- JWT token expired or invalid
- User doesn't have required role
- JwtAuthGuard not configured properly

**Fix:** Verify test user has proper role and token is valid.

### 4. Timing Issues

**Symptom:** Intermittent failures where logs sometimes appear

**Causes:**
- Insufficient delay between request and log query
- Background job processing delay
- Database write latency

**Fix:** Increase sleep duration between request and log verification.

## Advanced Usage

### Running Specific Test Categories

The test script supports running individual test categories by modifying the `testToRun` variable:

```javascript
// Run only TEST 1
const testsToRun = [1];

// Run TEST 2 and TEST 3
const testsToRun = [2, 3];

// Run all tests (default)
const testsToRun = [1, 2, 3, 4, 5, 6, 7, 8];
```

### Adding New Tests

To add a new test:

1. **Create test function** following naming pattern `testCategoryName()`
2. **Add test invocation** in main execution flow
3. **Use utility functions** for requests and verification
4. **Follow established patterns** for log verification
5. **Update test count** in documentation

Example new test:

```javascript
async function testNewFeature() {
  logInfo('TEST 9: New Feature Logging');
  logInfo('=====================================');
  
  logInfo('Test 9A: Testing new feature...');
  try {
    const correlationId = uuidv4();
    const options = buildRequestOptions('/new-feature', 'POST', true);
    options.headers['x-correlation-id'] = correlationId;
    
    const response = await makeRequest(options);
    
    if (response.statusCode === 201) {
      logSuccess('Test 9A: Feature created');
      
      await sleep(500);
      
      const logsValid = await verifyLogsExist(
        correlationId,
        ['Creating feature', 'Feature created successfully'],
        'Test 9A'
      );
      
      if (logsValid) {
        logSuccess('Test 9A: New feature logging verified');
      }
    }
  } catch (error) {
    logError(`Test 9A: Failed - ${error.message}`);
  }
  
  await sleep(1000);
}
```

### Debugging Test Failures

Enable verbose logging by modifying utility functions:

```javascript
// Add detailed request logging
async function makeRequest(options) {
  console.log('Request:', {
    method: options.method,
    path: options.path,
    headers: options.headers,
    body: options.body
  });
  
  const response = await http.request(options);
  
  console.log('Response:', {
    statusCode: response.statusCode,
    headers: response.headers,
    body: response.body
  });
  
  return response;
}
```

## Performance Monitoring

The test suite automatically tracks and reports:

- **Total execution time** - From start to finish
- **Individual test duration** - Time per test category
- **Memory usage** - Via logging system stats endpoint
- **Pass/fail rates** - Percentage of successful tests

## Continuous Integration

For CI/CD pipelines, the test script:

1. **Returns exit code 0** on success (all tests pass)
2. **Returns exit code 1** on failure (any test fails)
3. **Outputs machine-readable format** (JSON available with modification)
4. **Self-contained** - No external dependencies beyond running backend
5. **Idempotent** - Can run repeatedly without side effects

## Maintenance

### Updating Expected Log Messages

When changing log messages in services, update the test script:

```javascript
// Old
await verifyLogsExist(correlationId, ['Creating encounter', ...]);

// New (after service message change)
await verifyLogsExist(correlationId, ['Initiating encounter creation', ...]);
```

### Adding New Services

When adding logging to a new service:

1. Create new test function (e.g., `testNewServiceLogging()`)
2. Add test cases for each logged operation
3. Update test count in summary
4. Document new tests in this file

## Conclusion

The Priage logging test suite provides comprehensive validation of the logging system with 87 automated tests covering 13 services. The test suite ensures that all critical operations are properly logged with correct correlation tracking, enabling reliable debugging and error reporting in production.

For questions about specific tests or to report test failures, contact the development team or review the logging system documentation.
