import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { IdempotencyRecordStatus, Prisma } from '@prisma/client';

import { LoggingService } from '../logging/logging.service';
import { PrismaService } from '../prisma/prisma.service';
import type { PatientContext } from './guards/patient.guard';

type PatientCommandContext = {
  patient: PatientContext;
  command: string;
  idempotencyKey?: string;
  fingerprintInput: unknown;
  correlationId?: string;
};

type Reservation = {
  recordId: number;
};

@Injectable()
export class PatientIdempotencyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loggingService: LoggingService,
  ) {}

  async execute<T>(
    context: PatientCommandContext,
    action: () => Promise<T>,
  ): Promise<T> {
    const idempotencyKey = this.normalizeKey(context.idempotencyKey);
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key is required for this patient write');
    }

    const requestFingerprint = this.createFingerprint(context.fingerprintInput);
    const resolved = await this.reserve(context, idempotencyKey, requestFingerprint);
    if (!this.isReservation(resolved)) {
      return resolved as T;
    }

    try {
      const body = await action();
      const responseBody = this.toJsonBody(body);

      await this.prisma.patientIdempotencyRecord.update({
        where: { id: resolved.recordId },
        data: {
          status: IdempotencyRecordStatus.COMPLETED,
          completedAt: new Date(),
          responseStatus: 200,
          responseBody,
        },
      });

      return body;
    } catch (error) {
      await this.markFailed(resolved.recordId);
      throw error;
    }
  }

  private async reserve(
    context: PatientCommandContext,
    idempotencyKey: string,
    requestFingerprint: string,
  ): Promise<Reservation | Prisma.JsonValue> {
    while (true) {
      const existing = await this.prisma.patientIdempotencyRecord.findUnique({
        where: {
          patientId_command_idempotencyKey: {
            patientId: context.patient.patientId,
            command: context.command,
            idempotencyKey,
          },
        },
      });

      if (existing) {
        if (existing.requestFingerprint !== requestFingerprint) {
          throw new ConflictException('Idempotency key has already been used with a different request');
        }

        if (existing.status === IdempotencyRecordStatus.COMPLETED && existing.responseBody !== null) {
          await this.loggingService.debug(
            'Replayed patient idempotency response',
            {
              service: 'PatientIdempotencyService',
              operation: 'reserve',
              correlationId: context.correlationId,
              patientId: context.patient.patientId,
              encounterId: context.patient.encounterId ?? undefined,
              hospitalId: context.patient.hospitalId ?? undefined,
            },
            {
              command: context.command,
            },
          );
          return existing.responseBody;
        }

        if (existing.status === IdempotencyRecordStatus.IN_PROGRESS) {
          const staleAfterMs = this.readPositiveIntEnv('PATIENT_IDEMPOTENCY_STALE_AFTER_MS', 5 * 60_000);
          if (existing.createdAt.getTime() > Date.now() - staleAfterMs) {
            throw new ConflictException('An identical patient request is already in progress for this idempotency key');
          }
          const reclaimed = await this.prisma.patientIdempotencyRecord.updateMany({
            where: {
              id: existing.id,
              status: IdempotencyRecordStatus.IN_PROGRESS,
              createdAt: existing.createdAt,
            },
            data: {
              status: IdempotencyRecordStatus.IN_PROGRESS,
              completedAt: null,
              responseStatus: null,
              responseBody: Prisma.DbNull,
              createdAt: new Date(),
            },
          });
          if (reclaimed.count === 1) {
            return { recordId: existing.id };
          }
          continue;
        }

        if (existing.status === IdempotencyRecordStatus.FAILED) {
          const reclaimed = await this.prisma.patientIdempotencyRecord.updateMany({
            where: {
              id: existing.id,
              status: IdempotencyRecordStatus.FAILED,
              requestFingerprint,
            },
            data: {
              status: IdempotencyRecordStatus.IN_PROGRESS,
              completedAt: null,
              responseStatus: null,
              responseBody: Prisma.DbNull,
            },
          });

          if (reclaimed.count === 1) {
            return { recordId: existing.id };
          }

          continue;
        }
      }

      try {
        const created = await this.prisma.patientIdempotencyRecord.create({
          data: {
            patientId: context.patient.patientId,
            patientSessionId: context.patient.sessionId,
            command: context.command,
            idempotencyKey,
            requestFingerprint,
            status: IdempotencyRecordStatus.IN_PROGRESS,
          },
          select: { id: true },
        });

        return { recordId: created.id };
      } catch (error) {
        if (this.isUniqueConstraint(error)) {
          continue;
        }
        throw error;
      }
    }
  }

  private async markFailed(recordId: number): Promise<void> {
    await this.prisma.patientIdempotencyRecord.updateMany({
      where: {
        id: recordId,
        status: IdempotencyRecordStatus.IN_PROGRESS,
      },
      data: {
        status: IdempotencyRecordStatus.FAILED,
        completedAt: new Date(),
      },
    });
  }

  private normalizeKey(value: string | string[] | undefined): string | null {
    const raw = Array.isArray(value) ? value[0] : value;
    if (!raw) {
      return null;
    }

    const normalized = raw.trim();
    if (!normalized) {
      return null;
    }

    if (normalized.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(normalized)) {
      throw new BadRequestException('Idempotency-Key must be 1-128 URL-safe characters');
    }

    return normalized;
  }

  private readPositiveIntEnv(name: string, fallback: number): number {
    const parsed = Number.parseInt(process.env[name] || '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  private createFingerprint(value: unknown): string {
    return createHash('sha256').update(this.stableStringify(value)).digest('hex');
  }

  private stableStringify(value: unknown): string {
    if (value === null || typeof value !== 'object') {
      return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    }

    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${this.stableStringify(record[key])}`)
      .join(',')}}`;
  }

  private toJsonBody(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private isReservation(value: Reservation | Prisma.JsonValue): value is Reservation {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value) && 'recordId' in value);
  }

  private isUniqueConstraint(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
