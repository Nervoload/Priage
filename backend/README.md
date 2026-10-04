# Priage Backend

Hospital patient monitoring and traffic management platform.

## Overview

The backend serves the existing emergency-department workflow and a gated clinic intake and booking preview. The preview creates `INTAKE` encounters, visit contacts and walk-ins for a pinned clinic, then supports slot requests, Terms/Privacy acceptance and Reception confirmation. The gated preview also includes physician Care and appointment confirmation/reminders with separate verified scheduling recovery; local email defaults to capture. Provider delivery and clinic launch remain gated. See the [clinic pilot plan](../docs/CLINIC_PILOT_PLAN.md), [intake rollout](docs/CLINIC_INTAKE_PREVIEW_ROLLOUT.md) and [booking rollout](docs/CLINIC_BOOKING_PREVIEW_ROLLOUT.md).

### Technology Stack

- **Framework**: NestJS (Node.js)
- **Database**: PostgreSQL with Prisma 7
- **Caching/Queue**: Redis with BullMQ
- **Real-time**: Socket.IO
- **Authentication**: Cookie-backed staff sessions with role guards, patient sessions, and partner credentials; JWT assertion verification is available for configured staff SSO

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Setup Database**
   ```bash
   docker-compose up -d postgres redis
   npm run prisma:migrate
   ```

3. **Start Development Server**
   ```bash
   npm run start:dev
   ```

4. **Run Tests**
   ```bash
   npm run test:smoke
   ```

For detailed setup instructions, see [docs/QUICK_START.md](./docs/QUICK_START.md)

## Patient Encounter Workflow

The current flow is:

1. **Intake draft** - Patient supplies a chief complaint and completes the AI interview.
2. **Hospital selection and confirmation** - The draft becomes an `EXPECTED` encounter.
3. **Arrival** - Staff changes `EXPECTED` to `ADMITTED`; this action is currently named `confirm` in one API route.
4. **Triage or waiting** - Staff may move the encounter to `TRIAGE` or `WAITING` and record a CTAS assessment.
5. **Completion** - Staff may move an active encounter to `COMPLETE`; cancellation and unresolved exits also exist.

