# Testing Scripts Quick Reference

This document provides a quick overview of all testing scripts available in the Priage backend.

## Available Test Scripts

### 1. Smoke Test (Comprehensive E2E)
**File**: `scripts/smoke-test-v2.js`  
**Documentation**: [docs/SMOKE_TEST_README.md](./SMOKE_TEST_README.md)

Full end-to-end testing of the entire encounter lifecycle.

```bash
# Run all tests
npm run test:smoke

# Run with verbose output
npm run test:smoke:verbose

# Run with options
node scripts/smoke-test-v2.js [options]
```

**Options**:
- `-h, --help` - Show help
- `-v, --verbose` - Verbose logging
- `-s, --skip-cleanup` - Keep test data
- `-a, --test-auth` - Test authentication only
- `-i, --test-intake` - Test patient intake only
- `-e, --test-encounters` - Test encounter management only
- `-t, --test-triage` - Test triage assessments only
- `-m, --test-messaging` - Test messaging only
- `--test-alerts` - Test alerts only

**What it tests**:
- ✅ Authentication (staff, nurse, doctor login)
- ✅ Patient intake (create intent, update details, location)
- ✅ Encounter management (create, list, status transitions)
- ✅ Triage assessments (CTAS scoring, priority, notes)
- ✅ Messaging (staff-patient communication)
- ✅ Alerts (create, acknowledge, resolve)
- ✅ Complete encounter lifecycle (intake → discharge)

**When to use**:
- Before deployments
- After major backend changes
- Regular regression testing
- CI/CD pipelines

---

### 2. Logging Test
**File**: `scripts/test-logging.js`  
**Documentation**: [docs/TEST_LOGGING_README.md](./TEST_LOGGING_README.md)

Comprehensive testing of the logging system.

```bash
# Run logging tests
npm run test:logging

# Setup test user for logging tests
npm run test:logging:setup
```

**What it tests**:
- ✅ Authentication logging
- ✅ Encounter workflow logging
- ✅ Database connection logging
- ✅ Error logging (404, validation, auth)
- ✅ Fatal error simulation
- ✅ Correlation ID tracking
- ✅ Log retrieval and verification

**When to use**:
- Testing logging system changes
- Validating log output
- Debugging logging issues
- Verifying correlation ID propagation

---

### 3. Authentication Test
**File**: `scripts/test-auth.js`

Quick authentication validation.

```bash
node scripts/test-auth.js
```

**What it tests**:
- ✅ Login with test user
- ✅ Token generation
- ✅ Protected route access
- ✅ Authorization checks

**When to use**:
- Quick auth validation
- Debugging authentication issues
- Testing JWT configuration

---

### 4. Legacy Smoke Test
**File**: `scripts/smoke-test.js`

Original smoke test (use smoke-test-v2.js instead).

```bash
node scripts/smoke-test.js
```

**Status**: Legacy - use `smoke-test-v2.js` for comprehensive testing

---

## Test Comparison Matrix

| Feature | Smoke Test v2 | Logging Test | Auth Test | Legacy Smoke |
|---------|--------------|--------------|-----------|--------------|
| **Authentication** | ✅ | ✅ | ✅ | ✅ |
| **Patient Intake** | ✅ | ❌ | ❌ | ⚠️ |
| **Encounters** | ✅ | ✅ | ❌ | ✅ |
| **Triage** | ✅ | ❌ | ❌ | ❌ |
| **Messaging** | ✅ | ❌ | ❌ | ❌ |
| **Alerts** | ✅ | ❌ | ❌ | ❌ |
| **Logging** | ⚠️ | ✅ | ❌ | ❌ |
| **CLI Options** | ✅ | ✅ | ❌ | ❌ |
| **Selective Testing** | ✅ | ✅ | ❌ | ❌ |
| **Documentation** | ✅ | ✅ | ❌ | ❌ |

Legend: ✅ Full support | ⚠️ Partial | ❌ Not supported

---

## Common Testing Workflows

### Before Deployment
```bash
# Full validation
npm run test:smoke

# Include logging tests
npm run test:logging
npm run test:smoke
```

### After Code Changes

#### Changed Authentication Module
```bash
node scripts/smoke-test-v2.js --test-auth --verbose
```

#### Changed Encounter Management
```bash
node scripts/smoke-test-v2.js --test-encounters --test-triage --verbose
```

