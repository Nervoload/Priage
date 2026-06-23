import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { randomBytes } from 'crypto';
import type { Request, Response } from 'express';

import { SkipDemoGate } from '../../common/decorators/skip-demo-gate.decorator';
import {
  STAFF_AUTH_COOKIE,
  STAFF_DEVICE_COOKIE,
  buildAuthCookieOptions,
  buildClearedAuthCookieOptions,
  buildDeviceCookieOptions,
  readCookie,
} from '../../common/http/auth-cookie.util';
import { DEMO_ACCESS_THROTTLE } from '../../common/http/throttle.util';
import { DEMO_COOKIE_NAME } from './demo-sessions.constants';
import { DemoSessionsService } from './demo-sessions.service';
import { CreateDemoEventDto } from './dto/create-demo-event.dto';
import { RequestDemoDto } from './dto/request-demo.dto';
import { VerifyDemoCodeDto } from './dto/verify-demo-code.dto';

@Controller('demo-sessions')
export class DemoSessionsController {
  constructor(private readonly demoSessions: DemoSessionsService) {}

  @Post('request')
  @SkipDemoGate()
  @HttpCode(HttpStatus.OK)
  @Throttle(DEMO_ACCESS_THROTTLE)
  async requestDemo(@Body() dto: RequestDemoDto) {
    await this.demoSessions.requestDemo(dto);
    return {
      ok: true,
      message: 'If the email can receive a Priage demo code, one will be sent shortly.',
    };
  }

  @Post('verify')
  @SkipDemoGate()
  @HttpCode(HttpStatus.OK)
  @Throttle(DEMO_ACCESS_THROTTLE)
  async verifyDemo(
    @Body() dto: VerifyDemoCodeDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.demoSessions.verifyDemo(dto);
    res.cookie(DEMO_COOKIE_NAME, result.accessToken, buildAuthCookieOptions(result.maxAgeMs));
    return {
      ok: true,
      profile: result.profile,
    };
  }

  @Get('me')
  async me(@Req() req: Request) {
    return this.demoSessions.getCurrentProfile(req.headers?.cookie);
  }

  @Post('enter-hospital')
  @HttpCode(HttpStatus.OK)
  async enterHospital(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const deviceId = readCookie(req.headers?.cookie, STAFF_DEVICE_COOKIE) || randomBytes(24).toString('base64url');
    const result = await this.demoSessions.enterHospital(req.headers?.cookie, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? null,
      deviceId,
    });

    res.cookie(STAFF_AUTH_COOKIE, result.sessionToken, buildAuthCookieOptions(result.maxAgeMs));
    res.cookie(STAFF_DEVICE_COOKIE, deviceId, buildDeviceCookieOptions());

    return {
      session: result.session,
      user: result.user,
    };
  }

  @Post('events')
  @HttpCode(HttpStatus.OK)
  async recordEvent(@Req() req: Request, @Body() dto: CreateDemoEventDto) {
    return this.demoSessions.recordEvent(req.headers?.cookie, dto.type, dto.metadata);
  }

  @Delete()
  @SkipDemoGate()
  @HttpCode(HttpStatus.OK)
  async clear(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.demoSessions.revokeCurrentSession(req.headers?.cookie);
    res.clearCookie(DEMO_COOKIE_NAME, buildClearedAuthCookieOptions());
    return { ok: true };
  }
}
