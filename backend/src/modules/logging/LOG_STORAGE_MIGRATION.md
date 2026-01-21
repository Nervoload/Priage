# Log Storage Migration Guide

## Overview

This implementation adds persistent log storage using Prisma and PostgreSQL. The system supports two storage modes:

1. **In-Memory (Development)**: Default mode, uses Map-based storage in memory
2. **Database (Production)**: Uses PostgreSQL for persistent storage

## Storage Mode Configuration

Set the `LOG_STORAGE` environment variable to control which storage mode is used:

```bash
# Development (in-memory storage) - default if not set
# LOG_STORAGE not set, or set to any value other than "database"

# Production (database storage)
LOG_STORAGE=database
```

If `LOG_STORAGE` is not set or set to any value other than `database`, the system defaults to in-memory storage.

## Database Migration

To enable database storage, you need to run the Prisma migration:

```bash
cd backend
npm run prisma:migrate
```

This will create the `Log` table in your PostgreSQL database with the following schema:

```prisma
model Log {
  id            String   @id @default(uuid())
  timestamp     DateTime @default(now())
  level         LogLevel
  message       String
  correlationId String?
  service       String
  operation     String
  userId        Int?
  patientId     Int?
  hospitalId    Int?
  encounterId   Int?
  context       Json?
  data          Json?
  error         Json?
  
  @@index([correlationId, timestamp])
  @@index([level, timestamp])
  @@index([hospitalId, timestamp])
  @@index([userId, timestamp])
  @@index([timestamp])
}
```

## Files Added/Modified

### New Files:
- `backend/src/modules/logging/log-repository.service.ts` - Database operations for log storage

### Modified Files:
- `backend/prisma/schema.prisma` - Added Log model and LogLevel enum
- `backend/src/modules/logging/logging.service.ts` - Added support for database storage
- `backend/src/modules/logging/logging.module.ts` - Added LogRepositoryService provider

## Production Setup

1. Ensure your `.env` file has a valid `DATABASE_URL`
2. Run the migration: `npm run prisma:migrate`
3. Set environment variable: `LOG_STORAGE=database`
4. Start your application

## Benefits

- **Scalability**: Database storage eliminates memory constraints
- **Persistence**: Logs survive server restarts
- **Queryability**: Advanced filtering and searching capabilities
- **Retention**: Automatic cleanup of old logs (24-hour retention by default)
- **Development**: In-memory mode for fast local development without database overhead

## Implementation Notes

- The implementation is designed to never crash the application - logging failures are caught and logged to console
- Log cleanup runs every hour to remove logs older than 24 hours
- Database queries are limited to 1000 results to prevent excessive memory usage
- All context fields are indexed for fast queries
