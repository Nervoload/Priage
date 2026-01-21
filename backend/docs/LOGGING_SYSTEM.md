# Priage Logging System Documentation

## Overview

The Priage logging system is a hospital-grade, production-ready logging infrastructure designed to provide comprehensive request tracing, error reporting, and system monitoring across the entire NestJS backend. The system implements correlation-based request tracking, in-memory log storage with automatic retention management, and rich contextual logging to support debugging, auditing, and performance analysis.

## Architecture

### Core Components

The logging system consists of three primary components working together:

1. **LoggingService** - Central logging service that collects, stores, and manages all log entries
2. **ErrorReportService** - Generates comprehensive error reports with system metrics and reproduction context
3. **CorrelationMiddleware** - Express middleware that assigns unique correlation IDs to every incoming request

### Data Flow

```
1. HTTP Request arrives → CorrelationMiddleware assigns correlationId
2. Controller receives request → Passes correlationId to service layer
3. Service performs operations → Calls loggingService.info/warn/error/debug
4. LoggingService stores log → In-memory Map with 24hr retention
5. Developer queries logs → REST API or direct service access
6. Error occurs → ErrorReportService generates comprehensive report
```

## Features

### 1. Correlation-Based Request Tracing

Every HTTP request receives a unique correlation ID that follows the request through its entire lifecycle. This enables developers to:

- Track a single request across multiple services and operations
- Reconstruct the complete execution path for any request
- Group related log entries together for analysis
- Debug complex issues by following the request flow

**Implementation:**
```typescript
// Middleware automatically adds correlationId to req object
req.correlationId = req.headers['x-correlation-id'] || uuidv4();

// Controller passes it to service
async createEncounter(@Req() req: Request, @Body() dto: CreateEncounterDto) {
  return this.encountersService.create(dto, req.correlationId);
}

// Service uses it in all logging calls
this.loggingService.info('Creating encounter', {
  service: 'EncountersService',
  operation: 'create',
  correlationId,
  patientId,
  hospitalId
});
```

### 2. In-Memory Log Storage

Logs are stored in memory using a Map-based structure that provides fast access and automatic cleanup:

- **Storage Structure:** `Map<correlationId, LogEntry[]>`
- **Retention Period:** 24 hours (configurable)
- **Size Limit:** 10,000 logs maximum (oldest removed first)
- **Performance:** O(1) lookup by correlation ID
- **Auto-Cleanup:** Background job runs every hour to remove expired logs

**Benefits:**
- No database writes during normal operations (performance)
- Fast log retrieval for recent requests
- Automatic memory management prevents unbounded growth
- Suitable for production environments with reasonable traffic

### 3. Structured Logging Context

Every log entry includes rich contextual information structured for easy querying:

```typescript
interface LogEntry {
  id: string;                    // Unique log entry ID (UUID)
  timestamp: Date;               // When the log was created
  level: LogLevel;               // info | warn | error | debug
  message: string;               // Human-readable log message
  context: LogContext;           // Structured context data
}

interface LogContext {
  service: string;               // Service name (e.g., 'EncountersService')
  operation: string;             // Method name (e.g., 'create')
  correlationId?: string;        // Request correlation ID
  userId?: number;               // Authenticated user ID
  hospitalId?: number;           // Hospital context
  encounterId?: number;          // Encounter context
  patientId?: number;            // Patient context
  data?: Record<string, any>;    // Additional operation-specific data
  error?: {                      // Error details (for error logs)
    name: string;
    message: string;
    stack?: string;
  };
}
```

### 4. Multiple Log Levels

The system supports four log levels for different scenarios:

| Level | Usage | Examples |
|-------|-------|----------|
| **DEBUG** | High-frequency, low-priority operations | Profile queries, cache hits, routine lookups |
| **INFO** | Normal operations and milestones | Patient admission, triage completion, message sent |
| **WARN** | Potential issues that don't stop execution | Entity not found, invalid tokens, deprecated API usage |
| **ERROR** | Failures requiring attention | Database errors, authentication failures, validation errors |

**Best Practices:**
- Use **DEBUG** for operations that happen frequently (>100/min per service)
- Use **INFO** for business-critical milestones and state changes
- Use **WARN** for expected error cases that are handled gracefully
- Use **ERROR** for unexpected failures that indicate bugs or system issues

