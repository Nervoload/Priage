import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

import { RequestWithId } from './request-id.middleware';

interface ErrorResponse {
  statusCode: number;
  code: string;
  message: string;
  requestId?: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithId & Request>();
    const requestId = request.requestId;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_SERVER_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const responseBody = exception.getResponse();
      if (typeof responseBody === 'string') {
        message = responseBody;
      } else if (typeof responseBody === 'object' && responseBody) {
        const responseObj = responseBody as Record<string, unknown>;
        const responseMessage = responseObj.message;
        if (typeof responseMessage === 'string') {
          message = responseMessage;
        } else if (Array.isArray(responseMessage)) {
          message = responseMessage.join(', ');
        }
        const responseCode = responseObj.code;
        if (typeof responseCode === 'string') {
          code = responseCode;
        }
      }
      code = code === 'INTERNAL_SERVER_ERROR' ? HttpStatus[status] ?? code : code;
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const payload: ErrorResponse = {
      statusCode: status,
      code,
      message,
      requestId,
    };

    if (status >= 500) {
      this.logger.error(message, exception instanceof Error ? exception.stack : undefined);
    } else {
      this.logger.warn(message);
    }

    response.status(status).json(payload);
  }
}
