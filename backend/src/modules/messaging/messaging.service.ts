// backend/src/modules/messaging/messaging.service.ts
// Messaging service for encounter-linked chat.

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventType, SenderType } from '@prisma/client';

import { PaginatedResponse } from '../../common/dto/pagination.dto';
import { AlertsService } from '../alerts/alerts.service';
import { EventsService } from '../events/events.service';
import { LoggingService } from '../logging/logging.service';
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
    private readonly loggingService: LoggingService,
  ) {
    this.logger.log('MessagingService initialized');
  }

  async listMessages(
    encounterId: number,
    query?: ListMessagesQueryDto,
    correlationId?: string,
  ): Promise<PaginatedResponse<any>> {
    const page = query?.page || 1;
    const limit = query?.limit || 20;
    const skip = (page - 1) * limit;

    await this.loggingService.debug(
      'Listing messages',
      {
        service: 'MessagingService',
        operation: 'listMessages',
        correlationId,
        encounterId,
      },
      {
        page,
        limit,
      },
    );

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

      await this.loggingService.debug(
        'Messages retrieved',
        {
          service: 'MessagingService',
          operation: 'listMessages',
          correlationId,
          encounterId,
        },
        {
          count: messages.length,
          total,
          page,
          totalPages,
        },
      );

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
      await this.loggingService.error(
        'Failed to list messages',
        {
          service: 'MessagingService',
          operation: 'listMessages',
          correlationId,
          encounterId,
        },
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  async createMessage(encounterId: number, dto: CreateMessageDto, correlationId?: string) {
    await this.loggingService.info(
      'Creating message',
      {
        service: 'MessagingService',
        operation: 'createMessage',
        correlationId,
        encounterId,
        userId: dto.createdByUserId,
        patientId: dto.createdByPatientId,
      },
      {
        senderType: dto.senderType,
        isInternal: dto.isInternal,
        isWorsening: dto.isWorsening,
      },
    );

    try {
      const { message, event, alertEvent } = await this.prisma.$transaction(async (tx) => {
        const encounter = await tx.encounter.findUnique({
          where: { id: encounterId },
          select: { id: true, hospitalId: true },
        });
        if (!encounter) {
          await this.loggingService.warn(
            'Encounter not found for message',
            {
              service: 'MessagingService',
              operation: 'createMessage',
              correlationId,
              encounterId,
            },
          );
          throw new NotFoundException(`Encounter ${encounterId} not found`);
        }
        if (encounter.hospitalId == null) {
          await this.loggingService.warn(
            'Encounter missing hospitalId',
            {
              service: 'MessagingService',
              operation: 'createMessage',
              correlationId,
              encounterId,
            },
          );
          throw new BadRequestException(`Encounter ${encounterId} missing hospitalId`);
        }
        const hospitalId = encounter.hospitalId;

        try {
          this.ensureSenderIdentity(dto);
        } catch (validationError) {
          await this.loggingService.warn(
            'Message sender validation failed',
            {
              service: 'MessagingService',
              operation: 'createMessage',
              correlationId,
              encounterId,
              userId: dto.createdByUserId,
              patientId: dto.createdByPatientId,
            },
            {
              senderType: dto.senderType,
              error: validationError instanceof Error ? validationError.message : String(validationError),
            },
          );
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
          await this.loggingService.info(
            'Creating worsening alert from patient message',
            {
              service: 'MessagingService',
              operation: 'createMessage',
              correlationId,
              encounterId: encounter.id,
              hospitalId,
              patientId: dto.createdByPatientId,
            },
            {
              messageId: created.id,
            },
          );

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

      await this.loggingService.info(
        'Message created successfully',
        {
          service: 'MessagingService',
          operation: 'createMessage',
          correlationId,
          encounterId,
          userId: dto.createdByUserId,
          patientId: dto.createdByPatientId,
        },
        {
          messageId: message.id,
          eventId: event?.id,
          alertEventId: alertEvent?.id,
          alertCreated: !!alertEvent,
          senderType: dto.senderType,
          isInternal: dto.isInternal,
          isWorsening: dto.isWorsening,
        },
      );

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
      await this.loggingService.error(
        'Failed to create message',
        {
          service: 'MessagingService',
          operation: 'createMessage',
          correlationId,
          encounterId,
          userId: dto.createdByUserId,
          patientId: dto.createdByPatientId,
        },
        error instanceof Error ? error : new Error(String(error)),
        {
          senderType: dto.senderType,
          isInternal: dto.isInternal,
          isWorsening: dto.isWorsening,
        },
      );
      throw error;
    }
  }

  async markMessageRead(messageId: number, actorUserId: number, correlationId?: string) {
    await this.loggingService.info(
      'Marking message as read',
      {
        service: 'MessagingService',
        operation: 'markMessageRead',
        correlationId,
        userId: actorUserId,
      },
      {
        messageId,
      },
    );

    try {
      const message = await this.prisma.message.findUnique({
        where: { id: messageId },
        select: { id: true, encounterId: true, hospitalId: true },
      });
      if (!message) {
        await this.loggingService.warn(
          'Message not found for marking as read',
          {
            service: 'MessagingService',
            operation: 'markMessageRead',
            correlationId,
            userId: actorUserId,
          },
          {
            messageId,
          },
        );
        throw new NotFoundException(`Message ${messageId} not found`);
      }

      const event = await this.events.emitEncounterEventTx(this.prisma, {
        encounterId: message.encounterId,
        hospitalId: message.hospitalId ?? undefined,
        type: EventType.MESSAGE_READ,
        metadata: { messageId: message.id },
        actor: { actorUserId },
      });

      await this.loggingService.info(
        'Message marked as read',
        {
          service: 'MessagingService',
          operation: 'markMessageRead',
          correlationId,
          encounterId: message.encounterId,
          userId: actorUserId,
        },
        {
          messageId,
          eventId: event?.id,
        },
      );

      if (event) {
        this.events.dispatchEncounterEvent(event);
      }

      return { ok: true };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      await this.loggingService.error(
        'Failed to mark message as read',
        {
          service: 'MessagingService',
          operation: 'markMessageRead',
          correlationId,
          userId: actorUserId,
        },
        error instanceof Error ? error : new Error(String(error)),
        {
          messageId,
        },
      );
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