### 5. RESTful Logging API

The logging system exposes six REST endpoints for log access and analysis:

#### GET `/logging/error-reports/generate?correlationId=xxx`
Generates a comprehensive error report for a specific request.

**Response:**
```json
{
  "correlationId": "uuid",
  "timestamp": "2026-01-20T12:34:56.789Z",
  "logs": [/* all log entries */],
  "errors": [/* error entries only */],
  "systemMetrics": {
    "database": { "connected": true, "pool": { "total": 20, "idle": 18, "active": 2 } },
    "websocket": { "connected": 4, "rooms": 12 },
    "memory": { "heapUsed": "45 MB", "heapTotal": "89 MB" },
    "uptime": "1d 4h 23m"
  }
}
```

#### GET `/logging/error-reports/:reportId/export`
Downloads error report as a formatted text file for offline analysis.

#### GET `/logging/error-reports/:reportId`
Retrieves an existing error report by its ID.

#### GET `/logging/correlation/:correlationId`
Retrieves all log entries for a specific correlation ID.

**Response:**
```json
[
  {
    "id": "uuid",
    "timestamp": "2026-01-20T12:34:56.789Z",
    "level": "info",
    "message": "Creating encounter",
    "context": { /* ... */ }
  }
]
```

#### GET `/logging/query?service=X&level=Y&limit=Z`
Query logs by service name, log level, or both.

**Parameters:**
- `service` - Filter by service name (e.g., `EncountersService`)
- `level` - Filter by log level (`debug`, `info`, `warn`, `error`)
- `limit` - Maximum results to return (default: 100)

#### GET `/logging/stats`
Retrieves logging system statistics.

**Response:**
```json
{
  "totalLogs": 1247,
  "byLevel": { "debug": 823, "info": 389, "warn": 31, "error": 4 },
  "byService": { "EncountersService": 456, "AlertsService": 123, /* ... */ },
  "oldestLog": "2026-01-19T08:15:22.000Z",
  "newestLog": "2026-01-20T12:34:56.789Z"
}
```

### 6. Triple-Layer Error Handling

The logging system itself never throws errors, ensuring it cannot disrupt application functionality:

**Layer 1: Try-Catch Blocks**
```typescript
try {
  // Logging operation
} catch (error) {
  // Fall to Layer 2
}
```

**Layer 2: Console Fallback**
```typescript
catch (error) {
  console.error('[LoggingService] Error:', error);
  // Fall to Layer 3
}
```

**Layer 3: Silent Fail**
```typescript
catch (error) {
  // Silent fail - application continues
}
```

This approach guarantees that logging failures never cause application downtime.

## How to Add Logging to Your Code

### Step 1: Inject LoggingService

Add the `LoggingService` to your service constructor:

```typescript
import { Injectable } from '@nestjs/common';
import { LoggingService } from '../logging/logging.service';

@Injectable()
export class YourService {
  constructor(
    private readonly loggingService: LoggingService,
    // ... other dependencies
  ) {}
}
```

### Step 2: Add Logging Calls

Add logging calls at the beginning and end of important operations:

```typescript
async createSomething(dto: CreateDto, correlationId?: string) {
  // Log operation start
  this.loggingService.info('Creating something', {
    service: 'YourService',
    operation: 'createSomething',
    correlationId,
    data: { field: dto.field }
  });

  try {
    // Your business logic here
    const result = await this.prisma.something.create({ data: dto });

    // Log success
    this.loggingService.info('Something created successfully', {
      service: 'YourService',
      operation: 'createSomething',
      correlationId,
      data: { id: result.id }
    });

    return result;
  } catch (error) {
    // Log errors
    this.loggingService.error('Failed to create something', {
      service: 'YourService',
      operation: 'createSomething',
      correlationId,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    });
    throw error; // Re-throw after logging
  }
}
```

### Step 3: Pass CorrelationId from Controller

Ensure your controller passes the correlation ID to service methods:

```typescript
import { Controller, Post, Body, Req } from '@nestjs/common';
import { Request } from 'express';

@Controller('your-resource')
export class YourController {
  constructor(private readonly yourService: YourService) {}

  @Post()
  async create(@Req() req: Request, @Body() dto: CreateDto) {
    return this.yourService.createSomething(dto, req.correlationId);
  }
}
```

