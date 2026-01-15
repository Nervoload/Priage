import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { RequestWithId } from '../observability/request-id.middleware';

interface AuthenticatedRequest extends RequestWithId {
  user?: {
    hospitalId?: number;
  };
}

export const HospitalId = createParamDecorator((_: unknown, ctx: ExecutionContext): number | undefined => {
  const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  return request.user?.hospitalId;
});
