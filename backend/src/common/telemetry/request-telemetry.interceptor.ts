import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { LoggingService } from '../../modules/logging/logging.service';

@Injectable()
export class RequestTelemetryInterceptor implements NestInterceptor {
  constructor(private readonly loggingService: LoggingService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const startedAt = Date.now();

    return next.handle().pipe(
      finalize(() => {
        const durationMs = Date.now() - startedAt;
        const status = response.statusCode;
        const path = sanitizePath(request.route?.path || request.path || '/');
        const logContext = {
          service: 'HttpServer',
          operation: 'request',
          correlationId: request.correlationId,
          userId: readNumber((request as RequestWithActors).user?.userId),
          patientId: readNumber(request.patientUser?.patientId),
          hospitalId: readNumber((request as RequestWithActors).user?.hospitalId),
        };
        const data = {
          method: request.method,
          path,
          status,
          durationMs,
        };

        if (status >= 500) {
          void this.loggingService.error(
            'HTTP request failed',
            logContext,
            new Error(`HTTP ${status}`),
            data,
          ).catch(() => undefined);
        } else {
          void this.loggingService.info('HTTP request completed', logContext, data).catch(() => undefined);
        }
      }),
    );
  }
}

type RequestWithActors = Request & {
  user?: {
    userId?: number;
    hospitalId?: number;
  };
};

function sanitizePath(path: string): string {
  return path
    .split('?')[0]
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ':id')
    .replace(/\/\d+(?=\/|$)/g, '/:id')
    .slice(0, 240);
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
