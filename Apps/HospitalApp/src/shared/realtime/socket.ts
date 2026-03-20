// HospitalApp/src/shared/realtime/socket.ts
// John Surette
// Dec 8, 2025
// socket.ts
// Initialize Socket.IO client pointing at the local NestJS backend.

import { io, Socket } from 'socket.io-client';
import {
  API_BASE_URL,
  isDemoAccessRequiredResponse,
  notifyDemoAccessRequired,
} from '../api/client';
import type { Message } from '../types/domain';

let _socket: Socket | null = null;
let demoAccessProbeInFlight: Promise<void> | null = null;

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

async function probeDemoAccessGate(): Promise<void> {
  if (demoAccessProbeInFlight) {
    return demoAccessProbeInFlight;
  }

  demoAccessProbeInFlight = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        credentials: 'include',
      });
      const body = response.ok ? '' : await response.text().catch(() => '');
      if (isDemoAccessRequiredResponse(response.status, body)) {
        notifyDemoAccessRequired();
      }
    } catch {
      // If the backend is down we leave normal reconnect/error handling alone.
    } finally {
      demoAccessProbeInFlight = null;
    }
  })();

  return demoAccessProbeInFlight;
}

function handleSocketAccessError(error: SocketConnectError): void {
  const details = socketErrorDetails(error);
  if (details.includes('Demo access required') || details.includes('403')) {
    notifyDemoAccessRequired();
    return;
  }

  void probeDemoAccessGate();
}

/**
 * Get (or create) the singleton Socket.IO connection.
 * Authentication is provided by the backend auth cookie. This is the only
 * realtime transport used by the hospital app; REST covers initial loads and
 * reconnect reconciliation.
 */
export function getSocket(): Socket {
  if (!_socket) {
    _socket = io(API_BASE_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      autoConnect: false,
    });
    _socket.on('connect_error', (error) => {
      handleSocketAccessError(error as SocketConnectError);
    });
    _socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        void probeDemoAccessGate();
      }
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
  const socket = getSocket();
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
