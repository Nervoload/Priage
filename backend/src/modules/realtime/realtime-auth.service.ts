import { Injectable, UnauthorizedException } from '@nestjs/common';

import { AuthService } from '../auth/auth.service';
import { readCookie, STAFF_DEVICE_COOKIE } from '../../common/http/auth-cookie.util';

export type TrustedRealtimeUser = {
  userId: number;
  hospitalId: number;
  role: string;
  sessionId: number;
};

@Injectable()
export class RealtimeAuthService {
  constructor(private readonly authService: AuthService) {}

  async validateStaffToken(token: string, cookieHeader?: string | string[]): Promise<TrustedRealtimeUser> {
    const user = await this.authService.validateSessionToken(token, undefined, {
      deviceId: readCookie(cookieHeader, STAFF_DEVICE_COOKIE),
    }, {
      touch: true,
    }).catch(() => {
      throw new UnauthorizedException('Invalid staff session');
    });

    return {
      userId: user.userId,
      hospitalId: user.hospitalId,
      role: user.role,
      sessionId: user.sessionId,
    };
  }
}
