// backend/src/modules/prisma/prisma.service.ts
// prisma.service.ts
// Written by: John Surette
// Date Created: Jan 6 2026
// Last Edited: Jan 6 2026
// PrismaService: injectable PrismaClient with NestJS lifecycle hooks.
// This is the standard NestJS+Prisma pattern so the client connects cleanly and closes on shutdown.

import { INestApplication, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly pool: Pool;

  constructor() {
    // check if DATABASE_URL is set (from npx prisma generate and cp .env.example .env)
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set. Add it to your environment/.env for the backend process.');
    }

    // Create PostgreSQL pool for the adapter with proper limits
    const pool = new Pool({
      connectionString,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 2000, // Timeout for acquiring a connection
    });

    const adapter = new PrismaPg(pool);
    super({ adapter });
    this.pool = pool; // Store pool reference for cleanup
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    await this.pool.end(); // Properly close the pool on shutdown
  }
}
