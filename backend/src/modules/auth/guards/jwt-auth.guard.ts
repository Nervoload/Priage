// backend/src/modules/auth/guards/jwt-auth.guard.ts
// Staff session authentication guard.
// Protects routes requiring authenticated staff users.

import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

import { readCookie, STAFF_AUTH_COOKIE } from '../../../common/http/auth-cookie.util';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = readCookie(request.headers?.cookie, STAFF_AUTH_COOKIE)
      ?? this.readBearerToken(request.headers?.authorization)
      ?? null;

    if (!token) {
      throw new UnauthorizedException('Staff session token is required');
    }

    request.user = await this.authService.validateSessionToken(
      token,
      request.correlationId,
      {
        ipAddress: request.ip,
        userAgent: request.get?.('user-agent') ?? request.headers?.['user-agent'] ?? null,
      },
    );
    request.authToken = token;
    return true;
  }

  private readBearerToken(header: string | string[] | undefined): string | null {
    const value = Array.isArray(header) ? header[0] : header;
    if (!value || !value.startsWith('Bearer ')) {
      return null;
    }

    const token = value.slice('Bearer '.length).trim();
    return token || null;
  }
}
