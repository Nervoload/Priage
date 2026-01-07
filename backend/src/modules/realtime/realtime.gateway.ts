//backend/src/modules/realtime/realtime.gateway.ts
// realtime.gateway.ts
// Written by: John Surette
// Date Created: Dec 8 2025
// Last Edited: Jan 6 2026
// WebSocket gateway (Socket.IO) for pushing live updates to patient + hospital apps.
// Auth is intentionally skipped for prototype; clients can join rooms freely (lock down later).

import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

import { RealtimeEvents } from './realtime.events';
import { encounterRoomKey, hospitalRoomKey } from './realtime.rooms';

@WebSocketGateway({
  cors: { origin: true, credentials: true },
})
export class RealtimeGateway {
  @WebSocketServer()
  private readonly server!: Server;

  // --- Room join handlers (client-driven) ---

  @SubscribeMessage(RealtimeEvents.JoinHospitalRoom)
  handleJoinHospitalRoom(
    @MessageBody() body: { hospitalName: string },
    @ConnectedSocket() socket: Socket,
  ): { joined: string } {
    const room = hospitalRoomKey(body.hospitalName);
    void socket.join(room);
    return { joined: room };
  }

  @SubscribeMessage(RealtimeEvents.JoinEncounterRoom)
  handleJoinEncounterRoom(
    @MessageBody() body: { encounterId: number },
    @ConnectedSocket() socket: Socket,
  ): { joined: string } {
    const room = encounterRoomKey(body.encounterId);
    void socket.join(room);
    return { joined: room };
  }

  // --- Broadcast helpers used by services ---

  emitEncounterCreated(hospitalName: string, payload: unknown): void {
    const room = hospitalRoomKey(hospitalName);
    this.server.to(room).emit(RealtimeEvents.EncounterCreated, payload);
  }

  emitEncounterUpdated(hospitalName: string, encounterId: number, payload: unknown): void {
    const hospitalRoom = hospitalRoomKey(hospitalName);
    const encounterRoom = encounterRoomKey(encounterId);

    this.server.to(hospitalRoom).emit(RealtimeEvents.EncounterUpdated, payload);
    this.server.to(encounterRoom).emit(RealtimeEvents.EncounterUpdated, payload);
  }

  emitTriageNoteCreated(hospitalName: string, encounterId: number, payload: unknown): void {
    const hospitalRoom = hospitalRoomKey(hospitalName);
    const encounterRoom = encounterRoomKey(encounterId);

    this.server.to(hospitalRoom).emit(RealtimeEvents.TriageNoteCreated, payload);
    this.server.to(encounterRoom).emit(RealtimeEvents.TriageNoteCreated, payload);
  }

  emitMessageCreated(hospitalName: string, encounterId: number, payload: unknown): void {
    const hospitalRoom = hospitalRoomKey(hospitalName);
    const encounterRoom = encounterRoomKey(encounterId);

    this.server.to(hospitalRoom).emit(RealtimeEvents.MessageCreated, payload);
    this.server.to(encounterRoom).emit(RealtimeEvents.MessageCreated, payload);
  }
}
