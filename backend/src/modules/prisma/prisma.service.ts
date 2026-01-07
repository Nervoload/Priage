// backend/src/modules/prisma/prisma.service.ts
// prisma.service.ts
// Written by: John Surette
// Date Created: Jan 6 2026
// Last Edited: Jan 6 2026
// PrismaService: injectable PrismaClient with NestJS lifecycle hooks.
// This is the standard NestJS+Prisma pattern so the client connects cleanly and closes on shutdown.

import { INestApplication, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

import { PrismaPg } from '@prisma/adapter-pg'; // might fix constructor issue

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      // Fail fast with a clear message (otherwise you’ll get confusing downstream errors).
      throw new Error('DATABASE_URL is not set. Add it to your environment/.env for the backend process.');
    }

    //fixing constructor hooks
    const adapter = new PrismaPg({ connectionString });
    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
