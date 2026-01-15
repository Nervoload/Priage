import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

import { RequestWithId } from '../observability/request-id.middleware';

interface AuthenticatedRequest extends RequestWithId {
  user?: {
    hospitalId?: number;
  };
}

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user?.hospitalId) {
      throw new UnauthorizedException('Missing hospital context');
    }
    return true;
  }
}
