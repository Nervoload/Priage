// backend/src/main.ts
// main.ts
// Written by: John Surette
// Date Created: Jan 6 2026
// Last Edited: Jan 6 2026
// Bootstraps the NestJS server.
// Enables global validation and basic CORS for prototype development.

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import 'reflect-metadata';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

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

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);

  // eslint-disable-next-line no-console
  console.log(`[priage-backend] listening on http://localhost:${port}`);
}

void bootstrap();
