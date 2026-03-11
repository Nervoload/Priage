// backend/src/modules/demo-access/demo-access.controller.ts
// POST /demo-access — validates the access code and sets an httpOnly cookie.
// DELETE /demo-access — clears the cookie.

import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';

import { SkipDemoGate } from '../../common/decorators/skip-demo-gate.decorator';
import { buildAuthCookieOptions, buildClearedAuthCookieOptions } from '../../common/http/auth-cookie.util';
import { DEMO_ACCESS_THROTTLE } from '../../common/http/throttle.util';
import { DEMO_COOKIE_NAME } from './demo-access.guard';

const DEMO_COOKIE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

@Controller('demo-access')
@SkipDemoGate()
export class DemoAccessController {
  private readonly expectedCode: string | undefined;

  constructor() {
    this.expectedCode = process.env.DEMO_ACCESS_CODE?.trim() || undefined;
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle(DEMO_ACCESS_THROTTLE)
  verify(@Body() body: { code?: string }, @Res() res: Response) {
    if (!this.expectedCode) {
      return res.json({ ok: true, message: 'Demo gate is disabled' });
    }

    const provided = typeof body.code === 'string' ? body.code.trim() : '';

    if (!provided || provided !== this.expectedCode) {
      throw new ForbiddenException('Invalid access code');
    }

    res.cookie(DEMO_COOKIE_NAME, this.expectedCode, buildAuthCookieOptions(DEMO_COOKIE_TTL_MS));
    return res.json({ ok: true });
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  clear(@Res() res: Response) {
    res.clearCookie(DEMO_COOKIE_NAME, buildClearedAuthCookieOptions());
    return res.json({ ok: true });
  }
}
