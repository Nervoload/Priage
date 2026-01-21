// backend/src/modules/users/users.controller.ts
// Hospital staff endpoints

import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Request } from 'express';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // GET /users/me - Get current user (all authenticated users)
  @Get('me')
  async getMe(@Req() req: Request, @CurrentUser() user: any) {
    return this.usersService.getUser(user.userId, req.correlationId);
  }

  // GET /users - List hospital staff (ADMIN, NURSE, DOCTOR only)
  @Get()
  @Roles(Role.ADMIN, Role.NURSE, Role.DOCTOR)
  async listUsers(
    @Req() req: Request,
    @CurrentUser() user: any,
    @Query('role') role?: Role,
  ) {
    return this.usersService.getUsers(user.hospitalId, role, req.correlationId);
  }
}
