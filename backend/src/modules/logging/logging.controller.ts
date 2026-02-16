// backend/src/modules/logging/logging.controller.ts
// REST endpoints for error reports and log queries

import { Controller, Get, Param, Query, NotFoundException } from '@nestjs/common';
import { ErrorReportService } from './error-report.service';
import { LoggingService } from './logging.service';
import { LogLevel } from './types/log-entry.type';

@Controller('logging')
export class LoggingController {
  constructor(
    private readonly errorReportService: ErrorReportService,
    private readonly loggingService: LoggingService,
  ) {}

  /**
   * Generate error report for a correlation ID
   * GET /api/logging/error-reports/generate?correlationId=xxx
   */
  @Get('error-reports/generate')
  async generateErrorReport(@Query('correlationId') correlationId: string) {
    if (!correlationId) {
      throw new NotFoundException('correlationId query parameter is required');
    }

    return this.errorReportService.generateReport(correlationId);
  }

  /**
   * Get existing error report by ID
   * GET /api/logging/error-reports/:reportId
   */
  @Get('error-reports/:reportId')
  async getErrorReport(@Param('reportId') reportId: string) {
    const report = await this.errorReportService.getReport(reportId);
    
    if (!report) {
      throw new NotFoundException(`Error report not found: ${reportId}`);
    }

    return report;
  }

  /**
   * Export error report in full detail
   * GET /api/logging/error-reports/:reportId/export
   */
  @Get('error-reports/:reportId/export')
  async exportErrorReport(@Param('reportId') reportId: string) {
    return this.errorReportService.exportReport(reportId);
  }

  /**
   * Get all logs for a correlation ID
   * GET /api/logging/correlation/:correlationId
   */
  @Get('correlation/:correlationId')
  async getLogsByCorrelation(@Param('correlationId') correlationId: string) {
    const logs = this.loggingService.getLogsByCorrelationId(correlationId);
    
    return {
      correlationId,
      count: logs.length,
      logs,
    };
  }

  /**
   * Query logs with filters
   * GET /api/logging/query?level=error&service=encounters
   */
  @Get('query')
  async queryLogs(
    @Query('correlationId') correlationId?: string,
    @Query('level') level?: LogLevel,
    @Query('service') service?: string,
    @Query('userId') userId?: string,
    @Query('hospitalId') hospitalId?: string,
    @Query('encounterId') encounterId?: string,
  ) {
    const logs = this.loggingService.queryLogs({
      correlationId,
      level,
      service,
      userId: userId ? parseInt(userId, 10) : undefined,
      hospitalId: hospitalId ? parseInt(hospitalId, 10) : undefined,
      encounterId: encounterId ? parseInt(encounterId, 10) : undefined,
    });

    return {
      count: logs.length,
      logs,
    };
  }

  /**
   * Get logging statistics
   * GET /api/logging/stats
   */
  @Get('stats')
  async getStats() {
    return this.loggingService.getStats();
  }
}
