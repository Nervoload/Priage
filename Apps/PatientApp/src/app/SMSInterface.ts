// PatientApp/src/app/SMSInterface.ts
// Abstraction for SMS-based patient interaction.
// In production, a Twilio/SMS gateway would route inbound texts to the
// backend intake/messaging endpoints. This module provides helper types
// and functions that map SMS commands to API calls.
//
// For the prototype, we simulate this via the web UI — the patient types
// messages in the chat panel, and this module translates them.

import { sendPatientMessage } from '../shared/api/encounters';

// ─── SMS command types ──────────────────────────────────────────────────────

export type SMSCommand =
  | { type: 'message'; content: string }
  | { type: 'worsening'; content: string }
  | { type: 'checkin' }
  | { type: 'unknown'; raw: string };

/**
 * Parse a raw text message for known command prefixes:
 *   "!worse <text>"  → worsening flag
 *   "!checkin"       → check-in request
 *   anything else    → regular message
 */
export function parseSMSCommand(raw: string): SMSCommand {
  const trimmed = raw.trim();

  if (/^!worse\s+/i.test(trimmed)) {
    return { type: 'worsening', content: trimmed.replace(/^!worse\s+/i, '') };
  }
  if (/^!checkin$/i.test(trimmed)) {
    return { type: 'checkin' };
  }
  if (trimmed.length === 0) {
    return { type: 'unknown', raw: trimmed };
  }
  return { type: 'message', content: trimmed };
}

/**
 * Route a parsed SMS command to the appropriate API call.
 */
export async function routeSMSCommand(
  encounterId: number,
  command: SMSCommand,
): Promise<{ sent: boolean; response?: string }> {
  switch (command.type) {
    case 'message':
      await sendPatientMessage(encounterId, command.content, false);
      return { sent: true };

    case 'worsening':
      await sendPatientMessage(encounterId, command.content, true);
      return { sent: true, response: 'Alert sent to your care team.' };

    case 'checkin':
      return {
        sent: false,
        response: 'Check-in noted. A nurse will be with you shortly.',
      };

    case 'unknown':
      return { sent: false, response: 'Message not recognized.' };
  }
}
