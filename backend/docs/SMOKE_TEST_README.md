# Smoke Test Documentation

## Overview

The **smoke-test-v2.js** script is a comprehensive end-to-end testing suite for the Priage backend. It simulates a complete patient encounter lifecycle from initial intake through discharge, testing all major system components along the way.

## Purpose

This smoke test validates that the entire Priage backend is functioning correctly after changes or deployments. It tests:

- ✅ **Authentication**: User login, token validation, role-based access
- ✅ **Patient Intake**: Creating encounters, patient sessions, location tracking
- ✅ **Encounter Management**: Status transitions, timeline tracking
- ✅ **Triage Assessment**: Creating assessments, CTAS scoring, priority management
- ✅ **Messaging**: Staff-patient communication, message tracking
- ✅ **Alerts**: Creating, acknowledging, and resolving alerts
- ✅ **Event Logging**: Encounter events, state transitions

## Prerequisites

1. **Server Running**: The Priage backend must be running
   ```bash
   npm run start:dev
   ```

2. **Database**: PostgreSQL database must be running and accessible
   ```bash
   docker-compose up -d postgres
   ```

3. **Environment Variables**: `.env` file must be configured
   ```env
   DATABASE_URL=postgresql://user:password@localhost:5432/priage
   BASE_URL=http://localhost:3000
   ```

4. **Clean Database**: Database should have migrations applied
   ```bash
   npm run prisma:migrate:dev
   ```

## Usage

### Basic Usage

Run all tests with default settings:

```bash
node scripts/smoke-test-v2.js
```

Or use the npm script:

```bash
npm run test:smoke
```

Add to `package.json`:
```json
{
  "scripts": {
    "test:smoke": "node scripts/smoke-test-v2.js"
  }
}
```

### Command-Line Options

#### Help & Information
```bash
node scripts/smoke-test-v2.js --help     # Show help message
node scripts/smoke-test-v2.js -h         # Short form
```

#### Verbose Mode
Enable detailed logging including all API requests and responses:
```bash
node scripts/smoke-test-v2.js --verbose
node scripts/smoke-test-v2.js -v
```

#### Skip Cleanup
Keep test data in the database after test completion (useful for debugging):
```bash
node scripts/smoke-test-v2.js --skip-cleanup
node scripts/smoke-test-v2.js -s
```

The script will output the IDs of created entities:
```
Hospital ID: 123
Patient ID: 456
Encounter ID: 789
```

#### Selective Testing

Run only specific test suites:

```bash
# Test only authentication
node scripts/smoke-test-v2.js --test-auth

# Test only encounters
node scripts/smoke-test-v2.js --test-encounters

# Test authentication and messaging
node scripts/smoke-test-v2.js --test-auth --test-messaging

# Test everything except alerts
node scripts/smoke-test-v2.js -a -i -e -t -m
```

Available test flags:
- `-a, --test-auth` - Authentication tests
- `-i, --test-intake` - Patient intake tests
- `-e, --test-encounters` - Encounter management tests
- `-t, --test-triage` - Triage assessment tests
- `-m, --test-messaging` - Messaging tests
- `--test-alerts` - Alert tests

### Combined Options

```bash
# Verbose mode with cleanup disabled
node scripts/smoke-test-v2.js --verbose --skip-cleanup

# Test only triage with verbose output
node scripts/smoke-test-v2.js -t -v

# Test auth and encounters, keep data
node scripts/smoke-test-v2.js -a -e -s
```

## Test Coverage

### TEST 1: Authentication

Tests user authentication and authorization:

- **1A: Staff User Login** - Login with staff credentials
- **1B: Nurse User Login** - Login with nurse credentials
- **1C: Doctor User Login** - Login with doctor credentials
- **1D: Protected Route Access** - Verify JWT token works
- **1E: Invalid Credentials** - Verify rejection of wrong passwords

**Validates:**
- JWT token generation
- Role-based access control
- Password verification
- Protected route authentication

### TEST 2: Patient Intake

Tests the patient-facing intake process:

- **2A: Create Patient Intent** - Patient initiates encounter
- **2B: Get Patient Session Token** - Patient authentication token
- **2C: Update Intake Details** - Patient adds information
- **2D: Record Patient Location** - Patient en route tracking

**Validates:**
- Encounter creation
- Patient session management
- Token-based patient authentication
- Location tracking

### TEST 3: Encounter Management

Tests hospital staff encounter operations:

- **3A: List Hospital Encounters** - Query encounters by hospital
- **3B: Get Encounter Details** - Fetch specific encounter
- **3C: Mark Patient Arrived** - Transition to ADMITTED status
- **3D: Verify Events** - Check encounter event logging

