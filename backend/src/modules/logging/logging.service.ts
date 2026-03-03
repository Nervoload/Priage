// backend/src/modules/logging/logging.service.ts
// Centralized logging service backed by Postgres via Prisma.

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

import { PrismaService } from '../prisma/prisma.service';
import { CorrelationLogBufferService } from './correlation-log-buffer.service';
import { LogContext, LogEntry, LogLevel, LogQuery } from './types/log-entry.type';

type SanitizedContext = Pick<
  LogContext,
  'correlationId' | 'userId' | 'patientId' | 'hospitalId' | 'encounterId' | 'service' | 'operation'
>;

type QueryResult = {
  count: number;
  logs: LogEntry[];
  meta: {
    limit: number;
    offset: number;
  };
};

type DbLogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
type SanitizedData = Record<string, boolean | number | string | Array<number | string>>;

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

type LoggingPrismaClient = PrismaService & {
  logRecord: {
    create(args: unknown): Promise<LogRecordRow>;
    count(args?: unknown): Promise<number>;
    findMany(args?: unknown): Promise<LogRecordRow[]>;
    findFirst(args?: unknown): Promise<{ createdAt: Date } | null>;
    groupBy(args: unknown): Promise<Array<{ level: DbLogLevel; _count: { _all: number } }>>;
    deleteMany(args?: unknown): Promise<{ count: number }>;
  };
  errorReportSnapshot: {
    count(args?: unknown): Promise<number>;
    deleteMany(args?: unknown): Promise<{ count: number }>;
  };
};

const LEVEL_ORDER: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 10,
  [LogLevel.INFO]: 20,
  [LogLevel.WARN]: 30,
  [LogLevel.ERROR]: 40,
};

const SAFE_STRING_KEYS = new Set([
  'queue',
  'jobName',
  'senderType',
  'role',
  'interval',
  'status',
  'encounterStatus',
  'severity',
  'type',
  'eventType',
  'method',
  'path',
  'loginMethod',
]);

const SAFE_NUMERIC_KEYS = new Set([
  'attempt',
  'maxAttempts',
  'thresholdMinutes',
  'durationMs',
  'ttlSeconds',
  'page',
  'limit',
  'offset',
  'poolSize',
  'idleConnections',
  'waitingClients',
  'totalConnections',
  'attachmentCount',
]);

