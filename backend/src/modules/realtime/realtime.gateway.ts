//backend/src/modules/realtime/realtime.gateway.ts
// realtime.gateway.ts
// Written by: John Surette
// Date Created: Dec 8 2025
// Last Edited: Jan 6 2026
// WebSocket gateway (Socket.IO) for pushing live updates to patient + hospital apps.

import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import jwt from 'jsonwebtoken';
import type { Server, Socket } from 'socket.io';

import { PrismaService } from '../prisma/prisma.service';
import { RealtimeEvents } from './realtime.events';
import { encounterRoomKey, hospitalRoomKey } from './realtime.rooms';

type StaffSocketClaims = {
  userId: number;
  hospitalId: number;
  role?: string;
};

@WebSocketGateway({
  cors: { origin: true, credentials: true },
})
export class RealtimeGateway implements OnGatewayConnection {
  @WebSocketServer()
  private readonly server!: Server;

  constructor(private readonly prisma: PrismaService) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = this.extractToken(client);
    if (!token) {
      client.disconnect();
      return;
    }

    const secret = process.env.JWT_SECRET ?? 'dev-secret';

    try {
      const claims = jwt.verify(token, secret) as StaffSocketClaims;

      if (!claims?.userId || !claims?.hospitalId) {
        client.disconnect();
        return;
      }

      client.data.user = claims;
      await client.join(hospitalRoomKey(claims.hospitalId));

      const requestedEncounterIds = this.getEncounterIdsFromHandshake(client);
      if (requestedEncounterIds.length > 0) {
        const encounters = await this.prisma.encounter.findMany({
          where: {
            id: { in: requestedEncounterIds },
            hospitalId: claims.hospitalId,
          },
          select: { id: true },
        });

        for (const encounter of encounters) {
          await client.join(encounterRoomKey(encounter.id));
        }
      }
    } catch (error) {
      client.disconnect();
    }
  }

  emitEncounterUpdated(hospitalId: number, encounterId: number, payload: unknown): void {
    const hospitalRoom = hospitalRoomKey(hospitalId);
    const encounterRoom = encounterRoomKey(encounterId);

    this.server.to(hospitalRoom).emit(RealtimeEvents.EncounterUpdated, payload);
    this.server.to(encounterRoom).emit(RealtimeEvents.EncounterUpdated, payload);
  }

  emitMessageCreated(hospitalId: number, encounterId: number, payload: unknown): void {
    const hospitalRoom = hospitalRoomKey(hospitalId);
    const encounterRoom = encounterRoomKey(encounterId);

    this.server.to(hospitalRoom).emit(RealtimeEvents.MessageCreated, payload);
    this.server.to(encounterRoom).emit(RealtimeEvents.MessageCreated, payload);
  }

  emitAlertCreated(hospitalId: number, encounterId: number, payload: unknown): void {
    const hospitalRoom = hospitalRoomKey(hospitalId);
    const encounterRoom = encounterRoomKey(encounterId);

    this.server.to(hospitalRoom).emit(RealtimeEvents.AlertCreated, payload);
    this.server.to(encounterRoom).emit(RealtimeEvents.AlertCreated, payload);
  }

  emitAlertAcknowledged(hospitalId: number, encounterId: number, payload: unknown): void {
    const hospitalRoom = hospitalRoomKey(hospitalId);
    const encounterRoom = encounterRoomKey(encounterId);

    this.server.to(hospitalRoom).emit(RealtimeEvents.AlertAcknowledged, payload);
    this.server.to(encounterRoom).emit(RealtimeEvents.AlertAcknowledged, payload);
  }

  emitAlertResolved(hospitalId: number, encounterId: number, payload: unknown): void {
    const hospitalRoom = hospitalRoomKey(hospitalId);
    const encounterRoom = encounterRoomKey(encounterId);

    this.server.to(hospitalRoom).emit(RealtimeEvents.AlertResolved, payload);
    this.server.to(encounterRoom).emit(RealtimeEvents.AlertResolved, payload);
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
