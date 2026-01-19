// backend/src/modules/messaging/messaging.service.ts
// Messaging service for encounter-linked chat.

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventType, SenderType } from '@prisma/client';

import { AlertsService } from '../alerts/alerts.service';
import { EventsService } from '../events/events.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';

@Injectable()
export class MessagingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly alerts: AlertsService,
  ) {}

  async listMessages(encounterId: number) {
    return this.prisma.message.findMany({
      where: { encounterId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createMessage(encounterId: number, dto: CreateMessageDto) {
    const { message, event, alertEvent } = await this.prisma.$transaction(async (tx) => {
      const encounter = await tx.encounter.findUnique({
        where: { id: encounterId },
        select: { id: true, hospitalId: true },
      });
      if (!encounter) throw new NotFoundException(`Encounter ${encounterId} not found`);
      if (encounter.hospitalId == null) {
        throw new BadRequestException(`Encounter ${encounterId} missing hospitalId`);
      }
      const hospitalId = encounter.hospitalId;

      this.ensureSenderIdentity(dto);

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

    if (event) {
      this.events.dispatchEncounterEvent(event);
    }
    if (alertEvent) {
      this.events.dispatchEncounterEvent(alertEvent);
    }

    return message;
  }

  async markMessageRead(messageId: number, actorUserId: number) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, encounterId: true, hospitalId: true },
    });
    if (!message) throw new NotFoundException(`Message ${messageId} not found`);

    const event = await this.events.emitEncounterEventTx(this.prisma, {
      encounterId: message.encounterId,
      hospitalId: message.hospitalId ?? undefined,
      type: EventType.MESSAGE_READ,
      metadata: { messageId: message.id },
      actor: { actorUserId },
    });

    if (event) {
      this.events.dispatchEncounterEvent(event);
    }

    return { ok: true };
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
