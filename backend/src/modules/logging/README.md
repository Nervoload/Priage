# Logging System - Phase 1 Implementation

## Overview

This logging system provides **hospital-grade error tracking and reporting** with:
- ✅ Request correlation across all services
- ✅ Centralized log aggregation
- ✅ User-exportable error reports
- ✅ Full request chain reconstruction
- ✅ System health metrics

## Architecture

```
User Request → Correlation Middleware → Services → LoggingService → ErrorReportService
                    ↓                       ↓
              correlationId            Structured Logs
                    ↓                       ↓
            All Logs Linked    ← Error Report Generation
```

## Core Components

### 1. **CorrelationMiddleware**
- Adds unique `correlationId` to every HTTP request
- Links all logs from a single user action
- Available in `req.correlationId` throughout the app

### 2. **LoggingService**
- Central aggregation point for all logs
- Stores logs by correlation ID
- Provides query API
- Auto-cleanup old logs (24hr retention)

### 3. **ErrorReportService**
- Generates comprehensive error reports
- Captures system state at time of error
- Creates exportable reports for users
- Unique report IDs (e.g., `ERR-2026-A3F2`)

## Usage Guide

### Basic Logging in Services

```typescript
import { Injectable } from '@nestjs/common';
import { LoggingService } from '../logging/logging.service';
import { LogLevel } from '../logging/types/log-entry.type';

@Injectable()
export class MyService {
  constructor(private readonly loggingService: LoggingService) {}

  async myMethod(dto: any, req?: Express.Request) {
    const correlationId = req?.correlationId;
    
    try {
      // Log operation start
      await this.loggingService.info('Starting operation', {
        correlationId,
        service: 'MyService',
        operation: 'myMethod',
        userId: dto.userId,
      });

      // Your business logic
      const result = await this.doSomething(dto);

      // Log success
      await this.loggingService.info('Operation completed', {
        correlationId,
        service: 'MyService',
        operation: 'myMethod',
        userId: dto.userId,
      }, { resultId: result.id });

      return result;
    } catch (error) {
      // Log error with full context
      await this.loggingService.error(
        'Operation failed',
        {
          correlationId,
          service: 'MyService',
          operation: 'myMethod',
          userId: dto.userId,
        },
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }
}
```

### Controller Integration

```typescript
@Controller('my-resource')
export class MyController {
  constructor(
    private readonly myService: MyService,
    private readonly errorReportService: ErrorReportService,
  ) {}

  @Post()
  async create(@Body() dto: CreateDto, @Req() req: Request) {
    try {
      return await this.myService.create(dto, req);
    } catch (error) {
      // Auto-generate error report if errors occurred
      const report = await this.errorReportService.autoGenerateIfErrors(
        req.correlationId,
      );

      // Return error report ID to user
      throw new HttpException(
        {
          message: 'Operation failed',
          errorReportId: report?.reportId,
          correlationId: req.correlationId,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
```

### WebSocket/Gateway Integration

```typescript
@WebSocketGateway()
export class MyGateway {
  constructor(private readonly loggingService: LoggingService) {}

  @SubscribeMessage('my-event')
  async handleEvent(client: Socket, data: any) {
    // Generate correlation ID for WebSocket events
    const correlationId = randomUUID();

    await this.loggingService.info('WebSocket event received', {
      correlationId,
      service: 'MyGateway',
      operation: 'handleEvent',
      userId: client.data.user?.userId,
    }, data);

    // Process event...
  }
}
```

## API Endpoints

### Generate Error Report
```bash
GET /api/logging/error-reports/generate?correlationId=xxx-xxx-xxx
```

**Response:**
```json
{
  "reportId": "ERR-lm9x2k3-A3F2D5",
  "timestamp": "2026-01-20T10:30:00Z",
  "correlationId": "xxx-xxx-xxx",
  "summary": "2 errors occurred across 2 services. Primary error: Failed to create encounter",
  "errorChain": [
    {
      "service": "EncountersService",
      "operation": "createEncounter",
      "error": "Database connection lost",
      "timestamp": "2026-01-20T10:29:58Z",
      "stack": "..."
    }
  ],
  "affectedServices": ["EncountersService", "PrismaService"],
  "failurePoint": {
    "service": "PrismaService",
    "operation": "$connect",
    "timestamp": "2026-01-20T10:29:58Z"
  },
  "systemMetrics": {
    "database": { "connected": false },
    "websockets": { "totalConnections": 5 },
    "memory": { ... },
    "uptime": 3600
  },
  "exportUrl": "/api/logging/error-reports/ERR-lm9x2k3-A3F2D5/export"
}
```

