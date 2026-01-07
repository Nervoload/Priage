// backend/src/modules/realtime/realtime.events.ts
// realtime.events.ts

// Written by: John Surette
// Date Created: Jan 6 2026
// Last Edited: Jan 6 2026

// Event name constants shared by server and clients.

export const RealtimeEvents = {
  EncounterCreated: 'encounter.created',
  EncounterUpdated: 'encounter.updated',
  TriageNoteCreated: 'triageNote.created',
  MessageCreated: 'message.created',

  JoinHospitalRoom: 'room.joinHospital',
  JoinEncounterRoom: 'room.joinEncounter',
} as const;
