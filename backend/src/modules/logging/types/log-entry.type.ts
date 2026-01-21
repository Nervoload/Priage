// backend/src/modules/logging/types/log-entry.type.ts
// Type definitions for structured logging

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface LogContext {
  correlationId?: string;
  userId?: number;
  patientId?: number;
  hospitalId?: number;
  encounterId?: number;
  service: string;
  operation: string;
  [key: string]: any;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  message: string;
  context: LogContext;
  data?: any;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

export interface LogQuery {
  correlationId?: string;
  level?: LogLevel;
  service?: string;
  startTime?: Date;
  endTime?: Date;
  userId?: number;
  hospitalId?: number;
  encounterId?: number;
}
