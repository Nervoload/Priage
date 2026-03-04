// PatientApp/src/shared/realtime/socket.ts
// Socket.IO client for patient real-time updates.
// Note: The backend RealtimeGateway currently authenticates via JWT only.
// For patient sockets, we connect without auth and join encounter rooms
// via a future patient-socket auth strategy. For now, we use polling fallback
// to keep the architecture ready.

import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../api/client';

let _socket: Socket | null = null;

/**
 * Get (or create) the singleton Socket.IO connection for the patient.
 * Currently connects unauthenticated — the backend would need a patient
 * socket auth adapter for full real-time. We keep the plumbing ready.
 */
export function getSocket(): Socket {
  if (!_socket) {
    _socket = io(API_BASE_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: false,
    });
  }
  return _socket;
}

/** Connect the socket */
export function connectSocket(): void {
  const socket = getSocket();
  if (!socket.connected) {
    socket.connect();
  }
}

/** Disconnect and destroy the socket */
export function disconnectSocket(): void {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
}
