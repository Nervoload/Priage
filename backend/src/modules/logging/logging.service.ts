// backend/src/modules/logging/logging.service.ts
// Centralized logging service with correlation support

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { LogContext, LogEntry, LogLevel, LogQuery } from './types/log-entry.type';

@Injectable()
export class LoggingService {
  private readonly logger = new Logger(LoggingService.name);
  private readonly logs: Map<string, LogEntry[]> = new Map(); // In-memory store (dev mode)
  private readonly maxLogsPerCorrelation = 1000;
  private readonly maxTotalLogs = 10000;
  private readonly retentionMs = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    this.logger.log('LoggingService initialized');
    
    // Cleanup old logs periodically
    setInterval(() => this.cleanupOldLogs(), 60 * 60 * 1000); // Every hour
  }

  /**
   * Log an operation with full context and correlation
   * CRITICAL: This method MUST NOT throw - logging failures should never crash the app
   */
  async logOperation(
    level: LogLevel,
    message: string,
    context: LogContext,
    data?: any,
    error?: Error,
    duration?: number,
  ): Promise<LogEntry | null> {
    try {
      const entry: LogEntry = {
        id: randomUUID(),
        timestamp: new Date(),
        level,
        message,
        context: { ...context },
        data: this.sanitizeData(data),
        duration,
      };

      if (error) {
        entry.error = {
          message: error.message,
          stack: error.stack,
          code: (error as any).code,
        };
      }

      // Store by correlation ID for quick lookup
      const correlationId = context.correlationId || 'uncorrelated';
      if (!this.logs.has(correlationId)) {
        this.logs.set(correlationId, []);
      }

      const correlationLogs = this.logs.get(correlationId)!;
      correlationLogs.push(entry);

      // Limit logs per correlation to prevent memory issues
      if (correlationLogs.length > this.maxLogsPerCorrelation) {
        correlationLogs.shift();
      }

      // Also log to NestJS logger for console output
      this.logToConsole(level, message, context, error);

      // Cleanup if total logs exceed limit
      if (this.getTotalLogCount() > this.maxTotalLogs) {
        this.cleanupOldestCorrelation();
      }

      return entry;
    } catch (loggingError) {
      // CRITICAL: Logging failure should never crash the app
      // Log to console as last resort, but don't throw
      try {
        console.error('[LoggingService] CRITICAL: Logging operation failed', {
          originalMessage: message,
          loggingError: loggingError instanceof Error ? loggingError.message : String(loggingError),
          context,
        });
      } catch {
        // Even console.error failed - silent fail to keep app running
      }
      return null;
    }
  }

  /**
   * Convenience methods for different log levels
   * These wrap logOperation with error handling
   */
  async debug(message: string, context: LogContext, data?: any): Promise<LogEntry | null> {
    return this.logOperation(LogLevel.DEBUG, message, context, data);
  }

  async info(message: string, context: LogContext, data?: any): Promise<LogEntry | null> {
    return this.logOperation(LogLevel.INFO, message, context, data);
  }

  async warn(message: string, context: LogContext, data?: any): Promise<LogEntry | null> {
    return this.logOperation(LogLevel.WARN, message, context, data);
  }

  async error(
    message: string,
    context: LogContext,
    error?: Error,
    data?: any,
  ): Promise<LogEntry | null> {
    return this.logOperation(LogLevel.ERROR, message, context, data, error);
  }

  /**
   * Get all logs for a specific correlation ID
   */
  async getLogsByCorrelationId(correlationId: string): Promise<LogEntry[]> {
    return this.logs.get(correlationId) || [];
  }

  /**
   * Query logs with filters
   */
  async queryLogs(query: LogQuery): Promise<LogEntry[]> {
    let results: LogEntry[] = [];

    // If correlation ID provided, only search that
    if (query.correlationId) {
      results = this.logs.get(query.correlationId) || [];
    } else {
      // Search all logs
      for (const logs of this.logs.values()) {
        results.push(...logs);
      }
    }

    // Apply filters
    return results.filter((log) => {
      if (query.level && log.level !== query.level) return false;
      if (query.service && log.context.service !== query.service) return false;
      if (query.userId && log.context.userId !== query.userId) return false;
      if (query.hospitalId && log.context.hospitalId !== query.hospitalId) return false;
      if (query.encounterId && log.context.encounterId !== query.encounterId) return false;
      if (query.startTime && log.timestamp < query.startTime) return false;
      if (query.endTime && log.timestamp > query.endTime) return false;
      return true;
    });
  }

  /**
   * Get error logs for a correlation ID
   */
  async getErrorLogs(correlationId: string): Promise<LogEntry[]> {
    const logs = await this.getLogsByCorrelationId(correlationId);
    return logs.filter((log) => log.level === LogLevel.ERROR);
  }

  /**
   * Check if a correlation ID has errors
   */
  async hasErrors(correlationId: string): Promise<boolean> {
    const errors = await this.getErrorLogs(correlationId);
    return errors.length > 0;
  }

  /**
   * Get statistics about stored logs
   */
  getStats() {
    return {
      totalCorrelations: this.logs.size,
      totalLogs: this.getTotalLogCount(),
      oldestLog: this.getOldestLogTimestamp(),
      memoryUsage: process.memoryUsage(),
    };
  }

  /**
   * Clear all logs (for testing or manual cleanup)
   */
  clearAll() {
    this.logs.clear();
    this.logger.warn('All logs cleared');
  }

  /**
   * Clear logs for a specific correlation ID
   */
  clearCorrelation(correlationId: string) {
    this.logs.delete(correlationId);
  }

  // Private helper methods

  private logToConsole(level: LogLevel, message: string, context: LogContext, error?: Error) {
    try {
      const logData = {
        ...context,
        message,
        correlationId: context.correlationId,
        service: context.service,
        operation: context.operation,
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
      // Even console logging failed - use basic console.error as absolute fallback
      try {
        console.error('[LoggingService] Console logging failed', {
          level,
          message,
          error: consoleError,
        });
      } catch {
        // Absolute worst case - silent fail
      }
    }
  }

  private sanitizeData(data: any): any {
    if (!data) return undefined;

    // Remove sensitive fields
    const sensitive = ['password', 'token', 'secret', 'apiKey', 'authorization'];
    
    const sanitize = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) return obj;
      
      if (Array.isArray(obj)) {
        return obj.map(sanitize);
      }

      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (sensitive.some(s => key.toLowerCase().includes(s))) {
          sanitized[key] = '[REDACTED]';
        } else if (typeof value === 'object') {
          sanitized[key] = sanitize(value);
        } else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    };

    return sanitize(data);
  }

  private getTotalLogCount(): number {
    let count = 0;
    for (const logs of this.logs.values()) {
      count += logs.length;
    }
    return count;
  }

  private getOldestLogTimestamp(): Date | null {
    let oldest: Date | null = null;
    for (const logs of this.logs.values()) {
      if (logs.length > 0) {
        const firstLog = logs[0];
        if (!oldest || firstLog.timestamp < oldest) {
          oldest = firstLog.timestamp;
        }
      }
    }
    return oldest;
  }

  private cleanupOldLogs() {
    const cutoff = new Date(Date.now() - this.retentionMs);
    let removed = 0;

    for (const [correlationId, logs] of this.logs.entries()) {
      // Remove old logs from this correlation
      const filtered = logs.filter(log => log.timestamp > cutoff);
      
      if (filtered.length === 0) {
        // All logs are old, remove the entire correlation
        this.logs.delete(correlationId);
        removed += logs.length;
      } else if (filtered.length < logs.length) {
        // Some logs removed
        this.logs.set(correlationId, filtered);
        removed += logs.length - filtered.length;
      }
    }

    if (removed > 0) {
      this.logger.log({
        message: 'Cleaned up old logs',
        removed,
        remainingCorrelations: this.logs.size,
        remainingLogs: this.getTotalLogCount(),
      });
    }
  }

  private cleanupOldestCorrelation() {
    let oldestCorrelationId: string | null = null;
    let oldestTimestamp: Date | null = null;

    for (const [correlationId, logs] of this.logs.entries()) {
      if (logs.length > 0) {
        const firstLog = logs[0];
        if (!oldestTimestamp || firstLog.timestamp < oldestTimestamp) {
          oldestTimestamp = firstLog.timestamp;
          oldestCorrelationId = correlationId;
        }
      }
    }

    if (oldestCorrelationId) {
      this.logs.delete(oldestCorrelationId);
      this.logger.warn({
        message: 'Removed oldest correlation due to memory limit',
        correlationId: oldestCorrelationId,
      });
    }
  }
}
