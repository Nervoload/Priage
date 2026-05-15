// backend/src/modules/auth/auth.controller.ts
// John Surette
// Dec 8, 2025
// auth.controller.ts
// HTTP entrypoints for authentication
// POST /auth/login→ returns a staff session if credentials are valid
// receives HTTP request, validates, calls auth.service.ts

import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';

import {
  STAFF_AUTH_COOKIE,
  STAFF_AUTH_TTL_MS,
  buildAuthCookieOptions,
  buildClearedAuthCookieOptions,
  readCookie,
} from '../../common/http/auth-cookie.util';
import { STAFF_LOGIN_THROTTLE } from '../../common/http/throttle.util';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Throttle(STAFF_LOGIN_THROTTLE)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto, req.correlationId, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? null,
    });
    const sessionToken = readCookie(req.headers?.cookie, STAFF_AUTH_COOKIE);
    if (sessionToken) {
      await this.authService.logout(sessionToken, req.correlationId, 'superseded_by_new_login');
    }
    res.cookie(STAFF_AUTH_COOKIE, result.sessionToken, buildAuthCookieOptions(STAFF_AUTH_TTL_MS));

    const { sessionToken: _, ...responseBody } = result;
    return responseBody;
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@CurrentUser() user: any) {
    return user;
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = readCookie(req.headers?.cookie, STAFF_AUTH_COOKIE);
    await this.authService.logout(token, req.correlationId);
    res.clearCookie(STAFF_AUTH_COOKIE, buildClearedAuthCookieOptions());
    return { ok: true };
  }
}
