// HospitalApp/src/shared/realtime/socket.ts
// John Surette
// Dec 8, 2025
// socket.ts
// Initialize Socket.IO client pointing at the local NestJS backend.

import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../api/client';

let _socket: Socket | null = null;

/**
 * Get (or create) the singleton Socket.IO connection.
 * Reads the JWT from localStorage so it must be called after login.
 *
 * Phase 6.2: Add helper methods here for message-specific subscriptions:
 *   - subscribeToMessages(encounterId, callback) — listen for 'message.created'
 *     events filtered to a specific encounter, for real-time chat in ChatPanel.
 *   - sendMessageViaSocket(encounterId, content) — emit 'message.send' event
 *     to the gateway instead of using the REST API, for lower-latency chat.
 */
export function getSocket(): Socket {
  if (!_socket) {
    _socket = io(API_BASE_URL, {
      auth: {
        token: localStorage.getItem('authToken') ?? '',
      },
      transports: ['websocket', 'polling'],
      autoConnect: false,
    });
  }
  return _socket;
}

/** Connect the socket (call after login) */
export function connectSocket(): void {
  const socket = getSocket();
  // Refresh auth token in case it changed
  socket.auth = { token: localStorage.getItem('authToken') ?? '' };
  if (!socket.connected) {
    socket.connect();
  }
}

/** Disconnect and destroy the socket (call on logout) */
export function disconnectSocket(): void {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
}
