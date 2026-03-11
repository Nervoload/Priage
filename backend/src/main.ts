// backend/src/main.ts
// main.ts
// Written by: John Surette
// Date Created: Jan 6 2026
// Last Edited: Jan 6 2026
// Bootstraps the NestJS server.
// Enables global validation and basic CORS for prototype development.

import 'reflect-metadata';
import 'dotenv/config';
import { ValidationPipe, LogLevel } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';

import { getAllowedCorsOrigins } from './common/http/cors.util';
import { AppModule } from './app.module';
import { CorrelationMiddleware } from './common/middleware/correlation.middleware';

async function bootstrap(): Promise<void> {
  // Configure log levels based on environment
  // Default: 'log', 'error', 'warn' (clean)
  // With LOG_LEVEL=debug: adds 'debug' and 'verbose'
  const logLevel = process.env.LOG_LEVEL || 'log';
  const logLevels: LogLevel[] = ['error', 'warn', 'log'];
  
  if (logLevel === 'debug' || logLevel === 'verbose') {
    logLevels.push('debug');
  }
  if (logLevel === 'verbose') {
    logLevels.push('verbose');
  }

  const app = await NestFactory.create(AppModule, {
    logger: logLevels,
  });

  // Trust the first proxy (e.g. Railway, Render, or nginx) so Express
  // sees the real client IP for rate-limiting, logging, and secure cookies.
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', 1);

  // Security headers — helmet sets sensible defaults (X-Content-Type-Options,
  // Strict-Transport-Security, X-Frame-Options, etc.)
  app.use(helmet());

  const allowedOrigins = getAllowedCorsOrigins();

  // Apply correlation middleware for request tracing
  app.use(new CorrelationMiddleware().use.bind(new CorrelationMiddleware()));

  // CORS configuration - allow frontend origins
  // In production, CORS_ORIGINS must be explicitly configured.
  app.enableCors({
    origin: allowedOrigins,
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
