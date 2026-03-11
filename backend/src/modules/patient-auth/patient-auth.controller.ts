// Patient auth endpoints.
// POST /patient-auth/register — public, creates account + session
// POST /patient-auth/login    — public, validates credentials, creates session
// GET  /patient-auth/me       — returns current patient profile (PatientGuard)
// PATCH /patient-auth/profile — update profile fields (PatientGuard)
// POST /patient-auth/upgrade  — convert guest intake profile to full account (PatientGuard)
// POST /patient-auth/logout   — delete current session (PatientGuard)

import { Body, Controller, Delete, Get, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';

import {
  PATIENT_SESSION_COOKIE,
  PATIENT_SESSION_TTL_MS,
  buildAuthCookieOptions,
  buildClearedAuthCookieOptions,
} from '../../common/http/auth-cookie.util';
import {
  PATIENT_LOGIN_THROTTLE,
  PATIENT_REGISTER_THROTTLE,
} from '../../common/http/throttle.util';
import { CurrentPatient } from '../auth/decorators/current-patient.decorator';
import { PatientContext, PatientGuard } from '../auth/guards/patient.guard';
import { PatientAuthService } from './patient-auth.service';
import { RegisterPatientDto } from './dto/register-patient.dto';
import { LoginPatientDto } from './dto/login-patient.dto';
import { UpdatePatientProfileDto } from './dto/update-profile.dto';
import { UpgradeGuestDto } from './dto/upgrade-guest.dto';

@Controller('patient-auth')
export class PatientAuthController {
  constructor(private readonly patientAuthService: PatientAuthService) {}

  @Post('register')
  @Throttle(PATIENT_REGISTER_THROTTLE)
  async register(
    @Body() dto: RegisterPatientDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.patientAuthService.register(dto, req.correlationId);
    res.cookie(PATIENT_SESSION_COOKIE, result.sessionToken, buildAuthCookieOptions(PATIENT_SESSION_TTL_MS));
    return result;
  }

  @Post('login')
  @Throttle(PATIENT_LOGIN_THROTTLE)
  async login(
    @Body() dto: LoginPatientDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.patientAuthService.login(dto, req.correlationId);
    res.cookie(PATIENT_SESSION_COOKIE, result.sessionToken, buildAuthCookieOptions(PATIENT_SESSION_TTL_MS));
    return result;
  }

  @Get('me')
  @UseGuards(PatientGuard)
  async getMe(
    @CurrentPatient() patient: PatientContext,
    @Req() req: Request,
  ) {
    return this.patientAuthService.getMe(patient.patientId, req.correlationId);
  }

  @Patch('profile')
  @UseGuards(PatientGuard)
  async updateProfile(
    @Body() dto: UpdatePatientProfileDto,
    @CurrentPatient() patient: PatientContext,
    @Req() req: Request,
  ) {
    return this.patientAuthService.updateProfile(patient.patientId, dto, req.correlationId);
  }

  @Post('upgrade')
  @UseGuards(PatientGuard)
  async upgradeGuest(
    @Body() dto: UpgradeGuestDto,
    @CurrentPatient() patient: PatientContext,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.patientAuthService.upgradeGuest(
      patient.patientId,
      patient.sessionId,
      dto,
      req.correlationId,
    );
    res.cookie(PATIENT_SESSION_COOKIE, result.sessionToken, buildAuthCookieOptions(PATIENT_SESSION_TTL_MS));
    return result;
  }

  @Delete('logout')
  @UseGuards(PatientGuard)
  async logout(
    @CurrentPatient() patient: PatientContext,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.patientAuthService.logout(patient.sessionId, req.correlationId);
    res.clearCookie(PATIENT_SESSION_COOKIE, buildClearedAuthCookieOptions());
    return result;
  }
}