### Export Full Report
```bash
GET /api/logging/error-reports/ERR-lm9x2k3-A3F2D5/export
```
Downloads complete report with all logs (JSON format)

### Query Logs
```bash
GET /api/logging/query?level=error&service=EncountersService&hospitalId=1
```

### Get Logs by Correlation
```bash
GET /api/logging/correlation/xxx-xxx-xxx
```

### System Statistics
```bash
GET /api/logging/stats
```

## User Support Workflow

1. **Error Occurs** → User sees error with correlation ID
2. **Generate Report** → Frontend calls `/error-reports/generate?correlationId=xxx`
3. **Download Report** → User clicks "Export Error Report"
4. **Send to Support** → User emails JSON file
5. **Reproduce Issue** → Support team has full context to debug

## Client-Side Integration

### React/Frontend Example

```typescript
// API client
async function apiCall(method: string, path: string, data?: any) {
  const correlationId = crypto.randomUUID();
  
  try {
    const response = await fetch(`/api${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-correlation-id': correlationId,
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      // Error occurred - generate report
      const errorReport = await fetch(
        `/api/logging/error-reports/generate?correlationId=${correlationId}`
      ).then(r => r.json());

      throw new Error(`Request failed. Report ID: ${errorReport.reportId}`);
    }

    return response.json();
  } catch (error) {
    console.error('Correlation ID:', correlationId);
    throw error;
  }
}

// Error boundary component
function ErrorBoundary({ error, correlationId }) {
  const [report, setReport] = useState(null);

  const downloadReport = async () => {
    const data = await fetch(
      `/api/logging/error-reports/generate?correlationId=${correlationId}`
    ).then(r => r.json());
    
    setReport(data);

    // Download export
    window.open(data.exportUrl, '_blank');
  };

  return (
    <div>
      <h1>Something went wrong</h1>
      <p>Error ID: {correlationId}</p>
      <button onClick={downloadReport}>
        Download Error Report
      </button>
      {report && (
        <p>Report ID: {report.reportId}</p>
      )}
    </div>
  );
}
```

## Performance Considerations

- **Memory Usage:** In-memory storage limited to 10,000 logs (configurable)
- **Retention:** Auto-cleanup after 24 hours
- **Performance Impact:** <1ms per log operation
- **Production:** Consider external log storage (Elasticsearch, CloudWatch, etc.)

## Future Enhancements (Phase 2 & 3)

- [ ] Circuit breakers and auto-recovery
- [ ] Real-time health monitoring
- [ ] Performance analytics dashboard
- [ ] Dead letter queue for failed operations
- [ ] Log streaming to external services
- [ ] Automated test case generation from errors

## Configuration

### Environment Variables

```bash
# Log retention (milliseconds)
LOG_RETENTION_MS=86400000  # 24 hours

# Max logs per correlation
MAX_LOGS_PER_CORRELATION=1000

# Max total logs in memory
MAX_TOTAL_LOGS=10000

# Log level (debug|info|warn|error)
LOG_LEVEL=info
```

## Migration from Existing Logging

Your existing service-level logging continues to work! The new system runs alongside it:

```typescript
// Old logging (KEEP THIS)
this.logger.log({ message: 'Creating encounter', encounterId });

// New logging (ADD THIS for correlation)
await this.loggingService.info('Creating encounter', {
  correlationId: req.correlationId,
  service: 'EncountersService',
  operation: 'createEncounter',
  encounterId,
});
```

Both work together - the new system adds correlation and error reporting on top.

## Testing

```typescript
describe('LoggingService', () => {
  it('should correlate logs across operations', async () => {
    const correlationId = randomUUID();
    
    await loggingService.info('Step 1', { correlationId, service: 'Test', operation: 'test' });
    await loggingService.info('Step 2', { correlationId, service: 'Test', operation: 'test' });
    
    const logs = await loggingService.getLogsByCorrelationId(correlationId);
    expect(logs).toHaveLength(2);
  });

  it('should generate error reports', async () => {
    const correlationId = randomUUID();
    
    await loggingService.error('Test error', 
      { correlationId, service: 'Test', operation: 'test' },
      new Error('Test')
    );
    
    const report = await errorReportService.generateReport(correlationId);
    expect(report.errorChain).toHaveLength(1);
  });
});
```

## Questions?

See examples in:
- `src/modules/logging/logging.service.ts`
- `src/modules/logging/error-report.service.ts`
- `src/modules/logging/logging.controller.ts`
