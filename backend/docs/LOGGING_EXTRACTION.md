# Log Extraction and Error Reporting Guide

## Overview

This guide explains how to extract logs, generate error reports, and query the logging system for debugging, auditing, and performance analysis. The Priage logging system provides multiple methods for accessing log data through REST APIs, making it easy to retrieve exactly the information you need.

## Quick Reference

| What You Need | Endpoint | Method |
|---------------|----------|--------|
| All logs for a request | `/logging/correlation/:id` | GET |
| Error report with metrics | `/logging/error-reports/generate?correlationId=xxx` | GET |
| Get error report by ID | `/logging/error-reports/:reportId` | GET |
| Download error report as file | `/logging/error-reports/:reportId/export` | GET |
| Query by service/level | `/logging/query?service=X&level=Y` | GET |
| System statistics | `/logging/stats` | GET |

## Extracting Logs by Correlation ID

### What is a Correlation ID?

A correlation ID is a unique identifier (UUID format) assigned to every incoming HTTP request. This ID follows the request through its entire execution path, allowing you to trace all operations and logs related to a single request.

### Where to Find Correlation IDs

Correlation IDs are returned in the HTTP response headers:

```http
HTTP/1.1 200 OK
x-correlation-id: 550e8400-e29b-41d4-a716-446655440000
content-type: application/json
```

Frontend applications can extract and display this ID to users when errors occur.

### Retrieving All Logs for a Request

**Endpoint:** `GET /logging/correlation/:correlationId`

**Example:**
```bash
curl http://localhost:3000/logging/correlation/550e8400-e29b-41d4-a716-446655440000
```

**Response:**
```json
[
  {
    "id": "log-uuid-1",
    "timestamp": "2026-01-20T14:32:15.234Z",
    "level": "info",
    "message": "Creating encounter",
    "context": {
      "service": "EncountersService",
      "operation": "create",
      "correlationId": "550e8400-e29b-41d4-a716-446655440000",
      "userId": 42,
      "hospitalId": 1,
      "data": {
        "patientId": 123,
        "status": "EXPECTED"
      }
    }
  },
  {
    "id": "log-uuid-2",
    "timestamp": "2026-01-20T14:32:15.456Z",
    "level": "info",
    "message": "Dispatching event",
    "context": {
      "service": "EventsService",
      "operation": "dispatch",
      "correlationId": "550e8400-e29b-41d4-a716-446655440000",
      "data": {
        "eventType": "ENCOUNTER_CREATED",
        "encounterId": 789
      }
    }
  },
  {
    "id": "log-uuid-3",
    "timestamp": "2026-01-20T14:32:15.678Z",
    "level": "info",
    "message": "Encounter created successfully",
    "context": {
      "service": "EncountersService",
      "operation": "create",
      "correlationId": "550e8400-e29b-41d4-a716-446655440000",
      "encounterId": 789
    }
  }
]
```

### Understanding the Log Timeline

The logs are returned in chronological order (oldest to newest). You can trace the complete execution path:

1. **Operation Start** - First log with operation name
2. **Sub-operations** - Logs from other services called during execution
3. **Operation Complete** - Final log with success/failure message

This timeline view is essential for understanding:
- How long each operation took
- Which services were involved
- Where errors occurred in the flow
- What data was passed between operations

## Generating Error Reports

### What is an Error Report?

An error report is a comprehensive package that includes:
- All logs for a specific request
- Only error-level logs (for quick issue identification)
- System metrics at the time of the error
- Complete request context for reproduction

### When to Generate Error Reports

Generate error reports when:
- A user encounters an error in the UI
- An operation fails unexpectedly
- You need complete context for debugging
- You need to document an issue for later analysis

### Creating an Error Report

**Endpoint:** `GET /logging/error-reports/generate?correlationId={id}`

**Example:**
```bash
curl "http://localhost:3000/logging/error-reports/generate?correlationId=550e8400-e29b-41d4-a716-446655440000"
```

