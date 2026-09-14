// HospitalApp/src/shared/api/messaging.ts
// API calls for messaging — mirrors backend MessagingController.

import { client } from './client';
import type { Message } from '../types/domain';
import {
  isStaticDemoMode,
  listDemoMessages,
  sendDemoStaffMessage,
  trackDemoEvent,
} from '../../../../DemoShared/src/staticDemo';

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
  afterMessageId?: number;
}

export async function listMessages(
  encounterId: number,
  params: ListMessagesParams = {},
): Promise<PaginatedMessages> {
  if (isStaticDemoMode()) {
    return listDemoMessages(encounterId, params.afterMessageId) as PaginatedMessages;
  }
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.afterMessageId != null) query.set('afterMessageId', String(params.afterMessageId));

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
  if (isStaticDemoMode()) {
    return sendDemoStaffMessage(encounterId, payload.content) as Message;
  }
  return client<Message>(
    `/messaging/encounters/${encounterId}/messages`,
    {
      method: 'POST',
      body: JSON.stringify({
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
  if (isStaticDemoMode()) {
    trackDemoEvent('message_marked_read', { messageId });
    return { ok: true };
  }
  return client<{ ok: boolean }>(
    `/messaging/messages/${messageId}/read`,
    { method: 'POST' },
  );
}
