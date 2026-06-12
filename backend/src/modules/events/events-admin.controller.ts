import { Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';

import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { EventsService } from './events.service';

@Controller('operations/events')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class EventsAdminController {
  constructor(private readonly events: EventsService) {}

  @Get('dead-letters')
  listDeadLetters(
    @CurrentUser() user: { hospitalId: number },
    @Query('limit') rawLimit?: string,
  ) {
    const limit = Number.parseInt(rawLimit || '100', 10);
    return this.events.listDeadLetters(user.hospitalId, Number.isFinite(limit) ? limit : 100);
  }

  @Post('dead-letters/:id/requeue')
  requeueDeadLetter(
    @CurrentUser() user: { hospitalId: number },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.events.requeueDeadLetter(user.hospitalId, id);
  }
}
