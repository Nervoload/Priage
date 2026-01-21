// backend/src/modules/logging/error-report.service.ts
// Service for generating comprehensive error reports for users to send to support

import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import {
  ErrorReport,
  ErrorChainEntry,
  SystemMetrics,
  ErrorReportExport,
} from './types/error-report.type';
import { LogEntry, LogLevel } from './types/log-entry.type';
import { LoggingService } from './logging.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class ErrorReportService {
  private readonly logger = new Logger(ErrorReportService.name);
  private readonly reports: Map<string, ErrorReport> = new Map();
  private readonly maxReports = 100;

  constructor(
    private readonly loggingService: LoggingService,
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {
    this.logger.log('ErrorReportService initialized');
  }

  /**
   * Generate a comprehensive error report from a correlation ID
   */
  async generateReport(correlationId: string): Promise<ErrorReport> {
    this.logger.log({
      message: 'Generating error report',
      correlationId,
    });

    const logs = await this.loggingService.getLogsByCorrelationId(correlationId);

    if (logs.length === 0) {
      throw new Error(`No logs found for correlation ID: ${correlationId}`);
    }

    const reportId = this.generateReportId();
    const errorLogs = logs.filter((log) => log.level === LogLevel.ERROR);

    const report: ErrorReport = {
      reportId,
      timestamp: new Date(),
      correlationId,
      summary: this.generateSummary(logs, errorLogs),
      errorChain: this.buildErrorChain(errorLogs),
      affectedServices: this.getAffectedServices(logs),
      failurePoint: this.identifyFailurePoint(errorLogs),
      systemMetrics: await this.captureSystemMetrics(),
      requestContext: this.extractRequestContext(logs),
      userAction: this.extractUserAction(logs),
      logs,
      exportUrl: `/api/logging/error-reports/${reportId}/export`,
    };

    // Store report for later retrieval
    this.reports.set(reportId, report);

    // Cleanup old reports if needed
    if (this.reports.size > this.maxReports) {
      const firstEntry = this.reports.entries().next();
      if (!firstEntry.done) {
        this.reports.delete(firstEntry.value[0]);
      }
    }

    this.logger.log({
      message: 'Error report generated',
      reportId,
      correlationId,
      errorCount: errorLogs.length,
      totalLogs: logs.length,
    });

    return report;
  }

  /**
   * Get a previously generated report
   */
  async getReport(reportId: string): Promise<ErrorReport | null> {
    return this.reports.get(reportId) || null;
  }

  /**
   * Export report in a user-friendly format
   */
  async exportReport(reportId: string): Promise<ErrorReportExport> {
    const report = await this.getReport(reportId);
    if (!report) {
      throw new Error(`Report not found: ${reportId}`);
    }

    return {
      reportId,
      version: '1.0',
      generatedAt: new Date(),
      report,
      metadata: {
        nodeVersion: process.version,
        platform: process.platform,
        applicationVersion: process.env.APP_VERSION || 'unknown',
      },
    };
  }

  /**
   * Check if an error occurred in a correlation
   */
  async checkForErrors(correlationId: string): Promise<boolean> {
    return this.loggingService.hasErrors(correlationId);
  }

  /**
   * Auto-generate report if errors detected
   */
  async autoGenerateIfErrors(correlationId: string): Promise<ErrorReport | null> {
    const hasErrors = await this.checkForErrors(correlationId);
    if (hasErrors) {
      return this.generateReport(correlationId);
    }
    return null;
  }

  // Private helper methods

  private generateReportId(): string {
    const timestamp = Date.now().toString(36);
    const random = randomBytes(3).toString('hex').toUpperCase();
    return `ERR-${timestamp}-${random}`;
  }

  private generateSummary(allLogs: LogEntry[], errorLogs: LogEntry[]): string {
    if (errorLogs.length === 0) {
      return 'No errors detected in this request chain';
    }

    const firstError = errorLogs[0];
    const errorCount = errorLogs.length;
    const services = new Set(errorLogs.map((log) => log.context.service));

    let summary = `${errorCount} error${errorCount > 1 ? 's' : ''} occurred`;
    summary += ` across ${services.size} service${services.size > 1 ? 's' : ''}`;
    summary += `. Primary error: ${firstError.message}`;

    if (firstError.error) {
      summary += ` (${firstError.error.message})`;
    }

    return summary;
  }

  private buildErrorChain(errorLogs: LogEntry[]): ErrorChainEntry[] {
    return errorLogs.map((log) => ({
      service: log.context.service,
      operation: log.context.operation,
      error: log.error?.message || log.message,
      timestamp: log.timestamp,
      stack: log.error?.stack,
    }));
  }

  private getAffectedServices(logs: LogEntry[]): string[] {
    const services = new Set(logs.map((log) => log.context.service));
    return Array.from(services);
  }

  private identifyFailurePoint(errorLogs: LogEntry[]): ErrorReport['failurePoint'] {
    if (errorLogs.length === 0) {
      return {
        service: 'unknown',
        operation: 'unknown',
        timestamp: new Date(),
      };
    }

    const firstError = errorLogs[0];
    return {
      service: firstError.context.service,
      operation: firstError.context.operation,
      timestamp: firstError.timestamp,
    };
  }

  private async captureSystemMetrics(): Promise<SystemMetrics> {
    const memory = process.memoryUsage();
    
    // Get database metrics - handle failure gracefully
    const dbMetrics: SystemMetrics['database'] = {
      connected: false,
      poolSize: undefined,
      idleConnections: undefined,
      waitingClients: undefined,
    };
    
    try {
      const poolStats = this.prisma.getPoolStats();
      dbMetrics.connected = true;
      dbMetrics.poolSize = poolStats.totalCount;
      dbMetrics.idleConnections = poolStats.idleCount;
      dbMetrics.waitingClients = poolStats.waitingCount;
    } catch (error) {
      // Database metrics unavailable - log but continue
      this.logger.warn({
        message: 'Failed to capture database metrics',
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Get WebSocket metrics - handle failure gracefully
    let wsMetrics = {
      totalConnections: 0,
      connectionsByHospital: {},
    };
    
    try {
      const wsStats = this.realtime.getConnectionStats();
      wsMetrics = {
        totalConnections: wsStats.totalConnections,
        connectionsByHospital: Object.fromEntries(wsStats.connectionsByHospital),
      };
    } catch (error) {
      // WebSocket stats not available - log but continue
      this.logger.warn({
        message: 'Failed to capture WebSocket metrics',
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return {
      timestamp: new Date(),
      database: dbMetrics,
      websockets: wsMetrics,
      memory: {
        heapUsed: memory.heapUsed,
        heapTotal: memory.heapTotal,
        external: memory.external,
        rss: memory.rss,
      },
      uptime: process.uptime(),
    };
  }

  private extractRequestContext(logs: LogEntry[]): ErrorReport['requestContext'] {
    const context: ErrorReport['requestContext'] = {};

    // Find context from logs
    for (const log of logs) {
      if (log.context.userId) context.userId = log.context.userId;
      if (log.context.hospitalId) context.hospitalId = log.context.hospitalId;
      if (log.context.encounterId) context.encounterId = log.context.encounterId;
      
      // Try to extract HTTP method and path from data
      if (log.data?.method) context.method = log.data.method;
      if (log.data?.path) context.path = log.data.path;
    }

    return context;
  }

  private extractUserAction(logs: LogEntry[]): string | undefined {
    // Try to determine what the user was trying to do
    const firstLog = logs[0];
    if (!firstLog) return undefined;

    const operation = firstLog.context.operation;
    const service = firstLog.context.service;

    // Build a human-readable action description
    if (operation && service) {
      return `${operation} in ${service}`;
    }

    return firstLog.message;
  }
}
