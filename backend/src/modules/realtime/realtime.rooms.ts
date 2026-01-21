// backend/src/modules/realtime/realtime.rooms.ts
// realtime.rooms.ts

// Written by: John Surette
// Date Created: Jan 6 2026
// Last Edited: Jan 6 2026

// Helpers for producing stable socketio room keys

export function hospitalRoomKey(hospitalId: number): string {
  return `hospital:${hospitalId}`;
}

export function encounterRoomKey(encounterId: number): string {
  return `encounter:${encounterId}`;
}