#### Changed Messaging or Alerts
```bash
node scripts/smoke-test-v2.js --test-messaging --test-alerts
```

#### Changed Logging System
```bash
npm run test:logging
```

### Debugging Issues

#### Keep Test Data for Inspection
```bash
node scripts/smoke-test-v2.js --skip-cleanup --verbose
# Then inspect database with printed IDs
```

#### Test Specific Module Only
```bash
# Test only triage
node scripts/smoke-test-v2.js -t -v

# Test only messaging
node scripts/smoke-test-v2.js -m -v
```

#### Trace Requests Through System
```bash
# Run with verbose to see correlation IDs
node scripts/smoke-test-v2.js -v

# Then query logs with correlation ID
SELECT * FROM logs WHERE correlation_id LIKE 'smoke-test-%';
```

---

## Environment Setup

All test scripts require:

1. **Running Server**
   ```bash
   npm run start:dev
   ```

2. **Database Connection**
   ```env
   DATABASE_URL=postgresql://user:password@localhost:5432/priage
   ```

3. **Environment Variables**
   ```env
   BASE_URL=http://localhost:3000
   JWT_SECRET=your-secret-key
   ```

4. **Database Migrations**
   ```bash
   npm run prisma:migrate
   ```

---

## CI/CD Integration

### GitHub Actions Example
```yaml
- name: Run smoke tests
  run: npm run test:smoke

- name: Run logging tests
  run: npm run test:logging
```

### Pre-commit Hook
```bash
#!/bin/sh
# .husky/pre-push
npm run test:smoke || exit 1
```

---

## Test Data Management

### Cleanup Strategy

**Smoke Test v2**:
- Auto-cleanup by default
- Use `--skip-cleanup` to preserve data
- Creates isolated test data with UUID suffixes

**Logging Test**:
- Creates `test-logger@hospital.com` user
- May require manual cleanup of old test data

### Manual Cleanup
```sql
-- Clean up test hospitals
DELETE FROM hospitals WHERE name LIKE '%test%' OR slug LIKE '%test%';

-- Clean up test users
DELETE FROM users WHERE email LIKE '%@test.com';

-- Clean up test patients
DELETE FROM patient_profiles WHERE email LIKE '%@test.com';
```

---

## Adding New Tests

### To Smoke Test v2

1. Add test function in `scripts/smoke-test-v2.js`
2. Add CLI option parsing
3. Add to main execution flow
4. Update help text
5. Update documentation

### Creating New Test Script

1. Follow pattern from existing scripts
2. Use correlation IDs for tracing
3. Include cleanup logic
4. Add npm script to `package.json`
5. Document in this guide

---

## Troubleshooting

### Tests Failing?

1. **Check server is running**: `curl http://localhost:3000/health`
2. **Check database connection**: `psql $DATABASE_URL -c "SELECT 1;"`
3. **Run with verbose**: Add `-v` flag
4. **Check server logs**: Watch `npm run start:dev` output
5. **Keep test data**: Use `--skip-cleanup` to inspect

### Common Errors

**Connection refused**: Server not running  
**401 Unauthorized**: Auth module issue or JWT secret missing  
**404 Not Found**: Endpoint removed or changed  
**500 Internal Server**: Check server logs for stack trace  
**Database constraint violation**: Old test data not cleaned up

---

## Documentation Links

- [Smoke Test README](./SMOKE_TEST_README.md) - Comprehensive smoke test docs
- [Test Logging README](./TEST_LOGGING_README.md) - Logging test docs
- [Quick Start Guide](./QUICK_START.md) - Backend setup
- [Encounter Event Testing](./encounter-event-testing.md) - Event system docs

---

## Quick Commands Cheat Sheet

```bash
# Run all tests
npm run test:smoke

# Run with verbose output
npm run test:smoke:verbose

# Test specific modules
node scripts/smoke-test-v2.js -a -e    # Auth + Encounters
node scripts/smoke-test-v2.js -t -m    # Triage + Messaging

# Keep data for debugging
node scripts/smoke-test-v2.js -s -v

# Test logging system
npm run test:logging

# Quick auth check
node scripts/test-auth.js

# Show help
node scripts/smoke-test-v2.js --help
```

---

**Last Updated**: January 20, 2026  
**Maintained By**: John Surette
