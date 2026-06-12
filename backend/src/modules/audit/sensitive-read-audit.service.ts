import { Injectable } from '@nestjs/common';
import { Prisma, SensitiveReadResource } from '@prisma/client';

import { LoggingService } from '../logging/logging.service';
import { PrismaService } from '../prisma/prisma.service';

type SensitiveReadAuditInput = {
  resource: SensitiveReadResource;
  actorUserId: number;
  hospitalId: number;
  correlationId?: string;
  encounterId?: number | null;
  patientId?: number | null;
  assetId?: number | null;
  triageAssessmentId?: number | null;
  metadata?: Prisma.InputJsonValue;
};

@Injectable()
export class SensitiveReadAuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loggingService: LoggingService,
  ) {}

  async record(input: SensitiveReadAuditInput): Promise<void> {
    try {
      await this.prisma.sensitiveReadAuditLog.create({
        data: {
          resource: input.resource,
          hospitalId: input.hospitalId,
          userId: input.actorUserId,
          correlationId: input.correlationId,
          encounterId: input.encounterId ?? null,
          patientId: input.patientId ?? null,
          assetId: input.assetId ?? null,
          triageAssessmentId: input.triageAssessmentId ?? null,
          metadata: input.metadata ?? Prisma.DbNull,
        },
      });
    } catch (error) {
      await this.loggingService.warn(
        'Sensitive read audit write failed',
        {
          service: 'SensitiveReadAuditService',
          operation: 'record',
          correlationId: input.correlationId,
          hospitalId: input.hospitalId,
          userId: input.actorUserId,
          encounterId: input.encounterId ?? undefined,
          patientId: input.patientId ?? undefined,
        },
        {
          resource: input.resource,
          assetId: input.assetId ?? undefined,
          triageAssessmentId: input.triageAssessmentId ?? undefined,
          errorCode: error instanceof Error ? error.name : 'UnknownError',
        },
      );
      const failClosed = (process.env.SENSITIVE_READ_AUDIT_FAIL_CLOSED
        ?? ((process.env.NODE_ENV || '').toLowerCase() === 'production' ? 'true' : 'false'))
        .trim()
        .toLowerCase();
      if (['1', 'true', 'yes', 'on'].includes(failClosed)) {
        throw error;
      }
    }
  }
}