**Response:**
```json
{
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-01-20T14:32:15.234Z",
  "logs": [
    // All log entries for this correlation ID (full timeline)
  ],
  "errors": [
    {
      "id": "log-uuid-4",
      "timestamp": "2026-01-20T14:32:16.123Z",
      "level": "error",
      "message": "Failed to update encounter status",
      "context": {
        "service": "EncountersService",
        "operation": "updateStatus",
        "correlationId": "550e8400-e29b-41d4-a716-446655440000",
        "encounterId": 789,
        "error": {
          "name": "PrismaClientKnownRequestError",
          "message": "Unique constraint failed on the fields: (`id`)",
          "stack": "Error: Unique constraint failed...\n    at PrismaClient.encounter.update..."
        }
      }
    }
  ],
  "systemMetrics": {
    "database": {
      "connected": true,
      "pool": {
        "total": 20,
        "idle": 15,
        "active": 5,
        "waiting": 0
      }
    },
    "websocket": {
      "connected": 23,
      "rooms": 45
    },
    "memory": {
      "heapUsed": "67 MB",
      "heapTotal": "128 MB",
      "external": "2 MB",
      "rss": "145 MB"
    },
    "uptime": "2d 14h 32m 15s"
  }
}
```

### Error Report Sections

#### 1. Logs Array
Contains **all** log entries (info, debug, warn, error) in chronological order. Use this to see the complete timeline leading up to the error.

#### 2. Errors Array
Contains **only** error-level logs. Use this to quickly identify what went wrong without reading through all logs.

#### 3. System Metrics
Provides system state at the time of the error:

**Database Metrics:**
- `connected` - Whether database connection is alive
- `pool.total` - Total connection pool size
- `pool.idle` - Available connections
- `pool.active` - Connections in use
- `pool.waiting` - Queued requests waiting for connection

**WebSocket Metrics:**
- `connected` - Number of active WebSocket connections
- `rooms` - Number of Socket.IO rooms

**Memory Metrics:**
- `heapUsed` - V8 heap memory currently used
- `heapTotal` - V8 heap memory allocated
- `external` - Memory used by C++ objects bound to JavaScript
- `rss` - Resident Set Size (total memory allocated)

**Uptime:**
- Time since server started (format: "Xd Xh Xm Xs")

### User Workflow for Error Reporting

**Frontend Implementation:**

```typescript
// When API error occurs
try {
  const response = await fetch('http://localhost:3000/encounters', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(encounterData)
  });
  
  if (!response.ok) {
    const correlationId = response.headers.get('x-correlation-id');
    
    // Show error message to user with "Report Error" button
    showErrorDialog({
      message: 'Failed to create encounter',
      correlationId: correlationId,
      onReport: () => downloadErrorReport(correlationId)
    });
  }
} catch (error) {
  console.error('Request failed:', error);
}

// Download error report
async function downloadErrorReport(correlationId) {
  // Generate report first
  const response = await fetch(`http://localhost:3000/logging/error-reports/generate?correlationId=${correlationId}`);
  const report = await response.json();
  
  // Then export it
  const exportUrl = `http://localhost:3000/logging/error-reports/${report.id}/export`;
  window.open(exportUrl, '_blank');
}
```

**User Experience:**

1. User performs action (e.g., create encounter)
2. Error occurs
3. UI displays error message with correlation ID
4. User clicks "Report Error" button
5. Browser downloads formatted error report
6. User emails report to development team

## Exporting Logs as Text File

### Downloading Log Files

**Endpoint:** `GET /logging/error-reports/:reportId/export`

**Example:**
```bash
# First generate the report to get reportId
curl "http://localhost:3000/logging/error-reports/generate?correlationId=550e8400-e29b-41d4-a716-446655440000"

# Then export using the reportId
curl http://localhost:3000/logging/error-reports/{reportId}/export -o error-report.txt
```

**File Contents:**
```
================================================================================
ERROR REPORT
================================================================================
Correlation ID: 550e8400-e29b-41d4-a716-446655440000
Generated: 2026-01-20T14:35:22.123Z

================================================================================
LOGS (3 entries)
================================================================================

[2026-01-20T14:32:15.234Z] [INFO] Creating encounter
Service: EncountersService
Operation: create
Context: {"userId":42,"hospitalId":1,"patientId":123}

[2026-01-20T14:32:15.456Z] [INFO] Dispatching event
Service: EventsService
Operation: dispatch
Context: {"eventType":"ENCOUNTER_CREATED","encounterId":789}

[2026-01-20T14:32:16.123Z] [ERROR] Failed to update encounter status
Service: EncountersService
Operation: updateStatus
Context: {"encounterId":789}
Error: PrismaClientKnownRequestError - Unique constraint failed on the fields: (`id`)
Stack: Error: Unique constraint failed...
    at PrismaClient.encounter.update (/app/src/services/encounters.ts:45:10)
    ...

================================================================================
SYSTEM METRICS
================================================================================

