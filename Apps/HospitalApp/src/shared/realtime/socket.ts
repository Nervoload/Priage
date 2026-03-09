// HospitalApp/src/shared/realtime/socket.ts
// John Surette
// Dec 8, 2025
// socket.ts
// Initialize Socket.IO client pointing at the local NestJS backend.

import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../api/client';
import type { Message } from '../types/domain';

let _socket: Socket | null = null;

/**
 * Get (or create) the singleton Socket.IO connection.
 * Reads the JWT from localStorage so it must be called after login. This is the
 * only realtime transport used by the hospital app; REST covers initial loads
 * and reconnect reconciliation.
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

type MessageSendAck =
  | { ok: true; message: Message }
  | { ok: false; error: { code: string; message: string } };

async function ensureConnected(socket: Socket): Promise<void> {
  if (socket.connected) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const handleConnect = () => {
      socket.off('connect_error', handleError);
      resolve();
    };
    const handleError = (error: Error) => {
      socket.off('connect', handleConnect);
      reject(error);
    };

    socket.once('connect', handleConnect);
    socket.once('connect_error', handleError);
    socket.connect();
  });
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

export async function sendMessageViaSocket(
  encounterId: number,
  content: string,
  isInternal = false,
): Promise<Message> {
  const socket = getSocket();
  socket.auth = { token: localStorage.getItem('authToken') ?? '' };
  await ensureConnected(socket);

  const ack = await new Promise<MessageSendAck>((resolve, reject) => {
    const handleDisconnect = () => {
      reject(new Error('Socket disconnected before message acknowledgement'));
    };

    socket.emit(
      'message.send',
      { encounterId, content, isInternal },
      (response: MessageSendAck) => {
        socket.off('disconnect', handleDisconnect);
        resolve(response);
      },
    );

    socket.once('disconnect', handleDisconnect);
  });

  if (!ack.ok) {
    throw new Error(ack.error.message);
  }

  return ack.message;
}

/** Disconnect and destroy the socket (call on logout) */
export function disconnectSocket(): void {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
}
