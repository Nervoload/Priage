// backend/src/modules/logging/error-report.service.ts
// Service for generating comprehensive error reports for users to send to support.

import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';

import {
  ErrorChainEntry,
  ErrorReport,
  ErrorReportExport,
  SystemMetrics,
} from './types/error-report.type';
import { LogEntry, LogLevel } from './types/log-entry.type';
import { LoggingService } from './logging.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

type ErrorReportPayload = Prisma.JsonObject;

type DbLogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

type LogRecordRow = {
  id: number;
  createdAt: Date;
  level: DbLogLevel;
  message: string;
  correlationId: string | null;
  service: string;
  operation: string;
  userId: number | null;
  patientId: number | null;
  hospitalId: number | null;
  encounterId: number | null;
  data: Prisma.JsonValue | null;
  errorMessage: string | null;
  errorStack: string | null;
  errorCode: string | null;
};

type ErrorReportSnapshotRow = {
  payload: Prisma.JsonValue;
};

type LoggingPrismaClient = PrismaService & {
  logRecord: {
    findMany(args?: unknown): Promise<LogRecordRow[]>;
  };
  errorReportSnapshot: {
    create(args: unknown): Promise<unknown>;
    findUnique(args: unknown): Promise<ErrorReportSnapshotRow | null>;
  };
};

@Injectable()
export class ErrorReportService {
  private readonly logger = new Logger(ErrorReportService.name);

