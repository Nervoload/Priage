import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { HospitalId } from '../tenant/hospital-id.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UserSummary, UsersService } from './users.service';
import { Role } from '@prisma/client';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(Role.ADMIN)
  async createUser(@Body() body: CreateUserDto, @HospitalId() hospitalId: number): Promise<UserSummary> {
    return this.usersService.createStaffUser({
      email: body.email,
      password: body.password,
      role: body.role,
      hospitalId,
    });
  }
}
