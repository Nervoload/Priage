// backend/src/modules/auth/jwt.strategy.ts
// John Surette
// Dec 8, 2025
// jwt.strategy.ts
// implements NestJS's passport JWT strategy
// used by guards/jwt/jwt-auth.guard.ts and roles/guard.ts 
// JwtAuthGuard checks request has valid JWT, attaches req.user
// RolesGuard checks req.user.role is allowed at endpoint

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { AuthService, JwtPayload } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'dev-secret',
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.authService.validateUser(payload);
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}