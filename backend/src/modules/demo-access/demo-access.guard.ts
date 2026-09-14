// backend/src/modules/demo-access/demo-access.guard.ts
// Global guard that gates demo deployments behind either the legacy
// DEMO_ACCESS_CODE cookie or a verified DemoSession cookie.

import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { SKIP_DEMO_GATE_KEY } from '../../common/decorators/skip-demo-gate.decorator';
import { DEMO_COOKIE_NAME } from '../demo-sessions/demo-sessions.constants';
import { DemoSessionsService } from '../demo-sessions/demo-sessions.service';

export { DEMO_COOKIE_NAME };

@Injectable()
export class DemoAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly demoSessions: DemoSessionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
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
    const session = await this.demoSessions.getActiveSessionFromCookieHeader(request.headers?.cookie);
    this.demoSessions.assertDemoCapabilityAllowed(request, session);

    if (this.demoSessions.isLegacyCodeCookieValid(request.headers?.cookie)) {
      this.demoSessions.recordLegacyCodeUse();
      return true;
    }
    if (session) {
      return true;
    }

    if (!this.demoSessions.isDemoGateRequired()) {
      return true;
    }

    throw new ForbiddenException('Demo access required');
  }
}