Database:
  Status: Connected
  Pool: 5/20 active (15 idle, 0 waiting)

WebSocket:
  Connections: 23
  Rooms: 45

Memory:
  Heap Used: 67 MB
  Heap Total: 128 MB
  RSS: 145 MB

Uptime: 2d 14h 32m 15s

================================================================================
```

### Use Cases for Text Export

- Attaching to bug reports or tickets
- Sharing with team members via email
- Archiving for compliance or auditing
- Including in documentation
- Offline analysis without API access

## Querying Logs

### Query by Service

Retrieve all logs from a specific service:

**Endpoint:** `GET /logging/query?service={serviceName}`

**Example:**
```bash
curl "http://localhost:3000/logging/query?service=EncountersService&limit=50"
```

**Response:**
```json
[
  {
    "id": "log-uuid-1",
    "timestamp": "2026-01-20T14:30:00.000Z",
    "level": "info",
    "message": "Creating encounter",
    "context": {
      "service": "EncountersService",
      "operation": "create",
      // ...
    }
  },
  // ... up to 50 results
]
```

**Use Cases:**
- Monitor all activity for a specific service
- Debug service-specific issues
- Audit service usage patterns
- Performance analysis per service

### Query by Log Level

Retrieve all logs at a specific severity level:

**Endpoint:** `GET /logging/query?level={logLevel}`

**Example:**
```bash
curl "http://localhost:3000/logging/query?level=error"
```

**Valid Levels:** `debug`, `info`, `warn`, `error`

**Use Cases:**
- Find all errors in the system
- Review all warnings
- Monitor debug logs for specific investigation
- Filter out noise from high-frequency debug logs

### Combined Queries

Query by both service and level:

**Example:**
```bash
curl "http://localhost:3000/logging/query?service=EncountersService&level=error&limit=100"
```

This returns only error logs from the EncountersService.

### Query Parameters

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `service` | string | Filter by service name (exact match) | none |
| `level` | string | Filter by log level (debug/info/warn/error) | none |
| `limit` | number | Maximum results to return | 100 |

## Viewing System Statistics

### Logging System Stats

**Endpoint:** `GET /logging/stats`

**Example:**
```bash
curl http://localhost:3000/logging/stats
```

**Response:**
```json
{
  "totalLogs": 3247,
  "byLevel": {
    "debug": 1823,
    "info": 1289,
    "warn": 112,
    "error": 23
  },
  "byService": {
    "EncountersService": 892,
    "AlertsService": 456,
    "MessagingService": 378,
    "TriageService": 234,
    "PrismaService": 189,
    "AuthService": 167,
    "EventsService": 145,
    "JobsService": 98,
    "IntakeService": 234,
    "RealtimeGateway": 189,
    "PatientsService": 89,
    "UsersService": 123,
    "HospitalsService": 53
  },
  "oldestLog": "2026-01-19T14:32:15.234Z",
  "newestLog": "2026-01-20T14:32:15.234Z",
  "retentionHours": 24,
  "memoryUsageMB": 4.2
}
```

### Understanding Statistics

**Total Logs:**
Current number of logs in memory. Should be under 10,000 for production.

**By Level:**
Distribution of logs by severity. High error count indicates system issues.

**By Service:**
Distribution of logs by service. Helps identify chattiest services.

**Oldest/Newest Log:**
Time range of stored logs. Should show 24-hour window in production.

**Retention Hours:**
How long logs are kept before automatic cleanup.

**Memory Usage:**
Approximate memory used by log storage in MB.

### Monitoring Recommendations

**Check stats regularly to:**
- Ensure memory usage stays reasonable (<10 MB)
- Monitor error rates (should be <1% of total logs)
- Identify services that may be logging too much
- Verify retention is working correctly

## Common Query Patterns

### Finding All Errors in Last Hour

```bash
# Get all errors
curl "http://localhost:3000/logging/query?level=error&limit=1000" > errors.json

# Filter by timestamp in your application
```

### Investigating Specific Patient Issues

```bash
# Find patient's encounter
curl "http://localhost:3000/encounters?patientId=123" | jq '.data[0].id'

# Get encounter correlation (from encounter creation)
# Then query logs
curl "http://localhost:3000/logging/correlation/{correlationId}"
```

### Monitoring Service Health

```bash
# Check errors per service
curl "http://localhost:3000/logging/stats" | jq '.byService'

# Get errors for problematic service
curl "http://localhost:3000/logging/query?service=EncountersService&level=error"
```

### Debugging WebSocket Issues

```bash
# Query RealtimeGateway logs
curl "http://localhost:3000/logging/query?service=RealtimeGateway&limit=100"

