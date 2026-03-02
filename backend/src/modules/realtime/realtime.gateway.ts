//backend/src/modules/realtime/realtime.gateway.ts
// realtime.gateway.ts
// Written by: John Surette
// Date Created: Dec 8 2025
// Last Edited: Feb 28 2026
// WebSocket gateway (Socket.IO) for pushing live updates to patient + hospital apps.

import { BadRequestException, ForbiddenException, Inject, Logger, NotFoundException, forwardRef } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { randomUUID } from 'crypto';
import { Role } from '@prisma/client';
import type { Server, Socket } from 'socket.io';

import { LoggingService } from '../logging/logging.service';
import { CreateMessageDto } from '../messaging/dto/create-message.dto';
import { MessagingService } from '../messaging/messaging.service';
import { PrismaService } from '../prisma/prisma.service';
import { SendMessageWsDto } from './dto/send-message.ws.dto';
import { RealtimeAuthService, TrustedRealtimeUser } from './realtime-auth.service';
import { RealtimeRedisAdapterService } from './realtime-redis-adapter.service';
import {
  AlertAcknowledgedPayload,
  AlertCreatedPayload,
  AlertResolvedPayload,
  EncounterUpdatedPayload,
  MessageCreatedPayload,
  MessageReadPayload,
  RealtimeEvents,
} from './realtime.events';
import { encounterRoomKey, hospitalRoomKey } from './realtime.rooms';

type MessageSendAck =
  | { ok: true; message: unknown }
  | { ok: false; error: { code: string; message: string } };

