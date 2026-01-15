import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';

import { AuthService, JwtPayload } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { User } from '@prisma/client';

interface LoginRequest extends Request {
  user: User;
}

interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @UseGuards(LocalAuthGuard)
  async login(@Req() req: LoginRequest) {
    return this.authService.login(req.user);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, TenantGuard)
  me(@Req() req: AuthenticatedRequest): JwtPayload {
    return req.user;
  }
}
