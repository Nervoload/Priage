//backend/src/modules/realtime/realtime.gateway.ts
// realtime.gateway.ts
// Written by: John Surette
// Date Created: Dec 8 2025
// Last Edited: Feb 28 2026
// WebSocket gateway (Socket.IO) for pushing live updates to patient + hospital apps.

import { BadRequestException, ForbiddenException, Inject, Logger, NotFoundException, OnModuleDestroy, forwardRef } from '@nestjs/common';
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
import type Redis from 'ioredis';

import { readCookie, STAFF_AUTH_COOKIE } from '../../common/http/auth-cookie.util';
import { getAllowedCorsOrigins } from '../../common/http/cors.util';
import { DEMO_COOKIE_NAME } from '../demo-access/demo-access.guard';
import { LoggingService } from '../logging/logging.service';
import { CreateMessageDto } from '../messaging/dto/create-message.dto';
import { MessagingService } from '../messaging/messaging.service';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import { ClinicalAccessService } from '../clinical-access/clinical-access.service';
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
import {
  clinicalEncounterRoomKey,
  clinicalHospitalRoomKey,
  encounterRoomKey,
  hospitalRoomKey,
} from './realtime.rooms';

type MessageSendAck =
  | { ok: true; message: unknown }
  | { ok: false; error: { code: string; message: string } };

type EncounterSubscribeAck =
  | { ok: true; subscribedEncounterIds: number[] }
  | { ok: false; error: { code: string; message: string } };

const RESERVE_SOCKET_SCRIPT = `
local now = tonumber(ARGV[1])
local staleBefore = now - tonumber(ARGV[2])
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', staleBefore)
if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[3]) then return 0 end
redis.call('ZADD', KEYS[1], now, ARGV[4])
redis.call('PEXPIRE', KEYS[1], tonumber(ARGV[2]) * 2)
return 1
`;

