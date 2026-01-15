// backend/src/modules/prisma/prisma.service.ts
// prisma.service.ts
// Written by: John Surette
// Date Created: Jan 6 2026
// Last Edited: Jan 6 2026
// PrismaService: injectable PrismaClient with NestJS lifecycle hooks.
// This is the standard NestJS+Prisma pattern so the client connects cleanly and closes on shutdown.

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

import { PrismaPg } from '@prisma/adapter-pg'; // might fix constructor issue
import { AppConfigService } from '../config/config.service';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(configService: AppConfigService) {
    const connectionString = configService.getDatabaseUrl();
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
