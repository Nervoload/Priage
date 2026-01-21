# Logging Test Script Documentation

## Overview

The `test-logging.js` script is a comprehensive automated testing suite for the Priage logging system. It validates all aspects of logging implementation including authentication, business logic, error handling, and system health.

## Features

✅ **Independent Console Output**: Uses native `console.log` with color codes (not the logging system being tested)  
✅ **Correlation ID Tracking**: Captures and verifies correlation IDs for each request  
✅ **Comprehensive Coverage**: Tests 7 major areas with 20+ sub-tests  
✅ **Real API Calls**: Makes actual HTTP requests to test endpoints  
✅ **Log Verification**: Queries the logging API to verify logs were written correctly  
✅ **Pass/Fail Reporting**: Detailed summary with pass rate calculation  

## Prerequisites

1. **Server Running**: Application must be running (`npm run start:dev`)
2. **Test User**: User with email `test-logger@hospital.com` must exist
3. **Database**: Database must be seeded with test data (patient, hospital)

## Usage

### Basic Run
```bash
node scripts/test-logging.js
```

### With Custom Base URL
```bash
BASE_URL=http://localhost:4000 node scripts/test-logging.js
```

### Add to package.json
```json
{
  "scripts": {
    "test:logging": "node scripts/test-logging.js"
  }
}
```

Then run:
```bash
npm run test:logging
```

## Test Coverage

### TEST 1: Authentication Logging
- ✅ **1A**: Failed login (user not found) - Verifies warning logs
- ✅ **1B**: Successful login - Verifies success logs and token generation
- ✅ **1C**: JWT validation - Tests protected route access

**Verifies**:
- Login attempt logging
- Failed login reasons (user not found vs wrong password)
- Successful login with user details
- JWT validation on protected routes

### TEST 2: Full Encounter Workflow Logging
- ✅ **2A**: Create encounter - Verifies creation logs
- ✅ **2B**: List encounters - Verifies query logs
- ✅ **2C**: State transition - Verifies transition logs

**Verifies**:
- Encounter CRUD operations
- State machine transitions
- Event creation and dispatch
- Transaction logging

### TEST 3: Database & Connection Logging
- ✅ **3A**: Database connection logs - Verifies Prisma connection
- ✅ **3B**: WebSocket logs - Verifies RealtimeGateway initialization

**Verifies**:
- Database connection lifecycle
- Connection pool monitoring
- WebSocket gateway initialization
- Network event logging

### TEST 4: Error Logging Verification
- ✅ **4A**: 404 errors - Tests not found logging
- ✅ **4B**: Validation errors - Tests input validation logging
- ✅ **4C**: Authorization errors - Tests auth guard logging

**Verifies**:
- Error level logging
- Stack trace capture
- Validation error details
- Authorization failures

### TEST 5: Fatal Error Simulation
- ✅ **5A**: Invalid state transition - Tests business logic errors
- ✅ **5B**: Error report generation - Tests error report API

**Verifies**:
- Business logic error handling
- Error report generation
- System metrics capture
- Fatal error recovery

### TEST 6: Logger Service Health Check
- ✅ **6A**: Stats endpoint - Tests logging statistics
- ✅ **6B**: Query by service - Tests log filtering
- ✅ **6C**: Query by level - Tests level-based queries

**Verifies**:
- LoggingService health
- Log storage and retrieval
- Query API functionality
- Log structure integrity

### TEST 7: Additional Services Logging
- ✅ **7A**: Messaging service - Tests message creation logging
- ✅ **7B**: Alerts service - Tests alert creation logging
- ✅ **7C**: Triage service - Tests triage assessment logging

**Verifies**:
- MessagingService logging
- AlertsService logging
- TriageService logging
- Cross-service consistency

### TEST 8: Newly Added Services Logging
- ✅ **8A**: Intake service - Create intent - Tests patient registration logging
- ✅ **8B**: Intake service - Confirm intent - Tests hospital selection logging
- ✅ **8C**: Intake service - Update details - Tests form completion logging
- ✅ **8D**: Patients service - Get patient - Tests patient profile fetch logging
- ✅ **8E**: Users service - List users - Tests hospital staff list logging
- ✅ **8F**: Users service - Get user - Tests individual user fetch logging
- ✅ **8G**: Hospitals service - Get hospital - Tests hospital details logging
- ✅ **8H**: Hospitals service - Get dashboard - Tests dashboard metrics logging
- ✅ **8I**: Hospitals service - Get queue - Tests queue status logging

**Verifies**:
- IntakeService logging (patient onboarding flow)
- PatientsService logging (profile queries)
- UsersService logging (staff management)
- HospitalsService logging (dashboard and queue monitoring)
- Complete patient journey tracking
- Hospital operations monitoring

## Output Format

### Color Codes
- 🟢 **Green**: Test passed (✅)
- 🔴 **Red**: Test failed (❌)
- 🟡 **Yellow**: Warning/skipped (⚠️)
- 🔵 **Cyan**: Information (ℹ️)
- **White (Bright)**: Section headers