@WebSocketGateway({
  cors: { origin: true, credentials: true },
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);
  private static readonly MESSAGE_SEND_ALLOWED_ROLES = new Set<Role>([
    Role.NURSE,
    Role.DOCTOR,
    Role.ADMIN,
  ]);

  @WebSocketServer()
  private readonly server!: Server;

  private connectedClients = new Map<string, { userId: number; hospitalId: number; connectedAt: Date }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly loggingService: LoggingService,
    private readonly realtimeRedisAdapter: RealtimeRedisAdapterService,
    private readonly realtimeAuthService: RealtimeAuthService,
    @Inject(forwardRef(() => MessagingService))
    private readonly messagingService: MessagingService,
  ) {}

  afterInit(server: Server) {
    this.realtimeRedisAdapter.attach(server);
    this.logger.log('WebSocket Gateway initialized');
    this.logger.log('CORS enabled for all origins');

    this.loggingService.info('WebSocket Gateway initialized', {
      service: 'RealtimeGateway',
      operation: 'afterInit',
    }, {
      corsEnabled: true,
    });

    server.on('error', (error) => {
      this.logger.error({
        message: 'WebSocket server error',
        error: error.message,
        stack: error.stack,
      });

      this.loggingService.error('WebSocket server error', {
        service: 'RealtimeGateway',
        operation: 'serverError',
      }, error);
    });
  }

  async handleConnection(client: Socket): Promise<void> {
    const clientId = client.id;

    this.logger.log({
      message: 'New WebSocket connection attempt',
      clientId,
      remoteAddress: client.handshake.address,
    });

    this.loggingService.info('New WebSocket connection attempt', {
      service: 'RealtimeGateway',
      operation: 'handleConnection',
    }, {
      clientId,
      remoteAddress: client.handshake.address,
    });

    try {
      const token = this.extractToken(client);
      if (!token) {
        this.loggingService.warn('Connection rejected - no authentication token', {
          service: 'RealtimeGateway',
          operation: 'handleConnection',
        }, {
          clientId,
        });
        client.disconnect();
        return;
      }

      const trustedUser = await this.realtimeAuthService.validateStaffToken(token);
      client.data.user = trustedUser;

      this.connectedClients.set(clientId, {
        userId: trustedUser.userId,
        hospitalId: trustedUser.hospitalId,
        connectedAt: new Date(),
      });

      await client.join(hospitalRoomKey(trustedUser.hospitalId));

      this.loggingService.info('Client joined hospital room', {
        service: 'RealtimeGateway',
        operation: 'handleConnection',
        userId: trustedUser.userId,
        hospitalId: trustedUser.hospitalId,
      }, {
        clientId,
        role: trustedUser.role,
      });

      const requestedEncounterIds = this.getEncounterIdsFromHandshake(client);
      if (requestedEncounterIds.length > 0) {
        try {
          const encounters = await this.prisma.encounter.findMany({
            where: {
              id: { in: requestedEncounterIds },
              hospitalId: trustedUser.hospitalId,
            },
            select: { id: true },
          });

          for (const encounter of encounters) {
            await client.join(encounterRoomKey(encounter.id));
          }

          this.loggingService.info('Client subscribed to encounter rooms', {
            service: 'RealtimeGateway',
            operation: 'handleConnection',
            userId: trustedUser.userId,
            hospitalId: trustedUser.hospitalId,
          }, {
            clientId,
            requestedCount: requestedEncounterIds.length,
            subscribedCount: encounters.length,
            encounterIds: encounters.map((encounter) => encounter.id),
          });
        } catch (dbError) {
          this.loggingService.error('Failed to subscribe to encounter rooms', {
            service: 'RealtimeGateway',
            operation: 'handleConnection',
            userId: trustedUser.userId,
            hospitalId: trustedUser.hospitalId,
          }, dbError instanceof Error ? dbError : undefined, {
            clientId,
            requestedEncounterIds,
          });
        }
      }

      this.loggingService.info('WebSocket connection established successfully', {
        service: 'RealtimeGateway',
        operation: 'handleConnection',
        userId: trustedUser.userId,
        hospitalId: trustedUser.hospitalId,
      }, {
        clientId,
        totalConnections: this.connectedClients.size,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.loggingService.warn('Connection rejected during authentication', {
        service: 'RealtimeGateway',
        operation: 'handleConnection',
      }, {
        clientId,
        error: message,
      });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    const clientId = client.id;
    const clientInfo = this.connectedClients.get(clientId);

    if (clientInfo) {
      const connectionDuration = Date.now() - clientInfo.connectedAt.getTime();

      this.loggingService.info('WebSocket client disconnected', {
        service: 'RealtimeGateway',
        operation: 'handleDisconnect',
        userId: clientInfo.userId,
        hospitalId: clientInfo.hospitalId,
      }, {
        clientId,
        connectionDurationMs: connectionDuration,
        totalConnections: this.connectedClients.size - 1,
      });

      this.connectedClients.delete(clientId);
    } else {
      this.loggingService.debug('Unknown client disconnected', {
        service: 'RealtimeGateway',
        operation: 'handleDisconnect',
      }, {
        clientId,
      });
    }
  }

  @SubscribeMessage('message.send')
  async handleMessageSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawPayload: unknown,
  ): Promise<MessageSendAck> {
    const trustedUser = this.getTrustedUser(client);
    if (!trustedUser) {
      return {
        ok: false,
        error: { code: 'UNAUTHORIZED', message: 'Socket is not authenticated' },
      };
    }

    if (!RealtimeGateway.MESSAGE_SEND_ALLOWED_ROLES.has(trustedUser.role as Role)) {
      this.loggingService.warn('Socket message rejected - role not permitted', {
        service: 'RealtimeGateway',
        operation: 'handleMessageSend',
        userId: trustedUser.userId,
        hospitalId: trustedUser.hospitalId,
        encounterId: undefined,
      }, {
        clientId: client.id,
        role: trustedUser.role,
      });

      return {
        ok: false,
        error: { code: 'FORBIDDEN', message: 'User role cannot send staff messages' },
      };
    }

    const correlationId = `ws-${randomUUID()}`;
    const payload = plainToInstance(SendMessageWsDto, rawPayload);
    const errors = await validate(payload);
    const trimmedContent = payload.content?.trim();
    const assetIds = [...new Set((payload.assetIds ?? []).filter((value) => Number.isInteger(value) && value > 0))];

    if (errors.length > 0 || (!trimmedContent && assetIds.length === 0)) {
      const message = errors.length > 0
        ? this.formatValidationErrors(errors)
        : 'content or assetIds is required';

      this.loggingService.warn('Socket message rejected - validation failed', {
        service: 'RealtimeGateway',
        operation: 'handleMessageSend',
        correlationId,
        userId: trustedUser.userId,
        hospitalId: trustedUser.hospitalId,
        encounterId: payload.encounterId,
      }, {
        clientId: client.id,
        error: message,
      });

      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message },
      };
    }

    const dto: CreateMessageDto = {
      content: trimmedContent,
      isInternal: payload.isInternal ?? false,
      assetIds,
    };

    try {
      const message = await this.messagingService.createMessage(
        payload.encounterId,
        trustedUser.hospitalId,
        trustedUser.userId,
        dto,
        correlationId,
      );

      this.loggingService.info('Socket message created successfully', {
        service: 'RealtimeGateway',
        operation: 'handleMessageSend',
        correlationId,
        userId: trustedUser.userId,
        hospitalId: trustedUser.hospitalId,
        encounterId: payload.encounterId,
      }, {
        clientId: client.id,
        messageId: message.id,
      });

      return { ok: true, message };
    } catch (error) {
      const mapped = this.mapMessageSendError(error);

      this.loggingService[mapped.code === 'INTERNAL_ERROR' ? 'error' : 'warn'](
        'Socket message send failed',
        {
          service: 'RealtimeGateway',
          operation: 'handleMessageSend',
          correlationId,
          userId: trustedUser.userId,
          hospitalId: trustedUser.hospitalId,
          encounterId: payload.encounterId,
        },
        mapped.code === 'INTERNAL_ERROR' && error instanceof Error ? error : undefined,
        {
          clientId: client.id,
          errorCode: mapped.code,
          errorMessage: mapped.message,
        },
      );

      return {
        ok: false,
        error: mapped,
      };
    }
  }

  emitEncounterUpdated(hospitalId: number, encounterId: number, payload: EncounterUpdatedPayload): void {
    try {
      const hospitalRoom = hospitalRoomKey(hospitalId);
      const encounterRoom = encounterRoomKey(encounterId);

      this.server.to(hospitalRoom).to(encounterRoom).emit(RealtimeEvents.EncounterUpdated, payload);

      this.loggingService.debug('Encounter update emitted', {
        service: 'RealtimeGateway',
        operation: 'emitEncounterUpdated',
        hospitalId,
        encounterId,
      }, {
        event: RealtimeEvents.EncounterUpdated,
      });
    } catch (error) {
      this.loggingService.error('Failed to emit encounter update', {
        service: 'RealtimeGateway',
        operation: 'emitEncounterUpdated',
        hospitalId,
        encounterId,
      }, error instanceof Error ? error : undefined);
    }
  }

  emitMessageCreated(hospitalId: number, encounterId: number, payload: MessageCreatedPayload): void {
    try {
      const hospitalRoom = hospitalRoomKey(hospitalId);
      const encounterRoom = encounterRoomKey(encounterId);

      this.server.to(hospitalRoom).to(encounterRoom).emit(RealtimeEvents.MessageCreated, payload);

      this.loggingService.debug('Message created event emitted', {
        service: 'RealtimeGateway',
        operation: 'emitMessageCreated',
        hospitalId,
        encounterId,
      }, {
        event: RealtimeEvents.MessageCreated,
      });
    } catch (error) {
      this.loggingService.error('Failed to emit message created', {
        service: 'RealtimeGateway',
        operation: 'emitMessageCreated',
        hospitalId,
        encounterId,
      }, error instanceof Error ? error : undefined);
    }
  }

  emitAlertCreated(hospitalId: number, encounterId: number, payload: AlertCreatedPayload): void {
    try {
      const hospitalRoom = hospitalRoomKey(hospitalId);
      const encounterRoom = encounterRoomKey(encounterId);

      this.server.to(hospitalRoom).to(encounterRoom).emit(RealtimeEvents.AlertCreated, payload);
    } catch (error) {
      this.logger.error({
        message: 'Failed to emit alert created',
        hospitalId,
        encounterId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  emitMessageRead(hospitalId: number, encounterId: number, payload: MessageReadPayload): void {
    try {
      const hospitalRoom = hospitalRoomKey(hospitalId);
      const encounterRoom = encounterRoomKey(encounterId);

      this.server.to(hospitalRoom).to(encounterRoom).emit(RealtimeEvents.MessageRead, payload);

      this.loggingService.debug('Message read event emitted', {
        service: 'RealtimeGateway',
        operation: 'emitMessageRead',
        hospitalId,
        encounterId,
      }, {
        event: RealtimeEvents.MessageRead,
      });
    } catch (error) {
      this.loggingService.error('Failed to emit message read', {
        service: 'RealtimeGateway',
        operation: 'emitMessageRead',
        hospitalId,
        encounterId,
      }, error instanceof Error ? error : undefined);
    }
  }

  emitAlertAcknowledged(hospitalId: number, encounterId: number, payload: AlertAcknowledgedPayload): void {
    try {
      const hospitalRoom = hospitalRoomKey(hospitalId);
      const encounterRoom = encounterRoomKey(encounterId);

      this.server.to(hospitalRoom).to(encounterRoom).emit(RealtimeEvents.AlertAcknowledged, payload);
    } catch (error) {
      this.logger.error({
        message: 'Failed to emit alert acknowledged',
        hospitalId,
        encounterId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  emitAlertResolved(hospitalId: number, encounterId: number, payload: AlertResolvedPayload): void {
    try {
      const hospitalRoom = hospitalRoomKey(hospitalId);
      const encounterRoom = encounterRoomKey(encounterId);

      this.server.to(hospitalRoom).to(encounterRoom).emit(RealtimeEvents.AlertResolved, payload);
    } catch (error) {
      this.logger.error({
        message: 'Failed to emit alert resolved',
        hospitalId,
        encounterId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  getConnectionStats() {
    const stats = {
      totalConnections: this.connectedClients.size,
      connectionsByHospital: new Map<number, number>(),
    };

    for (const client of this.connectedClients.values()) {
      const count = stats.connectionsByHospital.get(client.hospitalId) || 0;
      stats.connectionsByHospital.set(client.hospitalId, count + 1);
    }

    return stats;
  }

  private extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.length > 0) {
      return authToken;
    }

    const header = client.handshake.headers?.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice('Bearer '.length).trim();
    }

    return null;
  }

  private getEncounterIdsFromHandshake(client: Socket): number[] {
    const ids = client.handshake.auth?.encounterIds;
    if (Array.isArray(ids)) {
      return ids.map((value) => Number(value)).filter((value) => Number.isFinite(value));
    }
    return [];
  }

  private getTrustedUser(client: Socket): TrustedRealtimeUser | null {
    const user = client.data.user as TrustedRealtimeUser | undefined;
    return user?.userId && user?.hospitalId ? user : null;
  }

  private formatValidationErrors(errors: Awaited<ReturnType<typeof validate>>): string {
    return errors
      .flatMap((error) => Object.values(error.constraints ?? {}))
      .join(', ');
  }

  private mapMessageSendError(error: unknown): { code: string; message: string } {
    if (error instanceof NotFoundException) {
      return { code: 'NOT_FOUND', message: error.message };
    }
    if (error instanceof ForbiddenException) {
      return { code: 'FORBIDDEN', message: error.message };
    }
    if (error instanceof BadRequestException) {
      return { code: 'VALIDATION_ERROR', message: error.message };
    }
    return { code: 'INTERNAL_ERROR', message: 'Failed to send message' };
  }
}
