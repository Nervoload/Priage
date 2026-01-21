# Logging Test Suite - Quick Start Guide

## 🚀 Quick Start

### Step 1: Setup Test Data
```bash
npm run test:logging:setup
```

This creates:
- Test hospital: "Test Hospital"
- Test user: test-logger@hospital.com (password: TestPassword123!)
- Test patient for creating encounters

### Step 2: Start Server
```bash
npm run start:dev
```

Wait for the server to fully initialize (you'll see all services initialized).

### Step 3: Run Tests
```bash
# In a new terminal
npm run test:logging
```

## 📊 What Gets Tested

### ✅ 8 Test Categories, 40+ Individual Tests:

1. **Authentication Logging**
   - Failed login attempts
   - Successful login
   - JWT validation

2. **Encounter Workflow**
   - Create encounter
   - List encounters
   - State transitions

3. **Database & Network**
   - Prisma connection logging
   - WebSocket initialization

4. **Error Handling**
   - 404 errors
   - Validation errors
   - Authorization errors

5. **Fatal Error Simulation**
   - Invalid state transitions
   - Error report generation

6. **Logger Service Health**
   - Stats endpoint
   - Query by service
   - Query by level

7. **Additional Services**
   - Messaging service
   - Alerts service
   - Triage service

8. **Newly Added Services** ⭐ NEW
   - Intake service (patient onboarding)
   - Patients service (profile queries)
   - Users service (staff management)
   - Hospitals service (dashboard & queue)

## 📋 Expected Output

```
================================================================================
LOGGING SYSTEM AUTOMATED TEST SUITE
================================================================================

[timestamp] ℹ️  Testing comprehensive logging implementation
[timestamp] ℹ️  Target: http://localhost:3000
[timestamp] ✅ Server health check passed

================================================================================
TEST 1: Authentication Logging
================================================================================

[timestamp] ℹ️  Test 1A: Testing failed login (user not found)...
[timestamp] ✅ Test 1A: Correctly rejected invalid login
[timestamp] ✅ Test 1A: Auth error logging verified

... (more tests)

================================================================================
TEST SUMMARY
================================================================================

[timestamp] ℹ️  Total Tests: 40
[timestamp] ✅ Passed: 38
[timestamp] ❌ Failed: 0
[timestamp] ⚠️  Skipped: 2
[timestamp] ℹ️  Pass Rate: 95.0%

[timestamp] ✅ 🎉 ALL TESTS PASSED! Logging system is working correctly.
```

## 🎯 Success Criteria

- ✅ All authentication logs captured
- ✅ Correlation IDs present in all requests
- ✅ Error logs include stack traces
- ✅ Database connection logs visible
- ✅ Service initialization logs present
- ✅ Error reports can be generated
- ✅ Log queries work correctly
- ✅ **Patient onboarding fully tracked (NEW)**
- ✅ **Dashboard queries logged (NEW)**
- ✅ **Queue monitoring tracked (NEW)**
- ✅ **Staff management logged (NEW)**

## 📈 Coverage Statistics

After running all tests, you should see:

- **189+ log statements** across 13 services
- **87% module coverage** (13/15 modules)
- **100% critical service coverage**
- **Complete patient journey tracking**
- **Full WebSocket debugging capability**

## 🔍 Additional Test Suggestions

Here are more test ideas you might want to add:

### Performance Testing
```javascript
async function testLoggingPerformance() {
  // Measure logging overhead
  // Verify <1ms per operation
  // Test with 1000+ concurrent requests
}
```

### Memory Testing
```javascript
async function testLoggingMemoryLimits() {
  // Verify max 10k logs limit
  // Test automatic cleanup
  // Verify memory doesn't grow unbounded
}
```

### Correlation Tracking
```javascript
async function testCorrelationPropagation() {
  // Pass x-correlation-id in request
  // Verify it's used throughout request
  // Test correlation across services
}
```

### Sensitive Data
```javascript
async function testSensitiveDataSanitization() {
  // Verify passwords not logged
  // Verify tokens sanitized
  // Test LoggingService.sanitizeData()
}
```

### Log Retention
```javascript
async function testLogRetention() {
  // Create logs
  // Wait 25 hours (past retention)
  // Verify logs cleaned up
}
```

### Concurrent Requests
```javascript
async function testConcurrentLogging() {
  // Send 100 parallel requests
  // Verify all logs captured
  // Verify no race conditions
}
```

### Error Report Export
```javascript
async function testErrorReportExport() {
  // Generate error report
  // Export as JSON
  // Verify structure
  // Test user-shareable format
}
```

### WebSocket Logging
```javascript
async function testWebSocketLogging() {
  // Connect WebSocket client
  // Verify connection logs
  // Test disconnect logs
  // Verify room subscription logs
}
```

### Job Queue Logging
```javascript
async function testJobQueueLogging() {
  // Trigger event poll job
  // Verify job execution logs
  // Test alert reassessment logs
  // Verify batch processing logs
}
```

### Hospital-Specific Features
```javascript
async function testAuditTrailCompliance() {
  // Create patient data access
  // Verify audit trail
  // Test critical operation markers
  // Verify HIPAA compliance fields
}
```

## 🐛 Troubleshooting

### Server Not Running
```bash
# Start server in one terminal
npm run start:dev

# Run tests in another terminal
npm run test:logging
```

### Test User Doesn't Exist
```bash
npm run test:logging:setup
```

### Database Connection Failed
```bash
# Check .env file
DATABASE_URL="postgresql://..."

# Test connection
npx prisma db pull
```

### Tests Timeout
Increase sleep times in test script:
```javascript
await sleep(2000); // Increase from 1000 to 2000
```

## 📝 Customization

### Change Test User
Edit `scripts/test-logging.js`:
```javascript
const CONFIG = {
  testEmail: 'your-test@email.com',
  testPassword: 'YourPassword123!',
};
```

### Change Base URL
```bash
BASE_URL=http://localhost:4000 npm run test:logging
```

### Add Custom Tests
See `scripts/TEST_LOGGING_README.md` for detailed examples.

## 🎓 Best Practices

1. **Run Before Deploy**: Always run before production deployment
2. **Clean Database**: Use test database, not production
3. **Check Warnings**: Review warnings even if tests pass
4. **CI Integration**: Add to GitHub Actions / CI pipeline
5. **Update Tests**: Add tests when new services are created

## 📚 Additional Resources

- Full documentation: `scripts/TEST_LOGGING_README.md`
- Logging implementation: `src/modules/logging/README.md`
- Quick start guide: `src/modules/logging/QUICKSTART.md`
- Verification report: `LOGGING_VERIFICATION_REPORT.md`
- Integration review: `CROSS_AGENT_INTEGRATION_REVIEW.md`

## 💡 Pro Tips

- Use `grep` to filter test output: `npm run test:logging | grep "✅"`
- Save output to file: `npm run test:logging > test-results.txt`
- Run specific test categories by commenting out others in `runAllTests()`
- Increase verbosity by setting LOG_LEVEL=debug before running

## 🤝 Contributing

To add new tests:
1. Create test function following naming pattern
2. Use `logSection`, `logSuccess`, `logError` for output
3. Verify logs with `verifyLogsExist()`
4. Add to `runAllTests()` sequence
5. Update this README with new test description

---

**Ready to test?** 🚀
```bash
npm run test:logging:setup  # One time setup
npm run test:logging        # Run tests
```