**Validates:**
- Encounter queries and filtering
- Status transitions (EXPECTED → ADMITTED)
- Timestamp management
- Event creation
- Actor tracking

### TEST 4: Triage Assessment

Tests the triage process:

- **4A: Start Triage Exam** - Transition to TRIAGE status
- **4B: Create Triage Assessment** - Nurse creates assessment
- **4C: List Triage Assessments** - Query assessments
- **4D: Verify Encounter Update** - Check CTAS level updated

**Validates:**
- Triage status transitions (ADMITTED → TRIAGE)
- CTAS level scoring (1-5)
- Priority score calculation
- Assessment note creation
- Encounter denormalization updates

### TEST 5: Messaging

Tests staff-patient communication:

- **5A: Send Message to Patient** - Staff sends message
- **5B: List Encounter Messages** - Query conversation
- **5C: Mark Message as Read** - Track message status

**Validates:**
- Message creation
- Sender type tracking (USER, PATIENT, SYSTEM)
- Message pagination
- Read status tracking
- Actor attribution

### TEST 6: Alerts

Tests the alerting system:

- **6A: Create Alert** - Generate alert for encounter
- **6B: List Unacknowledged Alerts** - Query pending alerts
- **6C: Acknowledge Alert** - Staff acknowledges alert
- **6D: Resolve Alert** - Staff resolves alert
- **6E: List Encounter Alerts** - Query alerts by encounter

**Validates:**
- Alert creation with severity levels
- Alert metadata storage
- Acknowledgment workflow
- Resolution workflow
- Hospital-wide alert queries

### TEST 7: Encounter Completion

Tests encounter finalization:

- **7A: Move to Waiting Room** - Transition to WAITING status
- **7B: Discharge Patient** - Transition to COMPLETE status
- **7C: Verify Final State** - Check all related data

**Validates:**
- Status transitions (TRIAGE → WAITING → COMPLETE)
- Discharge timestamp
- Final state verification
- Related data integrity

## Test Data

The script creates and cleans up:

- 1 Hospital (`Test Hospital`)
- 3 Users (staff, nurse, doctor with different roles)
- 1 Patient Profile
- 1 Encounter (full lifecycle)
- 1 Patient Session
- 1 Triage Assessment
- N Messages (staff-patient communication)
- N Alerts (system alerts)
- N Encounter Events (state changes)

### Data Cleanup

By default, all test data is removed after test completion. Use `--skip-cleanup` to preserve data for inspection.

## Output & Reporting

### Console Output

The script uses colored output for readability:

- ✅ Green: Successful tests
- ❌ Red: Failed tests
- ⚠️  Yellow: Warnings
- ℹ️  Cyan: Information
- 🔹 Dim: Verbose details (with `-v`)

### Test Summary

After execution, a summary is displayed:

```
══════════════════════════════════════════════════════════════════════════
  TEST SUMMARY
══════════════════════════════════════════════════════════════════════════

Duration: 3.45s
Passed:   42
Failed:   0
Total:    42
Pass Rate: 100.0%

✨ All tests passed! ✨
```

### Exit Codes

- `0` - All tests passed
- `1` - One or more tests failed

Use in CI/CD:
```bash
node scripts/smoke-test-v2.js || exit 1
```

## Troubleshooting

### Common Issues

#### 1. Connection Refused

**Error**: `fetch failed... ECONNREFUSED`

**Solution**: Ensure the backend server is running:
```bash
npm run start:dev
```

#### 2. Database Connection Failed

**Error**: `DATABASE_URL environment variable is not set`

**Solution**: Check `.env` file exists and contains valid `DATABASE_URL`

#### 3. Authentication Failures

**Error**: `401 Unauthorized`

**Solution**: 
- Ensure test users are being created correctly
- Check JWT secret is configured in `.env`
- Verify authentication guards are not blocking test users

#### 4. Status Transition Errors

**Error**: `Cannot transition from X to Y`

**Solution**: Check that encounter status transitions follow the state machine rules in `encounters.service.ts`

#### 5. Test Data Not Cleaned Up

**Issue**: Old test data accumulating in database

**Solution**: 
- Remove `--skip-cleanup` flag
- Manually delete old test data: `DELETE FROM hospitals WHERE name = 'Test Hospital';`

### Debugging Tips

1. **Use Verbose Mode**
   ```bash
   node scripts/smoke-test-v2.js -v
   ```
   This shows all API requests, responses, and timestamps.

2. **Keep Test Data**
   ```bash
   node scripts/smoke-test-v2.js --skip-cleanup
   ```
   Then inspect the database directly:
   ```sql
   SELECT * FROM encounters WHERE hospital_id = <hospital_id>;
   SELECT * FROM encounter_events WHERE encounter_id = <encounter_id>;
   ```

