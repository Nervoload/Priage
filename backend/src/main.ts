// backend/src/main.ts
// main.ts
// Written by: John Surette
// Date Created: Jan 6 2026
// Last Edited: Jan 6 2026
// Bootstraps the NestJS server.
// Enables global validation and basic CORS for prototype development.

import 'reflect-metadata';
import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { CorrelationMiddleware } from './common/middleware/correlation.middleware';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Apply correlation middleware for request tracing
  app.use(new CorrelationMiddleware().use.bind(new CorrelationMiddleware()));

  // CORS configuration - allow frontend origins
  // In production, set CORS_ORIGINS env var to restrict to specific domains
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') || true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-patient-token', 'x-correlation-id', 'x-request-id'],
  });

  // Global DTO validation:
  // - whitelist: strips unknown properties
  // - transform: coerces payloads into DTO classes/types when possible
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false, // Allow extra properties (more flexible for clients)
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);

  // eslint-disable-next-line no-console
  console.log(`[priage-backend] listening on http://localhost:${port}`);
}

void bootstrap();
