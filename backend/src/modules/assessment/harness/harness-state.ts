import type { InterviewGovernance } from '../../intake/interview/triage-interview.types';
import { SAFETY_GATE_PUBLIC_ID } from '../../intake/interview/triage-interview.types';
import type { Language } from '../case/types';
import {
  HARNESS_ENGINE, type AssessmentClientState, type ClientQuestion, type HarnessQuestion, type HarnessState, type ReviewItem,
} from './harness-types';

const STATUSES = ['in_progress', 'emergency_ack_required', 'review', 'complete'] as const;

export function isHarnessPayload(payload: unknown): boolean {
  return !!payload && typeof payload === 'object' && !Array.isArray(payload)
    && (payload as { harness?: { engine?: unknown } }).harness?.engine === HARNESS_ENGINE;
}

/** Reads a stored harness state. The harness wrote it, so this checks the shape that matters and nothing more. */
export function parseHarnessState(payload: unknown): HarnessState | null {
  if (!isHarnessPayload(payload)) return null;
  const state = payload as HarnessState;
  if (typeof state.interviewPublicId !== 'string' || !(STATUSES as readonly string[]).includes(state.status) || !Array.isArray(state.answers)) return null;
  return state;
}

export function harnessGovernance(mode: 'ai' | 'fallback', provider: { name: 'openai' | 'deterministic' | 'none'; model: string | null; promptVersion: string | null }): InterviewGovernance {
  return {
    version: process.env.PRIAGE_CLINICAL_GOVERNANCE_VERSION?.trim() || '2026-06-13',
    generationMode: mode,
    decisionSupportOnly: true,
    humanReviewRequired: true,
    emergencyInstructions: 'Call 911 or go to the nearest emergency department for immediate or life-threatening danger.',
    provider,
    reviewState: 'UNREVIEWED',
  };
}

/** What the patient sees as the summary: never anything generated about causes. */
export function patientSummary(status: HarnessState['status'], language: Language): string {
  if (status === 'complete') return language === 'fr' ? 'Vos réponses ont été envoyées à la clinique.' : 'Your answers were sent to the clinic.';
  if (status === 'review') return language === 'fr' ? 'Vérifiez vos réponses avant de les envoyer à la clinique.' : 'Check your answers before they go to the clinic.';
  return '';
}

/** A question without anything server-only: its plan (which can name possible causes) and English keys. */
export function toClientQuestion(question: HarnessQuestion): ClientQuestion {
  const { plan: _plan, choiceKeys: _keys, englishPrompt: _english, ...client } = question;
  return client;
}

/** The latest answer to each question, for the confirm-your-answers screen. */
export function reviewItems(state: HarnessState): ReviewItem[] {
  const latest = new Map<string, HarnessState['answers'][number]>();
  for (const answer of state.answers) latest.set(answer.questionPublicId, answer);
  return [...latest.values()].map((answer) => ({
    questionPublicId: answer.questionPublicId,
    prompt: answer.displayPrompt,
    answer: answer.originalText,
    canChange: answer.questionPublicId !== SAFETY_GATE_PUBLIC_ID,
    question: answer.question,
  }));
}

export function toAssessmentClientState(state: HarnessState, waitPollMs = 1000): AssessmentClientState {
  const waiting = state.status === 'in_progress' && !state.currentQuestion && state.harness.planning?.waitingSince
    ? { since: state.harness.planning.waitingSince, pollAfterMs: waitPollMs }
    : null;
  return {
    interviewPublicId: state.interviewPublicId,
    status: state.status,
    phase: state.phase,
    askedCount: state.askedCount,
    maxQuestions: state.maxQuestions,
    currentQuestion: state.currentQuestion ? toClientQuestion(state.currentQuestion) : null,
    cachedQuestions: [],
    emergencyAlert: state.emergencyAlert
      ? { title: state.emergencyAlert.title, body: state.emergencyAlert.body, recommendation: state.emergencyAlert.recommendation }
      : null,
    summaryPreview: state.summaryPreview,
    generationMode: state.generationMode,
    governance: state.governance,
    harness: {
      engine: HARNESS_ENGINE,
      language: state.harness.communication.language,
      answeredBy: state.harness.communication.answeredBy,
      waiting,
      review: state.status === 'review' ? reviewItems(state) : null,
    },
  };
}
