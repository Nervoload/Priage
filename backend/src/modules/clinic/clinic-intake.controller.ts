import { Body, ConflictException, Controller, Get, Param, ParseIntPipe, Patch, Post, Put, Req, Res, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';

import { CLINIC_ASSESSMENT_COOKIE, PATIENT_SESSION_COOKIE, PATIENT_SESSION_TTL_MS, buildAuthCookieOptions, readCookie } from '../../common/http/auth-cookie.util';
import { INTAKE_INTENT_THROTTLE } from '../../common/http/throttle.util';
import { CurrentPatient } from '../auth/decorators/current-patient.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PatientContext, PatientGuard } from '../auth/guards/patient.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdvanceAssessmentDto, StartAssessmentDto } from '../assessment/dto/assessment.dto';
import { ClinicIntakeService } from './clinic-intake.service';
import { ClinicEntryService } from './clinic-entry.service';
import { UpdateClinicEntryDto } from './dto/clinic-entry.dto';
import { CreateClinicWalkInDto, ExchangeDeskGrantDto, StartClinicVisitDto, UpdateVisitContactDto } from './dto/clinic-intake.dto';
import { SubmitClinicAnswersDto } from './dto/clinic-questionnaire.dto';
import { ClinicQuestionnaireService } from './questionnaire/clinic-questionnaire.service';

const STAFF_ROLES = [Role.STAFF, Role.NURSE, Role.DOCTOR, Role.ADMIN, Role.CLINICAL_ADMIN];
type Staff = { userId: number; hospitalId: number; role: Role };
const ADMIN_ROLES = [Role.ADMIN, Role.IT_ADMIN, Role.CLINICAL_ADMIN];

@Controller('clinic-intake')
export class ClinicIntakeController {
  constructor(private readonly clinic: ClinicIntakeService, private readonly entry: ClinicEntryService, private readonly questionnaire: ClinicQuestionnaireService) {}

  @Get('clinic')
  clinicMetadata() { return this.clinic.clinicMetadata(); }

  @Get('entry/:alias')
  entryMetadata(@Param('alias') alias: string) { return this.entry.resolve(alias); }

