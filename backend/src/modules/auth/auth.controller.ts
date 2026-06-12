// backend/src/modules/auth/auth.controller.ts
// John Surette
// Dec 8, 2025
// auth.controller.ts
// HTTP entrypoints for authentication
// POST /auth/login→ returns a staff session if credentials are valid
// receives HTTP request, validates, calls auth.service.ts

import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { randomBytes } from 'crypto';

import {
  STAFF_AUTH_COOKIE,
  STAFF_DEVICE_COOKIE,
  STAFF_AUTH_TTL_MS,
  buildAuthCookieOptions,
  buildClearedAuthCookieOptions,
  buildDeviceCookieOptions,
  readCookie,
} from '../../common/http/auth-cookie.util';
import { STAFF_LOGIN_THROTTLE } from '../../common/http/throttle.util';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { SsoLoginDto, VerifyMfaDto } from './dto/staff-security.dto';

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
    const deviceId = readCookie(req.headers?.cookie, STAFF_DEVICE_COOKIE) || randomBytes(24).toString('base64url');
    const result = await this.authService.login(dto, req.correlationId, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? null,
      deviceId,
    });
    const sessionToken = readCookie(req.headers?.cookie, STAFF_AUTH_COOKIE);
    if (sessionToken) {
      await this.authService.logout(sessionToken, req.correlationId, 'superseded_by_new_login');
    }
    res.cookie(STAFF_AUTH_COOKIE, result.sessionToken, buildAuthCookieOptions(STAFF_AUTH_TTL_MS));
    res.cookie(STAFF_DEVICE_COOKIE, deviceId, buildDeviceCookieOptions());

    const { sessionToken: _, ...responseBody } = result;
    return responseBody;
  }

  @Post('sso')
  @Throttle(STAFF_LOGIN_THROTTLE)
  async sso(
    @Body() dto: SsoLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const deviceId = readCookie(req.headers?.cookie, STAFF_DEVICE_COOKIE) || randomBytes(24).toString('base64url');
    const result = await this.authService.loginWithSso(dto.assertion, req.correlationId, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? null,
      deviceId,
    });
    res.cookie(STAFF_AUTH_COOKIE, result.sessionToken, buildAuthCookieOptions(STAFF_AUTH_TTL_MS));
    res.cookie(STAFF_DEVICE_COOKIE, deviceId, buildDeviceCookieOptions());
    const { sessionToken: _, ...responseBody } = result;
    return responseBody;
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@CurrentUser() user: any) {
    return user;
  }

  @UseGuards(JwtAuthGuard)
  @Post('mfa/setup')
  beginMfa(@CurrentUser() user: { userId: number }) {
    return this.authService.beginMfaEnrollment(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('mfa/enable')
  enableMfa(@CurrentUser() user: { userId: number }, @Body() dto: VerifyMfaDto) {
    return this.authService.enableMfa(user.userId, dto.code);
  }

  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  listSessions(@CurrentUser() user: { userId: number }) {
    return this.authService.listSessions(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('sessions/:id/revoke')
  revokeSession(
    @CurrentUser() user: { userId: number },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.authService.revokeSession(user.userId, id);
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = readCookie(req.headers?.cookie, STAFF_AUTH_COOKIE);
    await this.authService.logout(token, req.correlationId);
    res.clearCookie(STAFF_AUTH_COOKIE, buildClearedAuthCookieOptions());
    return { ok: true };
  }
}