@Injectable()
export class LoggingService implements OnModuleInit {
  private readonly logger = new Logger(LoggingService.name);
  private prisma: PrismaService | null = null;
  private readonly logDbEnabled = this.parseBooleanEnv(process.env.LOG_DB_ENABLED, true);
  private readonly logDbMinLevel = this.parseDbMinLevel(process.env.LOG_DB_MIN_LEVEL);
  private readonly logRetentionDays = this.parseNumberEnv(process.env.LOG_RETENTION_DAYS, 30);
  private readonly logQueryDefaultLimit = this.parseNumberEnv(
    process.env.LOG_QUERY_DEFAULT_LIMIT,
    100,
  );
  private readonly logQueryMaxLimit = this.parseNumberEnv(process.env.LOG_QUERY_MAX_LIMIT, 500);

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly correlationBuffer: CorrelationLogBufferService,
  ) {
    this.logger.log('LoggingService initialized');
  }

  onModuleInit() {
    this.prisma = this.resolvePrisma();
  }

  async logOperation(
    level: LogLevel,
    message: string,
    context: LogContext,
    data?: unknown,
    error?: Error,
  ): Promise<LogEntry | null> {
    try {
      const sanitizedContext = this.sanitizePersistedContext(context);
      const sanitizedData = this.sanitizePersistedData(
        data,
        sanitizedContext.service,
        sanitizedContext.operation,
      );

      const fallbackEntry = this.buildLogEntry(level, message, sanitizedContext, sanitizedData, error);
      this.logToConsole(level, message, sanitizedContext, sanitizedData, error);

      const correlationId = sanitizedContext.correlationId;
      const shouldPersist = this.shouldPersistLevel(level);
      const isPromoted =
        !!correlationId && this.correlationBuffer.isEnabled()
          ? await this.correlationBuffer.isPromoted(correlationId)
          : false;

      if (correlationId && isPromoted) {
        await this.correlationBuffer.touchPromotion(correlationId);
      }

      if (
        correlationId &&
        !isPromoted &&
        !shouldPersist &&
        level !== LogLevel.WARN &&
        level !== LogLevel.ERROR
      ) {
        await this.correlationBuffer.append(fallbackEntry);
        return fallbackEntry;
      }

      if (correlationId && !isPromoted && (level === LogLevel.WARN || level === LogLevel.ERROR)) {
        await this.correlationBuffer.promote(correlationId);
      }

      const shouldPersistEntry =
        shouldPersist ||
        (!!correlationId &&
          this.correlationBuffer.isEnabled() &&
          (isPromoted || level === LogLevel.WARN || level === LogLevel.ERROR));

      if (!shouldPersistEntry) {
        return fallbackEntry;
      }

      const created = await this.persistEntry(fallbackEntry);

      if (correlationId && (isPromoted || level === LogLevel.WARN || level === LogLevel.ERROR)) {
        if (level === LogLevel.WARN || level === LogLevel.ERROR) {
          await this.flushCorrelation(correlationId);
        }
      }

      return created ?? fallbackEntry;
    } catch (loggingError) {
      try {
        console.error('[LoggingService] CRITICAL: Logging operation failed', {
          originalMessage: message,
          loggingError:
            loggingError instanceof Error ? loggingError.message : String(loggingError),
          service: context.service,
          operation: context.operation,
          correlationId: context.correlationId,
        });
      } catch {
        // Silent fail is preferable to breaking the request path.
      }
      return null;
    }
  }

  async flushCorrelation(correlationId: string): Promise<void> {
    if (!correlationId || !this.correlationBuffer.isEnabled()) {
      return;
    }

    const [isPromoted, hasProcessingEntries] = await Promise.all([
      this.correlationBuffer.isPromoted(correlationId),
      this.correlationBuffer.hasProcessingEntries(correlationId),
    ]);

    if (!isPromoted && !hasProcessingEntries) {
      return;
    }

    try {
      await this.correlationBuffer.flush(correlationId, async (entries) => {
        if (entries.length === 0) {
          return;
        }

        await this.persistBufferedEntries(entries);
      });
    } catch (error) {
      try {
        console.error('[LoggingService] Failed to flush correlation logs', {
          correlationId,
          error: error instanceof Error ? error.message : String(error),
        });
      } catch {
        // Silent fallback to avoid breaking request paths.
      }
    }
  }

  debug(message: string, context: LogContext, data?: unknown): Promise<LogEntry | null> {
    return this.logOperation(LogLevel.DEBUG, message, context, data);
  }

  info(message: string, context: LogContext, data?: unknown): Promise<LogEntry | null> {
    return this.logOperation(LogLevel.INFO, message, context, data);
  }

  warn(message: string, context: LogContext, data?: unknown): Promise<LogEntry | null> {
    return this.logOperation(LogLevel.WARN, message, context, data);
  }

  error(
    message: string,
    context: LogContext,
    error?: Error,
    data?: unknown,
  ): Promise<LogEntry | null> {
    return this.logOperation(LogLevel.ERROR, message, context, data, error);
  }

  async getLogsByCorrelationId(
    correlationId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<QueryResult> {
    const { limit, offset } = this.normalizePagination(options?.limit, options?.offset);
    await this.flushCorrelation(correlationId);

    const prisma = this.getPrismaOrThrow();
    const where = { correlationId };

    const [count, rows] = await prisma.$transaction([
      prisma.logRecord.count({ where }),
      prisma.logRecord.findMany({
        where,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip: offset,
        take: limit,
      }),
    ]);

    return {
      count,
      logs: rows.map((row) => this.mapRecordToLogEntry(row)),
      meta: { limit, offset },
    };
  }

  async queryLogs(query: LogQuery): Promise<QueryResult> {
    const { limit, offset } = this.normalizePagination(query.limit, query.offset);
    if (query.correlationId) {
      await this.flushCorrelation(query.correlationId);
    }
    const prisma = this.getPrismaOrThrow();
    const where = {
      correlationId: query.correlationId,
      service: query.service,
      userId: query.userId,
      patientId: query.patientId,
      hospitalId: query.hospitalId,
      encounterId: query.encounterId,
      level: query.level ? this.mapLevelToRecordLevel(query.level) : undefined,
      createdAt:
        query.startTime || query.endTime
          ? {
              gte: query.startTime,
              lte: query.endTime,
            }
          : undefined,
    };

    const [count, rows] = await prisma.$transaction([
      prisma.logRecord.count({ where }),
      prisma.logRecord.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
    ]);

    return {
      count,
      logs: rows.map((row) => this.mapRecordToLogEntry(row)),
      meta: { limit, offset },
    };
  }

  async getErrorLogs(correlationId: string): Promise<LogEntry[]> {
    await this.flushCorrelation(correlationId);
    const prisma = this.getPrismaOrThrow();
    const rows = await prisma.logRecord.findMany({
      where: {
        correlationId,
        level: 'ERROR' as const,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    return rows.map((row) => this.mapRecordToLogEntry(row));
  }

  async hasErrors(correlationId: string): Promise<boolean> {
    await this.flushCorrelation(correlationId);
    const prisma = this.getPrismaOrThrow();
    const count = await prisma.logRecord.count({
      where: {
        correlationId,
        level: 'ERROR' as const,
      },
    });

    return count > 0;
  }

  async getStats() {
    const prisma = this.getPrismaOrThrow();
    const recentWindowStart = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [totalLogs, totalReports, oldestLog, recentCounts] = await Promise.all([
      prisma.logRecord.count(),
      prisma.errorReportSnapshot.count(),
      prisma.logRecord.findFirst({
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
      prisma.logRecord.groupBy({
        by: ['level'],
        where: {
          createdAt: {
            gte: recentWindowStart,
          },
        },
        _count: {
          _all: true,
        },
      }),
    ]);

    const countsByLevel = {
      debug: 0,
      info: 0,
      warn: 0,
      error: 0,
    };

    for (const row of recentCounts) {
      countsByLevel[this.mapRecordLevelToLogLevel(row.level)] = row._count._all;
    }

    return {
      totalLogs,
      totalReports,
      oldestLog: oldestLog?.createdAt ?? null,
      dbLoggingEnabled: this.logDbEnabled,
      dbMinLevel: this.logDbMinLevel,
      retentionDays: this.logRetentionDays,
      countsByLevel,
      buffer: this.correlationBuffer.getStats(),
      memoryUsage: process.memoryUsage(),
    };
  }

  sanitizePersistedContext(context: LogContext): SanitizedContext {
    return {
      correlationId: context.correlationId,
      userId: context.userId,
      patientId: context.patientId,
      hospitalId: context.hospitalId,
      encounterId: context.encounterId,
      service: context.service,
      operation: context.operation,
    };
  }

  sanitizePersistedData(data: unknown, _service: string, _operation: string) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return undefined;
    }

    const sanitized: Record<string, boolean | number | string | Array<number | string>> = {};

    for (const [key, value] of Object.entries(data)) {
      const normalized = this.normalizeSafeValue(key, value);
      if (normalized !== undefined) {
        sanitized[key] = normalized;
      }
    }

    return Object.keys(sanitized).length > 0 ? sanitized : undefined;
  }

  shouldPersistLevel(level: LogLevel): boolean {
    if (!this.logDbEnabled) {
      return false;
    }

    return LEVEL_ORDER[level] >= LEVEL_ORDER[this.logDbMinLevel];
  }

  async purgeOlderThan(cutoff: Date) {
    const prisma = this.getPrismaOrThrow();

    const [deletedLogs, deletedReports] = await prisma.$transaction([
      prisma.logRecord.deleteMany({
        where: {
          createdAt: { lt: cutoff },
        },
      }),
      prisma.errorReportSnapshot.deleteMany({
        where: {
          generatedAt: { lt: cutoff },
        },
      }),
    ]);

    return {
      deletedLogs: deletedLogs.count,
      deletedReports: deletedReports.count,
      cutoff,
    };
  }

  private async persistEntry(entry: LogEntry): Promise<LogEntry | null> {
    const prisma = this.getPrisma();
    if (!prisma) {
      return entry;
    }

    const created = await prisma.logRecord.create({
      data: this.buildCreateInput(entry),
    });

    return this.mapRecordToLogEntry(created);
  }

  private async persistBufferedEntries(entries: LogEntry[]): Promise<void> {
    const prisma = this.getPrisma();
    if (!prisma || entries.length === 0) {
      return;
    }

    await prisma.$transaction(
      entries.map((entry) =>
        prisma.logRecord.create({
          data: this.buildCreateInput(entry),
        }),
      ),
    );
  }

  private buildCreateInput(entry: LogEntry) {
    return {
      createdAt: entry.timestamp,
      level: this.mapLevelToRecordLevel(entry.level),
      message: entry.message,
      correlationId: entry.context.correlationId,
      service: entry.context.service,
      operation: entry.context.operation,
      userId: entry.context.userId,
      patientId: entry.context.patientId,
      hospitalId: entry.context.hospitalId,
      encounterId: entry.context.encounterId,
      data: entry.data as Prisma.InputJsonValue | undefined,
      errorMessage: entry.error?.message,
      errorStack: entry.level === LogLevel.ERROR ? entry.error?.stack : undefined,
      errorCode: entry.error?.code,
    };
  }

  private buildLogEntry(
    level: LogLevel,
    message: string,
    context: SanitizedContext,
    data?: SanitizedData,
    error?: Error,
  ): LogEntry {
    return {
      id: randomUUID(),
      timestamp: new Date(),
      level,
      message,
      context,
      data,
      error: error
        ? {
            message: error.message,
            stack: level === LogLevel.ERROR ? error.stack : undefined,
            code: this.getErrorCode(error),
          }
        : undefined,
    };
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

  private logToConsole(
    level: LogLevel,
    message: string,
    context: SanitizedContext,
    data?: Record<string, boolean | number | string | Array<number | string>>,
    error?: Error,
  ) {
    try {
      const logData = {
        ...context,
        message,
        data,
      };

      switch (level) {
        case LogLevel.DEBUG:
          this.logger.debug(logData);
          break;
        case LogLevel.INFO:
          this.logger.log(logData);
          break;
        case LogLevel.WARN:
          this.logger.warn(logData);
          break;
        case LogLevel.ERROR:
          this.logger.error(logData, error?.stack);
          break;
      }
    } catch (consoleError) {
      try {
        console.error('[LoggingService] Console logging failed', {
          level,
          message,
          error: consoleError instanceof Error ? consoleError.message : String(consoleError),
        });
      } catch {
        // Silent fail as absolute fallback.
      }
    }
  }

  private normalizeSafeValue(
    key: string,
    value: unknown,
  ): boolean | number | string | Array<number | string> | undefined {
    if (!this.isAllowedDataKey(key)) {
      return undefined;
    }

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : undefined;
    }

    if (typeof value === 'string') {
      if (!this.isAllowedStringValue(key, value)) {
        return undefined;
      }
      return value;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (Array.isArray(value) && this.isAllowedArrayKey(key)) {
      const normalized = value
        .map((item) => {
          if (typeof item === 'number' && Number.isFinite(item)) {
            return item;
          }
          if (typeof item === 'string' && item.length <= 100) {
            return item;
          }
          return undefined;
        })
        .filter((item): item is number | string => item !== undefined);

      return normalized.length > 0 ? normalized : undefined;
    }

    return undefined;
  }

  private isAllowedDataKey(key: string): boolean {
    if (SAFE_STRING_KEYS.has(key) || SAFE_NUMERIC_KEYS.has(key)) {
      return true;
    }

    if (/^(has|is|can|should)[A-Z]/.test(key)) {
      return true;
    }

    if (/(Id|Ids|Count|Ms|Seconds|Minutes|Page|Limit|Offset|Attempts|Size|Connections)$/.test(key)) {
      return true;
    }

    return false;
  }

  private isAllowedStringValue(key: string, value: string): boolean {
    if (value.length > 120) {
      return false;
    }

    return SAFE_STRING_KEYS.has(key) || /(Id|Ids|Status|Type|Role)$/.test(key);
  }

  private isAllowedArrayKey(key: string): boolean {
    return /(Ids|Statuses|Types)$/.test(key);
  }

  private parseBooleanEnv(raw: string | undefined, fallback: boolean) {
    if (raw === undefined) {
      return fallback;
    }

    return raw.toLowerCase() !== 'false';
  }

  private parseDbMinLevel(raw: string | undefined): LogLevel {
    switch ((raw ?? LogLevel.WARN).toLowerCase()) {
      case LogLevel.DEBUG:
        return LogLevel.DEBUG;
      case LogLevel.INFO:
        return LogLevel.INFO;
      case LogLevel.ERROR:
        return LogLevel.ERROR;
      case LogLevel.WARN:
      default:
        return LogLevel.WARN;
    }
  }

  private parseNumberEnv(raw: string | undefined, fallback: number) {
    if (!raw) {
      return fallback;
    }

    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  private normalizePagination(limit?: number, offset?: number) {
    const normalizedLimit =
      typeof limit === 'number' && Number.isFinite(limit) && limit > 0
        ? Math.min(Math.trunc(limit), this.logQueryMaxLimit)
        : this.logQueryDefaultLimit;
    const normalizedOffset =
      typeof offset === 'number' && Number.isFinite(offset) && offset >= 0
        ? Math.trunc(offset)
        : 0;

    return {
      limit: normalizedLimit,
      offset: normalizedOffset,
    };
  }

  private resolvePrisma() {
    try {
      return this.moduleRef.get(PrismaService, { strict: false });
    } catch {
      return null;
    }
  }

  private getPrisma() {
    if (!this.prisma) {
      this.prisma = this.resolvePrisma();
    }

    return this.prisma;
  }

  private getPrismaOrThrow(): LoggingPrismaClient {
    const prisma = this.getPrisma();
    if (!prisma) {
      throw new Error('PrismaService is not available for log queries');
    }
    return prisma as LoggingPrismaClient;
  }

  private mapLevelToRecordLevel(level: LogLevel): DbLogLevel {
    switch (level) {
      case LogLevel.DEBUG:
        return 'DEBUG';
      case LogLevel.INFO:
        return 'INFO';
      case LogLevel.ERROR:
        return 'ERROR';
      case LogLevel.WARN:
      default:
        return 'WARN';
    }
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

  private getErrorCode(error?: Error) {
    const code = error && 'code' in error ? (error as Error & { code?: unknown }).code : undefined;
    return typeof code === 'string' ? code : undefined;
  }
}
