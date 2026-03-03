// backend/src/modules/logging/logging.controller.ts
// REST endpoints for error reports and log queries

import { Controller, Get, Param, Query, NotFoundException, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ErrorReportService } from './error-report.service';
import { LoggingService } from './logging.service';
import { LogLevel } from './types/log-entry.type';

@Controller('logging')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class LoggingController {
  constructor(
    private readonly errorReportService: ErrorReportService,
    private readonly loggingService: LoggingService,
  ) {}

  /**
   * Generate error report for a correlation ID
   * GET /logging/error-reports/generate?correlationId=xxx
   */
  @Get('error-reports/generate')
  async generateErrorReport(
    @Query('correlationId') correlationId: string,
    @CurrentUser() user: { userId: number },
  ) {
    if (!correlationId) {
      throw new NotFoundException('correlationId query parameter is required');
    }

    return this.errorReportService.generateReport(correlationId, user.userId);
  }

  /**
   * Get existing error report by ID
   * GET /logging/error-reports/:reportId
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
   * GET /logging/error-reports/:reportId/export
   */
  @Get('error-reports/:reportId/export')
  async exportErrorReport(@Param('reportId') reportId: string) {
    return this.errorReportService.exportReport(reportId);
  }

  /**
   * Get persisted logs for a correlation ID.
   * Failing/promoted correlations include flushed pre-error debug/info steps.
   * GET /logging/correlation/:correlationId
   */
  @Get('correlation/:correlationId')
  async getLogsByCorrelation(
    @Param('correlationId') correlationId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const result = await this.loggingService.getLogsByCorrelationId(correlationId, {
      limit: this.parseNumberQuery(limit),
      offset: this.parseNumberQuery(offset),
    });

    return {
      correlationId,
      count: result.count,
      logs: result.logs,
      meta: result.meta,
    };
  }

  /**
   * Query logs with filters
   * GET /logging/query?level=error&service=encounters
   */
  @Get('query')
  async queryLogs(
    @Query('correlationId') correlationId?: string,
    @Query('level') level?: LogLevel,
    @Query('service') service?: string,
    @Query('userId') userId?: string,
    @Query('patientId') patientId?: string,
    @Query('hospitalId') hospitalId?: string,
    @Query('encounterId') encounterId?: string,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const result = await this.loggingService.queryLogs({
      correlationId,
      level,
      service,
      userId: this.parseNumberQuery(userId),
      patientId: this.parseNumberQuery(patientId),
      hospitalId: this.parseNumberQuery(hospitalId),
      encounterId: this.parseNumberQuery(encounterId),
      startTime: this.parseDateQuery(startTime),
      endTime: this.parseDateQuery(endTime),
      limit: this.parseNumberQuery(limit),
      offset: this.parseNumberQuery(offset),
    });

    return {
      count: result.count,
      logs: result.logs,
      meta: result.meta,
    };
  }

  /**
   * Get logging statistics
   * GET /logging/stats
   */
  @Get('stats')
  async getStats() {
    return this.loggingService.getStats();
  }

  private parseNumberQuery(value?: string) {
    if (!value) {
      return undefined;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private parseDateQuery(value?: string) {
    if (!value) {
      return undefined;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
}
