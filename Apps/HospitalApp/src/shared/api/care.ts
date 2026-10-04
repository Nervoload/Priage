import { client } from './client';

export interface CareQueueItem {
  id: number;
  patientId: number;
  patientName: string;
  age: number | null;
  gender: string | null;
  chiefComplaint: string | null;
  status: 'ADMITTED' | 'CARE' | 'COMPLETE';
  arrivedAt: string | null;
  seenAt: string | null;
  departedAt: string | null;
  assessmentStatus: string;
  /** Present once the assessment has answers. */
  briefing?: string | null;
  urgency?: { level: CareUrgencyLevel; sentence: string } | null;
  redFlagCount?: number;
  emergency?: { shown: true; acknowledged: boolean } | null;
}

export type CareUrgencyLevel = 'clear' | 'caution' | 'escalate';
export type CareSegmentVoice = 'patient' | 'generated' | 'clinic' | 'record';
export type CareSectionKey =
  | 'summary' | 'urgency' | 'red_flags' | 'emergency' | 'next_steps' | 'ask_in_room' | 'gaps'
  | 'transcript' | 'not_asked' | 'questionnaire' | 'visit_record' | 'considerations' | 'exam' | 'timed_risks';
export interface CareSegment { id: string; kind: string; text: string; voice?: CareSegmentVoice; section?: CareSectionKey; ruleId?: string }
export type CareStage = 'red_flag_screen' | 'narrowing' | 'history';
export interface CareReason { id: string; ruleId: string; text: string; refs: string[] }
export interface CareAskItem { id: string; ruleId: string; text: string; why: string; basedOn: string[]; priority: 'must' | 'worth'; category: 'clarify' | 'sensitive' | 'exam' | 'history' }
export interface CareEmergencyEvent { id: string; trigger: 'safety_gate' | 'model_interrupt'; triggerQuestionId: string | null; title: string; body: string; reason: string | null; shownAt: string; acknowledgedAt: string | null }

export interface CareSnapshotContentV1 {
  interviewStatus: string;
  generatedAt: string | null;
  generationMode: 'ai' | 'fallback';
  provider: { name?: string; model?: string | null; promptVersion?: string | null } | null;
  governanceVersion: string | null;
  summary: { briefing: string; caseSummary: string; recommendedAction: string; redFlags: string[]; progressionRisks: string[] };
  answers: Array<{ questionId: string; question: string; answer: string; phase: string; answeredAt: string; entryMode: string | null; enteredByUserId: number | null }>;
  unasked: Array<{ questionId: string; question: string; phase: string; clinicalReason: string | null }>;
  segments: CareSegment[];
}

export interface CareSnapshotContentV2 extends CareSnapshotContentV1 {
  schemaVersion: 2;
  governance: { version: string | null; decisionSupportOnly: true; humanReviewRequired: true };
  handoffGenerator: { kind: 'deterministic' | 'model'; rulesVersion: string; promptVersion: string | null; model: string | null };
  visitRecord: { chiefComplaint: string; patientNote: string | null; allergies: string | null; conditions: string | null };
  urgency: { level: CareUrgencyLevel; sentence: string; reasons: CareReason[] };
  emergencyEvents: CareEmergencyEvent[];
  /** The clinic's own questions: asked after the safety question, or after the assessment for general-site patients. */
  questionnaire: null | { versionId: number; version: number; timing: 'in_interview' | 'after_interview'; submittedAt: string | null; fedToInterview: boolean };
  answers: Array<CareSnapshotContentV1['answers'][number] & { source: 'safety' | 'clinic' | 'ai'; stage: CareStage | null; why: string | null; inputType: string }>;
  unasked: Array<CareSnapshotContentV1['unasked'][number] & { stage: CareStage | null }>;
  redFlags: Array<{ id: string; ruleId: string; label: string; refs: string[] }>;
  redFlagScreen: Array<{ domain: string; label: string; status: 'reported' | 'denied' | 'not_screened'; refs: string[] }>;
  nextSteps: Array<{ id: string; ruleId: string; text: string; refs: string[] }>;
  askInRoom: CareAskItem[];
  gaps: Array<{ id: string; ruleId: string; kind: string; text: string; refs: string[] }>;
  timedRisks: Array<{ id: string; text: string; window: string | null; refs: string[] }>;
  considerations: Array<{ id: string; text: string; supporting: string[]; against: string[] }>;
  examSuggestions: Array<{ id: string; text: string; why: string; refs: string[] }>;
}

export type CareSnapshotContent = CareSnapshotContentV1 | CareSnapshotContentV2;

