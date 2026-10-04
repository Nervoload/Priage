import { Body, ConflictException, Controller, Delete, Get, Header, HttpException, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';

import { INTAKE_INTENT_THROTTLE } from '../../common/http/throttle.util';
import { CurrentPatient } from '../auth/decorators/current-patient.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PatientContext, PatientGuard } from '../auth/guards/patient.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ClinicAppointmentsService } from './clinic-appointments.service';
import { ClinicEntryService } from './clinic-entry.service';
import { ClinicAppointmentCommandDto, CreateClinicScheduleBlockDto, RequestClinicAppointmentDto, RescheduleClinicAppointmentDto, UpdateClinicScheduleDto, UpsertClinicDayOverrideDto } from './dto/clinic-appointment.dto';

type Staff = { userId: number; hospitalId: number; role: Role };
const STAFF_ROLES = [Role.STAFF, Role.NURSE, Role.DOCTOR, Role.ADMIN, Role.CLINICAL_ADMIN];
const RECEPTION_ROLES = [Role.STAFF, Role.ADMIN, Role.CLINICAL_ADMIN];
const ADMIN_ROLES = [Role.ADMIN, Role.IT_ADMIN, Role.CLINICAL_ADMIN];
const SCHEDULE_VIEW_ROLES = [...STAFF_ROLES, Role.IT_ADMIN];

@Controller('clinic-intake')
export class ClinicAppointmentsController {
  constructor(private readonly appointments: ClinicAppointmentsService, private readonly entry: ClinicEntryService) {}

  @Get('availability')
  availability(@Query('from') from?: string, @Query('days') days?: string) {
    return this.appointments.availability(from, days === undefined ? 7 : Number(days));
  }

  @Get('entry/:alias/availability')
  async entryAvailability(@Param('alias') alias: string, @Query('from') from?: string, @Query('days') days?: string) {
    const entry = await this.entry.resolve(alias);
    return this.appointments.availability(from, days === undefined ? 7 : Number(days), entry.id);
  }

  @Get('legal-documents')
  legalDocuments() { return this.appointments.publishedDocuments(); }

  @Get('entry/:alias/legal-documents')
  async entryLegalDocuments(@Param('alias') alias: string) {
    const entry = await this.entry.resolve(alias);
    return this.appointments.publishedDocuments(entry.id);
  }

  @Get('visits/:id/state')
  @Header('Cache-Control', 'no-store')
  @UseGuards(PatientGuard)
  visitState(@Param('id', ParseIntPipe) id: number, @CurrentPatient() patient: PatientContext) {
    return this.appointments.patientVisitState(id, patient);
  }

  @Get('visits/:id/availability')
  @Header('Cache-Control', 'no-store')
  @UseGuards(PatientGuard)
  async visitAvailability(@Param('id', ParseIntPipe) id: number, @CurrentPatient() patient: PatientContext, @Query('from') from?: string, @Query('days') days?: string) {
    const visit = await this.appointments.patientVisitState(id, patient);
    return this.appointments.availability(from, days === undefined ? 7 : Number(days), visit.encounter.hospitalId);
  }

  @Get('visits/:id/legal-documents')
  @Header('Cache-Control', 'no-store')
  @UseGuards(PatientGuard)
  async visitLegalDocuments(@Param('id', ParseIntPipe) id: number, @CurrentPatient() patient: PatientContext) {
    const visit = await this.appointments.patientVisitState(id, patient);
    return this.appointments.publishedDocuments(visit.encounter.hospitalId);
  }

  @Post('visits/:id/appointment-request')
  @UseGuards(PatientGuard)
  @Throttle(INTAKE_INTENT_THROTTLE)
  async request(@Param('id', ParseIntPipe) id: number, @CurrentPatient() patient: PatientContext, @Body() dto: RequestClinicAppointmentDto) {
    return this.withVisitState(id, patient, () => this.appointments.requestAppointment(id, patient, dto));
  }

  @Get('visits/:id/appointment')
  @UseGuards(PatientGuard)
  patientAppointment(@Param('id', ParseIntPipe) id: number, @CurrentPatient() patient: PatientContext) {
    return this.appointments.patientAppointment(id, patient);
  }

  @Post('visits/:id/appointment/reschedule')
  @UseGuards(PatientGuard)
  patientReschedule(@Param('id', ParseIntPipe) id: number, @CurrentPatient() patient: PatientContext, @Body() dto: RescheduleClinicAppointmentDto) {
    return this.withVisitState(id, patient, () => this.appointments.patientCommand(patient, id, dto.commandKey, 'reschedule', dto.startAt, dto.expectedRevision));
  }

