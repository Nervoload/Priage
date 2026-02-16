// HospitalApp/src/shared/api/messaging.ts
// API calls for messaging — mirrors backend MessagingController.

import { client } from './client';
import type { Message } from '../types/domain';

// ─── Response types ─────────────────────────────────────────────────────────

interface PaginatedMessages {
  data: Message[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

// ─── List messages for an encounter ─────────────────────────────────────────

export interface ListMessagesParams {
  page?: number;
  limit?: number;
}

export async function listMessages(
  encounterId: number,
  params: ListMessagesParams = {},
): Promise<PaginatedMessages> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));

  const qs = query.toString();
  return client<PaginatedMessages>(
    `/messaging/encounters/${encounterId}/messages${qs ? `?${qs}` : ''}`,
  );
}

// ─── Send a message (staff → patient) ───────────────────────────────────────
// Phase 6.2: This function is fully built but not yet used by ChatPanel or
// HospitalApp.handleSendMessage. Wire it in to replace the local-state-only
// messaging. Optionally, add a socket.emit('message.send', ...) path for
// even lower latency (see socket.ts Phase 6.2 comment).

export interface SendMessagePayload {
  content: string;
  isInternal?: boolean;
}

export async function sendMessage(
  encounterId: number,
  payload: SendMessagePayload,
): Promise<Message> {
  return client<Message>(
    `/messaging/encounters/${encounterId}/messages`,
    {
      method: 'POST',
      body: JSON.stringify({
        senderType: 'USER',
        content: payload.content,
        isInternal: payload.isInternal ?? false,
      }),
    },
  );
}

// ─── Mark a message as read ─────────────────────────────────────────────────

export async function markMessageRead(
  messageId: number,
): Promise<{ ok: boolean }> {
  return client<{ ok: boolean }>(
    `/messaging/messages/${messageId}/read`,
    { method: 'POST' },
  );
}