The gated clinic preview has a separate appointment confirmation action before arrival. A Care workspace for the physician remains to build. See [the proposed state model](../docs/CLINIC_PILOT_PLAN.md#recommended-product-model).

Throughout this workflow:
- Staff can communicate with patients via messaging
- System generates alerts for important events
- All actions are logged with correlation IDs
- Real-time updates via WebSockets

## Project Structure

```
backend/
├── src/
│   ├── modules/
│   │   ├── auth/          # Authentication & authorization
│   │   ├── encounters/    # Encounter management
│   │   ├── patients/      # Patient profiles
│   │   ├── triage/        # Triage assessments
│   │   ├── intake/        # Patient intake
│   │   ├── messaging/     # Staff-patient communication
│   │   ├── alerts/        # Alert system
│   │   ├── events/        # Domain events
│   │   ├── logging/       # Structured logging
│   │   ├── realtime/      # WebSocket gateway
│   │   └── ...
│   ├── common/            # Shared utilities
│   └── main.ts            # Application entry point
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── migrations/        # Database migrations
├── scripts/
│   ├── smoke-test-v2.js   # Comprehensive E2E tests
│   ├── test-logging.js    # Logging system tests
│   └── seed.js            # Local seed data
├── docs/                  # Documentation
└── package.json
```

## Available Commands

### Development
```bash
npm run start:dev          # Start with hot-reload
npm run build              # Build for production
npm run start              # Run production build
```

### Database
```bash
npm run prisma:generate    # Generate Prisma Client
npm run prisma:migrate     # Run migrations
npm run prisma:studio      # Open Prisma Studio UI
```

### Testing
```bash
npm run test:smoke         # Run comprehensive smoke tests
npm run test:smoke:verbose # Run with detailed output
npm run test:logging       # Test logging system
```

## Testing

Priage includes comprehensive testing scripts to validate all system components.

### Smoke Test (Comprehensive E2E)

Tests the complete encounter lifecycle from intake to discharge:

```bash
# Run all tests
npm run test:smoke

# Run specific tests
node scripts/smoke-test-v2.js --test-auth --test-encounters

# Run with verbose output
npm run test:smoke:verbose

# Keep test data for inspection
node scripts/smoke-test-v2.js --skip-cleanup
```

**What it tests**:
- Authentication (staff, nurse, doctor)
- Patient intake and session management
- Encounter status transitions
- Triage assessments (CTAS scoring)
- Messaging between staff and patients
- Alert creation and management
- Complete lifecycle workflow

See [docs/SMOKE_TEST_README.md](./docs/SMOKE_TEST_README.md) for full documentation.

### Logging Test

Validates the structured logging system:

```bash
npm run test:logging
```

See [docs/TEST_LOGGING_README.md](./docs/TEST_LOGGING_README.md) for details.

### Quick Reference

For all testing commands and options, see [docs/TESTING_QUICK_REFERENCE.md](./docs/TESTING_QUICK_REFERENCE.md)

## API Modules

### Authentication (`/auth`)
- User login with JWT tokens
- Role-based access control (STAFF, NURSE, DOCTOR, ADMIN)
- Password hashing with bcrypt

### Encounters (`/encounters`)
- Create and manage patient encounters
- Status transitions (EXPECTED → ADMITTED → TRIAGE → WAITING → COMPLETE)
- List and filter encounters by hospital
- Track timestamps throughout lifecycle

### Triage (`/triage`)
- Create triage assessments with CTAS levels (1-5)
- Priority scoring
- Clinical notes
- Assessment history

### Messaging (`/messaging`)
- Send messages between staff and patients
- Message threading by encounter
- Read receipts
- Support for PATIENT, USER, and SYSTEM senders

### Alerts (`/alerts`)
- Create alerts with severity levels
- Acknowledge and resolve alerts
- Query by hospital or encounter
- Track alert lifecycle

### Intake (`/intake`)
- Patient-initiated encounter creation
- Patient session management (token-based)
- Location tracking (en route)
- Intake detail updates

### Patients (`/patients`)
- Patient profile management
- Health information
- Preferred language
- Demographics

## Database Schema

The database uses PostgreSQL with Prisma ORM. Key models:

- **Encounter** - Central entity for patient visits
- **PatientProfile** - Patient demographics and health info
- **User** - Hospital staff (with roles)
- **Hospital** - Hospital entities
- **TriageAssessment** - CTAS assessments
- **Message** - Staff-patient communication
- **Alert** - System alerts
- **EncounterEvent** - Event log for encounters
- **PatientSession** - Patient authentication sessions

See [prisma/schema.prisma](./prisma/schema.prisma) for complete schema.

## Environment Variables

Required environment variables (`.env` file):

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/priage

# Server
PORT=3000
BASE_URL=http://localhost:3000

# Authentication
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=24h

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Optional
NODE_ENV=development
```

## Key Features

### ✅ Role-Based Access Control
Different endpoints are accessible to different roles:
- **ADMIN** - Full access
- **DOCTOR** - Medical actions (triage, discharge)
- **NURSE** - Triage and patient care
- **STAFF** - Admission and basic operations

### ✅ Structured Logging
All requests include correlation IDs for tracing:
```typescript
@Req() req: Request
// req.correlationId is automatically available
```

### ✅ Event-Driven Architecture
Domain events are emitted for all significant actions:
- Encounter state changes
- Message creation
- Alert generation
- Triage assessments

### ✅ Real-time Updates
WebSocket connections for live updates:
- Encounter status changes
- New messages
- Alert notifications

### ✅ State Machine
Encounters follow a strict state machine:
```
EXPECTED → ADMITTED → TRIAGE → WAITING → COMPLETE
                              ↓
                          CANCELLED
```

## Documentation

- [Quick Start Guide](./docs/QUICK_START.md) - Setup instructions
- [Smoke Test Documentation](./docs/SMOKE_TEST_README.md) - E2E testing
- [Logging Test Documentation](./docs/TEST_LOGGING_README.md) - Logging tests
- [Testing Quick Reference](./docs/TESTING_QUICK_REFERENCE.md) - All testing commands
- [Encounter Event Testing](./docs/encounter-event-testing.md) - Event system
- [New Services Testing](./docs/NEW_SERVICES_TESTING.md) - Service patterns

## Contributing

1. Create a feature branch
2. Make your changes
3. Run tests: `npm run test:smoke`
4. Ensure all tests pass
5. Submit pull request

## Troubleshooting

### Server won't start
- Check PostgreSQL is running: `docker-compose up -d postgres`
- Check Redis is running: `docker-compose up -d redis`
- Verify environment variables in `.env`

### Tests failing
- Ensure server is running: `npm run start:dev`
- Run with verbose: `npm run test:smoke:verbose`
- Check database is migrated: `npm run prisma:migrate`

### Database issues
- Reset database: `npm run prisma:migrate:reset`
- View database: `npm run prisma:studio`

For more troubleshooting, see [docs/SMOKE_TEST_README.md#troubleshooting](./docs/SMOKE_TEST_README.md#troubleshooting)

## License

Internal use only - Priage Hospital Management System

---

**Version**: 0.1.0
**Last Updated**: September 26, 2026
**Maintained By**: John Surette

### Clinic appointment communications

The gated clinic preview now supports transactional confirmation/reminders, Resend and local capture delivery, Reception delivery history, Admin email settings and separate verified scheduling recovery. See the [communications rollout](docs/CLINIC_COMMUNICATIONS_PREVIEW_ROLLOUT.md) for configuration, US external processing, test modes and launch gates. Run `npm run test:clinic-communications-smoke` against a loopback mock PostgreSQL database after building.
