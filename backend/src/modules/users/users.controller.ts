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

  // Phase 6.4: Add profile endpoints here:
  //   @Patch('me') async updateProfile(@Body() dto: UpdateProfileDto, @CurrentUser() user)
  //     → update display name, avatar URL, phone, department, specialization
  //   @Get(':id') async getStaffProfile(@Param('id') id: number)
  //     → public staff profile for viewing colleagues
  // The Prisma schema will need new columns on the User model (or a separate
  // StaffProfile table). The frontend user info pill in HospitalApp.tsx would
  // link to a profile page/modal for editing.
}
