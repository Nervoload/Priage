import type {
  AnswerTriagePayload,
  StartTriagePayload,
  TriageSession,
} from '../types/domain';
import { client } from './client';

export function startTriage(payload: StartTriagePayload): Promise<TriageSession> {
  return client<TriageSession>('/api/triage/start', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function answerTriage(
  sessionId: string,
  payload: AnswerTriagePayload,
): Promise<TriageSession> {
  return client<TriageSession>(`/api/triage/${encodeURIComponent(sessionId)}/answer`, {
    method: 'POST',
    headers: { 'Idempotency-Key': `triage-answer-${sessionId}-${payload.questionId}` },
    body: JSON.stringify(payload),
  });
}

export function getTriage(sessionId: string): Promise<TriageSession> {
  return client<TriageSession>(`/api/triage/${encodeURIComponent(sessionId)}`);
}

export function completeTriage(sessionId: string): Promise<TriageSession> {
  return client<TriageSession>(`/api/triage/${encodeURIComponent(sessionId)}/complete`, {
    method: 'POST',
    headers: { 'Idempotency-Key': `triage-complete-${sessionId}` },
    body: JSON.stringify({}),
  });
}
