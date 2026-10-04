import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ClinicAnalyticsService } from './clinic-analytics.service';

type Staff = { userId: number; hospitalId: number; role: Role };

@Controller('clinic-analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClinicAnalyticsController {
  constructor(private readonly analytics: ClinicAnalyticsService) {}

  @Get('assessment')
  @Header('Cache-Control', 'no-store')
  @Roles(Role.ADMIN, Role.CLINICAL_ADMIN)
  assessment(@CurrentUser() staff: Staff, @Query('days') days?: string) {
    return this.analytics.assessment(staff, days ? Number.parseInt(days, 10) : undefined);
  }
}