export interface CareState {
  encounter: {
    id: number; status: string; chiefComplaint: string | null; details: string | null;
    arrivedAt: string | null; seenAt: string | null; departedAt: string | null;
    patient: { firstName: string | null; lastName: string | null; age: number | null; gender: string | null; allergies: string | null; conditions: string | null; optionalHealthInfo: unknown };
    contact: { email: string | null; phone: string | null } | null;
    appointment: { status: string; requestedStartAt: string; confirmedStartAt: string | null; timezone: string } | null;
  };
  assessmentStatus: string;
  snapshot: { id: number; version: number; partial: boolean; createdAt: string; content: CareSnapshotContent } | null;
  snapshots: Array<{ id: number; version: number; partial: boolean; createdAt: string; content: CareSnapshotContent }>;
  note: { text: string; version: number; finalizedAt: string | null; updatedAt: string | null; updatedByUserId: number | null; history: Array<{ version: number; kind: string; reason: string | null; actorUserId: number; createdAt: string }> };
  comments: Array<{ id: number; snapshotId: number; segmentId: string; startOffset: number; endOffset: number; quote: string; text: string; version: number; resolvedAt: string | null; actorUserId: number; updatedAt: string }>;
  openQuestions: Array<{ id: number; text: string; version: number; addressedAt: string | null; actorUserId: number; snapshotId?: number | null; sourceSegmentId?: string | null; answerText?: string | null }>;
  handoffOverride: { reason: string; actorUserId: number; createdAt: string } | null;
  /** This clinician's own feedback on generated items. */
  myFeedback?: CareFeedback[];
  allowedActions: { start: boolean; edit: boolean; finish: boolean; feedback?: boolean };
}

export type CareFeedbackKind = 'USEFUL' | 'NOT_RIGHT' | 'MISSING';
export interface CareFeedback { snapshotId: number; targetKey: string; segmentId: string | null; sectionKey: string; kind: CareFeedbackKind; note: string | null; updatedAt: string }

export const listCareQueue = () => client<CareQueueItem[]>('/clinic-care/queue');
export const getCareState = (id: number) => client<CareState>(`/clinic-care/encounters/${id}`);
export const getCareExport = (id: number) => client<{ filename: string; text: string }>(`/clinic-care/encounters/${id}/export`);
export type CareCopySection =
  | 'assessment_section' | 'question_answer' | 'physician_note' | 'open_question' | 'comment'
  | 'before_you_go_in' | 'urgency' | 'ask_in_room' | 'gaps' | 'questionnaire' | 'visit_record' | 'transcript' | 'chart_composer';
/** Records a copy before it happens. Pass several sections when they're copied together. */
export const auditCareCopy = (id: number, section: CareCopySection | CareCopySection[], snapshotId?: number) => {
  const sections = Array.isArray(section) ? section : [section];
  return client<{ recorded: boolean }>(`/clinic-care/encounters/${id}/copy-audit`, { method: 'POST', body: JSON.stringify({ section: sections[0], sections: sections.slice(1), snapshotId }) });
};
export const startCare = (id: number, urgentOverrideReason?: string) => client<CareState>(`/clinic-care/encounters/${id}/start`, { method: 'POST', body: JSON.stringify({ commandKey: crypto.randomUUID(), urgentOverrideReason }) });
export const finishCare = (id: number, noteVersion: number) => client<CareState>(`/clinic-care/encounters/${id}/finish`, { method: 'POST', body: JSON.stringify({ commandKey: crypto.randomUUID(), noteVersion }) });
export const saveCareNote = (id: number, text: string, expectedVersion: number, amendmentReason?: string) => client<CareState>(`/clinic-care/encounters/${id}/note`, { method: 'PUT', body: JSON.stringify({ text, expectedVersion, amendmentReason }) });
export const addCareComment = (id: number, input: { snapshotId: number; segmentId: string; startOffset: number; endOffset: number; quote: string; text: string }) => client<CareState>(`/clinic-care/encounters/${id}/comments`, { method: 'POST', body: JSON.stringify({ ...input, commandKey: crypto.randomUUID() }) });
export const updateCareComment = (id: number, commentId: number, input: { expectedVersion: number; text?: string; resolved?: boolean }) => client<CareState>(`/clinic-care/encounters/${id}/comments/${commentId}`, { method: 'PATCH', body: JSON.stringify(input) });
/** Pass `source` when ticking an "Ask in the room" item; the server takes the text from the snapshot. */
export const addCareQuestion = (id: number, text: string, source?: { snapshotId: number; sourceSegmentId: string; addressed: boolean }) => client<CareState>(`/clinic-care/encounters/${id}/open-questions`, { method: 'POST', body: JSON.stringify({ text, ...source, commandKey: crypto.randomUUID() }) });
export const updateCareQuestion = (id: number, questionId: number, input: { expectedVersion: number; addressed?: boolean; text?: string; answerText?: string }) => client<CareState>(`/clinic-care/encounters/${id}/open-questions/${questionId}`, { method: 'PATCH', body: JSON.stringify(input) });
export const setCareFeedback = (id: number, input: { snapshotId: number; kind: CareFeedbackKind; segmentId?: string; sectionKey?: string; note?: string }) => client<CareState>(`/clinic-care/encounters/${id}/feedback`, { method: 'PUT', body: JSON.stringify(input) });
export const clearCareFeedback = (id: number, snapshotId: number, targetKey: string) => client<CareState>(`/clinic-care/encounters/${id}/feedback?${new URLSearchParams({ snapshotId: String(snapshotId), targetKey })}`, { method: 'DELETE' });
