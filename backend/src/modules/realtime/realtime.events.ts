// backend/src/modules/realtime/realtime.events.ts
// realtime.events.ts

// Written by: John Surette
// Date Created: Jan 6 2026
// Last Edited: Jan 6 2026

// Event name constants shared by server and clients.

export const RealtimeEvents = {
  EncounterUpdated: 'encounter.updated',
  MessageCreated: 'message.created',
  AlertCreated: 'alert.created',
  AlertAcknowledged: 'alert.acknowledged',
  AlertResolved: 'alert.resolved',
} as const;
