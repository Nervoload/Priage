// HospitalApp/src/shared/realtime/socket.ts
// John Surette
// Dec 8, 2025
// socket.ts
// Initialize Socket.IO client pointing at the local NestJS backend.

import { io, Socket } from 'socket.io-client';
import { API_BASE_URL, notifyDemoAccessRequired } from '../api/client';
import type { Message } from '../types/domain';
import {
  isStaticDemoMode,
  sendDemoStaffMessage,
  trackDemoEvent,
} from '../../../../DemoShared/src/staticDemo';

let _socket: Socket | null = null;

type SocketConnectError = Error & {
  description?: unknown;
  data?: unknown;
};

function serializeSocketErrorFragment(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (value == null) {
    return '';
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function socketErrorDetails(error: SocketConnectError): string {
  return [
    error.message,
    serializeSocketErrorFragment(error.description),
    serializeSocketErrorFragment(error.data),
  ]
    .filter(Boolean)
    .join(' ');
}

function handleSocketAccessError(error: SocketConnectError): void {
  const details = socketErrorDetails(error);
  if (details.includes('Demo access required') || details.includes('403')) {
    notifyDemoAccessRequired();
  }
}

/**
 * Get (or create) the singleton Socket.IO connection.
 * Authentication is provided by the backend auth cookie. This is the only
 * realtime transport used by the hospital app; REST covers initial loads and
 * reconnect reconciliation.
 */
export function getSocket(): Socket {
  if (isStaticDemoMode()) {
    throw new Error('Static demo mode does not create a Socket.IO connection');
  }
  if (!_socket) {
    _socket = io(API_BASE_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      autoConnect: false,
    });
    _socket.on('connect_error', (error) => {
      handleSocketAccessError(error as SocketConnectError);
    });
  }
  return _socket;
}

type MessageSendAck =
  | { ok: true; message: Message }
  | { ok: false; error: { code: string; message: string } };

type EncounterSubscribeAck =
  | { ok: true; subscribedEncounterIds: number[] }
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
      handleSocketAccessError(error as SocketConnectError);
      reject(error);
    };

    socket.once('connect', handleConnect);
    socket.once('connect_error', handleError);
    socket.connect();
  });
}

/** Connect the socket (call after login) */
export function connectSocket(): void {
  if (isStaticDemoMode()) return;
  const socket = getSocket();
  if (!socket.connected) {
    socket.connect();
  }
}

export async function subscribeToEncounterRealtime(encounterIds: number[]): Promise<number[]> {
  if (isStaticDemoMode()) {
    trackDemoEvent('static_demo_realtime_subscribed', { encounterCount: encounterIds.length });
    return encounterIds;
  }
  const socket = getSocket();
  await ensureConnected(socket);
  const ack = await new Promise<EncounterSubscribeAck>((resolve, reject) => {
    const handleDisconnect = () => reject(new Error('Socket disconnected before subscription acknowledgement'));
    socket.emit('encounters.subscribe', { encounterIds }, (response: EncounterSubscribeAck) => {
      socket.off('disconnect', handleDisconnect);
      resolve(response);
    });
    socket.once('disconnect', handleDisconnect);
  });
  if (!ack.ok) throw new Error(ack.error.message);
  return ack.subscribedEncounterIds;
}

export async function sendMessageViaSocket(
  encounterId: number,
  content: string,
  isInternal = false,
): Promise<Message> {
  if (isStaticDemoMode()) {
    return sendDemoStaffMessage(encounterId, content) as Message;
  }
  const socket = getSocket();
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
  if (isStaticDemoMode()) return;
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
}