### Step 4: Add Method Parameter (If Needed)

If the service method doesn't have a `correlationId` parameter, add it:

```typescript
// Before
async getSomething(id: number) { }

// After
async getSomething(id: number, correlationId?: string) { }
```

Make it optional (`?`) to avoid breaking existing callers.

## Logging Best Practices

### 1. Choose the Right Log Level

```typescript
// DEBUG - High frequency, low priority
this.loggingService.debug('Cache hit', { service, operation, correlationId });

// INFO - Business milestones
this.loggingService.info('Patient admitted', { service, operation, correlationId, patientId });

// WARN - Expected errors
this.loggingService.warn('Patient not found', { service, operation, correlationId, patientId });

// ERROR - Unexpected failures
this.loggingService.error('Database connection failed', { service, operation, correlationId, error });
```

### 2. Include Relevant Context

Always include the minimum required context plus operation-specific identifiers:

```typescript
// Minimum context
{ service: 'YourService', operation: 'methodName', correlationId }

// Add relevant entity IDs
{ service, operation, correlationId, patientId, encounterId }

// Add operation-specific data
{ service, operation, correlationId, data: { status: 'ADMITTED', priority: 3 } }
```

### 3. Log at Operation Boundaries

Add logs at the start and completion of operations:

```typescript
async processPatient(patientId: number, correlationId?: string) {
  // Start
  this.loggingService.info('Processing patient', { service, operation, correlationId, patientId });
  
  // ... business logic ...
  
  // Success
  this.loggingService.info('Patient processed successfully', { service, operation, correlationId, patientId });
}
```

### 4. Don't Log Sensitive Data

Avoid logging passwords, tokens, or PHI (Protected Health Information):

```typescript
// ❌ BAD - Logs sensitive data
this.loggingService.info('User login', { 
  service, operation, correlationId,
  data: { email, password } // DON'T DO THIS
});

// ✅ GOOD - Logs safe identifiers only
this.loggingService.info('User login successful', { 
  service, operation, correlationId,
  userId: user.id
});
```

### 5. Use Meaningful Messages

Write clear, searchable log messages:

```typescript
// ❌ BAD - Vague messages
this.loggingService.info('Done', { service, operation });
this.loggingService.error('Error', { service, operation });

// ✅ GOOD - Specific messages
this.loggingService.info('Triage assessment completed', { service, operation });
this.loggingService.error('Failed to update encounter status', { service, operation });
```

### 6. Don't Await Logging Calls

Logging is fire-and-forget to avoid performance impact:

```typescript
// ❌ BAD - Awaiting logging
await this.loggingService.info('Message', context);

// ✅ GOOD - Fire and forget
this.loggingService.info('Message', context);
```

## Service Coverage

The logging system is integrated into 13 of 15 backend modules (87% coverage):

### Critical Services (100% Coverage)

| Service | Log Statements | Key Operations Logged |
|---------|---------------|-----------------------|
| **EncountersService** | 17 | Create, update status, admit, discharge, patient journey |
| **AlertsService** | 20 | Create alerts, acknowledge, resolve, notifications |
| **MessagingService** | 14 | Send messages, real-time delivery, history queries |
| **TriageService** | 8 | Assessments, CTAS scoring, queue management |
| **AuthService** | 9 | Login, registration, token validation, security events |
| **IntakeService** | 8 | Patient onboarding, intent creation, hospital selection |
| **PrismaService** | 9 | Database connections, health checks, pool management |
| **EventsService** | 8 | Event dispatch, processing, job scheduling |
| **JobsService** | 7 | Job execution, recurring tasks, queue processing |
| **RealtimeGateway** | 15 | WebSocket connections, room joins, event emissions |
| **PatientsService** | 3 | Profile queries, encounter history |
| **UsersService** | 7 | Staff management, user queries, hospital staff lists |
| **HospitalsService** | 7 | Hospital details, dashboard metrics, queue status |

### Not Yet Covered

- **AssetsService** - Planned for future implementation
- **HealthController** - Simple health checks, low priority

