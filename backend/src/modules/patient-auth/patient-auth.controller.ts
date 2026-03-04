// Patient auth endpoints.
// POST /patient-auth/register — public, creates account + session
// POST /patient-auth/login    — public, validates credentials, creates session
// GET  /patient-auth/me       — returns current patient profile (PatientGuard)
// PATCH /patient-auth/profile — update profile fields (PatientGuard)
// POST /patient-auth/logout   — delete current session (PatientGuard)

import { Body, Controller, Delete, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';

import { CurrentPatient } from '../auth/decorators/current-patient.decorator';
import { PatientContext, PatientGuard } from '../auth/guards/patient.guard';
import { PatientAuthService } from './patient-auth.service';
import { RegisterPatientDto } from './dto/register-patient.dto';
import { LoginPatientDto } from './dto/login-patient.dto';
import { UpdatePatientProfileDto } from './dto/update-profile.dto';

@Controller('patient-auth')
export class PatientAuthController {
  constructor(private readonly patientAuthService: PatientAuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterPatientDto, @Req() req: Request) {
    return this.patientAuthService.register(dto, req.correlationId);
  }

  @Post('login')
  async login(@Body() dto: LoginPatientDto, @Req() req: Request) {
    return this.patientAuthService.login(dto, req.correlationId);
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

  @Delete('logout')
  @UseGuards(PatientGuard)
  async logout(
    @CurrentPatient() patient: PatientContext,
    @Req() req: Request,
  ) {
    return this.patientAuthService.logout(patient.sessionId, req.correlationId);
  }
}
