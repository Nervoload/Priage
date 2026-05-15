// Patient authentication service.
// Handles registration, login, and profile management for patient users.
// Uses bcrypt for password hashing and opaque patient sessions.

import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import {
  ContextSourceType,
  EncounterStatus,
  Prisma,
  ReviewState,
  TrustTier,
  VisibilityScope,
} from '@prisma/client';

import { PATIENT_SESSION_TTL_MS } from '../../common/http/auth-cookie.util';
import { PatientContext } from '../auth/guards/patient.guard';
import { LoggingService } from '../logging/logging.service';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterPatientDto } from './dto/register-patient.dto';
import { LoginPatientDto } from './dto/login-patient.dto';
import { UpdatePatientProfileDto } from './dto/update-profile.dto';
import { UpgradeGuestDto } from './dto/upgrade-guest.dto';
import { SubmitPatientFeedbackDto } from './dto/submit-feedback.dto';
import { DeletePatientAccountDto } from './dto/delete-account.dto';
import { hashPatientPassword } from './patient-password.util';

const ACTIVE_SESSION_ENCOUNTER_STATUSES: EncounterStatus[] = [
  EncounterStatus.EXPECTED,
  EncounterStatus.ADMITTED,
  EncounterStatus.TRIAGE,
  EncounterStatus.WAITING,
];

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

    const hashedPassword = await hashPatientPassword(dto.password);
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
        expiresAt: this.buildSessionExpiry(),
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

    // Only carry over an encounter when it is still active. Historical visits
    // must not block the patient from signing back in or starting a new visit.
    const latestSession = await this.prisma.patientSession.findFirst({
      where: {
        patientId: patient.id,
        OR: [
          { encounterId: null },
          {
            encounter: {
              status: {
                in: ACTIVE_SESSION_ENCOUNTER_STATUSES,
              },
            },
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: {
        encounterId: true,
      },
    });

    await this.prisma.patientSession.create({
      data: {
        token,
        patientId: patient.id,
        encounterId: latestSession?.encounterId ?? null,
        expiresAt: this.buildSessionExpiry(),
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

    const existingPatient = await this.prisma.patientProfile.findUnique({
      where: { id: patientId },
    });

    if (!existingPatient) {
      throw new UnauthorizedException('Patient not found');
    }

    if (dto.currentPassword?.trim()) {
      const valid = await bcrypt.compare(dto.currentPassword, existingPatient.password);
      if (!valid) {
        throw new UnauthorizedException('Incorrect password');
      }
    }

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

  async submitFeedback(patient: PatientContext, dto: SubmitPatientFeedbackDto, correlationId?: string) {
    const trimmedMessage = dto.message.trim();

    const profile = await this.prisma.patientProfile.findUnique({
      where: { id: patient.patientId },
      select: {
        email: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!profile) {
      throw new UnauthorizedException('Patient not found');
    }

    await this.prisma.contextItem.create({
      data: {
        publicId: randomUUID(),
        itemType: dto.type === 'bug' ? 'patient_bug_report' : 'patient_feedback',
        payload: {
          channel: 'patient_app_settings',
          category: dto.type,
          message: trimmedMessage,
          submittedAt: new Date().toISOString(),
          patientEmail: profile.email,
          patientName: [profile.firstName, profile.lastName].filter(Boolean).join(' ') || null,
        },
        sourceType: ContextSourceType.PATIENT,
        trustTier: TrustTier.UNTRUSTED,
        reviewState: ReviewState.UNREVIEWED,
        visibilityScope: VisibilityScope.STORED_ONLY,
        patientId: patient.patientId,
        encounterId: patient.encounterId,
        hospitalId: patient.hospitalId,
      },
    });

    this.loggingService.info('Patient feedback stored', {
      service: 'PatientAuthService',
      operation: 'submitFeedback',
      correlationId,
      patientId: patient.patientId,
    }, {
      type: dto.type,
      encounterId: patient.encounterId,
      hospitalId: patient.hospitalId,
    });

    return { ok: true };
  }

  async deleteAccount(patientId: number, dto: DeletePatientAccountDto, correlationId?: string) {
    const patient = await this.prisma.patientProfile.findUnique({
      where: { id: patientId },
    });

    if (!patient) {
      throw new UnauthorizedException('Patient not found');
    }

    if (dto.email.trim().toLowerCase() !== patient.email.trim().toLowerCase()) {
      throw new BadRequestException('Enter the exact account email to confirm deletion');
    }

    const valid = await bcrypt.compare(dto.password, patient.password);
    if (!valid) {
      throw new UnauthorizedException('Incorrect password');
    }

    const replacementPassword = await hashPatientPassword(randomUUID());
    const deletedEmail = `deleted+${patient.id}-${Date.now()}@deleted.local`;

    await this.prisma.$transaction(async (tx) => {
      await tx.patientSession.deleteMany({
        where: { patientId },
      });

      await tx.patientProfile.update({
        where: { id: patientId },
        data: {
          email: deletedEmail,
          password: replacementPassword,
          firstName: null,
          lastName: null,
          phone: null,
          age: null,
          gender: null,
          heightCm: null,
          weightKg: null,
          allergies: null,
          conditions: null,
          preferredLanguage: 'en',
          optionalHealthInfo: Prisma.JsonNull,
        },
      });
    });

    this.loggingService.info('Patient account deleted from app access', {
      service: 'PatientAuthService',
      operation: 'deleteAccount',
      correlationId,
      patientId,
    });

    return { ok: true };
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

  /**
   * Upgrade a guest intake profile to a full account.
   * Sets a real email + hashed password on the existing PatientProfile so all
   * encounters, messages, and assets are preserved.
   */
  async upgradeGuest(patientId: number, sessionId: number, dto: UpgradeGuestDto, correlationId?: string) {
    this.loggingService.info('Guest account upgrade attempt', {
      service: 'PatientAuthService',
      operation: 'upgradeGuest',
      correlationId,
      patientId,
    });

    const patient = await this.prisma.patientProfile.findUnique({
      where: { id: patientId },
    });

    if (!patient) {
      throw new UnauthorizedException('Patient not found');
    }

    // Only allow upgrade for guest profiles (intake.local placeholder emails)
    if (!patient.email.endsWith('@intake.local')) {
      throw new BadRequestException('This account is already a full account');
    }

    // Check that the desired email is not already taken
    const existing = await this.prisma.patientProfile.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const hashedPassword = await hashPatientPassword(dto.password);

    const updated = await this.prisma.patientProfile.update({
      where: { id: patientId },
      data: {
        email: dto.email,
        password: hashedPassword,
        firstName: dto.firstName ?? patient.firstName,
        lastName: dto.lastName ?? patient.lastName,
        phone: dto.phone ?? patient.phone,
        age: dto.age ?? patient.age,
        gender: dto.gender ?? patient.gender,
        allergies: dto.allergies ?? patient.allergies,
        conditions: dto.conditions ?? patient.conditions,
      },
    });

    // Create a fresh session token for the upgraded account
    const token = randomUUID();

    // Carry over encounterId from the current session
    const currentSession = await this.prisma.patientSession.findUnique({
      where: { id: sessionId },
      select: {
        encounterId: true,
        encounter: {
          select: {
            status: true,
          },
        },
      },
    });

    const reusableEncounterId =
      currentSession?.encounterId && currentSession.encounter
        ? ACTIVE_SESSION_ENCOUNTER_STATUSES.includes(currentSession.encounter.status)
          ? currentSession.encounterId
          : null
        : currentSession?.encounterId ?? null;

    await this.prisma.patientSession.create({
      data: {
        token,
        patientId: patient.id,
        encounterId: reusableEncounterId,
        expiresAt: this.buildSessionExpiry(),
      },
    });

    this.loggingService.info('Guest account upgraded successfully', {
      service: 'PatientAuthService',
      operation: 'upgradeGuest',
      correlationId,
      patientId: patient.id,
    });

    return {
      sessionToken: token,
      patient: this.sanitizePatient(updated),
    };
  }

  private sanitizePatient(patient: any) {
    const { password, ...safe } = patient;
    return safe;
  }

  private buildSessionExpiry(): Date {
    return new Date(Date.now() + PATIENT_SESSION_TTL_MS);
  }
}
