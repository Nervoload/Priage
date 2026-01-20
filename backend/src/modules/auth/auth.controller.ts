// backend/src/modules/auth/auth.controller.ts
// John Surette
// Dec 8, 2025
// auth.controller.ts
// HTTP entrypoints for authentication
// POST /auth/login→ returns a JWT if credentials are valid
// receives HTTP request, validates, calls auth.service.ts

import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@CurrentUser() user: any) {
    return user;
  }
}