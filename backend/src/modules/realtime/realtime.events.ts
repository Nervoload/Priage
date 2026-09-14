// backend/src/modules/realtime/realtime.events.ts
// realtime.events.ts

// Written by: John Surette
// Date Created: Jan 6 2026
// Last Edited: Feb 12 2026

// Event name constants and typed payloads for WebSocket communication.
// Both backend gateway and frontend clients should reference these types.

// ─── Event Names ─────────────────────────────────────────────────────────────

export const RealtimeEvents = {
  EncounterUpdated: 'encounter.updated',
  MessageCreated: 'message.created',
  MessageRead: 'message.read',
  AlertCreated: 'alert.created',
  AlertEscalated: 'alert.escalated',
  AlertAcknowledged: 'alert.acknowledged',
  AlertResolved: 'alert.resolved',
} as const;

export type RealtimeEventName = typeof RealtimeEvents[keyof typeof RealtimeEvents];

// ─── Event Payloads ──────────────────────────────────────────────────────────

/** Base payload included in every realtime event */
export interface BaseEventPayload {
  eventId: number;
  encounterId: number;
  hospitalId: number;
  createdAt: Date;
  metadata: unknown;
}

/** Encounter created or status changed */
export interface EncounterUpdatedPayload extends BaseEventPayload {
  metadata: {
    status?: string;
    fromStatus?: string;
    toStatus?: string;
    transition?: string;
    intake?: string;
    timestamps?: {
      arrivedAt: Date | null;
      triagedAt: Date | null;
      waitingAt: Date | null;
      seenAt: Date | null;
      departedAt: Date | null;
      cancelledAt: Date | null;
    };
    // Triage-related
    triageId?: number;
    ctasLevel?: number;
    priorityScore?: number;
  };
}

/** New message on an encounter */
export interface MessageCreatedPayload extends BaseEventPayload {
  metadata: {
    messageId: number;
    senderType: 'PATIENT' | 'USER' | 'SYSTEM';
    isInternal: boolean;
    attachmentCount?: number;
  };
  /**
   * Authorized staff sockets receive the created message inline so every
   * connected workstation does not need to issue a follow-up REST request.
   * Older event records may not resolve to a message, so clients retain a
   * cursor-based reconciliation fallback.
   */
  message?: {
    id: number;
    createdAt: Date;
    senderType: 'PATIENT' | 'USER' | 'SYSTEM';
    content: string;
    isInternal: boolean;
    createdByUserId: number | null;
    createdByPatientId: number | null;
    encounterId: number;
    hospitalId: number;
  };
}

export interface MessageReadPayload extends BaseEventPayload {
  metadata: {
    messageId: number;
    lastReadMessageId: number;
    lastReadAt: Date;
  };
}

/** Alert lifecycle payloads */
export interface AlertCreatedPayload extends BaseEventPayload {
  metadata: {
    alertId: number;
    type: string;
    severity: string;
  };
}

export interface AlertAcknowledgedPayload extends BaseEventPayload {
  metadata: {
    alertId: number;
    acknowledgedAt: Date;
  };
}

export interface AlertEscalatedPayload extends AlertCreatedPayload {
  metadata: AlertCreatedPayload['metadata'] & { previousSeverity: string };
}

export interface AlertResolvedPayload extends BaseEventPayload {
  metadata: {
    alertId: number;
    resolvedAt: Date;
  };
}

// ─── Event Map (maps event names to their payload types) ──────────────────────

export interface RealtimeEventMap {
  [RealtimeEvents.EncounterUpdated]: EncounterUpdatedPayload;
  [RealtimeEvents.MessageCreated]: MessageCreatedPayload;
  [RealtimeEvents.MessageRead]: MessageReadPayload;
  [RealtimeEvents.AlertCreated]: AlertCreatedPayload;
  [RealtimeEvents.AlertEscalated]: AlertEscalatedPayload;
  [RealtimeEvents.AlertAcknowledged]: AlertAcknowledgedPayload;
  [RealtimeEvents.AlertResolved]: AlertResolvedPayload;
}
