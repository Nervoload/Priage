// backend/src/modules/messaging/messaging.service.ts
// Messaging service for encounter-linked chat.

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AssetStatus, EventType, Prisma, SenderType } from '@prisma/client';

import { PaginatedResponse } from '../../common/dto/pagination.dto';
import { AlertsService } from '../alerts/alerts.service';
import { AssetsService } from '../assets/assets.service';
import { AssetSummaryDto, assetSummarySelect, mapAssetSummary } from '../assets/asset-summary.dto';
import { EventsService } from '../events/events.service';
import { LoggingService } from '../logging/logging.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { CreatePatientMessageDto } from './dto/create-patient-message.dto';
import { ListMessagesQueryDto } from './dto/list-messages.query.dto';

const messageWithAssetsSelect = {
  id: true,
  createdAt: true,
  senderType: true,
  content: true,
  isInternal: true,
  createdByUserId: true,
  createdByPatientId: true,
  assets: {
    where: {
      status: AssetStatus.READY,
    },
    select: assetSummarySelect,
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.MessageSelect;

type MessageWithAssetsRecord = Prisma.MessageGetPayload<{ select: typeof messageWithAssetsSelect }>;

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly alerts: AlertsService,
    private readonly assetsService: AssetsService,
    private readonly loggingService: LoggingService,
  ) {
    this.logger.log('MessagingService initialized');
  }

  async listMessages(
    encounterId: number,
    hospitalId: number,
    query?: ListMessagesQueryDto,
    correlationId?: string,
  ): Promise<PaginatedResponse<any>> {
    const page = query?.page || 1;
    const limit = query?.limit || 20;
    const skip = (page - 1) * limit;

    this.loggingService.debug(
      'Listing messages',
      {
        service: 'MessagingService',
        operation: 'listMessages',
        correlationId,
        encounterId,
        hospitalId,
      },
      {
        page,
        limit,
      },
    );

    try {
      const [messages, total] = await Promise.all([
        this.prisma.message.findMany({
          where: { encounterId, hospitalId },
          orderBy: { createdAt: 'asc' },
          skip,
          take: limit,
          select: messageWithAssetsSelect,
        }),
        this.prisma.message.count({ where: { encounterId, hospitalId } }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: messages.map((message) => this.serializeMessage(message, 'staff')),
        meta: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };
    } catch (error) {
      this.loggingService.error(
        'Failed to list messages',
        {
          service: 'MessagingService',
          operation: 'listMessages',
          correlationId,
          encounterId,
          hospitalId,
        },
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  async createMessage(
    encounterId: number,
    hospitalId: number,
    actorUserId: number,
    dto: CreateMessageDto,
    correlationId?: string,
  ) {
    const { content, assetIds } = this.normalizePayload(dto.content, dto.assetIds);

    this.loggingService.info(
      'Creating message',
      {
        service: 'MessagingService',
        operation: 'createMessage',
        correlationId,
        encounterId,
        hospitalId,
        userId: actorUserId,
      },
      {
        senderType: SenderType.USER,
        isInternal: dto.isInternal,
        attachmentCount: assetIds.length,
      },
    );

    try {
      const { message, event } = await this.prisma.$transaction(async (tx) => {
        const encounter = await tx.encounter.findUnique({
          where: {
            id_hospitalId: {
              id: encounterId,
              hospitalId,
            },
          },
          select: { id: true, hospitalId: true },
        });

        if (!encounter) {
          throw new NotFoundException(`Encounter ${encounterId} not found for hospital`);
        }

        const created = await tx.message.create({
          data: {
            senderType: SenderType.USER,
            createdByUserId: actorUserId,
            content,
            isInternal: dto.isInternal ?? false,
            encounterId: encounter.id,
            hospitalId: hospitalId,
          },
          select: messageWithAssetsSelect,
        });

        const attachments = await this.assetsService.attachAssetsToMessage(
          tx,
          assetIds,
          created.id,
          encounter.id,
          { actorUserId },
          'staff',
        );

        const createdEvent = await this.events.emitEncounterEventTx(tx, {
          encounterId: encounter.id,
          hospitalId,
          type: EventType.MESSAGE_CREATED,
          metadata: {
            messageId: created.id,
            senderType: created.senderType,
            isInternal: created.isInternal,
            attachmentCount: attachments.length,
          },
          actor: {
            actorUserId,
          },
        });

        return {
          message: {
            ...created,
            attachments,
          },
          event: createdEvent,
        };
      });

      void this.events.dispatchEncounterEventAndMarkProcessed(event);
      return message;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      this.loggingService.error(
        'Failed to create message',
        {
          service: 'MessagingService',
          operation: 'createMessage',
          correlationId,
          encounterId,
          hospitalId,
          userId: actorUserId,
        },
        error instanceof Error ? error : new Error(String(error)),
        {
          senderType: SenderType.USER,
          isInternal: dto.isInternal,
          attachmentCount: assetIds.length,
        },
      );
      throw error;
    }
  }

  async markMessageRead(
    messageId: number,
    hospitalId: number,
    actorUserId: number,
    correlationId?: string,
  ) {
    this.loggingService.info(
      'Marking message as read',
      {
        service: 'MessagingService',
        operation: 'markMessageRead',
        correlationId,
        userId: actorUserId,
        hospitalId,
      },
      {
        messageId,
      },
    );

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const message = await tx.message.findUnique({
          where: { id: messageId },
          select: { id: true, encounterId: true, hospitalId: true, createdAt: true },
        });
        if (!message || message.hospitalId !== hospitalId) {
          throw new NotFoundException(`Message ${messageId} not found`);
        }

        const existingCursor = await tx.encounterReadCursor.findUnique({
          where: {
            encounterId_userId: {
              encounterId: message.encounterId,
              userId: actorUserId,
            },
          },
        });

        if (existingCursor?.lastReadMessageId && existingCursor.lastReadMessageId >= message.id) {
          return {
            encounterId: message.encounterId,
            lastReadMessageId: existingCursor.lastReadMessageId,
            lastReadAt: existingCursor.lastReadAt,
            event: null,
          };
        }

        const now = new Date();
        const cursor = existingCursor
          ? await tx.encounterReadCursor.update({
              where: { id: existingCursor.id },
              data: {
                hospitalId,
                lastReadMessageId: message.id,
                lastReadAt: now,
              },
            })
          : await tx.encounterReadCursor.create({
              data: {
                encounterId: message.encounterId,
                hospitalId,
                userId: actorUserId,
                lastReadMessageId: message.id,
                lastReadAt: now,
              },
            });

        const event = await this.events.emitEncounterEventTx(tx, {
          encounterId: message.encounterId,
          hospitalId: message.hospitalId,
          type: EventType.MESSAGE_READ,
          metadata: {
            messageId: message.id,
            lastReadMessageId: cursor.lastReadMessageId,
            lastReadAt: cursor.lastReadAt,
          },
          actor: { actorUserId },
        });

        return {
          encounterId: message.encounterId,
          lastReadMessageId: cursor.lastReadMessageId,
          lastReadAt: cursor.lastReadAt,
          event,
        };
      });

      if (result.event) {
        void this.events.dispatchEncounterEventAndMarkProcessed(result.event);
      }

      return {
        ok: true,
        encounterId: result.encounterId,
        lastReadMessageId: result.lastReadMessageId,
        lastReadAt: result.lastReadAt,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.loggingService.error(
        'Failed to mark message as read',
        {
          service: 'MessagingService',
          operation: 'markMessageRead',
          correlationId,
          userId: actorUserId,
          hospitalId,
        },
        error instanceof Error ? error : new Error(String(error)),
        {
          messageId,
        },
      );
      throw error;
    }
  }

  async getEncounterReadState(
    encounterId: number,
    hospitalId: number,
    actorUserId: number,
    correlationId?: string,
  ) {
    this.loggingService.debug(
      'Fetching encounter read state',
      {
        service: 'MessagingService',
        operation: 'getEncounterReadState',
        correlationId,
        encounterId,
        hospitalId,
        userId: actorUserId,
      },
    );

    const encounter = await this.prisma.encounter.findUnique({
      where: {
        id_hospitalId: {
          id: encounterId,
          hospitalId,
        },
      },
      select: { id: true },
    });

    if (!encounter) {
      throw new NotFoundException(`Encounter ${encounterId} not found for hospital`);
    }

    const cursor = await this.prisma.encounterReadCursor.findUnique({
      where: {
        encounterId_userId: {
          encounterId,
          userId: actorUserId,
        },
      },
      select: {
        lastReadMessageId: true,
        lastReadAt: true,
      },
    });

    return {
      encounterId,
      lastReadMessageId: cursor?.lastReadMessageId ?? null,
      lastReadAt: cursor?.lastReadAt ?? null,
    };
  }

  async listMessagesForPatient(
    encounterId: number,
    patientId: number,
    correlationId?: string,
  ) {
    this.loggingService.debug(
      'Patient listing messages',
      {
        service: 'MessagingService',
        operation: 'listMessagesForPatient',
        correlationId,
        encounterId,
        patientId,
      },
    );

    const encounter = await this.prisma.encounter.findUnique({
      where: { id: encounterId },
      select: { patientId: true, hospitalId: true },
    });
    if (!encounter) {
      throw new NotFoundException(`Encounter ${encounterId} not found`);
    }
    if (encounter.patientId !== patientId) {
      throw new ForbiddenException('You can only view messages on your own encounters');
    }

    const messages = await this.prisma.message.findMany({
      where: {
        encounterId,
        hospitalId: encounter.hospitalId,
        isInternal: false,
      },
      orderBy: { createdAt: 'asc' },
      select: messageWithAssetsSelect,
    });

    return messages.map((message) => this.serializeMessage(message, 'patient'));
  }

  async createPatientMessage(
    encounterId: number,
    patientId: number,
    dto: CreatePatientMessageDto,
    correlationId?: string,
  ) {
    const { content, assetIds } = this.normalizePayload(dto.content, dto.assetIds);

    this.loggingService.info(
      'Patient creating message',
      {
        service: 'MessagingService',
        operation: 'createPatientMessage',
        correlationId,
        encounterId,
        patientId,
      },
      {
        isWorsening: dto.isWorsening,
        attachmentCount: assetIds.length,
      },
    );

    const encounter = await this.prisma.encounter.findUnique({
      where: { id: encounterId },
      select: { id: true, patientId: true, hospitalId: true },
    });
    if (!encounter) {
      throw new NotFoundException(`Encounter ${encounterId} not found`);
    }
    if (encounter.patientId !== patientId) {
      throw new ForbiddenException('You can only send messages on your own encounters');
    }

    const { message, event, alertEvent } = await this.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          senderType: SenderType.PATIENT,
          createdByPatientId: patientId,
          content,
          isInternal: false,
          encounterId: encounter.id,
          hospitalId: encounter.hospitalId,
        },
        select: messageWithAssetsSelect,
      });

      const attachments = await this.assetsService.attachAssetsToMessage(
        tx,
        assetIds,
        created.id,
        encounter.id,
        { actorPatientId: patientId },
        'patient',
      );

      const createdEvent = await this.events.emitEncounterEventTx(tx, {
        encounterId: encounter.id,
        hospitalId: encounter.hospitalId,
        type: EventType.MESSAGE_CREATED,
        metadata: {
          messageId: created.id,
          senderType: SenderType.PATIENT,
          isInternal: false,
          attachmentCount: attachments.length,
        },
        actor: { actorPatientId: patientId },
      });

      let createdAlertEvent = null;
      if (dto.isWorsening) {
        const createdAlert = await this.alerts.createAlertTx(tx, {
          encounterId: encounter.id,
          hospitalId: encounter.hospitalId,
          type: 'PATIENT_WORSENING',
          severity: 'HIGH',
          metadata: { messageId: created.id },
          actor: { actorPatientId: patientId },
        });
        createdAlertEvent = createdAlert.event;
      }

      return {
        message: {
          ...created,
          attachments,
        },
        event: createdEvent,
        alertEvent: createdAlertEvent,
      };
    });

    void this.events.dispatchEncounterEventAndMarkProcessed(event);
    if (alertEvent) {
      void this.events.dispatchEncounterEventAndMarkProcessed(alertEvent);
    }

    return message;
  }

  private normalizePayload(content?: string, assetIds?: number[]): { content: string; assetIds: number[] } {
    const trimmedContent = content?.trim() ?? '';
    const normalizedAssetIds = [...new Set((assetIds ?? []).filter((value) => Number.isInteger(value) && value > 0))];

    if (!trimmedContent && normalizedAssetIds.length === 0) {
      throw new BadRequestException('content or assetIds is required');
    }

    return {
      content: trimmedContent,
      assetIds: normalizedAssetIds,
    };
  }

  private serializeMessage(message: MessageWithAssetsRecord, audience: 'patient' | 'staff') {
    return {
      id: message.id,
      createdAt: message.createdAt,
      senderType: message.senderType,
      content: message.content,
      isInternal: message.isInternal,
      createdByUserId: message.createdByUserId,
      createdByPatientId: message.createdByPatientId,
      attachments: message.assets.map((asset) => mapAssetSummary(asset, audience)),
    };
  }
}