# Look for connection/disconnection patterns
# Review authentication failures
```

## Identifier Tables

### Extracting Entity IDs from Logs

Log context includes several identifier fields that help track entities:

| Field | Description | Example |
|-------|-------------|---------|
| `correlationId` | Request tracking ID | `550e8400-e29b-41d4-a716-446655440000` |
| `userId` | Authenticated user ID | `42` |
| `hospitalId` | Hospital context | `1` |
| `encounterId` | Patient encounter ID | `789` |
| `patientId` | Patient profile ID | `123` |
| `alertId` | Alert ID | `456` |
| `messageId` | Message ID | `678` |

### Building Identifier Tables

For auditing or analysis, extract identifier relationships:

```javascript
// Example: Build correlation → encounter table
const logs = await fetch('/logging/query?service=EncountersService');
const correlationMap = {};

logs.forEach(log => {
  if (log.context.correlationId && log.context.encounterId) {
    correlationMap[log.context.correlationId] = log.context.encounterId;
  }
});

console.table(correlationMap);
```

### Tracking Patient Journey

Extract all correlations for a specific patient:

```javascript
const logs = await fetch('/logging/query?limit=10000');
const patientJourney = logs
  .filter(log => log.context.patientId === 123)
  .map(log => ({
    time: log.timestamp,
    service: log.context.service,
    operation: log.context.operation,
    correlationId: log.context.correlationId,
    message: log.message
  }));

console.table(patientJourney);
```

This creates a complete timeline of all operations involving a specific patient.

## Best Practices

### 1. Always Use Correlation IDs

When reporting errors to users, display the correlation ID prominently:

```typescript
<ErrorDialog>
  <Title>Operation Failed</Title>
  <Message>{errorMessage}</Message>
  <CorrelationId>{correlationId}</CorrelationId>
  <Button onClick={() => downloadReport(correlationId)}>
    Download Error Report
  </Button>
</ErrorDialog>
```

### 2. Limit Query Results

Always use the `limit` parameter to avoid retrieving too many logs:

```bash
# Good - Limited results
curl "/logging/query?service=EncountersService&limit=100"

# Bad - Could return thousands of logs
curl "/logging/query?service=EncountersService"
```

### 3. Export for Long-Term Storage

Error reports are only kept for 24 hours. Export important reports:

```bash
curl "/logging/export/${correlationId}" -o "reports/error-${correlationId}.txt"
```

### 4. Monitor System Stats

Check stats endpoint regularly to ensure healthy operation:

```bash
# Add to monitoring dashboard
*/5 * * * * curl http://localhost:3000/logging/stats | jq '.totalLogs,.byLevel.error'
```

### 5. Use Text Export for Documentation

When documenting bugs or issues, attach text export for complete context:

```markdown
## Bug Report: Encounter Creation Fails

**Correlation ID:** 550e8400-e29b-41d4-a716-446655440000

**Steps to Reproduce:**
1. Navigate to Admissions
2. Click "New Patient"
3. Fill in patient details
4. Click "Create Encounter"

**Error:**
See attached error report: [error-report.txt]
```

## Troubleshooting

### No Logs Found

**Problem:** Query returns empty array despite request succeeding.

**Solutions:**
1. Verify correlation ID is correct (check response headers)
2. Wait 1 second after request before querying (async processing)
3. Check that LoggingService is injected in the service
4. Verify controller passes correlationId to service

### Incomplete Error Reports

**Problem:** Error report missing expected logs or metrics.

**Solutions:**
1. Ensure correlation ID was passed through entire request flow
2. Verify all services in the flow use LoggingService
3. Check that error occurred recently (within 24 hours)
4. Confirm system metrics services are running (Prisma, Socket.IO)

### Memory Warnings

**Problem:** Stats show totalLogs near 10,000 or memory usage high.

**Solutions:**
1. Check if retention cleanup is running (should run hourly)
2. Reduce DEBUG logging in high-traffic services
3. Consider lowering retention period from 24h to 12h
4. Review services with highest log counts (reduce logging frequency)

## Conclusion

The Priage logging extraction system provides comprehensive tools for retrieving logs, generating error reports, and querying system activity. With correlation-based tracking and rich contextual information, developers can quickly diagnose issues, reproduce errors, and analyze system behavior.

For questions about log extraction or to request additional query capabilities, contact the development team.