  constructor(
    private readonly loggingService: LoggingService,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => RealtimeGateway))
    private readonly realtime: RealtimeGateway,
  ) {
    this.logger.log('ErrorReportService initialized');
  }

  async generateReport(correlationId: string, createdByUserId?: number): Promise<ErrorReport> {
    this.logger.log({
      message: 'Generating error report',
      correlationId,
    });

    const logs = await this.getLogsForCorrelation(correlationId);
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

    await this.getLoggingPrisma().errorReportSnapshot.create({
      data: {
        reportId,
        correlationId,
        summary: report.summary,
        errorCount: errorLogs.length,
        logCount: logs.length,
        payload: this.serializeReport(report),
        createdByUserId,
      },
    });

    this.logger.log({
      message: 'Error report generated',
      reportId,
      correlationId,
      errorCount: errorLogs.length,
      totalLogs: logs.length,
    });

    return report;
  }

  async getReport(reportId: string): Promise<ErrorReport | null> {
    const snapshot = await this.getLoggingPrisma().errorReportSnapshot.findUnique({
      where: { reportId },
    });

    if (!snapshot) {
      return null;
    }

    return this.deserializeReport(snapshot.payload as ErrorReportPayload);
  }

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

  async checkForErrors(correlationId: string): Promise<boolean> {
    return this.loggingService.hasErrors(correlationId);
  }

  async autoGenerateIfErrors(
    correlationId: string,
    createdByUserId?: number,
  ): Promise<ErrorReport | null> {
    const hasErrors = await this.checkForErrors(correlationId);
    if (hasErrors) {
      return this.generateReport(correlationId, createdByUserId);
    }
    return null;
  }

  private async getLogsForCorrelation(correlationId: string): Promise<LogEntry[]> {
    await this.loggingService.flushCorrelation(correlationId);

    const rows = await this.getLoggingPrisma().logRecord.findMany({
      where: { correlationId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    return rows.map((row) => this.mapRecordToLogEntry(row));
  }

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
    return Array.from(new Set(logs.map((log) => log.context.service)));
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
    const dbMetrics: SystemMetrics['database'] = {
      connected: false,
      poolSize: undefined,
      idleConnections: undefined,
      waitingClients: undefined,
    };

    try {
      const poolStats = await this.prisma.getPoolStats();
      dbMetrics.connected = true;
      dbMetrics.poolSize = poolStats.totalCount;
      dbMetrics.idleConnections = poolStats.idleCount;
      dbMetrics.waitingClients = poolStats.waitingCount;
    } catch (error) {
      this.logger.warn({
        message: 'Failed to capture database metrics',
        error: error instanceof Error ? error.message : String(error),
      });
    }

    let wsMetrics: SystemMetrics['websockets'] = {
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

    for (const log of logs) {
      if (log.context.userId) context.userId = log.context.userId;
      if (log.context.hospitalId) context.hospitalId = log.context.hospitalId;
      if (log.context.encounterId) context.encounterId = log.context.encounterId;
      if (typeof log.data?.method === 'string') context.method = log.data.method;
      if (typeof log.data?.path === 'string') context.path = log.data.path;
    }

    return context;
  }

  private extractUserAction(logs: LogEntry[]): string | undefined {
    const firstLog = logs[0];
    if (!firstLog) {
      return undefined;
    }

    if (firstLog.context.operation && firstLog.context.service) {
      return `${firstLog.context.operation} in ${firstLog.context.service}`;
    }

    return firstLog.message;
  }

  private mapRecordToLogEntry(
    row: LogRecordRow,
  ): LogEntry {
    return {
      id: String(row.id),
      timestamp: row.createdAt,
      level: this.mapRecordLevelToLogLevel(row.level),
      message: row.message,
      context: {
        correlationId: row.correlationId ?? undefined,
        userId: row.userId ?? undefined,
        patientId: row.patientId ?? undefined,
        hospitalId: row.hospitalId ?? undefined,
        encounterId: row.encounterId ?? undefined,
        service: row.service,
        operation: row.operation,
      },
      data:
        row.data && typeof row.data === 'object' && !Array.isArray(row.data)
          ? (row.data as Record<string, unknown>)
          : undefined,
      error:
        row.errorMessage || row.errorStack || row.errorCode
          ? {
              message: row.errorMessage ?? row.message,
              stack: row.errorStack ?? undefined,
              code: row.errorCode ?? undefined,
            }
          : undefined,
    };
  }

  private mapRecordLevelToLogLevel(level: DbLogLevel): LogLevel {
    switch (level) {
      case 'DEBUG':
        return LogLevel.DEBUG;
      case 'INFO':
        return LogLevel.INFO;
      case 'ERROR':
        return LogLevel.ERROR;
      case 'WARN':
      default:
        return LogLevel.WARN;
    }
  }

  private serializeReport(report: ErrorReport) {
    return JSON.parse(JSON.stringify(report)) as Prisma.InputJsonObject;
  }

  private deserializeReport(payload: ErrorReportPayload): ErrorReport {
    const value = payload as Record<string, unknown>;

    return {
      reportId: String(value.reportId),
      timestamp: new Date(String(value.timestamp)),
      correlationId: String(value.correlationId),
      summary: String(value.summary),
      errorChain: Array.isArray(value.errorChain)
        ? value.errorChain.map((entry) => ({
            service: String((entry as Record<string, unknown>).service),
            operation: String((entry as Record<string, unknown>).operation),
            error: String((entry as Record<string, unknown>).error),
            timestamp: new Date(String((entry as Record<string, unknown>).timestamp)),
            stack:
              typeof (entry as Record<string, unknown>).stack === 'string'
                ? String((entry as Record<string, unknown>).stack)
                : undefined,
          }))
        : [],
      affectedServices: Array.isArray(value.affectedServices)
        ? value.affectedServices.map((service) => String(service))
        : [],
      failurePoint: {
        service: String((value.failurePoint as Record<string, unknown>).service),
        operation: String((value.failurePoint as Record<string, unknown>).operation),
        timestamp: new Date(String((value.failurePoint as Record<string, unknown>).timestamp)),
      },
      systemMetrics: {
        timestamp: new Date(String((value.systemMetrics as Record<string, unknown>).timestamp)),
        database: (value.systemMetrics as Record<string, unknown>).database as SystemMetrics['database'],
        websockets: (value.systemMetrics as Record<string, unknown>).websockets as SystemMetrics['websockets'],
        memory: (value.systemMetrics as Record<string, unknown>).memory as SystemMetrics['memory'],
        uptime: Number((value.systemMetrics as Record<string, unknown>).uptime),
      },
      userAction: typeof value.userAction === 'string' ? value.userAction : undefined,
      requestContext: (value.requestContext ?? {}) as ErrorReport['requestContext'],
      logs: Array.isArray(value.logs)
        ? value.logs.map((entry) => {
            const log = entry as Record<string, unknown>;
            const rawContext = log.context as Record<string, unknown>;
            const rawError = log.error as Record<string, unknown> | undefined;

            return {
              id: String(log.id),
              timestamp: new Date(String(log.timestamp)),
              level: String(log.level) as LogLevel,
              message: String(log.message),
              context: {
                correlationId:
                  typeof rawContext?.correlationId === 'string'
                    ? rawContext.correlationId
                    : undefined,
                userId:
                  typeof rawContext?.userId === 'number' ? rawContext.userId : undefined,
                patientId:
                  typeof rawContext?.patientId === 'number' ? rawContext.patientId : undefined,
                hospitalId:
                  typeof rawContext?.hospitalId === 'number' ? rawContext.hospitalId : undefined,
                encounterId:
                  typeof rawContext?.encounterId === 'number'
                    ? rawContext.encounterId
                    : undefined,
                service: String(rawContext?.service),
                operation: String(rawContext?.operation),
              },
              data:
                log.data && typeof log.data === 'object' && !Array.isArray(log.data)
                  ? (log.data as Record<string, unknown>)
                  : undefined,
              error: rawError
                ? {
                    message: String(rawError.message),
                    stack:
                      typeof rawError.stack === 'string' ? String(rawError.stack) : undefined,
                    code: typeof rawError.code === 'string' ? String(rawError.code) : undefined,
                  }
                : undefined,
            };
          })
        : [],
      exportUrl: String(value.exportUrl),
    };
  }

  private getLoggingPrisma(): LoggingPrismaClient {
    return this.prisma as LoggingPrismaClient;
  }
}