3. **Run Selective Tests**
   ```bash
   node scripts/smoke-test-v2.js --test-auth --verbose
   ```
   Isolate failing test suites to identify issues faster.

4. **Check Server Logs**
   
   Watch the backend server output while running tests to see server-side errors.

5. **Correlation IDs**
   
   Each request generates a correlation ID (`smoke-test-<uuid>`). Use this to trace requests through the logging system:
   ```sql
   SELECT * FROM logs WHERE correlation_id = 'smoke-test-...';
   ```

## Integration with CI/CD

### GitHub Actions

```yaml
name: Smoke Tests

on: [push, pull_request]

jobs:
  smoke-test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: password
          POSTGRES_DB: priage_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run migrations
        env:
          DATABASE_URL: postgresql://postgres:password@localhost:5432/priage_test
        run: npm run prisma:migrate:deploy
      
      - name: Start server
        env:
          DATABASE_URL: postgresql://postgres:password@localhost:5432/priage_test
        run: |
          npm run start:dev &
          sleep 10
      
      - name: Run smoke tests
        env:
          DATABASE_URL: postgresql://postgres:password@localhost:5432/priage_test
        run: node scripts/smoke-test-v2.js
```

### Docker Compose

```yaml
# Run tests in containerized environment
version: '3.8'
services:
  smoke-test:
    build: .
    depends_on:
      - postgres
    environment:
      DATABASE_URL: postgresql://postgres:password@postgres:5432/priage
      BASE_URL: http://api:3000
    command: node scripts/smoke-test-v2.js
```

## Comparison with Other Test Scripts

### vs. test-logging.js

- **test-logging.js**: Focuses specifically on logging system validation
- **smoke-test-v2.js**: Tests full application workflow end-to-end

Both are complementary and should be run together.

### vs. test-auth.js

- **test-auth.js**: Quick authentication validation
- **smoke-test-v2.js**: Comprehensive testing including authentication plus all other modules

Use `test-auth.js` for quick checks, `smoke-test-v2.js` for complete validation.

## Best Practices

1. **Run Before Deployments**
   
   Always run smoke tests before deploying to staging or production:
   ```bash
   npm run test:smoke && npm run deploy
   ```

2. **Run After Major Changes**
   
   After modifying core modules (encounters, auth, events), run smoke tests:
   ```bash
   node scripts/smoke-test-v2.js --verbose
   ```

3. **Include in Pre-commit Hooks**
   
   Add to `.husky/pre-push`:
   ```bash
   #!/bin/sh
   node scripts/smoke-test-v2.js || exit 1
   ```

4. **Monitor Test Duration**
   
   Track test execution time. Increasing duration may indicate performance issues.

5. **Keep Tests Updated**
   
   When adding new features, update the smoke test to include them.

## Extending the Tests

### Adding New Test Suites

To add a new test suite (e.g., for a new module):

1. **Create Test Function**
   ```javascript
   async function testNewFeature() {
     logSection('TEST X: New Feature');
     
     try {
       logSubSection('XA: Test Something');
       const result = await makeRequest('POST', '/new-feature', {
         headers: { Authorization: `Bearer ${testState.staffToken}` },
         body: { data: 'test' },
       });
       
       if (!result.success) {
         throw new Error('Feature failed');
       }
       
       logSuccess('New feature working');
       
     } catch (error) {
       logError('New feature test failed', error);
       throw error;
     }
   }
   ```

2. **Add CLI Option**
   ```javascript
   const options = {
     // ... existing options
     testNewFeature: args.includes('--test-new-feature'),
   };
   ```

3. **Call in Main**
   ```javascript
   if (options.testNewFeature) {
     await testNewFeature();
   }
   ```

4. **Update Documentation**
   
   Add description to this README and the help text.

### Modifying Test Data

Adjust test data creation in `setupTestData()`:

```javascript
// Add more complex test scenarios
testState.patient = await prisma.patientProfile.create({
  data: {
    // ... your custom data
    allergies: 'Penicillin, Latex',
    conditions: 'Type 2 Diabetes',
  },
});
```

## Related Documentation

- [Test Logging README](./TEST_LOGGING_README.md) - Logging system test documentation
- [Encounter Event Testing](./encounter-event-testing.md) - Event system documentation
- [Quick Start Guide](./QUICK_START.md) - Backend setup guide

## Version History

- **v2.0.0** (Jan 20, 2026) - Complete rewrite with CLI options and comprehensive testing
  - Added selective test execution
  - Added verbose mode
  - Added skip-cleanup option
  - Expanded test coverage to all modules
  - Added detailed documentation

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review server logs with correlation IDs
3. Run with `--verbose` flag for detailed output
4. Check related documentation

## License

Internal use only - Priage Backend Testing Suite
