import { Body, Controller, Get, Headers, Param, ParseIntPipe, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsBoolean, IsEmail, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { NotificationsService } from './notifications.service';
import { NotificationDeliveryService } from './notification-delivery.service';
import { SkipDemoGate } from '../../common/decorators/skip-demo-gate.decorator';
type Staff = { hospitalId: number; userId: number; role: Role };
class SettingsDto {
  @IsBoolean() enabled!: boolean;
  @IsOptional() @IsEmail() replyTo?: string;
  @IsOptional() @IsString() @MaxLength(40) contactPhone?: string;
  @IsArray() @ArrayMaxSize(2) @IsInt({ each: true }) reminderMinutes!: number[];
  @IsInt() @Min(0) expectedVersion!: number;
}
class EmailDto { @IsEmail() @MaxLength(254) email!: string; }

@Controller('clinic-notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.STAFF, Role.ADMIN, Role.CLINICAL_ADMIN, Role.IT_ADMIN)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}
  @Get('settings') settings(@CurrentUser() staff: Staff) { return this.notifications.settings(staff); }
  @Put('settings') update(@CurrentUser() staff: Staff, @Body() dto: SettingsDto) { return this.notifications.updateSettings(staff, dto); }
  @Get('preview') preview(@CurrentUser() staff: Staff) { return this.notifications.preview(staff); }
  @Post('test-send') test(@CurrentUser() staff: Staff, @Body() dto: EmailDto) { return this.notifications.testSend(staff, dto.email); }
  @Get('history') all(@CurrentUser() staff: Staff) { return this.notifications.history(staff); }
  @Get('failures') failures(@CurrentUser() staff: Staff) { return this.notifications.history(staff, undefined, true); }
  @Get('appointments/:id') history(@CurrentUser() staff: Staff, @Param('id', ParseIntPipe) id: number) { return this.notifications.history(staff, id); }
  @Post(':id/retry') retry(@CurrentUser() staff: Staff, @Param('id') id: string) { return this.notifications.retry(staff, id); }
  @Get('suppressions') suppressions(@CurrentUser() staff: Staff) { return this.notifications.suppressions(staff); }
  @Post('clear-suppression') clear(@CurrentUser() staff: Staff, @Body() dto: EmailDto) { return this.notifications.clearSuppression(staff, dto.email); }
}

@Controller('notifications')
export class EmailWebhookController {
  constructor(private readonly delivery: NotificationDeliveryService) {}
  @SkipDemoGate()
  @Post('resend/webhook') webhook(@Req() request: Request & { rawBody?: Buffer }, @Headers('svix-id') id: string, @Headers('svix-timestamp') timestamp: string, @Headers('svix-signature') signature: string) {
    return this.delivery.webhook(request.rawBody?.toString('utf8') || '', { id, timestamp, signature });
  }
}
