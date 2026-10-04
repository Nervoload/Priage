import { Body, CanActivate, ConflictException, Controller, ExecutionContext, Get, Header, HttpException, Injectable, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { IsEmail, IsInt, IsISO8601, IsString, IsUUID, Matches, MaxLength, Min } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { APPOINTMENT_RECOVERY_COOKIE, buildAuthCookieOptions, buildClearedAuthCookieOptions, readCookie } from '../../common/http/auth-cookie.util';
import { AppointmentRecoveryService, RecoveryContext } from '../notifications/appointment-recovery.service';
import { ClinicEntryService } from './clinic-entry.service';
import { ClinicAppointmentsService } from './clinic-appointments.service';
type RecoveryRequest = Request & { appointmentRecovery: RecoveryContext };
class RecoveryRequestDto { @IsString() @MaxLength(80) reference!: string; @IsEmail() @MaxLength(254) email!: string; }
class VerifyDto { @IsUUID() challengeId!: string; @Matches(/^\d{6}$/) code!: string; }
class RecoveryCommandDto { @IsUUID() commandKey!: string; @IsInt() @Min(1) expectedRevision!: number; }
class RecoveryRescheduleDto extends RecoveryCommandDto { @IsISO8601({ strict: true }) startAt!: string; }

@Injectable()
export class AppointmentRecoveryGuard implements CanActivate {
  constructor(private readonly recovery: AppointmentRecoveryService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<RecoveryRequest>();
    request.appointmentRecovery = await this.recovery.authenticate(readCookie(request.headers.cookie, APPOINTMENT_RECOVERY_COOKIE));
    return true;
  }
}

@Controller('clinic-intake')
export class AppointmentRecoveryController {
  constructor(private readonly recovery: AppointmentRecoveryService, private readonly appointments: ClinicAppointmentsService, private readonly entry: ClinicEntryService) {}
  @Post('entry/:alias/recovery/request')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async request(@Param('alias') alias: string, @Body() dto: RecoveryRequestDto, @Req() request: Request) {
    const entry = await this.entry.resolve(alias);
    return this.recovery.request(entry.id, dto.reference, dto.email, request.ip || 'unknown');
  }
  @Post('entry/:alias/recovery/verify')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async verify(@Param('alias') alias: string, @Body() dto: VerifyDto, @Res({ passthrough: true }) response: Response) {
    const entry = await this.entry.resolve(alias);
    const result = await this.recovery.verify(entry.id, dto.challengeId, dto.code);
    response.cookie(APPOINTMENT_RECOVERY_COOKIE, result.token, buildAuthCookieOptions(24 * 3600_000));
    return { verified: true };
  }
  @Get('recovery/state') @Header('Cache-Control', 'no-store') @UseGuards(AppointmentRecoveryGuard)
  state(@Req() request: RecoveryRequest) { return this.appointments.recoveryState(request.appointmentRecovery); }
  @Get('recovery/availability') @Header('Cache-Control', 'no-store') @UseGuards(AppointmentRecoveryGuard)
  availability(@Req() request: RecoveryRequest, @Query('from') from?: string, @Query('days') days?: string) { return this.appointments.availability(from, days === undefined ? 7 : Number(days), request.appointmentRecovery.hospitalId); }
  @Post('recovery/reschedule') @UseGuards(AppointmentRecoveryGuard)
  reschedule(@Req() request: RecoveryRequest, @Body() dto: RecoveryRescheduleDto) { return this.command(request.appointmentRecovery, dto, 'reschedule', dto.startAt); }
  @Post('recovery/cancel') @UseGuards(AppointmentRecoveryGuard)
  cancel(@Req() request: RecoveryRequest, @Body() dto: RecoveryCommandDto) { return this.command(request.appointmentRecovery, dto, 'cancel'); }
  @Post('recovery/logout') @UseGuards(AppointmentRecoveryGuard)
  async logout(@Req() request: RecoveryRequest, @Res({ passthrough: true }) response: Response) { const result = await this.recovery.logout(request.appointmentRecovery); response.clearCookie(APPOINTMENT_RECOVERY_COOKIE, buildClearedAuthCookieOptions()); return result; }
  private async command(context: RecoveryContext, dto: RecoveryCommandDto, kind: 'reschedule' | 'cancel', startAt?: string) {
    try { return await this.appointments.recoveryCommand(context, dto.commandKey, kind, startAt, dto.expectedRevision); }
    catch (error) { if (error instanceof HttpException && error.getStatus() === 409) throw new ConflictException({ message: error.message, visitState: await this.appointments.recoveryState(context) }); throw error; }
  }
}
