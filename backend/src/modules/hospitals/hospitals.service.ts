// backend/src/modules/hospitals/hospitals.service.ts
// Hospital management and dashboard analytics service

import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import {
  ContextSourceType,
  EncounterStatus,
  Prisma,
  ReviewState,
  Role,
  TrustTier,
  VisibilityScope,
} from '@prisma/client';

import { LoggingService } from '../logging/logging.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFeedbackSubmissionDto } from './dto/create-feedback-submission.dto';
import { UpdateHospitalConfigDto } from './dto/update-hospital-config.dto';
import { UpdateHospitalDetailsDto } from './dto/update-hospital-details.dto';
import {
  normalizeHospitalConfig,
  type HospitalFeedbackSubmission,
} from './hospital-config';

@Injectable()
export class HospitalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loggingService: LoggingService,
  ) {}

  async getHospital(id: number, correlationId?: string) {
    this.loggingService.debug('Fetching hospital details', {
      service: 'HospitalsService',
      operation: 'getHospital',
      correlationId,
      hospitalId: id,
    });

    const hospital = await this.prisma.hospital.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        _count: {
          select: {
            encounters: true,
            users: true,
          },
        },
      },
    });

    if (!hospital) {
      await this.loggingService.warn('Hospital not found', {
        service: 'HospitalsService',
        operation: 'getHospital',
        correlationId,
        hospitalId: id,
      });
      throw new NotFoundException(`Hospital ${id} not found`);
    }

    this.loggingService.debug('Hospital details fetched', {
      service: 'HospitalsService',
      operation: 'getHospital',
      correlationId,
      hospitalId: id,
    }, {
      encounterCount: hospital._count.encounters,
      userCount: hospital._count.users,
    });

    return hospital;
  }

  async updateHospitalDetails(
    hospitalId: number,
    adminUserId: number,
    dto: UpdateHospitalDetailsDto,
    correlationId?: string,
  ) {
    this.loggingService.info('Updating hospital details', {
      service: 'HospitalsService',
      operation: 'updateHospitalDetails',
      correlationId,
      hospitalId,
      userId: adminUserId,
    }, {
      hasNameChange: true,
      hasSlugChange: true,
    });

    const [hospital, adminUser] = await Promise.all([
      this.prisma.hospital.findUnique({
        where: { id: hospitalId },
        select: {
          id: true,
          name: true,
          slug: true,
        },
      }),
      this.prisma.user.findUnique({
        where: { id: adminUserId },
        select: {
          id: true,
          hospitalId: true,
          password: true,
          role: true,
        },
      }),
    ]);

    if (!hospital) {
      throw new NotFoundException(`Hospital ${hospitalId} not found`);
    }

    if (!adminUser || adminUser.hospitalId !== hospitalId || adminUser.role !== Role.ADMIN) {
      throw new UnauthorizedException('Administrator confirmation is required');
    }

    const passwordMatches = await bcrypt.compare(dto.currentPassword, adminUser.password);
    if (!passwordMatches) {
      throw new UnauthorizedException('Administrator password is incorrect');
    }

    try {
      await this.prisma.hospital.update({
        where: { id: hospitalId },
        data: {
          name: dto.name.trim(),
          slug: dto.slug.trim().toLowerCase(),
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError
        && error.code === 'P2002'
      ) {
        throw new ConflictException('That hospital slug is already in use');
      }
      throw error;
    }

    this.loggingService.info('Hospital details updated', {
      service: 'HospitalsService',
      operation: 'updateHospitalDetails',
      correlationId,
      hospitalId,
      userId: adminUserId,
    });

    return this.getHospital(hospitalId, correlationId);
  }

  async getDashboard(hospitalId: number, correlationId?: string) {
    this.loggingService.info('Fetching hospital dashboard', {
      service: 'HospitalsService',
      operation: 'getDashboard',
      correlationId,
      hospitalId,
    });
    // Get encounter counts by status
    const statusCounts = await this.prisma.encounter.groupBy({
      by: ['status'],
      where: { hospitalId },
      _count: true,
    });

    // Get active encounters (not COMPLETE, UNRESOLVED, or CANCELLED)
    const activeEncounters = await this.prisma.encounter.count({
      where: {
        hospitalId,
        status: {
          notIn: [EncounterStatus.COMPLETE, EncounterStatus.UNRESOLVED, EncounterStatus.CANCELLED],
        },
      },
    });

    // Get triage queue (TRIAGE status)
    const triageQueue = await this.prisma.encounter.count({
      where: {
        hospitalId,
        status: EncounterStatus.TRIAGE,
      },
    });

    // Get waiting room (WAITING status)
    const waitingRoom = await this.prisma.encounter.count({
      where: {
        hospitalId,
        status: EncounterStatus.WAITING,
      },
    });

    // Get recent encounters (last 24 hours)
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const recentEncounters = await this.prisma.encounter.count({
      where: {
        hospitalId,
        createdAt: {
          gte: oneDayAgo,
        },
      },
    });

    const dashboard = {
      hospitalId,
      activeEncounters,
      triageQueue,
      waitingRoom,
      recentEncounters,
      statusCounts: statusCounts.reduce((acc, { status, _count }) => {
        acc[status] = _count;
        return acc;
      }, {} as Record<string, number>),
    };

    this.loggingService.info('Hospital dashboard fetched', {
      service: 'HospitalsService',
      operation: 'getDashboard',
      correlationId,
      hospitalId,
    }, {
      activeEncounters,
      triageQueue,
      waitingRoom,
      recentEncounters,
    });

    return dashboard;
  }

  async getQueueStatus(hospitalId: number, correlationId?: string) {
    this.loggingService.info('Fetching hospital queue status', {
      service: 'HospitalsService',
      operation: 'getQueueStatus',
      correlationId,
      hospitalId,
    });
    // Get all active encounters with patient info
    const encounters = await this.prisma.encounter.findMany({
      where: {
        hospitalId,
        status: {
          notIn: [EncounterStatus.COMPLETE, EncounterStatus.UNRESOLVED, EncounterStatus.CANCELLED],
        },
      },
      select: {
        id: true,
        status: true,
        currentPriorityScore: true,
        currentCtasLevel: true,
        createdAt: true,
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            age: true,
          },
        },
        triageAssessments: {
          select: {
            ctasLevel: true,
            priorityScore: true,
            note: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: [
        { currentPriorityScore: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'asc' },
      ],
    });

    const queue = {
      hospitalId,
      queueLength: encounters.length,
      encounters,
    };

    this.loggingService.info('Hospital queue status fetched', {
      service: 'HospitalsService',
      operation: 'getQueueStatus',
      correlationId,
      hospitalId,
    }, {
      queueLength: encounters.length,
    });

    return queue;
  }

  async getConfig(hospitalId: number, correlationId?: string) {
    await this.assertHospitalExists(hospitalId);

    this.loggingService.info('Fetching hospital configuration', {
      service: 'HospitalsService',
      operation: 'getConfig',
      correlationId,
      hospitalId,
    });

    const record = await this.prisma.hospitalConfig.findUnique({
      where: { hospitalId },
      select: {
        config: true,
        updatedAt: true,
      },
    });

    return {
      hospitalId,
      updatedAt: record?.updatedAt.toISOString() ?? null,
      config: normalizeHospitalConfig(record?.config),
    };
  }

  async updateConfig(hospitalId: number, dto: UpdateHospitalConfigDto, correlationId?: string) {
    await this.assertHospitalExists(hospitalId);

    const normalized = normalizeHospitalConfig(dto);
    const normalizedConfigJson = normalized as unknown as Prisma.InputJsonValue;

    this.loggingService.info('Updating hospital configuration', {
      service: 'HospitalsService',
      operation: 'updateConfig',
      correlationId,
      hospitalId,
    }, {
      customQuestionCount: normalized.customIntakeQuestions.length,
      feedbackQuestionCount: normalized.admittanceFeedbackSurvey.length,
    });

    const record = await this.prisma.hospitalConfig.upsert({
      where: { hospitalId },
      create: {
        hospitalId,
        config: normalizedConfigJson,
      },
      update: {
        config: normalizedConfigJson,
      },
      select: {
        updatedAt: true,
      },
    });

    return {
      hospitalId,
      updatedAt: record.updatedAt.toISOString(),
      config: normalized,
    };
  }

  async submitAdmittanceFeedback(
    hospitalId: number,
    submittedBy: { userId: number; email: string; role: Role },
    dto: CreateFeedbackSubmissionDto,
    correlationId?: string,
  ) {
    await this.assertHospitalExists(hospitalId);

    const config = await this.getConfig(hospitalId, correlationId);
    const surveyById = new Map(config.config.admittanceFeedbackSurvey.map((question) => [question.id, question]));
    const requiredQuestionIds = new Set(
      config.config.admittanceFeedbackSurvey
        .filter((question) => question.required)
        .map((question) => question.id),
    );

    const responses = (dto.responses ?? []).map((response) => {
      const question = surveyById.get(response.questionId);
      if (!question) {
        throw new BadRequestException(`Unknown feedback question: ${response.questionId}`);
      }

      requiredQuestionIds.delete(response.questionId);

      return {
        questionId: response.questionId,
        prompt: question.prompt,
        answer: this.coerceFeedbackAnswer(question.responseType, response.answer),
      };
    });

    if (requiredQuestionIds.size > 0) {
      throw new BadRequestException('Please answer all required feedback questions before submitting');
    }

    const bugReport = dto.bugReport?.trim() ? dto.bugReport.trim() : null;
    if (responses.length === 0 && !bugReport) {
      throw new BadRequestException('Please submit survey answers or a bug report');
    }

    const created = await this.prisma.contextItem.create({
      data: {
        publicId: randomUUID(),
        itemType: 'staff_feedback_submission',
        schemaVersion: 'v1',
        payload: {
          submittedBy,
          responses,
          bugReport,
        },
        sourceType: ContextSourceType.INSTITUTION,
        trustTier: TrustTier.INSTITUTION_TRUSTED,
        reviewState: ReviewState.STAFF_REVIEWED,
        visibilityScope: VisibilityScope.STORED_ONLY,
        hospitalId,
      },
      select: {
        publicId: true,
        createdAt: true,
        payload: true,
      },
    });

    this.loggingService.info('Admittance feedback submitted', {
      service: 'HospitalsService',
      operation: 'submitAdmittanceFeedback',
      correlationId,
      hospitalId,
      userId: submittedBy.userId,
    }, {
      responseCount: responses.length,
      hasBugReport: !!bugReport,
    });

    return this.mapFeedbackSubmission(created);
  }

  async listAdmittanceFeedback(hospitalId: number, limit = 20, correlationId?: string) {
    await this.assertHospitalExists(hospitalId);

    const safeLimit = Math.max(1, Math.min(50, Number(limit) || 20));

    this.loggingService.info('Listing admittance feedback submissions', {
      service: 'HospitalsService',
      operation: 'listAdmittanceFeedback',
      correlationId,
      hospitalId,
    }, {
      limit: safeLimit,
    });

    const submissions = await this.prisma.contextItem.findMany({
      where: {
        hospitalId,
        itemType: 'staff_feedback_submission',
      },
      select: {
        publicId: true,
        createdAt: true,
        payload: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: safeLimit,
    });

    return submissions.map((submission) => this.mapFeedbackSubmission(submission));
  }

  private async assertHospitalExists(hospitalId: number) {
    const hospital = await this.prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { id: true },
    });

    if (!hospital) {
      throw new NotFoundException(`Hospital ${hospitalId} not found`);
    }
  }

  private coerceFeedbackAnswer(
    responseType: 'scale' | 'text' | 'boolean',
    rawAnswer: string,
  ): string | number | boolean {
    if (responseType === 'scale') {
      const numeric = Number(rawAnswer);
      if (!Number.isFinite(numeric) || numeric < 1 || numeric > 5) {
        throw new BadRequestException('Scale feedback answers must be between 1 and 5');
      }
      return numeric;
    }

    if (responseType === 'boolean') {
      if (rawAnswer !== 'true' && rawAnswer !== 'false') {
        throw new BadRequestException('Boolean feedback answers must be true or false');
      }
      return rawAnswer === 'true';
    }

    const trimmed = rawAnswer.trim();
    if (!trimmed) {
      throw new BadRequestException('Feedback responses cannot be empty');
    }
    return trimmed;
  }

  private mapFeedbackSubmission(submission: {
    publicId: string;
    createdAt: Date;
    payload: unknown;
  }): HospitalFeedbackSubmission {
    const payload = submission.payload && typeof submission.payload === 'object'
      ? submission.payload as Record<string, unknown>
      : {};
    const submittedBy = payload.submittedBy && typeof payload.submittedBy === 'object'
      ? payload.submittedBy as Record<string, unknown>
      : {};
    const responses = Array.isArray(payload.responses)
      ? payload.responses
          .map((item) => {
            if (!item || typeof item !== 'object') return null;
            const response = item as Record<string, unknown>;
            if (
              typeof response.questionId !== 'string'
              || typeof response.prompt !== 'string'
              || !['string', 'number', 'boolean'].includes(typeof response.answer)
            ) {
              return null;
            }
            return {
              questionId: response.questionId,
              prompt: response.prompt,
              answer: response.answer as string | number | boolean,
            };
          })
          .filter((item): item is { questionId: string; prompt: string; answer: string | number | boolean } => item !== null)
      : [];
    const bugReport = typeof payload.bugReport === 'string' && payload.bugReport.trim().length > 0
      ? payload.bugReport.trim()
      : null;

    return {
      id: submission.publicId,
      createdAt: submission.createdAt.toISOString(),
      submittedBy: {
        userId: typeof submittedBy.userId === 'number' ? submittedBy.userId : 0,
        email: typeof submittedBy.email === 'string' ? submittedBy.email : 'unknown@priage.local',
        role: typeof submittedBy.role === 'string' ? submittedBy.role as Role : Role.STAFF,
      },
      responses,
      bugReport,
    };
  }
}
