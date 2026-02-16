// backend/src/common/middleware/correlation.middleware.ts
// Middleware to add correlation IDs to all requests for distributed tracing

import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

// Extend Express Request type to include correlationId and patientUser
declare global {
  namespace Express {
    interface Request {
      correlationId: string;
      patientUser?: {
        patientId: number;
        sessionId: number;
        encounterId: number | null;
      };
    }
  }
}

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Check if client provided a correlation ID, otherwise generate one
    const correlationId = 
      (req.headers['x-correlation-id'] as string) || 
      (req.headers['x-request-id'] as string) ||
      randomUUID();
    
    // Attach to request object for use in services
    req.correlationId = correlationId;
    
    // Return in response headers for client-side tracing
    res.setHeader('x-correlation-id', correlationId);
    
    next();
  }
}
