// backend/src/modules/logging/log-repository.service.ts
// Repository service for persistent log storage using Prisma/PostgreSQL

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LogEntry, LogLevel, LogQuery } from './types/log-entry.type';
import { Prisma } from '@prisma/client';

@Injectable()
export class LogRepositoryService {
  private readonly logger = new Logger(LogRepositoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Save a log entry to the database
   * CRITICAL: This method MUST NOT throw - logging failures should never crash the app
   */
  async saveLog(entry: LogEntry): Promise<void> {
    try {
      await this.prisma.log.create({
        data: {
          id: entry.id,
          timestamp: entry.timestamp,
          level: this.mapLogLevel(entry.level),
          message: entry.message,
          correlationId: entry.context.correlationId,
          service: entry.context.service,
          operation: entry.context.operation,
          userId: entry.context.userId,
          patientId: entry.context.patientId,
          hospitalId: entry.context.hospitalId,
          encounterId: entry.context.encounterId,
          context: entry.context as Prisma.InputJsonValue,
          data: entry.data as Prisma.InputJsonValue,
          error: entry.error as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      // CRITICAL: Database logging failure should never crash the app
      // Log to console as last resort
      this.logger.error({
        message: 'Failed to save log to database',
        error: error instanceof Error ? error.message : String(error),
        originalLog: entry,
      });
    }
  }

  /**
   * Get all logs for a specific correlation ID
   */
  async getLogsByCorrelationId(correlationId: string): Promise<LogEntry[]> {
    try {
      const logs = await this.prisma.log.findMany({
        where: { correlationId },
        orderBy: { timestamp: 'asc' },
      });
      return logs.map(this.mapToLogEntry);
    } catch (error) {
      this.logger.error({
        message: 'Failed to retrieve logs by correlation ID',
        correlationId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Query logs with filters
   */
  async queryLogs(query: LogQuery): Promise<LogEntry[]> {
    try {
      const where: Prisma.LogWhereInput = {};

      if (query.correlationId) where.correlationId = query.correlationId;
      if (query.level) where.level = this.mapLogLevel(query.level);
      if (query.service) where.service = query.service;
      if (query.userId) where.userId = query.userId;
      if (query.hospitalId) where.hospitalId = query.hospitalId;
      if (query.encounterId) where.encounterId = query.encounterId;
      
      if (query.startTime || query.endTime) {
        where.timestamp = {};
        if (query.startTime) where.timestamp.gte = query.startTime;
        if (query.endTime) where.timestamp.lte = query.endTime;
      }

      const logs = await this.prisma.log.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: 1000, // Limit to prevent excessive memory usage
      });

      return logs.map(this.mapToLogEntry);
    } catch (error) {
      this.logger.error({
        message: 'Failed to query logs',
        query,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Get error logs for a correlation ID
   */
  async getErrorLogs(correlationId: string): Promise<LogEntry[]> {
    try {
      const logs = await this.prisma.log.findMany({
        where: {
          correlationId,
          level: 'ERROR',
        },
        orderBy: { timestamp: 'asc' },
      });
      return logs.map(this.mapToLogEntry);
    } catch (error) {
      this.logger.error({
        message: 'Failed to retrieve error logs',
        correlationId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Check if a correlation ID has errors
   */
  async hasErrors(correlationId: string): Promise<boolean> {
    try {
      const count = await this.prisma.log.count({
        where: {
          correlationId,
          level: 'ERROR',
        },
      });
      return count > 0;
    } catch (error) {
      this.logger.error({
        message: 'Failed to check for errors',
        correlationId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Clean up old logs (for scheduled cleanup)
   */
  async cleanupOldLogs(retentionMs: number): Promise<number> {
    try {
      const cutoff = new Date(Date.now() - retentionMs);
      const result = await this.prisma.log.deleteMany({
        where: {
          timestamp: { lt: cutoff },
        },
      });
      return result.count;
    } catch (error) {
      this.logger.error({
        message: 'Failed to cleanup old logs',
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  /**
   * Get statistics about stored logs
   */
  async getStats() {
    try {
      const [totalLogs, oldestLog] = await Promise.all([
        this.prisma.log.count(),
        this.prisma.log.findFirst({
          orderBy: { timestamp: 'asc' },
          select: { timestamp: true },
        }),
      ]);

      return {
        totalLogs,
        oldestLog: oldestLog?.timestamp || null,
      };
    } catch (error) {
      this.logger.error({
        message: 'Failed to get log statistics',
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        totalLogs: 0,
        oldestLog: null,
      };
    }
  }

  /**
   * Clear all logs (for testing or manual cleanup)
   */
  async clearAll(): Promise<void> {
    try {
      await this.prisma.log.deleteMany({});
    } catch (error) {
      this.logger.error({
        message: 'Failed to clear all logs',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Clear logs for a specific correlation ID
   */
  async clearCorrelation(correlationId: string): Promise<void> {
    try {
      await this.prisma.log.deleteMany({
        where: { correlationId },
      });
    } catch (error) {
      this.logger.error({
        message: 'Failed to clear correlation logs',
        correlationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Private helper methods

  private mapLogLevel(level: LogLevel): 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' {
    switch (level) {
      case LogLevel.DEBUG:
        return 'DEBUG';
      case LogLevel.INFO:
        return 'INFO';
      case LogLevel.WARN:
        return 'WARN';
      case LogLevel.ERROR:
        return 'ERROR';
      default:
        return 'INFO';
    }
  }

  private mapToLogEntry(dbLog: {
    id: string;
    timestamp: Date;
    level: string;
    message: string;
    correlationId: string | null;
    service: string;
    operation: string;
    userId: number | null;
    patientId: number | null;
    hospitalId: number | null;
    encounterId: number | null;
    context: any;
    data: any;
    error: any;
  }): LogEntry {
    return {
      id: dbLog.id,
      timestamp: dbLog.timestamp,
      level: this.mapDbLogLevel(dbLog.level),
      message: dbLog.message,
      context: {
        correlationId: dbLog.correlationId,
        service: dbLog.service,
        operation: dbLog.operation,
        userId: dbLog.userId,
        patientId: dbLog.patientId,
        hospitalId: dbLog.hospitalId,
        encounterId: dbLog.encounterId,
        ...(dbLog.context || {}),
      },
      data: dbLog.data,
      error: dbLog.error,
    };
  }

  private mapDbLogLevel(level: string): LogLevel {
    switch (level) {
      case 'DEBUG':
        return LogLevel.DEBUG;
      case 'INFO':
        return LogLevel.INFO;
      case 'WARN':
        return LogLevel.WARN;
      case 'ERROR':
        return LogLevel.ERROR;
      default:
        return LogLevel.INFO;
    }
  }
}