### Sample Output
```
================================================================================
TEST 1: Authentication Logging
================================================================================

[2026-01-20T21:30:45.123Z] ℹ️  Test 1A: Testing failed login (user not found)...
[2026-01-20T21:30:45.456Z] ✅ Test 1A: Correctly rejected invalid login
[2026-01-20T21:30:45.789Z] ℹ️  Test 1A: Found 3 log entries
[2026-01-20T21:30:45.890Z] ✅ Test 1A: Found expected log: "Login attempt"
[2026-01-20T21:30:45.901Z] ✅ Test 1A: Found expected log: "Login failed - user not found"
[2026-01-20T21:30:45.912Z] ✅ Test 1A: Auth error logging verified

...

================================================================================
TEST SUMMARY
================================================================================

[2026-01-20T21:32:15.123Z] ℹ️  Total Tests: 20
[2026-01-20T21:32:15.124Z] ✅ Passed: 18
[2026-01-20T21:32:15.125Z] ❌ Failed: 0
[2026-01-20T21:32:15.126Z] ⚠️  Skipped: 2
[2026-01-20T21:32:15.127Z] ℹ️  Pass Rate: 90.0%

[2026-01-20T21:32:15.128Z] ✅ 🎉 ALL TESTS PASSED! Logging system is working correctly.
```

## Configuration

### Environment Variables
```bash
# Base URL for the API (default: http://localhost:3000)
BASE_URL=http://localhost:3000

# Test credentials (hardcoded in script, modify if needed)
testEmail=test-logger@hospital.com
testPassword=TestPassword123!
```

### Customization
Edit `CONFIG` object in script:
```javascript
const CONFIG = {
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  testEmail: 'test-logger@hospital.com',
  testPassword: 'TestPassword123!',
};
```

## What Gets Tested

### ✅ Logging System
- LoggingService initialization
- Log storage (in-memory Map)
- Log retrieval by correlation ID
- Log querying (by service, level, filters)
- Statistics endpoint
- Error report generation

### ✅ Service Logging
- AuthService (login, JWT validation)
- EncountersService (CRUD, state transitions)
- PrismaService (connection, pool monitoring)
- EventsService (event creation, dispatch)
- RealtimeGateway (WebSocket connections)
- MessagingService (message creation)
- AlertsService (alert lifecycle)
- TriageService (assessments)
- JobsService (job initialization)
- **IntakeService (patient onboarding - NEW)**
- **PatientsService (profile queries - NEW)**
- **UsersService (staff management - NEW)**
- **HospitalsService (dashboard and queue - NEW)**

### ✅ Patient Journey Tracking (Complete)
- Patient intent creation (Intake)
- Hospital selection (Intake)
- Form completion (Intake)
- Patient profile access (Patients)
- Encounter state transitions (Encounters)
- Message exchange (Messaging)
- Alert generation (Alerts)
- Triage assessment (Triage)
- Queue monitoring (Hospitals)

### ✅ Error Handling
- Business logic errors
- Validation errors
- Authorization errors
- Not found errors
- Invalid state transitions
- Database errors (simulated)

### ✅ System Health
- Server availability
- API endpoints
- Authentication flow
- Authorization guards
- Correlation middleware
- Log retention

## Troubleshooting

### Test Fails: "Server is not running"
**Solution**: Start the server first:
```bash
npm run start:dev
```

### Test Fails: "Cannot continue without authentication"
**Solution**: Ensure test user exists:
```bash
node scripts/create-test-user.js
# Or manually create user: test-logger@hospital.com
```

### Test Fails: "Failed to create encounter"
**Solution**: Ensure database is seeded:
```bash
npx prisma db seed
# Or check that patient ID 1 exists
```

### Many Tests Skipped
**Cause**: Authentication or encounter creation failed  
**Solution**: Check server logs for errors, verify database connection

### No Logs Found
**Cause**: LoggingService not initialized or correlation ID mismatch  
**Solution**: Check that LoggingModule is imported in AppModule

## Exit Codes

- `0` - All tests passed
- `1` - One or more tests failed or fatal error occurred

## Integration with CI/CD

### GitHub Actions Example
```yaml
name: Test Logging System

on: [push, pull_request]

jobs:
  test-logging:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
        working-directory: ./backend
      
      - name: Start server
        run: npm run start:dev &
        working-directory: ./backend
      
      - name: Wait for server
        run: sleep 10
      
      - name: Run logging tests
        run: npm run test:logging
        working-directory: ./backend
```

## Extending Tests

### Add New Test Section
```javascript
async function testMyNewFeature() {
  logSection('TEST X: My New Feature');
  
  logInfo('Test XA: Testing something...');
  try {
    const options = buildRequestOptions('/my-endpoint', 'POST', true);
    const response = await makeRequest(options, { data: 'test' });
    
    const correlationId = response.headers['x-correlation-id'];
    
    if (response.statusCode === 200) {
      logSuccess('Test XA: Success');
      
      // Verify logs
      await verifyLogsExist(
        correlationId,
        ['Expected log message 1', 'Expected log message 2'],
        'Test XA'
      );
    }
  } catch (error) {
    logError(`Test XA: Failed - ${error.message}`);
  }
}

// Add to runAllTests()
await testMyNewFeature();
```

## Best Practices

1. **Run Before Deployment**: Always run before pushing to production
2. **Clean Database**: Use clean test database to avoid conflicts
3. **Monitor Output**: Check for warnings even if tests pass
4. **Update Tests**: Add tests when new services are created
5. **CI Integration**: Include in continuous integration pipeline

## Notes

- Tests create real data (encounters, messages, alerts)
- Use dedicated test database to avoid polluting production data
- Some tests may fail if server is under heavy load (increase sleep times)
- Tests are sequential to avoid race conditions
- Correlation IDs are captured and verified for full traceability

## Support

For issues or questions:
1. Check server logs: `npm run start:dev`
2. Verify database connection: `npx prisma db pull`
3. Review test output for specific error messages
4. Check LOGGING_VERIFICATION_REPORT.md for known issues