  @Post('visits/:id/appointment/cancel')
  @UseGuards(PatientGuard)
  patientCancel(@Param('id', ParseIntPipe) id: number, @CurrentPatient() patient: PatientContext, @Body() dto: ClinicAppointmentCommandDto) {
    return this.withVisitState(id, patient, () => this.appointments.patientCommand(patient, id, dto.commandKey, 'cancel', undefined, dto.expectedRevision));
  }

  private async withVisitState<T extends object>(id: number, patient: PatientContext, action: () => Promise<T>) {
    try {
      const appointment = await action();
      return { ...appointment, visitState: await this.appointments.patientVisitState(id, patient) };
    } catch (error) {
      if (error instanceof HttpException && error.getStatus() === 409) {
        throw new ConflictException({ message: error.message, visitState: await this.appointments.patientVisitState(id, patient) });
      }
      throw error;
    }
  }

  @Get('reception/schedule')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...SCHEDULE_VIEW_ROLES)
  schedule(@CurrentUser() staff: Staff) { return this.appointments.scheduleForStaff(staff); }

  @Get('reception/availability')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...SCHEDULE_VIEW_ROLES)
  receptionAvailability(@CurrentUser() staff: Staff, @Query('from') from?: string, @Query('days') days?: string) {
    return this.appointments.availability(from, days === undefined ? 7 : Number(days), staff.hospitalId);
  }

  @Put('reception/schedule')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  updateSchedule(@CurrentUser() staff: Staff, @Body() dto: UpdateClinicScheduleDto) { return this.appointments.updateSchedule(staff, dto); }

  @Put('reception/schedule/day-override')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  dayOverride(@CurrentUser() staff: Staff, @Body() dto: UpsertClinicDayOverrideDto) { return this.appointments.upsertDayOverride(staff, dto); }

  @Delete('reception/schedule/day-override/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  removeDayOverride(@CurrentUser() staff: Staff, @Param('id', ParseIntPipe) id: number) { return this.appointments.removeDayOverride(staff, id); }

  @Post('reception/schedule/blocks')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  block(@CurrentUser() staff: Staff, @Body() dto: CreateClinicScheduleBlockDto) { return this.appointments.createBlock(staff, dto); }

  @Delete('reception/schedule/blocks/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  removeBlock(@CurrentUser() staff: Staff, @Param('id', ParseIntPipe) id: number) { return this.appointments.removeBlock(staff, id); }

  @Get('reception/appointments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF_ROLES)
  receptionAppointments(@CurrentUser() staff: Staff) { return this.appointments.receptionAppointments(staff); }

  @Post('reception/appointments/:id/confirm')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...RECEPTION_ROLES)
  confirm(@CurrentUser() staff: Staff, @Param('id', ParseIntPipe) id: number, @Body() dto: ClinicAppointmentCommandDto) {
    return this.appointments.staffCommand(staff, id, dto.commandKey, 'confirm', undefined, dto.expectedRevision);
  }

  @Post('reception/appointments/:id/decline')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...RECEPTION_ROLES)
  decline(@CurrentUser() staff: Staff, @Param('id', ParseIntPipe) id: number, @Body() dto: ClinicAppointmentCommandDto) {
    return this.appointments.staffCommand(staff, id, dto.commandKey, 'decline', undefined, dto.expectedRevision);
  }

  @Post('reception/appointments/:id/reschedule')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...RECEPTION_ROLES)
  reschedule(@CurrentUser() staff: Staff, @Param('id', ParseIntPipe) id: number, @Body() dto: RescheduleClinicAppointmentDto) {
    return this.appointments.staffCommand(staff, id, dto.commandKey, 'reschedule', dto.startAt, dto.expectedRevision);
  }

  @Post('reception/appointments/:id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...RECEPTION_ROLES)
  cancel(@CurrentUser() staff: Staff, @Param('id', ParseIntPipe) id: number, @Body() dto: ClinicAppointmentCommandDto) {
    return this.appointments.staffCommand(staff, id, dto.commandKey, 'cancel', undefined, dto.expectedRevision);
  }

  @Post('reception/appointments/:id/arrive')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...RECEPTION_ROLES)
  arrive(@CurrentUser() staff: Staff, @Param('id', ParseIntPipe) id: number, @Body() dto: ClinicAppointmentCommandDto) {
    return this.appointments.staffCommand(staff, id, dto.commandKey, 'arrive', undefined, dto.expectedRevision);
  }

  @Post('reception/appointments/:id/no-show')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...RECEPTION_ROLES)
  noShow(@CurrentUser() staff: Staff, @Param('id', ParseIntPipe) id: number, @Body() dto: ClinicAppointmentCommandDto) {
    return this.appointments.staffCommand(staff, id, dto.commandKey, 'no_show', undefined, dto.expectedRevision);
  }
}
