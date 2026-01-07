// backend/src/modules/realtime/realtime.rooms.ts
// realtime.rooms.ts

// Written by: John Surette
// Date Created: Jan 6 2026
// Last Edited: Jan 6 2026

// Helpers for producing stable socketio room keys
// Prototype uses hospitalName; later switch to hospitalId/slug.

export function hospitalRoomKey(hospitalName: string): string {
  // Avoid spaces/special chars breaking room naming conventions
  return `hospital:${encodeURIComponent(hospitalName.trim())}`;
}

export function encounterRoomKey(encounterId: number): string {
  return `encounter:${encounterId}`;
}