@WebSocketGateway({
  cors: { origin: getAllowedCorsOrigins(), credentials: true },
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
  private readonly logger = new Logger(RealtimeGateway.name);
  private static readonly MESSAGE_SEND_ALLOWED_ROLES = new Set<Role>([
    Role.NURSE,
    Role.DOCTOR,
    Role.ADMIN,
  ]);
  private static readonly CLINICAL_EVENT_ROLES = new Set<Role>([
    Role.NURSE,
    Role.DOCTOR,
    Role.ADMIN,
  ]);

  @WebSocketServer()
  private readonly server!: Server;

  private connectedClients = new Map<string, {
    userId: number;
    hospitalId: number;
    connectedAt: Date;
    connectionKey: string;
    connectionMember: string;
  }>();
  private socketHeartbeatTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly loggingService: LoggingService,
    private readonly realtimeRedisAdapter: RealtimeRedisAdapterService,
    private readonly realtimeAuthService: RealtimeAuthService,
    private readonly clinicalAccess: ClinicalAccessService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(forwardRef(() => MessagingService))
    private readonly messagingService: MessagingService,
  ) {}

  async afterInit(server: Server) {
    try {
      await this.realtimeRedisAdapter.attach(server);
    } catch (error) {
      this.logger.error(
        'Failed to attach Redis adapter',
        error instanceof Error ? error.stack : undefined,
      );
      if ((process.env.NODE_ENV || '').trim().toLowerCase() === 'production') {
        throw error;
      }
    }
    this.logger.log('WebSocket Gateway initialized');
    this.logger.log('WebSocket CORS configured for explicit origins');

    this.loggingService.info('WebSocket Gateway initialized', {
      service: 'RealtimeGateway',
      operation: 'afterInit',
    }, {
      corsEnabled: true,
      corsOriginsConfigured: true,
    });

    server.on('error', (error) => {
      this.logger.error({
        message: 'WebSocket server error',
        error: error.message,
        stack: error.stack,
      });

      void this.loggingService.error('WebSocket server error', {
        service: 'RealtimeGateway',
        operation: 'serverError',
      }, error);
    });

    this.socketHeartbeatTimer = setInterval(() => {
      const now = Date.now();
      const staleMs = this.readPositiveIntEnv('SOCKET_CONNECTION_STALE_MS', 120_000);
      for (const client of this.connectedClients.values()) {
        void this.redis
          .zadd(client.connectionKey, now, client.connectionMember)
          .then(() => this.redis.pexpire(client.connectionKey, staleMs * 2))
          .catch(() => undefined);
      }
    }, 30_000);
  }

  async handleConnection(client: Socket): Promise<void> {
    const clientId = client.id;
    if (!await this.consumeSocketAttempt(client)) {
      client.disconnect();
      return;
    }

    // Demo gate: reject WebSocket connections when DEMO_ACCESS_CODE is set
    // and the client doesn't carry a valid demo cookie.
    const demoCode = process.env.DEMO_ACCESS_CODE?.trim();
    if (demoCode) {
      const demoCookie = readCookie(client.handshake.headers?.cookie, DEMO_COOKIE_NAME);
      if (demoCookie !== demoCode) {
        this.logger.warn({ message: 'WebSocket rejected - missing demo access cookie', clientId });
        client.disconnect();
        return;
      }
    }

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
        await this.loggingService.warn('Connection rejected - no authentication token', {
          service: 'RealtimeGateway',
          operation: 'handleConnection',
        }, {
          clientId,
        });
        client.disconnect();
        return;
      }

      const trustedUser = await this.realtimeAuthService.validateStaffToken(token, client.handshake.headers?.cookie);
      const connectionKey = `socket:user:${trustedUser.userId}:connections`;
      if (!await this.reserveSocketConnection(connectionKey, clientId)) {
        client.disconnect();
        return;
      }
      client.data.user = trustedUser;

      this.connectedClients.set(clientId, {
        userId: trustedUser.userId,
        hospitalId: trustedUser.hospitalId,
        connectedAt: new Date(),
        connectionKey,
        connectionMember: clientId,
      });

      await client.join(hospitalRoomKey(trustedUser.hospitalId));
      if (this.canReceiveHospitalClinicalEvents(trustedUser.role as Role)) {
        await client.join(clinicalHospitalRoomKey(trustedUser.hospitalId));
      }

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
            if (
              this.canReceiveClinicalEvents(trustedUser.role as Role)
              && await this.canAccessEncounter(trustedUser, encounter.id)
            ) {
              await client.join(clinicalEncounterRoomKey(encounter.id));
            }
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
          await this.loggingService.error('Failed to subscribe to encounter rooms', {
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
      await this.loggingService.warn('Connection rejected during authentication', {
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
      void this.redis.zrem(clientInfo.connectionKey, clientInfo.connectionMember).catch(() => undefined);
    } else {
      this.loggingService.debug('Unknown client disconnected', {
        service: 'RealtimeGateway',
        operation: 'handleDisconnect',
      }, {
        clientId,
      });
    }
  }

  onModuleDestroy(): void {
    if (this.socketHeartbeatTimer) {
      clearInterval(this.socketHeartbeatTimer);
      this.socketHeartbeatTimer = undefined;
    }
  }

  @SubscribeMessage('message.send')
  async handleMessageSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawPayload: unknown,
  ): Promise<MessageSendAck> {
    const trustedUser = await this.revalidateTrustedUser(client);
    if (!trustedUser) {
      client.disconnect();
      return {
        ok: false,
        error: { code: 'UNAUTHORIZED', message: 'Socket is not authenticated' },
      };
    }

    if (!RealtimeGateway.MESSAGE_SEND_ALLOWED_ROLES.has(trustedUser.role as Role)) {
      await this.loggingService.warn('Socket message rejected - role not permitted', {
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

      await this.loggingService.warn('Socket message rejected - validation failed', {
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
      await this.clinicalAccess.assertClinicalEncounterAccess({
        userId: trustedUser.userId,
        hospitalId: trustedUser.hospitalId,
        role: trustedUser.role as Role,
      }, payload.encounterId);
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

      if (mapped.code === 'INTERNAL_ERROR') {
        await this.loggingService.error(
          'Socket message send failed',
          {
            service: 'RealtimeGateway',
            operation: 'handleMessageSend',
            correlationId,
            userId: trustedUser.userId,
            hospitalId: trustedUser.hospitalId,
            encounterId: payload.encounterId,
          },
          error instanceof Error ? error : undefined,
          {
            clientId: client.id,
            errorCode: mapped.code,
            errorMessage: mapped.message,
          },
        );
      } else {
        await this.loggingService.warn(
          'Socket message send failed',
          {
            service: 'RealtimeGateway',
            operation: 'handleMessageSend',
            correlationId,
            userId: trustedUser.userId,
            hospitalId: trustedUser.hospitalId,
            encounterId: payload.encounterId,
          },
          {
            clientId: client.id,
            errorCode: mapped.code,
            errorMessage: mapped.message,
          },
        );
      }

      return {
        ok: false,
        error: mapped,
      };
    }
  }

  @SubscribeMessage('encounters.subscribe')
  async handleEncounterSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawPayload: unknown,
  ): Promise<EncounterSubscribeAck> {
    const trustedUser = await this.revalidateTrustedUser(client);
    if (!trustedUser) {
      client.disconnect();
      return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Socket is not authenticated' } };
    }

    const requestedIds = this.normalizeEncounterIds(
      rawPayload && typeof rawPayload === 'object'
        ? (rawPayload as { encounterIds?: unknown }).encounterIds
        : undefined,
    );
    const maxSubscriptions = this.readPositiveIntEnv('SOCKET_ENCOUNTER_SUBSCRIPTION_CAP', 250);
    if (requestedIds.length > maxSubscriptions) {
      return {
        ok: false,
        error: { code: 'LIMIT_EXCEEDED', message: 'Too many encounter subscriptions requested' },
      };
    }

    const encounters = await this.prisma.encounter.findMany({
      where: {
        id: { in: requestedIds },
        hospitalId: trustedUser.hospitalId,
      },
      select: { id: true },
    });
    const sameHospitalIds = encounters.map((encounter) => encounter.id);
    const accessible = await this.clinicalAccess.getClinicallyAccessibleEncounterIds(
      {
        userId: trustedUser.userId,
        hospitalId: trustedUser.hospitalId,
        role: trustedUser.role as Role,
      },
      sameHospitalIds,
    );
    const existingClinicalRooms = new Set(
      [...client.rooms].filter((room) => room.startsWith('encounter:') && room.endsWith(':clinical')),
    );
    const newClinicalSubscriptions = [...accessible]
      .filter((encounterId) => !existingClinicalRooms.has(clinicalEncounterRoomKey(encounterId)));
    if (existingClinicalRooms.size + newClinicalSubscriptions.length > maxSubscriptions) {
      return {
        ok: false,
        error: { code: 'LIMIT_EXCEEDED', message: 'Encounter subscription cap reached' },
      };
    }

    for (const encounterId of sameHospitalIds) {
      await client.join(encounterRoomKey(encounterId));
      if (accessible.has(encounterId)) {
        await client.join(clinicalEncounterRoomKey(encounterId));
      }
    }

    return { ok: true, subscribedEncounterIds: [...accessible] };
  }

  async emitEncounterUpdated(
    hospitalId: number,
    encounterId: number,
    payload: EncounterUpdatedPayload,
  ): Promise<void> {
    try {
      const hospitalRoom = hospitalRoomKey(hospitalId);
      const encounterRoom = encounterRoomKey(encounterId);
      const clinicalHospitalRoom = clinicalHospitalRoomKey(hospitalId);
      const clinicalEncounterRoom = clinicalEncounterRoomKey(encounterId);
      const operationalPayload = this.toOperationalEncounterUpdatePayload(payload);

      this.server.to(hospitalRoom).to(encounterRoom).emit(RealtimeEvents.EncounterUpdated, operationalPayload);
      this.server.to(clinicalHospitalRoom).to(clinicalEncounterRoom).emit(RealtimeEvents.EncounterUpdated, operationalPayload);

      this.loggingService.debug('Encounter update emitted', {
        service: 'RealtimeGateway',
        operation: 'emitEncounterUpdated',
        hospitalId,
        encounterId,
      }, {
        event: RealtimeEvents.EncounterUpdated,
      });
    } catch (error) {
      await this.loggingService.error('Failed to emit encounter update', {
        service: 'RealtimeGateway',
        operation: 'emitEncounterUpdated',
        hospitalId,
        encounterId,
      }, error instanceof Error ? error : undefined);
    }
  }

  async emitMessageCreated(
    hospitalId: number,
    encounterId: number,
    payload: MessageCreatedPayload,
  ): Promise<void> {
    try {
      const hospitalRoom = clinicalHospitalRoomKey(hospitalId);
      const encounterRoom = clinicalEncounterRoomKey(encounterId);

      this.server.to(hospitalRoom).to(encounterRoom).emit(RealtimeEvents.MessageCreated, {
        ...payload,
        metadata: { messageId: payload.metadata.messageId },
      });

      this.loggingService.debug('Message created event emitted', {
        service: 'RealtimeGateway',
        operation: 'emitMessageCreated',
        hospitalId,
        encounterId,
      }, {
        event: RealtimeEvents.MessageCreated,
      });
    } catch (error) {
      await this.loggingService.error('Failed to emit message created', {
        service: 'RealtimeGateway',
        operation: 'emitMessageCreated',
        hospitalId,
        encounterId,
      }, error instanceof Error ? error : undefined);
    }
  }

  async emitAlertCreated(
    hospitalId: number,
    encounterId: number,
    payload: AlertCreatedPayload,
  ): Promise<void> {
    try {
      const hospitalRoom = clinicalHospitalRoomKey(hospitalId);
      const encounterRoom = clinicalEncounterRoomKey(encounterId);

      this.server.to(hospitalRoom).to(encounterRoom).emit(RealtimeEvents.AlertCreated, {
        ...payload,
        metadata: { alertId: payload.metadata.alertId },
      });
    } catch (error) {
      await this.loggingService.error(
        'Failed to emit alert created',
        {
          service: 'RealtimeGateway',
          operation: 'emitAlertCreated',
          hospitalId,
          encounterId,
        },
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  async emitMessageRead(
    hospitalId: number,
    encounterId: number,
    payload: MessageReadPayload,
  ): Promise<void> {
    try {
      const hospitalRoom = clinicalHospitalRoomKey(hospitalId);
      const encounterRoom = clinicalEncounterRoomKey(encounterId);

      this.server.to(hospitalRoom).to(encounterRoom).emit(RealtimeEvents.MessageRead, {
        ...payload,
        metadata: { messageId: payload.metadata.messageId },
      });

      this.loggingService.debug('Message read event emitted', {
        service: 'RealtimeGateway',
        operation: 'emitMessageRead',
        hospitalId,
        encounterId,
      }, {
        event: RealtimeEvents.MessageRead,
      });
    } catch (error) {
      await this.loggingService.error('Failed to emit message read', {
        service: 'RealtimeGateway',
        operation: 'emitMessageRead',
        hospitalId,
        encounterId,
      }, error instanceof Error ? error : undefined);
    }
  }

  async emitAlertAcknowledged(
    hospitalId: number,
    encounterId: number,
    payload: AlertAcknowledgedPayload,
  ): Promise<void> {
    try {
      const hospitalRoom = clinicalHospitalRoomKey(hospitalId);
      const encounterRoom = clinicalEncounterRoomKey(encounterId);

      this.server.to(hospitalRoom).to(encounterRoom).emit(RealtimeEvents.AlertAcknowledged, {
        ...payload,
        metadata: { alertId: payload.metadata.alertId },
      });
    } catch (error) {
      await this.loggingService.error(
        'Failed to emit alert acknowledged',
        {
          service: 'RealtimeGateway',
          operation: 'emitAlertAcknowledged',
          hospitalId,
          encounterId,
        },
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  async emitAlertResolved(
    hospitalId: number,
    encounterId: number,
    payload: AlertResolvedPayload,
  ): Promise<void> {
    try {
      const hospitalRoom = clinicalHospitalRoomKey(hospitalId);
      const encounterRoom = clinicalEncounterRoomKey(encounterId);

      this.server.to(hospitalRoom).to(encounterRoom).emit(RealtimeEvents.AlertResolved, {
        ...payload,
        metadata: { alertId: payload.metadata.alertId },
      });
    } catch (error) {
      await this.loggingService.error(
        'Failed to emit alert resolved',
        {
          service: 'RealtimeGateway',
          operation: 'emitAlertResolved',
          hospitalId,
          encounterId,
        },
        error instanceof Error ? error : new Error(String(error)),
      );
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

    const cookieToken = readCookie(client.handshake.headers?.cookie, STAFF_AUTH_COOKIE);
    if (cookieToken) {
      return cookieToken;
    }

    return null;
  }

  private getEncounterIdsFromHandshake(client: Socket): number[] {
    return this.normalizeEncounterIds(client.handshake.auth?.encounterIds);
  }

  private normalizeEncounterIds(rawIds: unknown): number[] {
    if (!Array.isArray(rawIds)) return [];
    return [...new Set(rawIds
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0))];
  }

  private canReceiveClinicalEvents(role: Role): boolean {
    return RealtimeGateway.CLINICAL_EVENT_ROLES.has(role);
  }

  private toOperationalEncounterUpdatePayload(payload: EncounterUpdatedPayload): EncounterUpdatedPayload {
    const metadata = payload.metadata ?? {};
    return {
      ...payload,
      metadata: {
        status: metadata.status,
        fromStatus: metadata.fromStatus,
        toStatus: metadata.toStatus,
        transition: metadata.transition,
        intake: metadata.intake,
        timestamps: metadata.timestamps,
      },
    };
  }

  private canReceiveHospitalClinicalEvents(role: Role): boolean {
    const careTeamRequired = ['1', 'true', 'yes', 'on'].includes(
      (process.env.CARE_TEAM_ACCESS_REQUIRED || '').trim().toLowerCase(),
    );
    return this.canReceiveClinicalEvents(role) && !careTeamRequired;
  }

  private async canAccessEncounter(user: TrustedRealtimeUser, encounterId: number): Promise<boolean> {
    try {
      await this.clinicalAccess.assertClinicalEncounterAccess({
        userId: user.userId,
        hospitalId: user.hospitalId,
        role: user.role as Role,
      }, encounterId);
      return true;
    } catch {
      return false;
    }
  }

  private async consumeSocketAttempt(client: Socket): Promise<boolean> {
    const key = `socket:attempt:${client.handshake.address || 'unknown'}`;
    const limit = Number.parseInt(process.env.SOCKET_CONNECTION_ATTEMPTS_PER_MINUTE || '30', 10);
    try {
      const count = await this.redis.incr(key);
      if (count === 1) await this.redis.expire(key, 60);
      return count <= limit;
    } catch {
      return false;
    }
  }

  private async reserveSocketConnection(key: string, member: string): Promise<boolean> {
    const limit = this.readPositiveIntEnv('SOCKET_CONNECTIONS_PER_USER', 5);
    const staleMs = this.readPositiveIntEnv('SOCKET_CONNECTION_STALE_MS', 120_000);
    const result = await this.redis.eval(
      RESERVE_SOCKET_SCRIPT,
      1,
      key,
      Date.now(),
      staleMs,
      limit,
      member,
    );
    return Number(result) === 1;
  }

  private readPositiveIntEnv(name: string, fallback: number): number {
    const parsed = Number.parseInt(process.env[name] || '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  private async revalidateTrustedUser(client: Socket): Promise<TrustedRealtimeUser | null> {
    const token = this.extractToken(client);
    if (!token) return null;
    try {
      const trustedUser = await this.realtimeAuthService.validateStaffToken(token, client.handshake.headers?.cookie);
      client.data.user = trustedUser;
      return trustedUser;
    } catch {
      return null;
    }
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
