// backend/src/modules/demo-access/demo-access.guard.ts
// Global guard that gates every request behind a DEMO_ACCESS_CODE cookie.
// When DEMO_ACCESS_CODE is not set in the environment the gate is disabled,
// so local development works without any extra setup.

import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { SKIP_DEMO_GATE_KEY } from '../../common/decorators/skip-demo-gate.decorator';
import { readCookie } from '../../common/http/auth-cookie.util';

export const DEMO_COOKIE_NAME = 'priage_demo_access';

@Injectable()
export class DemoAccessGuard implements CanActivate {
  private readonly expectedCode: string | undefined;

  constructor(private readonly reflector: Reflector) {
    this.expectedCode = process.env.DEMO_ACCESS_CODE?.trim() || undefined;
  }

  canActivate(context: ExecutionContext): boolean {
    // If no code is configured, the gate is wide-open (local dev).
    if (!this.expectedCode) {
      return true;
    }

    // Allow routes decorated with @SkipDemoGate() (health checks, the
    // demo-access endpoint itself, etc.)
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_DEMO_GATE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const cookie = readCookie(request.headers?.cookie, DEMO_COOKIE_NAME);

    if (cookie && cookie === this.expectedCode) {
      return true;
    }

    throw new ForbiddenException('Demo access required');
  }
}
