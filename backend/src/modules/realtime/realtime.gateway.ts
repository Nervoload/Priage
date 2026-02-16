//backend/src/modules/realtime/realtime.gateway.ts
// realtime.gateway.ts
// Written by: John Surette
// Date Created: Dec 8 2025
// Last Edited: Jan 6 2026
// WebSocket gateway (Socket.IO) for pushing live updates to patient + hospital apps.

import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import type { Server, Socket } from 'socket.io';

import { LoggingService } from '../logging/logging.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AlertAcknowledgedPayload,
  AlertCreatedPayload,
  AlertResolvedPayload,
  EncounterUpdatedPayload,
  MessageCreatedPayload,
  RealtimeEvents,
} from './realtime.events';
import { encounterRoomKey, hospitalRoomKey } from './realtime.rooms';

type StaffSocketClaims = {
  userId: number;
  hospitalId: number;
  role?: string;
};

@WebSocketGateway({
  cors: { origin: true, credentials: true },
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  private readonly server!: Server;

  private connectedClients = new Map<string, { userId: number; hospitalId: number; connectedAt: Date }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly loggingService: LoggingService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
    this.logger.log(`CORS enabled for all origins`);
    
    this.loggingService.info('WebSocket Gateway initialized', {
      service: 'RealtimeGateway',
      operation: 'afterInit',
    }, {
      corsEnabled: true,
    });
    
    // Set up server-level error handling
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
        this.logger.warn({
          message: 'Connection rejected: No authentication token',
          clientId,
        });
        
        this.loggingService.warn('Connection rejected - no authentication token', {
          service: 'RealtimeGateway',
          operation: 'handleConnection',
        }, {
          clientId,
        });
        
        client.disconnect();
        return;
      }

      const secret = process.env.JWT_SECRET;
      if (!secret) {
        this.loggingService.error('Connection rejected - JWT_SECRET is not configured', {
          service: 'RealtimeGateway',
          operation: 'handleConnection',
        }, new Error('JWT_SECRET environment variable is required'), {
          clientId,
        });
        client.disconnect();
        return;
      }

      let claims: StaffSocketClaims;
      try {
        claims = jwt.verify(token, secret) as StaffSocketClaims;
      } catch (jwtError) {
        this.logger.warn({
          message: 'Connection rejected: Invalid JWT token',
          clientId,
          error: jwtError instanceof Error ? jwtError.message : String(jwtError),
        });
        
        this.loggingService.warn('Connection rejected - invalid JWT token', {
          service: 'RealtimeGateway',
          operation: 'handleConnection',
        }, {
          clientId,
          error: jwtError instanceof Error ? jwtError.message : String(jwtError),
        });
        
        client.disconnect();
        return;
      }

      if (!claims?.userId || !claims?.hospitalId) {
        this.logger.warn({
          message: 'Connection rejected: Invalid token claims',
          clientId,
          claims,
        });
        
        this.loggingService.warn('Connection rejected - invalid token claims', {
          service: 'RealtimeGateway',
          operation: 'handleConnection',
        }, {
          clientId,
          hasClaims: !!claims,
          hasUserId: !!claims?.userId,
          hasHospitalId: !!claims?.hospitalId,
        });
        
        client.disconnect();
        return;
      }

      const user = await this.prisma.user.findUnique({
        where: { id: claims.userId },
        select: { id: true, hospitalId: true, role: true },
      });

      if (!user || user.hospitalId !== claims.hospitalId) {
        this.loggingService.warn('Connection rejected - token claims do not match current user state', {
          service: 'RealtimeGateway',
          operation: 'handleConnection',
        }, {
          clientId,
          tokenUserId: claims.userId,
          tokenHospitalId: claims.hospitalId,
          userFound: !!user,
          actualHospitalId: user?.hospitalId,
        });
        client.disconnect();
        return;
      }

      const trustedClaims: StaffSocketClaims = {
        userId: user.id,
        hospitalId: user.hospitalId,
        role: user.role,
      };

      client.data.user = trustedClaims;
      this.connectedClients.set(clientId, {
        userId: user.id,
        hospitalId: user.hospitalId,
        connectedAt: new Date(),
      });

      await client.join(hospitalRoomKey(user.hospitalId));
      
      this.logger.log({
        message: 'Client joined hospital room',
        clientId,
        userId: user.id,
        hospitalId: user.hospitalId,
        role: user.role,
      });
      
      this.loggingService.info('Client joined hospital room', {
        service: 'RealtimeGateway',
        operation: 'handleConnection',
        userId: user.id,
        hospitalId: user.hospitalId,
      }, {
        clientId,
        role: user.role,
      });

      const requestedEncounterIds = this.getEncounterIdsFromHandshake(client);
      if (requestedEncounterIds.length > 0) {
        try {
          const encounters = await this.prisma.encounter.findMany({
            where: {
              id: { in: requestedEncounterIds },
              hospitalId: user.hospitalId,
            },
            select: { id: true },
          });

          for (const encounter of encounters) {
            await client.join(encounterRoomKey(encounter.id));
          }

          this.logger.log({
            message: 'Client subscribed to encounter rooms',
            clientId,
            userId: user.id,
            requestedCount: requestedEncounterIds.length,
            subscribedCount: encounters.length,
            encounterIds: encounters.map(e => e.id),
          });
          
          this.loggingService.info('Client subscribed to encounter rooms', {
            service: 'RealtimeGateway',
            operation: 'handleConnection',
            userId: user.id,
            hospitalId: user.hospitalId,
          }, {
            clientId,
            requestedCount: requestedEncounterIds.length,
            subscribedCount: encounters.length,
            encounterIds: encounters.map(e => e.id),
          });
        } catch (dbError) {
          this.logger.error({
            message: 'Failed to subscribe to encounter rooms',
            clientId,
            userId: user.id,
            requestedEncounterIds,
            error: dbError instanceof Error ? dbError.message : String(dbError),
            stack: dbError instanceof Error ? dbError.stack : undefined,
          });
          
          this.loggingService.error('Failed to subscribe to encounter rooms', {
            service: 'RealtimeGateway',
            operation: 'handleConnection',
            userId: user.id,
            hospitalId: user.hospitalId,
          }, dbError instanceof Error ? dbError : undefined, {
            clientId,
            requestedEncounterIds,
          });
          // Don't disconnect - hospital room subscription is still valid
        }
      }

      this.logger.log({
        message: 'WebSocket connection established successfully',
        clientId,
        userId: user.id,
        hospitalId: user.hospitalId,
        totalConnections: this.connectedClients.size,
      });
      
      this.loggingService.info('WebSocket connection established successfully', {
        service: 'RealtimeGateway',
        operation: 'handleConnection',
        userId: user.id,
        hospitalId: user.hospitalId,
      }, {
        clientId,
        totalConnections: this.connectedClients.size,
      });
    } catch (error) {
      this.logger.error({
        message: 'Unexpected error during connection handling',
        clientId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      
      this.loggingService.error('Unexpected error during WebSocket connection', {
        service: 'RealtimeGateway',
        operation: 'handleConnection',
      }, error instanceof Error ? error : undefined, {
        clientId,
      });
      
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    const clientId = client.id;
    const clientInfo = this.connectedClients.get(clientId);
    
    if (clientInfo) {
      const connectionDuration = Date.now() - clientInfo.connectedAt.getTime();
      
      this.logger.log({
        message: 'WebSocket client disconnected',
        clientId,
        userId: clientInfo.userId,
        hospitalId: clientInfo.hospitalId,
        connectionDurationMs: connectionDuration,
        totalConnections: this.connectedClients.size - 1,
      });
      
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
      this.logger.log({
        message: 'Unknown client disconnected',
        clientId,
      });
      
      this.loggingService.debug('Unknown client disconnected', {
        service: 'RealtimeGateway',
        operation: 'handleDisconnect',
      }, {
        clientId,
      });
    }
  }

  emitEncounterUpdated(hospitalId: number, encounterId: number, payload: EncounterUpdatedPayload): void {
    try {
      const hospitalRoom = hospitalRoomKey(hospitalId);
      const encounterRoom = encounterRoomKey(encounterId);

      this.server.to(hospitalRoom).emit(RealtimeEvents.EncounterUpdated, payload);
      this.server.to(encounterRoom).emit(RealtimeEvents.EncounterUpdated, payload);

      this.logger.debug({
        message: 'Encounter update emitted',
        hospitalId,
        encounterId,
        event: RealtimeEvents.EncounterUpdated,
      });
      
      this.loggingService.debug('Encounter update emitted', {
        service: 'RealtimeGateway',
        operation: 'emitEncounterUpdated',
        hospitalId,
        encounterId,
      }, {
        event: RealtimeEvents.EncounterUpdated,
      });
    } catch (error) {
      this.logger.error({
        message: 'Failed to emit encounter update',
        hospitalId,
        encounterId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      
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

      this.server.to(hospitalRoom).emit(RealtimeEvents.MessageCreated, payload);
      this.server.to(encounterRoom).emit(RealtimeEvents.MessageCreated, payload);

      this.logger.debug({
        message: 'Message created event emitted',
        hospitalId,
        encounterId,
      });
    } catch (error) {
      this.logger.error({
        message: 'Failed to emit message created',
        hospitalId,
        encounterId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  emitAlertCreated(hospitalId: number, encounterId: number, payload: AlertCreatedPayload): void {
    try {
      const hospitalRoom = hospitalRoomKey(hospitalId);
      const encounterRoom = encounterRoomKey(encounterId);

      this.server.to(hospitalRoom).emit(RealtimeEvents.AlertCreated, payload);
      this.server.to(encounterRoom).emit(RealtimeEvents.AlertCreated, payload);

      this.logger.debug({
        message: 'Alert created event emitted',
        hospitalId,
        encounterId,
      });
    } catch (error) {
      this.logger.error({
        message: 'Failed to emit alert created',
        hospitalId,
        encounterId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  emitAlertAcknowledged(hospitalId: number, encounterId: number, payload: AlertAcknowledgedPayload): void {
    try {
      const hospitalRoom = hospitalRoomKey(hospitalId);
      const encounterRoom = encounterRoomKey(encounterId);

      this.server.to(hospitalRoom).emit(RealtimeEvents.AlertAcknowledged, payload);
      this.server.to(encounterRoom).emit(RealtimeEvents.AlertAcknowledged, payload);

      this.logger.debug({
        message: 'Alert acknowledged event emitted',
        hospitalId,
        encounterId,
      });
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

      this.server.to(hospitalRoom).emit(RealtimeEvents.AlertResolved, payload);
      this.server.to(encounterRoom).emit(RealtimeEvents.AlertResolved, payload);

      this.logger.debug({
        message: 'Alert resolved event emitted',
        hospitalId,
        encounterId,
      });
    } catch (error) {
      this.logger.error({
        message: 'Failed to emit alert resolved',
        hospitalId,
        encounterId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get connection statistics for monitoring
   */
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
}
