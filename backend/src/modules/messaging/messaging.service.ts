// backend/src/modules/messaging/messaging.service.ts
// Messaging service for encounter-linked chat.

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventType, SenderType } from '@prisma/client';

import { PaginatedResponse } from '../../common/dto/pagination.dto';
import { AlertsService } from '../alerts/alerts.service';
import { EventsService } from '../events/events.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { ListMessagesQueryDto } from './dto/list-messages.query.dto';

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly alerts: AlertsService,
  ) {
    this.logger.log('MessagingService initialized');
  }

  async listMessages(
    encounterId: number,
    query?: ListMessagesQueryDto,
  ): Promise<PaginatedResponse<any>> {
    const page = query?.page || 1;
    const limit = query?.limit || 20;
    const skip = (page - 1) * limit;

    this.logger.debug({
      message: 'Listing messages',
      encounterId,
      page,
      limit,
    });

    try {
      const [messages, total] = await Promise.all([
        this.prisma.message.findMany({
          where: { encounterId },
          orderBy: { createdAt: 'asc' },
          skip,
          take: limit,
        }),
        this.prisma.message.count({ where: { encounterId } }),
      ]);

      const totalPages = Math.ceil(total / limit);

      this.logger.debug({
        message: 'Messages retrieved',
        encounterId,
        count: messages.length,
        total,
        page,
        totalPages,
      });

      return {
        data: messages,
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
      this.logger.error({
        message: 'Failed to list messages',
        encounterId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  async createMessage(encounterId: number, dto: CreateMessageDto) {
    const logContext = {
      encounterId,
      senderType: dto.senderType,
      isInternal: dto.isInternal,
      isWorsening: dto.isWorsening,
      createdByUserId: dto.createdByUserId,
      createdByPatientId: dto.createdByPatientId,
    };

    this.logger.log({
      message: 'Creating message',
      ...logContext,
    });

    try {
      const { message, event, alertEvent } = await this.prisma.$transaction(async (tx) => {
        const encounter = await tx.encounter.findUnique({
          where: { id: encounterId },
          select: { id: true, hospitalId: true },
        });
        if (!encounter) {
          this.logger.warn({
            message: 'Encounter not found for message',
            encounterId,
          });
          throw new NotFoundException(`Encounter ${encounterId} not found`);
        }
        if (encounter.hospitalId == null) {
          this.logger.warn({
            message: 'Encounter missing hospitalId',
            encounterId,
          });
          throw new BadRequestException(`Encounter ${encounterId} missing hospitalId`);
        }
        const hospitalId = encounter.hospitalId;

        try {
          this.ensureSenderIdentity(dto);
        } catch (validationError) {
          this.logger.warn({
            message: 'Message sender validation failed',
            ...logContext,
            error: validationError instanceof Error ? validationError.message : String(validationError),
          });
          throw validationError;
        }

        const created = await tx.message.create({
          data: {
            senderType: dto.senderType,
            createdByUserId: dto.createdByUserId,
            createdByPatientId: dto.createdByPatientId,
            content: dto.content,
            isInternal: dto.isInternal ?? false,
            encounterId: encounter.id,
            hospitalId: hospitalId,
          },
        });

        const createdEvent = await this.events.emitEncounterEventTx(tx, {
          encounterId: encounter.id,
          hospitalId,
          type: EventType.MESSAGE_CREATED,
          metadata: {
            messageId: created.id,
            senderType: created.senderType,
            isInternal: created.isInternal,
          },
          actor: {
            actorUserId: dto.createdByUserId,
            actorPatientId: dto.createdByPatientId,
          },
        });

        let createdAlertEvent = null;
        if (dto.isWorsening && dto.senderType === SenderType.PATIENT) {
          this.logger.log({
            message: 'Creating worsening alert from patient message',
            messageId: created.id,
            encounterId: encounter.id,
            hospitalId,
          });

          const createdAlert = await this.alerts.createAlertTx(tx, {
            encounterId: encounter.id,
            hospitalId,
            type: 'PATIENT_WORSENING',
            severity: 'HIGH',
            metadata: {
              messageId: created.id,
            },
            actor: {
              actorPatientId: dto.createdByPatientId,
            },
          });
          createdAlertEvent = createdAlert.event;
        }

        return { message: created, event: createdEvent, alertEvent: createdAlertEvent };
      });

      this.logger.log({
        message: 'Message created successfully',
        messageId: message.id,
        eventId: event?.id,
        alertEventId: alertEvent?.id,
        alertCreated: !!alertEvent,
        ...logContext,
      });

      if (event) {
        this.events.dispatchEncounterEvent(event);
      }
      if (alertEvent) {
        this.events.dispatchEncounterEvent(alertEvent);
      }

      return message;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error({
        message: 'Failed to create message',
        ...logContext,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  async markMessageRead(messageId: number, actorUserId: number) {
    this.logger.log({
      message: 'Marking message as read',
      messageId,
      actorUserId,
    });

    try {
      const message = await this.prisma.message.findUnique({
        where: { id: messageId },
        select: { id: true, encounterId: true, hospitalId: true },
      });
      if (!message) {
        this.logger.warn({
          message: 'Message not found for marking as read',
          messageId,
        });
        throw new NotFoundException(`Message ${messageId} not found`);
      }

      const event = await this.events.emitEncounterEventTx(this.prisma, {
        encounterId: message.encounterId,
        hospitalId: message.hospitalId ?? undefined,
        type: EventType.MESSAGE_READ,
        metadata: { messageId: message.id },
        actor: { actorUserId },
      });

      this.logger.log({
        message: 'Message marked as read',
        messageId,
        actorUserId,
        encounterId: message.encounterId,
        eventId: event?.id,
      });

      if (event) {
        this.events.dispatchEncounterEvent(event);
      }

      return { ok: true };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error({
        message: 'Failed to mark message as read',
        messageId,
        actorUserId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  private ensureSenderIdentity(dto: CreateMessageDto) {
    if (dto.senderType === SenderType.USER && !dto.createdByUserId) {
      throw new BadRequestException('createdByUserId is required for USER messages');
    }
    if (dto.senderType === SenderType.PATIENT && !dto.createdByPatientId) {
      throw new BadRequestException('createdByPatientId is required for PATIENT messages');
    }
    if (
      dto.senderType === SenderType.USER &&
      dto.createdByPatientId !== undefined
    ) {
      throw new BadRequestException('createdByPatientId must be empty for USER messages');
    }
    if (
      dto.senderType === SenderType.PATIENT &&
      dto.createdByUserId !== undefined
    ) {
      throw new BadRequestException('createdByUserId must be empty for PATIENT messages');
    }
  }
}
