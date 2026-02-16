// backend/src/modules/messaging/messaging.service.ts
// Messaging service for encounter-linked chat.

import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventType, SenderType } from '@prisma/client';

import { PaginatedResponse } from '../../common/dto/pagination.dto';
import { AlertsService } from '../alerts/alerts.service';
import { EventsService } from '../events/events.service';
import { LoggingService } from '../logging/logging.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { CreatePatientMessageDto } from './dto/create-patient-message.dto';
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
        }),
        this.prisma.message.count({ where: { encounterId, hospitalId } }),
      ]);

      const totalPages = Math.ceil(total / limit);

      this.loggingService.debug(
        'Messages retrieved',
        {
          service: 'MessagingService',
          operation: 'listMessages',
          correlationId,
          encounterId,
          hospitalId,
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
        senderType: dto.senderType,
        isInternal: dto.isInternal,
        isWorsening: dto.isWorsening,
      },
    );

    try {
      const { message, event, alertEvent } = await this.prisma.$transaction(async (tx) => {
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
          this.loggingService.warn(
            'Encounter not found for message',
            {
              service: 'MessagingService',
              operation: 'createMessage',
              correlationId,
              encounterId,
              hospitalId,
            },
          );
          throw new NotFoundException(`Encounter ${encounterId} not found for hospital`);
        }

        try {
          this.ensureSenderIdentity(dto);
        } catch (validationError) {
          this.loggingService.warn(
            'Message sender validation failed',
            {
              service: 'MessagingService',
              operation: 'createMessage',
              correlationId,
              encounterId,
              hospitalId,
              userId: actorUserId,
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
            createdByUserId: actorUserId,
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
            actorUserId,
          },
        });

        let createdAlertEvent = null;
        if (dto.isWorsening && dto.senderType === SenderType.PATIENT) {
          this.loggingService.info(
            'Creating worsening alert from patient message',
            {
              service: 'MessagingService',
              operation: 'createMessage',
              correlationId,
              encounterId: encounter.id,
              hospitalId,
              userId: actorUserId,
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
              actorUserId,
            },
          });
          createdAlertEvent = createdAlert.event;
        }

        return { message: created, event: createdEvent, alertEvent: createdAlertEvent };
      });

      this.loggingService.info(
        'Message created successfully',
        {
          service: 'MessagingService',
          operation: 'createMessage',
          correlationId,
          encounterId,
          hospitalId,
          userId: actorUserId,
        },
        {
          messageId: message.id,
          eventId: event.id,
          alertEventId: alertEvent?.id,
          alertCreated: !!alertEvent,
          senderType: dto.senderType,
          isInternal: dto.isInternal,
          isWorsening: dto.isWorsening,
        },
      );

      void this.events.dispatchEncounterEventAndMarkProcessed(event);
      if (alertEvent) {
        void this.events.dispatchEncounterEventAndMarkProcessed(alertEvent);
      }

      return message;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
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
          senderType: dto.senderType,
          isInternal: dto.isInternal,
          isWorsening: dto.isWorsening,
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
      const message = await this.prisma.message.findUnique({
        where: { id: messageId },
        select: { id: true, encounterId: true, hospitalId: true },
      });
      if (!message) {
        this.loggingService.warn(
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
      if (message.hospitalId !== hospitalId) {
        throw new NotFoundException(`Message ${messageId} not found`);
      }

      const event = await this.events.emitEncounterEventTx(this.prisma, {
        encounterId: message.encounterId,
        hospitalId: message.hospitalId,
        type: EventType.MESSAGE_READ,
        metadata: { messageId: message.id },
        actor: { actorUserId },
      });

      this.loggingService.info(
        'Message marked as read',
        {
          service: 'MessagingService',
          operation: 'markMessageRead',
          correlationId,
          encounterId: message.encounterId,
          hospitalId,
          userId: actorUserId,
        },
        {
          messageId,
          eventId: event.id,
        },
      );

      void this.events.dispatchEncounterEventAndMarkProcessed(event);

      return { ok: true };
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

  private ensureSenderIdentity(dto: CreateMessageDto) {
    if (dto.senderType === SenderType.PATIENT) {
      throw new BadRequestException('PATIENT senderType is not allowed on staff messaging endpoints');
    }
  }

  // ─── Patient-scoped messaging methods ─────────────────────────────────────

  /**
   * List messages for an encounter from the patient’s perspective.
   * Excludes internal staff messages.
   */
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

    // Verify patient owns this encounter
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
      select: {
        id: true,
        createdAt: true,
        senderType: true,
        content: true,
        createdByPatientId: true,
      },
    });

    return messages;
  }

  /**
   * Create a message from the patient on their own encounter.
   */
  async createPatientMessage(
    encounterId: number,
    patientId: number,
    dto: CreatePatientMessageDto,
    correlationId?: string,
  ) {
    this.loggingService.info(
      'Patient creating message',
      {
        service: 'MessagingService',
        operation: 'createPatientMessage',
        correlationId,
        encounterId,
        patientId,
      },
      { isWorsening: dto.isWorsening },
    );

    // Verify patient owns this encounter
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
          content: dto.content,
          isInternal: false,
          encounterId: encounter.id,
          hospitalId: encounter.hospitalId,
        },
      });

      const createdEvent = await this.events.emitEncounterEventTx(tx, {
        encounterId: encounter.id,
        hospitalId: encounter.hospitalId,
        type: EventType.MESSAGE_CREATED,
        metadata: {
          messageId: created.id,
          senderType: SenderType.PATIENT,
          isInternal: false,
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

      return { message: created, event: createdEvent, alertEvent: createdAlertEvent };
    });

    void this.events.dispatchEncounterEventAndMarkProcessed(event);
    if (alertEvent) {
      void this.events.dispatchEncounterEventAndMarkProcessed(alertEvent);
    }

    return message;
  }
}
