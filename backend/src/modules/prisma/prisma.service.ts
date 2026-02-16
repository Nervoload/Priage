// backend/src/modules/prisma/prisma.service.ts
// prisma.service.ts
// Written by: John Surette
// Date Created: Jan 6 2026
// Last Edited: Jan 6 2026
// PrismaService: injectable PrismaClient with NestJS lifecycle hooks.
// This is the standard NestJS+Prisma pattern so the client connects cleanly and closes on shutdown.

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

import { PrismaPg } from '@prisma/adapter-pg';
import { LoggingService } from '../logging/logging.service';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly pool: Pool;
  private connectionAttempts = 0;
  private readonly MAX_CONNECTION_ATTEMPTS = 3;
  private loggingService?: LoggingService;

  constructor() {
    // check if DATABASE_URL is set (from npx prisma generate and cp .env.example .env)
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      const error = 'DATABASE_URL is not set. Add it to your environment/.env for the backend process.';
      Logger.error(error, '', 'PrismaService');
      throw new Error(error);
    }

    Logger.log('Initializing PrismaService with connection pool', 'PrismaService');

    // Create PostgreSQL pool for the adapter with proper limits
    const pool = new Pool({
      connectionString,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 2000, // Timeout for acquiring a connection
    });

    // Monitor pool events for debugging and performance tracking
    pool.on('connect', () => {
      Logger.debug('New client connected to database pool', 'PrismaService');
    });

    pool.on('error', (err) => {
      Logger.error({
        message: 'Unexpected database pool error',
        error: err.message,
        stack: err.stack,
      }, '', 'PrismaService');
    });

    pool.on('remove', () => {
      Logger.debug('Client removed from database pool', 'PrismaService');
    });

    const adapter = new PrismaPg(pool);
    super({ 
      adapter,
      log: [
        { level: 'warn', emit: 'event' },
        { level: 'error', emit: 'event' },
      ],
    });
    
    this.pool = pool; // Store pool reference for cleanup

    // Subscribe to Prisma's query events for performance monitoring
    this.$on('warn' as never, async (e: any) => {
      if (this.loggingService) {
        this.loggingService.warn(
          'Prisma warning',
          {
            service: 'PrismaService',
            operation: 'prismaWarning',
            correlationId: undefined,
          },
          {
            warning: e.message,
          },
        );
      } else {
        this.logger.warn({
          message: 'Prisma warning',
          warning: e.message,
        });
      }
    });

    this.$on('error' as never, async (e: any) => {
      if (this.loggingService) {
        this.loggingService.error(
          'Prisma error',
          {
            service: 'PrismaService',
            operation: 'prismaError',
            correlationId: undefined,
          },
          new Error(e.message),
        );
      } else {
        this.logger.error({
          message: 'Prisma error',
          error: e.message,
        });
      }
    });

    Logger.log('PrismaService pool configuration:', 'PrismaService');
    Logger.log(`  - Max connections: 20`, 'PrismaService');
    Logger.log(`  - Idle timeout: 30s`, 'PrismaService');
    Logger.log(`  - Connection timeout: 2s`, 'PrismaService');
  }

  setLoggingService(loggingService: LoggingService) {
    this.loggingService = loggingService;
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('Connecting to database...');
    
    while (this.connectionAttempts < this.MAX_CONNECTION_ATTEMPTS) {
      try {
        this.connectionAttempts++;
        await this.$connect();
        
        // Test the connection
        await this.$queryRaw`SELECT 1`;
        
        if (this.loggingService) {
          this.loggingService.info(
            'Database connection established successfully',
            {
              service: 'PrismaService',
              operation: 'onModuleInit',
              correlationId: undefined,
            },
            {
              attempt: this.connectionAttempts,
              poolSize: this.pool.totalCount,
              idleConnections: this.pool.idleCount,
              waitingClients: this.pool.waitingCount,
            },
          );
        } else {
          this.logger.log({
            message: 'Database connection established successfully',
            attempt: this.connectionAttempts,
            poolSize: this.pool.totalCount,
            idleConnections: this.pool.idleCount,
            waitingClients: this.pool.waitingCount,
          });
        }
        
        return;
      } catch (error) {
        if (this.loggingService) {
          this.loggingService.error(
            'Failed to connect to database',
            {
              service: 'PrismaService',
              operation: 'onModuleInit',
              correlationId: undefined,
            },
            error instanceof Error ? error : new Error(String(error)),
            {
              attempt: this.connectionAttempts,
              maxAttempts: this.MAX_CONNECTION_ATTEMPTS,
            },
          );
        } else {
          this.logger.error({
            message: 'Failed to connect to database',
            attempt: this.connectionAttempts,
            maxAttempts: this.MAX_CONNECTION_ATTEMPTS,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          });
        }

        if (this.connectionAttempts >= this.MAX_CONNECTION_ATTEMPTS) {
          this.logger.error('Max connection attempts reached. Service will be unavailable.');
          throw error;
        }

        // Wait before retrying (exponential backoff)
        const waitTime = Math.pow(2, this.connectionAttempts) * 1000;
        this.logger.log(`Retrying connection in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Disconnecting from database...');
    
    try {
      await this.$disconnect();
      if (this.loggingService) {
        this.loggingService.info(
          'Prisma client disconnected',
          {
            service: 'PrismaService',
            operation: 'onModuleDestroy',
            correlationId: undefined,
          },
        );
      } else {
        this.logger.log('Prisma client disconnected');
      }
    } catch (error) {
      if (this.loggingService) {
        this.loggingService.error(
          'Error disconnecting Prisma client',
          {
            service: 'PrismaService',
            operation: 'onModuleDestroy',
            correlationId: undefined,
          },
          error instanceof Error ? error : new Error(String(error)),
        );
      } else {
        this.logger.error({
          message: 'Error disconnecting Prisma client',
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
      }
    }

    try {
      await this.pool.end();
      if (this.loggingService) {
        this.loggingService.info(
          'Database connection pool closed',
          {
            service: 'PrismaService',
            operation: 'onModuleDestroy',
            correlationId: undefined,
          },
          {
            finalPoolSize: this.pool.totalCount,
          },
        );
      } else {
        this.logger.log({
          message: 'Database connection pool closed',
          finalPoolSize: this.pool.totalCount,
        });
      }
    } catch (error) {
      if (this.loggingService) {
        this.loggingService.error(
          'Error closing database pool',
          {
            service: 'PrismaService',
            operation: 'onModuleDestroy',
            correlationId: undefined,
          },
          error instanceof Error ? error : new Error(String(error)),
        );
      } else {
        this.logger.error({
          message: 'Error closing database pool',
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
      }
    }
  }

  /**
   * Get current pool statistics for monitoring
   */
  async getPoolStats() {
    const stats = {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };

    if (this.loggingService) {
      this.loggingService.debug(
        'Current pool statistics',
        {
          service: 'PrismaService',
          operation: 'getPoolStats',
          correlationId: undefined,
        },
        stats,
      );
    } else {
      this.logger.debug({
        message: 'Current pool statistics',
        ...stats,
      });
    }

    return stats;
  }
}
