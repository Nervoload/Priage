import { Body, Controller, Get, NotFoundException, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AlertWebhooksService } from './alert-webhooks.service';
import { CreateAlertWebhookDto, CreateEscalationExceptionDto, UpdateAlertWebhookDto } from './dto/alert-webhook.dto';

@Controller('hospitals/:hospitalId/alert-webhooks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.IT_ADMIN, Role.CLINICAL_ADMIN)
export class AlertWebhooksController {
  constructor(private readonly webhooks: AlertWebhooksService) {}

  @Get()
  list(
    @Param('hospitalId', ParseIntPipe) hospitalId: number,
    @CurrentUser() user: { hospitalId: number },
  ) {
    this.assertHospital(hospitalId, user.hospitalId);
    return this.webhooks.list(hospitalId);
  }

  @Get('readiness')
  readiness(
    @Param('hospitalId', ParseIntPipe) hospitalId: number,
    @CurrentUser() user: { hospitalId: number },
  ) {
    this.assertHospital(hospitalId, user.hospitalId);
    return this.webhooks.getReadiness(hospitalId);
  }

  @Post('readiness/temporary-exception')
  recordTemporaryException(
    @Param('hospitalId', ParseIntPipe) hospitalId: number,
    @CurrentUser() user: { userId: number; hospitalId: number },
    @Body() dto: CreateEscalationExceptionDto,
  ) {
    this.assertHospital(hospitalId, user.hospitalId);
    return this.webhooks.recordTemporaryException(hospitalId, user.userId, dto);
  }

  @Post()
  create(
    @Param('hospitalId', ParseIntPipe) hospitalId: number,
    @CurrentUser() user: { hospitalId: number },
    @Body() dto: CreateAlertWebhookDto,
  ) {
    this.assertHospital(hospitalId, user.hospitalId);
    return this.webhooks.create(hospitalId, dto);
  }

  @Patch(':subscriptionId')
  update(
    @Param('hospitalId', ParseIntPipe) hospitalId: number,
    @Param('subscriptionId', ParseIntPipe) subscriptionId: number,
    @CurrentUser() user: { hospitalId: number },
    @Body() dto: UpdateAlertWebhookDto,
  ) {
    this.assertHospital(hospitalId, user.hospitalId);
    return this.webhooks.update(hospitalId, subscriptionId, dto);
  }

  @Post(':subscriptionId/rotate-secret')
  rotate(
    @Param('hospitalId', ParseIntPipe) hospitalId: number,
    @Param('subscriptionId', ParseIntPipe) subscriptionId: number,
    @CurrentUser() user: { hospitalId: number },
  ) {
    this.assertHospital(hospitalId, user.hospitalId);
    return this.webhooks.rotateSecret(hospitalId, subscriptionId);
  }

  @Post(':subscriptionId/test')
  test(
    @Param('hospitalId', ParseIntPipe) hospitalId: number,
    @Param('subscriptionId', ParseIntPipe) subscriptionId: number,
    @CurrentUser() user: { hospitalId: number },
  ) {
    this.assertHospital(hospitalId, user.hospitalId);
    return this.webhooks.enqueueTest(hospitalId, subscriptionId);
  }

  @Get(':subscriptionId/deliveries')
  deliveries(
    @Param('hospitalId', ParseIntPipe) hospitalId: number,
    @Param('subscriptionId', ParseIntPipe) subscriptionId: number,
    @CurrentUser() user: { hospitalId: number },
    @Query('limit') limit?: number,
  ) {
    this.assertHospital(hospitalId, user.hospitalId);
    return this.webhooks.listDeliveries(hospitalId, subscriptionId, limit);
  }

  @Post(':subscriptionId/deliveries/:deliveryId/retry')
  retry(
    @Param('hospitalId', ParseIntPipe) hospitalId: number,
    @Param('subscriptionId', ParseIntPipe) subscriptionId: number,
    @Param('deliveryId', ParseIntPipe) deliveryId: number,
    @CurrentUser() user: { hospitalId: number },
  ) {
    this.assertHospital(hospitalId, user.hospitalId);
    return this.webhooks.retryDelivery(hospitalId, subscriptionId, deliveryId);
  }

  private assertHospital(requested: number, authenticated: number): void {
    if (requested !== authenticated) throw new NotFoundException('Alert webhook subscription not found');
  }
}
