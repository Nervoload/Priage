import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

import { RequestWithId } from './request-id.middleware';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const start = Date.now();
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<RequestWithId & Request>();
    const res = ctx.getResponse<Response>();

    return next.handle().pipe(
      tap(() => {
        const durationMs = Date.now() - start;
        const method = req.method;
        const url = req.originalUrl ?? req.url;
        const statusCode = res.statusCode;
        const requestId = req.requestId;
        this.logger.log(`${method} ${url} ${statusCode} +${durationMs}ms${requestId ? ` requestId=${requestId}` : ''}`);
      }),
    );
  }
}
