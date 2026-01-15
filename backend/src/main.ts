// backend/src/main.ts
// main.ts
// Written by: John Surette
// Date Created: Jan 6 2026
// Last Edited: Jan 6 2026
// Bootstraps the NestJS server.
// Enables global validation and basic CORS for prototype development.

import 'reflect-metadata';
import 'dotenv/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { AppConfigService } from './modules/config/config.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  // Prototype-friendly CORS (lock down origins later).
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Global DTO validation:
  // - whitelist: strips unknown properties
  // - transform: coerces payloads into DTO classes/types when possible
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false, // set true later for stricter contracts
    }),
  );

  const configService = app.get(AppConfigService);
  const port = configService.getPort();
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`[priage-backend] listening on http://localhost:${port}`);
}

void bootstrap();
