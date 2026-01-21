# Quick Start Guide - Phase 1 Logging Implementation

## ✅ What's Been Implemented

1. **CorrelationMiddleware** - Automatic correlation ID for every HTTP request
2. **LoggingService** - Centralized log aggregation with correlation support
3. **ErrorReportService** - Generate user-exportable error reports
4. **REST API** - Query logs and generate error reports
5. **TypeScript Types** - Full type safety for logging structures

## 🚀 Quick Start

### 1. Your Services Now Have Access to LoggingService

Because `LoggingModule` is marked as `@Global()`, you can inject it anywhere:

```typescript
import { Injectable } from '@nestjs/common';
import { LoggingService } from '../logging/logging.service';

@Injectable()
export class YourService {
  constructor(private readonly loggingService: LoggingService) {}
  
  async yourMethod(data: any, req?: Express.Request) {
    await this.loggingService.info('Operation started', {
      correlationId: req?.correlationId,
      service: 'YourService',
      operation: 'yourMethod',
    });
  }
}
```

### 2. Every HTTP Request Gets a Correlation ID

The middleware automatically adds `req.correlationId` to all requests:

```typescript
@Controller('your-endpoint')
export class YourController {
  @Get()
  async get(@Req() req: Request) {
    // req.correlationId is automatically available!
    console.log('Correlation ID:', req.correlationId);
  }
}
```

### 3. API Endpoints Are Ready to Use

```bash
# Generate error report
curl http://localhost:3000/api/logging/error-reports/generate?correlationId=xxx

# Get all logs for a correlation
curl http://localhost:3000/api/logging/correlation/xxx

# Query logs
curl http://localhost:3000/api/logging/query?level=error&service=EncountersService

# System stats
curl http://localhost:3000/api/logging/stats
```

## 📝 Integration Pattern (Recommended)

### For Controllers (User-Facing Errors):

```typescript
@Post()
async create(@Body() dto: CreateDto, @Req() req: Request) {
  try {
    return await this.service.create(dto, req.correlationId);
  } catch (error) {
    // Auto-generate error report
    const report = await this.errorReportService.autoGenerateIfErrors(
      req.correlationId
    );

    // Return error with report ID
    throw new HttpException({
      message: 'Operation failed',
      errorReportId: report?.reportId,
      correlationId: req.correlationId,
    }, HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
```

### For Services (Business Logic):

```typescript
async processData(data: any, correlationId?: string) {
  try {
    await this.loggingService.info('Processing started', {
      correlationId,
      service: 'MyService',
      operation: 'processData',
    });

    const result = await this.doWork(data);

    await this.loggingService.info('Processing completed', {
      correlationId,
      service: 'MyService',
      operation: 'processData',
    });

    return result;
  } catch (error) {
    await this.loggingService.error('Processing failed', {
      correlationId,
      service: 'MyService',
      operation: 'processData',
    }, error instanceof Error ? error : new Error(String(error)));

    throw error;
  }
}
```

## 🔧 Testing the System

### 1. Start the backend
```bash
cd backend
npm run dev
```

### 2. Make a request (will auto-get correlation ID)
```bash
curl http://localhost:3000/api/encounters
```

### 3. Check the response headers
```bash
curl -i http://localhost:3000/api/encounters
# Look for: x-correlation-id: xxx-xxx-xxx
```

### 4. Query logs for that correlation
```bash
curl http://localhost:3000/api/logging/correlation/xxx-xxx-xxx
```

### 5. If an error occurred, generate report
```bash
curl http://localhost:3000/api/logging/error-reports/generate?correlationId=xxx-xxx-xxx
```

## 🎯 Next Steps

### Optional: Gradually Enhance Existing Services

You can add correlation logging to existing services gradually:

```typescript
// Your existing service (KEEP THIS - it still works!)
this.logger.log({ message: 'Creating encounter', encounterId });

// Add correlation logging alongside it
await this.loggingService.info('Creating encounter', {
  correlationId,
  service: 'EncountersService',
  operation: 'createEncounter',
  encounterId,
});
```

Both logging systems work side-by-side. No need to remove existing logs.

### Optional: Add Frontend Integration

```typescript
// React/Frontend
const response = await fetch('/api/endpoint', {
  headers: {
    'x-correlation-id': generateUUID(), // Optional - middleware will create if not provided
  },
});

// Check response for correlation ID
const correlationId = response.headers.get('x-correlation-id');

// If error, fetch report
if (!response.ok) {
  const report = await fetch(
    `/api/logging/error-reports/generate?correlationId=${correlationId}`
  ).then(r => r.json());
  
  console.log('Error Report ID:', report.reportId);
  console.log('Download:', report.exportUrl);
}
```

## 📊 Monitoring

### Check system health
```bash
curl http://localhost:3000/api/logging/stats
```

Returns:
```json
{
  "totalCorrelations": 150,
  "totalLogs": 3452,
  "oldestLog": "2026-01-20T10:00:00Z",
  "memoryUsage": { ... }
}
```

## 🔍 Debugging Tips

### Find all errors in the system
```bash
curl http://localhost:3000/api/logging/query?level=error
```

### Find logs for a specific user
```bash
curl http://localhost:3000/api/logging/query?userId=123
```

### Find logs for a specific hospital
```bash
curl http://localhost:3000/api/logging/query?hospitalId=1
```

### Find logs for a specific service
```bash
curl http://localhost:3000/api/logging/query?service=EncountersService
```

## ⚠️ Important Notes

1. **In-Memory Storage**: Current implementation stores logs in memory (development mode)
   - Automatic cleanup after 24 hours
   - Max 10,000 total logs
   - For production, consider external storage (Elasticsearch, CloudWatch, etc.)

2. **Performance**: Minimal impact (~<1ms per log operation)

3. **Privacy**: Sensitive fields (password, token, secret) are automatically redacted

4. **Existing Logs**: Your existing NestJS Logger calls continue to work normally!

## 📚 Full Documentation

See [README.md](./README.md) for complete documentation including:
- API endpoints
- Type definitions
- Advanced usage
- Client integration
- Performance considerations
- Migration guide

## Questions?

The logging system is now fully integrated and ready to use. Start by:
1. Making a request to any endpoint
2. Checking the `x-correlation-id` header in the response
3. Querying logs for that correlation ID
4. Generating error reports when errors occur

You don't need to modify any existing code - the system works out of the box!