  @Get('reception/entry-settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  entrySettings(@CurrentUser() staff: Staff) { return this.entry.settings(staff.hospitalId); }

  @Put('reception/entry-settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  updateEntrySettings(@CurrentUser() staff: Staff, @Body() dto: UpdateClinicEntryDto) {
    return this.entry.update(staff.hospitalId, dto);
  }

  @Post('visits/guest')
  @Throttle(INTAKE_INTENT_THROTTLE)
  async startGuest(@Body() dto: StartClinicVisitDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const existingToken = readCookie(req.headers.cookie, PATIENT_SESSION_COOKIE);
    const result = await this.clinic.startGuest(dto, existingToken ?? undefined);
    res.cookie(PATIENT_SESSION_COOKIE, result.sessionToken, buildAuthCookieOptions(PATIENT_SESSION_TTL_MS));
    const { sessionToken: _, ...body } = result;
    return body;
  }

  @Post('entry/:alias/visits/guest')
  @Throttle(INTAKE_INTENT_THROTTLE)
  async startGuestForEntry(@Param('alias') alias: string, @Body() dto: StartClinicVisitDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const entry = await this.entry.resolve(alias);
    if (!entry.appointmentBookingAvailable) throw new ConflictException('Clinic booking is not ready');
    const existingToken = readCookie(req.headers.cookie, PATIENT_SESSION_COOKIE);
    const result = await this.clinic.startGuest(dto, existingToken ?? undefined, entry.id);
    res.cookie(PATIENT_SESSION_COOKIE, result.sessionToken, buildAuthCookieOptions(PATIENT_SESSION_TTL_MS));
    const { sessionToken: _, ...body } = result;
    return body;
  }

  @Post('visits/account')
  @UseGuards(PatientGuard)
  startAccount(@Body() dto: StartClinicVisitDto, @CurrentPatient() patient: PatientContext) {
    return this.clinic.startAccount(dto, patient);
  }

  @Post('entry/:alias/visits/account')
  @UseGuards(PatientGuard)
  async startAccountForEntry(@Param('alias') alias: string, @Body() dto: StartClinicVisitDto, @CurrentPatient() patient: PatientContext) {
    const entry = await this.entry.resolve(alias);
    if (!entry.appointmentBookingAvailable) throw new ConflictException('Clinic booking is not ready');
    return this.clinic.startAccount(dto, patient, entry.id);
  }

  @Get('visits/:id')
  @UseGuards(PatientGuard)
  getVisit(@Param('id', ParseIntPipe) id: number, @CurrentPatient() patient: PatientContext) {
    return this.clinic.getPatientVisit(id, patient);
  }

  @Patch('visits/:id/contact')
  @UseGuards(PatientGuard)
  updateContact(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateVisitContactDto, @CurrentPatient() patient: PatientContext) {
    return this.clinic.updateContact(id, patient, dto.email);
  }

  /** The clinic's own questions, for patients who chose this clinic after the general assessment. */
  @Get('visits/:id/clinic-questions')
  @UseGuards(PatientGuard)
  clinicQuestions(@Param('id', ParseIntPipe) id: number, @CurrentPatient() patient: PatientContext) {
    return this.questionnaire.patientQuestions(id, patient);
  }

  @Post('visits/:id/clinic-questions')
  @UseGuards(PatientGuard)
  answerClinicQuestions(@Param('id', ParseIntPipe) id: number, @Body() dto: SubmitClinicAnswersDto, @CurrentPatient() patient: PatientContext) {
    return this.questionnaire.submitPatientAnswers(id, patient, dto);
  }

  @Get('visits/:id/interview')
  @UseGuards(PatientGuard)
  patientInterviewState(@Param('id', ParseIntPipe) id: number, @CurrentPatient() patient: PatientContext) {
    return this.clinic.patientInterviewState(id, patient);
  }

  @Post('visits/:id/interview/start')
  @UseGuards(PatientGuard)
  patientStart(@Param('id', ParseIntPipe) id: number, @Body() start: StartAssessmentDto, @CurrentPatient() patient: PatientContext) {
    return this.clinic.patientInterview(id, patient, undefined, start);
  }

  @Post('visits/:id/interview/advance')
  @UseGuards(PatientGuard)
  patientAdvance(@Param('id', ParseIntPipe) id: number, @Body() dto: AdvanceAssessmentDto, @CurrentPatient() patient: PatientContext) {
    return this.clinic.patientInterview(id, patient, dto);
  }

  @Post('desk/exchange')
  @Throttle(INTAKE_INTENT_THROTTLE)
  async exchange(@Body() dto: ExchangeDeskGrantDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.clinic.exchangeGrant(dto.token);
    res.cookie(CLINIC_ASSESSMENT_COOKIE, result.sessionToken, buildAuthCookieOptions(30 * 60_000));
    return { encounterId: result.encounterId, expiresAt: result.expiresAt };
  }

  @Post('entry/:alias/desk/exchange')
  @Throttle(INTAKE_INTENT_THROTTLE)
  async exchangeForEntry(@Param('alias') alias: string, @Body() dto: ExchangeDeskGrantDto, @Res({ passthrough: true }) res: Response) {
    const entry = await this.entry.resolve(alias);
    const result = await this.clinic.exchangeGrant(dto.token, entry.id);
    res.cookie(CLINIC_ASSESSMENT_COOKIE, result.sessionToken, buildAuthCookieOptions(30 * 60_000));
    return { encounterId: result.encounterId, expiresAt: result.expiresAt };
  }

  @Get('entry/:alias/desk/interview')
  async deskStateForEntry(@Param('alias') alias: string, @Req() req: Request) {
    const entry = await this.entry.resolve(alias);
    return this.clinic.deskInterviewState(readCookie(req.headers.cookie, CLINIC_ASSESSMENT_COOKIE) ?? undefined, entry.id);
  }

  @Post('entry/:alias/desk/interview/start')
  async deskStartForEntry(@Param('alias') alias: string, @Req() req: Request, @Body() start: StartAssessmentDto) {
    const entry = await this.entry.resolve(alias);
    return this.clinic.deskInterview(readCookie(req.headers.cookie, CLINIC_ASSESSMENT_COOKIE) ?? undefined, undefined, entry.id, start);
  }

  @Post('entry/:alias/desk/interview/advance')
  async deskAdvanceForEntry(@Param('alias') alias: string, @Req() req: Request, @Body() dto: AdvanceAssessmentDto) {
    const entry = await this.entry.resolve(alias);
    return this.clinic.deskInterview(readCookie(req.headers.cookie, CLINIC_ASSESSMENT_COOKIE) ?? undefined, dto, entry.id);
  }

  @Get('desk/interview')
  deskState(@Req() req: Request) { return this.clinic.deskInterviewState(readCookie(req.headers.cookie, CLINIC_ASSESSMENT_COOKIE) ?? undefined); }

  @Post('desk/interview/start')
  deskStart(@Req() req: Request, @Body() start: StartAssessmentDto) {
    return this.clinic.deskInterview(readCookie(req.headers.cookie, CLINIC_ASSESSMENT_COOKIE) ?? undefined, undefined, undefined, start);
  }

  @Post('desk/interview/advance')
  deskAdvance(@Req() req: Request, @Body() dto: AdvanceAssessmentDto) {
    return this.clinic.deskInterview(readCookie(req.headers.cookie, CLINIC_ASSESSMENT_COOKIE) ?? undefined, dto);
  }

  @Get('reception')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF_ROLES)
  reception(@CurrentUser() staff: Staff) { return this.clinic.listReception(staff); }

  @Post('reception/walk-ins')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF_ROLES)
  walkIn(@CurrentUser() staff: Staff, @Body() dto: CreateClinicWalkInDto) { return this.clinic.createWalkIn(staff, dto); }

  @Get('reception/walk-ins/:id/interview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF_ROLES)
  staffState(@CurrentUser() staff: Staff, @Param('id', ParseIntPipe) id: number) { return this.clinic.staffInterviewState(staff, id); }

  @Post('reception/walk-ins/:id/interview/start')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF_ROLES)
  staffStart(@CurrentUser() staff: Staff, @Param('id', ParseIntPipe) id: number, @Body() start: StartAssessmentDto) {
    return this.clinic.staffInterview(staff, id, undefined, start);
  }

  @Post('reception/walk-ins/:id/interview/advance')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF_ROLES)
  staffAdvance(@CurrentUser() staff: Staff, @Param('id', ParseIntPipe) id: number, @Body() dto: AdvanceAssessmentDto) {
    return this.clinic.staffInterview(staff, id, dto);
  }

  @Post('reception/walk-ins/:id/grants')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF_ROLES)
  issueGrant(@CurrentUser() staff: Staff, @Param('id', ParseIntPipe) id: number) { return this.clinic.issueGrant(staff, id); }

  @Post('reception/grants/:id/revoke')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF_ROLES)
  revokeGrant(@CurrentUser() staff: Staff, @Param('id', ParseIntPipe) id: number) { return this.clinic.revokeGrant(staff, id); }
}
