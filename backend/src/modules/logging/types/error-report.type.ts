// backend/src/modules/logging/types/error-report.type.ts
// Type definitions for error reports

import { LogEntry } from './log-entry.type';

export interface ErrorReport {
  reportId: string;
  timestamp: Date;
  correlationId: string;

  // What happened
  summary: string;
  errorChain: ErrorChainEntry[];
  
  // Where it happened
  affectedServices: string[];
  failurePoint: {
    service: string;
    operation: string;
    timestamp: Date;
  };
  
  // System state at time of error
  systemMetrics: SystemMetrics;
  
  // Reproduction information
  userAction?: string;
  requestContext: {
    method?: string;
    path?: string;
    userId?: number;
    hospitalId?: number;
    encounterId?: number;
  };
  
  // All related logs
  logs: LogEntry[];
  
  // Export URL
  exportUrl: string;
}

export interface ErrorChainEntry {
  service: string;
  operation: string;
  error: string;
  timestamp: Date;
  stack?: string;
}

export interface SystemMetrics {
  timestamp: Date;
  database: {
    connected: boolean;
    poolSize?: number;
    idleConnections?: number;
    waitingClients?: number;
  };
  websockets: {
    totalConnections: number;
    connectionsByHospital?: Record<number, number>;
  };
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  uptime: number;
}

export interface ErrorReportExport {
  reportId: string;
  version: string;
  generatedAt: Date;
  report: ErrorReport;
  metadata: {
    nodeVersion: string;
    platform: string;
    applicationVersion?: string;
  };
}
