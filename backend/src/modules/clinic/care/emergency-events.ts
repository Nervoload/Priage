import { SAFETY_GATE_PUBLIC_ID } from '../../intake/interview/triage-interview.types';

type JsonRecord = Record<string, unknown>;

const asRecord = (value: unknown): JsonRecord => value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
const text = (value: unknown): string => typeof value === 'string' ? value : '';

export interface InterviewStateRow {
  payload: unknown;
  createdAt: Date;
}

export interface EmergencyEvent {
  id: string;
  trigger: 'safety_gate' | 'model_interrupt';
  triggerQuestionId: string | null;
  title: string;
  body: string;
  reason: string | null;
  shownAt: string;
  acknowledgedAt: string | null;
}

/**
 * Every interview turn stores a full state that supersedes the last one, so
 * the chain already records when a warning was shown (the first state that
 * entered `emergency_ack_required`) and when the patient continued (the next
 * state that left it with `emergencyAcknowledged`).
 */
export function deriveEmergencyEvents(states: InterviewStateRow[]): EmergencyEvent[] {
  const events: EmergencyEvent[] = [];
  let open: EmergencyEvent | null = null;
  let previousStatus = '';
  for (const row of [...states].sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())) {
    const state = asRecord(row.payload);
    const status = text(state.status);
    if (status === 'emergency_ack_required' && previousStatus !== 'emergency_ack_required') {
      const alert = asRecord(state.emergencyAlert);
      const answers = Array.isArray(state.answers) ? state.answers.map(asRecord) : [];
      const triggerQuestionId = text(alert.triggerQuestionId) || text(answers[answers.length - 1]?.questionPublicId) || null;
      open = {
        id: `emergency-${events.length}`,
        trigger: triggerQuestionId === SAFETY_GATE_PUBLIC_ID ? 'safety_gate' : 'model_interrupt',
        triggerQuestionId,
        title: text(alert.title) || 'Emergency warning',
        body: text(alert.body),
        reason: text(alert.reason) || null,
        shownAt: row.createdAt.toISOString(),
        acknowledgedAt: null,
      };
      events.push(open);
    } else if (open && status !== 'emergency_ack_required' && state.emergencyAcknowledged === true) {
      open.acknowledgedAt = row.createdAt.toISOString();
      open = null;
    }
    previousStatus = status;
  }
  return events;
}

/** What the queue can say from the current state alone. */
export function emergencyMarker(currentState: unknown): { shown: true; acknowledged: boolean } | null {
  const state = asRecord(currentState);
  if (text(state.status) === 'emergency_ack_required') return { shown: true, acknowledged: false };
  if (state.emergencyAcknowledged === true) return { shown: true, acknowledged: true };
  return null;
}