## Performance Considerations

### Memory Usage

The in-memory log storage is designed for production use with automatic size management:

- **Average log size:** ~500 bytes
- **Maximum logs:** 10,000
- **Maximum memory:** ~5 MB
- **Retention period:** 24 hours
- **Cleanup frequency:** Every 1 hour

### Performance Impact

Logging operations are optimized to minimize performance impact:

- **Log write:** O(1) - Direct Map insertion
- **Log read:** O(1) - Direct Map lookup by correlation ID
- **Query by service/level:** O(n) - Full scan with filter
- **No I/O blocking:** Fire-and-forget logging pattern
- **No async overhead:** Synchronous operations where possible

### Production Recommendations

For high-traffic production environments:

1. **Monitor memory usage** - Use the `/logging/stats` endpoint
2. **Adjust retention** - Lower to 12 hours if memory is constrained
3. **Consider external storage** - For compliance or long-term analysis
4. **Use DEBUG sparingly** - In high-traffic services (disable in production if needed)
5. **Rate limit queries** - Protect the `/logging/query` endpoint

## Troubleshooting

### Logs Not Appearing

**Problem:** Logs aren't showing up in the logging system.

**Solutions:**
1. Verify LoggingService is injected in the service constructor
2. Confirm you're calling `loggingService.info()` not `this.logger.log()` (NestJS Logger)
3. Check that the correlation ID is being passed from controller to service
4. Ensure the logging module is imported in your module's imports array

### Correlation IDs Missing

**Problem:** Logs are created but correlation IDs are undefined.

**Solutions:**
1. Verify CorrelationMiddleware is registered in `main.ts`
2. Confirm controllers inject `@Req() req: Request`
3. Check that `req.correlationId` is passed to service methods
4. Ensure service methods have `correlationId?: string` parameter

### Memory Growth

**Problem:** Application memory usage growing over time.

**Solutions:**
1. Check `/logging/stats` to see total log count
2. Verify auto-cleanup is running (check logs for cleanup messages)
3. Reduce retention period in LoggingService configuration
4. Lower the maximum log limit from 10,000 to 5,000
5. Consider switching DEBUG logs to INFO in high-traffic services

### Test Failures

**Problem:** Logging tests failing despite logs appearing in logs.

**Solutions:**
1. Verify the test is using the correct correlation ID
2. Add a small delay (`await sleep(500)`) between request and log query
3. Check that the service is using LoggingService not NestJS Logger
4. Ensure the controller is passing correlation ID to the service
5. Verify log message strings match exactly (case-sensitive)

## Integration with Error Reporting

When errors occur, users can generate comprehensive error reports to send to developers:

### User Workflow

1. User encounters an error in the UI
2. UI displays correlation ID (from response headers)
3. User clicks "Report Error" button
4. System calls `GET /logging/report/:correlationId`
5. User receives formatted report with all context
6. User sends report to development team

### Developer Workflow

1. Receive error report from user
2. Review complete request timeline
3. Examine error logs and stack traces
4. Check system metrics at time of error
5. Review business context (patient, encounter, hospital)
6. Reproduce issue using exact parameters from report

## Future Enhancements

### Planned Features

1. **Persistent Storage** - Option to store logs in PostgreSQL for compliance
2. **Log Streaming** - Real-time log streaming via WebSocket for monitoring dashboards
3. **Advanced Filtering** - Full-text search and complex query support
4. **Aggregation** - Pre-computed statistics and trends over time
5. **Alerting** - Automated alerts for error rate thresholds
6. **Performance Metrics** - Automatic duration tracking for operations
7. **Distributed Tracing** - Support for multi-service architectures

### Considerations

- **Database storage** would require migration scripts and retention policies
- **Log streaming** would need authentication and authorization
- **Advanced querying** may require Elasticsearch or similar technology
- **Performance tracking** should not add significant overhead

## Conclusion

The Priage logging system provides hospital-grade logging infrastructure with comprehensive request tracing, error reporting, and system monitoring. With 132 log statements across 13 services covering 87% of the backend, the system tracks the complete patient journey from registration through discharge, enabling rapid debugging, compliance auditing, and performance analysis.

For questions or feature requests, contact the development team or create an issue in the project repository.
