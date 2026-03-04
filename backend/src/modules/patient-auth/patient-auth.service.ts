// Patient authentication service.
// Handles registration, login, and profile management for patient users.
// Uses bcrypt for password hashing and x-patient-token sessions.

import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';

import { LoggingService } from '../logging/logging.service';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterPatientDto } from './dto/register-patient.dto';
import { LoginPatientDto } from './dto/login-patient.dto';
import { UpdatePatientProfileDto } from './dto/update-profile.dto';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class PatientAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loggingService: LoggingService,
  ) {}

  /**
   * Register a new patient account.
   * Creates PatientProfile + PatientSession, returns session token.
   */
  async register(dto: RegisterPatientDto, correlationId?: string) {
    this.loggingService.info('Patient registration attempt', {
      service: 'PatientAuthService',
      operation: 'register',
      correlationId,
    }, { email: dto.email });

    // Check if email already exists
    const existing = await this.prisma.patientProfile.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const token = randomUUID();

    const patient = await this.prisma.patientProfile.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        age: dto.age,
        gender: dto.gender,
      },
    });

    await this.prisma.patientSession.create({
      data: {
        token,
        patientId: patient.id,
      },
    });

    this.loggingService.info('Patient registered successfully', {
      service: 'PatientAuthService',
      operation: 'register',
      correlationId,
      patientId: patient.id,
    });

    return {
      sessionToken: token,
      patient: this.sanitizePatient(patient),
    };
  }

  /**
   * Login an existing patient.
   * Validates credentials, creates a new session, returns token.
   */
  async login(dto: LoginPatientDto, correlationId?: string) {
    this.loggingService.info('Patient login attempt', {
      service: 'PatientAuthService',
      operation: 'login',
      correlationId,
    }, { email: dto.email });

    const patient = await this.prisma.patientProfile.findUnique({
      where: { email: dto.email },
    });

    if (!patient) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await bcrypt.compare(dto.password, patient.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const token = randomUUID();

    // Find the most recent session to carry over encounterId
    const latestSession = await this.prisma.patientSession.findFirst({
      where: { patientId: patient.id },
      orderBy: { createdAt: 'desc' },
    });

    await this.prisma.patientSession.create({
      data: {
        token,
        patientId: patient.id,
        encounterId: latestSession?.encounterId ?? null,
      },
    });

    this.loggingService.info('Patient login successful', {
      service: 'PatientAuthService',
      operation: 'login',
      correlationId,
      patientId: patient.id,
    });

    return {
      sessionToken: token,
      patient: this.sanitizePatient(patient),
    };
  }

  /**
   * Get the current patient profile (from PatientGuard context).
   */
  async getMe(patientId: number, correlationId?: string) {
    const patient = await this.prisma.patientProfile.findUnique({
      where: { id: patientId },
    });

    if (!patient) {
      throw new UnauthorizedException('Patient not found');
    }

    return this.sanitizePatient(patient);
  }

  /**
   * Update patient profile fields.
   */
  async updateProfile(patientId: number, dto: UpdatePatientProfileDto, correlationId?: string) {
    this.loggingService.info('Updating patient profile', {
      service: 'PatientAuthService',
      operation: 'updateProfile',
      correlationId,
      patientId,
    });

    const patient = await this.prisma.patientProfile.update({
      where: { id: patientId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        age: dto.age,
        gender: dto.gender,
        heightCm: dto.heightCm,
        weightKg: dto.weightKg,
        allergies: dto.allergies,
        conditions: dto.conditions,
        preferredLanguage: dto.preferredLanguage,
      },
    });

    return this.sanitizePatient(patient);
  }

  /**
   * Logout — delete the current session.
   */
  async logout(sessionId: number, correlationId?: string) {
    await this.prisma.patientSession.delete({
      where: { id: sessionId },
    }).catch(() => {
      // Session may already be deleted
    });
    return { ok: true };
  }

  private sanitizePatient(patient: any) {
    const { password, ...safe } = patient;
    return safe;
  }
}
