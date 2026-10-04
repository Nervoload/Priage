import type {
  CareAskItem, CareCopySection, CareEmergencyEvent, CareFeedback, CareQueueItem, CareReason, CareSegment, CareSnapshotContent,
  CareSnapshotContentV2, CareStage, CareState, CareUrgencyLevel,
} from '../../../shared/api/care';

export const SAFETY_QUESTION_ID = 'safety_immediate_danger';

export function isSnapshotV2(content: CareSnapshotContent | null | undefined): content is CareSnapshotContentV2 {
  return !!content && (content as Partial<CareSnapshotContentV2>).schemaVersion === 2;
}

// ─── View model ─────────────────────────────────────────────────────────────

export type Tone = 'amber' | 'blue' | 'green' | 'grey' | 'red';
export type AnswerSource = 'safety' | 'clinic' | 'ai';

export interface ViewAnswer {
  questionId: string;
  question: string;
  answer: string;
  answeredAt: string;
  entryMode: string | null;
  enteredByUserId: number | null;
  source: AnswerSource;
  stage: CareStage | null;
  why: string | null;
}

export interface CareView {
  schemaVersion: 1 | 2;
  briefing: string;
  caseSummary: string;
  urgency: { level: CareUrgencyLevel; sentence: string; reasons: CareReason[] } | null;
  redFlags: Array<{ segmentId: string; label: string; refs: string[] }>;
  emergencyEvents: Array<{ segmentId: string; event: CareEmergencyEvent }>;
  nextSteps: Array<{ segmentId: string; text: string; refs: string[] }>;
  askInRoom: Array<{ segmentId: string; whySegmentId: string; item: CareAskItem }>;
  gaps: Array<{ segmentId: string; text: string; kind: string; refs: string[] }>;
  redFlagScreen: CareSnapshotContentV2['redFlagScreen'];
  answers: ViewAnswer[];
  unasked: Array<{ questionId: string; question: string; why: string | null; stage: CareStage | null }>;
  visitRecord: CareSnapshotContentV2['visitRecord'] | null;
  questionnaire: CareSnapshotContentV2['questionnaire'];
  considerations: CareSnapshotContentV2['considerations'];
  examSuggestions: CareSnapshotContentV2['examSuggestions'];
  timedRisks: CareSnapshotContentV2['timedRisks'];
  segments: ReadonlyMap<string, CareSegment>;
  generation: { mode: 'ai' | 'fallback'; generatedAt: string | null; rulesVersion: string | null };
}

const STAGE_FROM_PHASE: Record<string, CareStage> = { urgent: 'red_flag_screen', emergent: 'narrowing', history: 'history' };

export const STAGE_LABELS: Record<CareStage, string> = {
  red_flag_screen: 'Red-flag screen',
  narrowing: 'Narrowing it down',
  history: 'History',
};

/** Older briefings carried ED wording and a CTAS level after this marker; Care shows only the part before it. */
const LEGACY_BRIEFING_CUT = ', with current intake urgency';

export function legacyBriefing(text: string): string {
  const cut = text.indexOf(LEGACY_BRIEFING_CUT);
  return cut === -1 ? text : text.slice(0, cut);
}

export function normalizeSnapshot(content: CareSnapshotContent): CareView {
  if (isSnapshotV2(content)) {
    const segments = new Map(content.segments.map((segment) => [segment.id, segment]));
    return {
      schemaVersion: 2,
      briefing: content.summary.briefing,
      caseSummary: content.summary.caseSummary,
      urgency: content.urgency,
      redFlags: content.redFlags.map((flag, index) => ({ segmentId: `red-flag:${index}`, label: flag.label, refs: flag.refs })),
      emergencyEvents: content.emergencyEvents.map((event, index) => ({ segmentId: `emergency:${index}`, event })),
      nextSteps: content.nextSteps.map((step, index) => ({ segmentId: `next:${index}`, text: step.text, refs: step.refs })),
      askInRoom: content.askInRoom.map((item, index) => ({ segmentId: `ask:${index}`, whySegmentId: `ask:${index}:why`, item })),
      gaps: content.gaps.map((gap, index) => ({ segmentId: `gap:${index}`, text: gap.text, kind: gap.kind, refs: gap.refs })),
      redFlagScreen: content.redFlagScreen,
      answers: content.answers.map((answer) => ({
        questionId: answer.questionId, question: answer.question, answer: answer.answer, answeredAt: answer.answeredAt,
        entryMode: answer.entryMode, enteredByUserId: answer.enteredByUserId, source: answer.source, stage: answer.stage, why: answer.why,
      })),
      unasked: content.unasked.map((item) => ({ questionId: item.questionId, question: item.question, why: item.clinicalReason, stage: item.stage })),
      visitRecord: content.visitRecord,
      questionnaire: content.questionnaire ?? null,
      considerations: content.considerations,
      examSuggestions: content.examSuggestions,
      timedRisks: content.timedRisks,
      segments,
      generation: { mode: content.generationMode, generatedAt: content.generatedAt, rulesVersion: content.handoffGenerator.rulesVersion },
    };
  }
  // v1 snapshots stay readable; the new sections are simply empty.
  const segments = new Map(content.segments.map((segment) => [segment.id, segment.id === 'summary:briefing' ? { ...segment, text: legacyBriefing(segment.text) } : segment]));
  return {
    schemaVersion: 1,
    briefing: legacyBriefing(content.summary.briefing),
    caseSummary: content.summary.caseSummary,
    urgency: null,
    redFlags: content.summary.redFlags.map((label, index) => ({ segmentId: `red-flag:${index}`, label, refs: [] })),
    emergencyEvents: [],
    nextSteps: content.summary.recommendedAction ? [{ segmentId: 'summary:action', text: content.summary.recommendedAction, refs: [] }] : [],
    askInRoom: [],
    gaps: [],
    redFlagScreen: [],
    answers: content.answers.map((answer) => ({
      questionId: answer.questionId, question: answer.question, answer: answer.answer, answeredAt: answer.answeredAt,
      entryMode: answer.entryMode, enteredByUserId: answer.enteredByUserId,
      source: answer.questionId === SAFETY_QUESTION_ID ? 'safety' : 'ai',
      stage: answer.questionId === SAFETY_QUESTION_ID ? null : STAGE_FROM_PHASE[answer.phase] ?? null,
      why: null,
    })),
    unasked: content.unasked.map((item) => ({ questionId: item.questionId, question: item.question, why: item.clinicalReason, stage: STAGE_FROM_PHASE[item.phase] ?? null })),
    visitRecord: null,
    questionnaire: null,
    considerations: [],
    examSuggestions: [],
    timedRisks: content.summary.progressionRisks.map((text, index) => ({ id: `risk:${index}`, text, window: null, refs: [] })),
    segments,
    generation: { mode: content.generationMode, generatedAt: content.generatedAt, rulesVersion: null },
  };
}

/** Safety first, then clinic questions, then the assessment by stage. */
/** The aside beside the clinic's questions in the transcript. */
export function clinicQuestionsAside(questionnaire: CareView['questionnaire']): string {
  if (!questionnaire) return 'Your clinic’s questions';
  return questionnaire.timing === 'after_interview'
    ? `Version ${questionnaire.version}, answered after the assessment`
    : `Version ${questionnaire.version}, asked right after the safety question`;
}

export function groupAnswers(answers: ViewAnswer[]): Array<{ key: string; label: string; answers: ViewAnswer[] }> {
  const groups = [
    { key: 'safety', label: 'Safety check', answers: answers.filter((answer) => answer.source === 'safety') },
    { key: 'clinic', label: 'Clinic questions', answers: answers.filter((answer) => answer.source === 'clinic') },
    ...(Object.keys(STAGE_LABELS) as CareStage[]).map((stage) => ({
      key: stage, label: STAGE_LABELS[stage], answers: answers.filter((answer) => answer.source === 'ai' && answer.stage === stage),
    })),
    { key: 'other', label: 'Other questions', answers: answers.filter((answer) => answer.source === 'ai' && !answer.stage) },
  ];
  return groups.filter((group) => group.answers.length > 0);
}

export function urgencyTone(level: CareUrgencyLevel | null | undefined): Tone {
  return level === 'escalate' ? 'red' : level === 'caution' ? 'amber' : level === 'clear' ? 'green' : 'grey';
}

export function urgencyWord(level: CareUrgencyLevel): string {
  return level === 'escalate' ? 'Escalate' : level === 'caution' ? 'Caution' : 'Clear';
}

// ─── Highlights and selection ───────────────────────────────────────────────

export interface CommentRange { id: number; start: number; end: number; resolved: boolean }
export interface TextRun { text: string; start: number; end: number; commentIds: number[]; resolvedOnly: boolean }

/** Splits text into runs so overlapping comment ranges can each be highlighted. */
export function splitRuns(text: string, ranges: CommentRange[]): TextRun[] {
  const valid = ranges
    .map((range) => ({ ...range, start: Math.max(0, range.start), end: Math.min(text.length, range.end) }))
    .filter((range) => range.start < range.end);
  const points = new Set([0, text.length]);
  for (const range of valid) { points.add(range.start); points.add(range.end); }
  const sorted = [...points].sort((left, right) => left - right);
  const runs: TextRun[] = [];
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const start = sorted[index];
    const end = sorted[index + 1];
    const covering = valid.filter((range) => range.start <= start && range.end >= end);
    runs.push({ text: text.slice(start, end), start, end, commentIds: covering.map((range) => range.id), resolvedOnly: covering.length > 0 && covering.every((range) => range.resolved) });
  }
  return runs.filter((run) => run.text.length > 0);
}

/** Comments anchored to one passage of one snapshot, plus any whose passage is hidden in this version. */
export function commentRangesFor(segmentId: string, snapshotId: number, textLength: number, comments: CareState['comments']): { ranges: CommentRange[]; hidden: number[] } {
  const mine = comments.filter((comment) => comment.snapshotId === snapshotId && comment.segmentId === segmentId);
  return {
    ranges: mine.filter((comment) => comment.startOffset < textLength).map((comment) => ({ id: comment.id, start: comment.startOffset, end: comment.endOffset, resolved: !!comment.resolvedAt })),
    hidden: mine.filter((comment) => comment.startOffset >= textLength).map((comment) => comment.id),
  };
}

/** The server re-checks this; the client checks first so the composer only opens for a valid quote. */
export function validateSelection(segmentText: string, start: number, quote: string): boolean {
  return quote.trim().length > 0 && start >= 0 && segmentText.slice(start, start + quote.length) === quote;
}

// ─── Queue ──────────────────────────────────────────────────────────────────

export type QueueGroupKey = 'ready' | 'assessment' | 'active' | 'completed';
export const QUEUE_GROUPS: Array<{ key: QueueGroupKey; label: string; note: string; empty: string }> = [
  { key: 'ready', label: 'Ready for you', note: 'Arrived, assessment finished', empty: 'Nobody is waiting with a finished assessment.' },
  { key: 'assessment', label: 'Assessment in progress', note: 'Start early only for urgent care', empty: 'No arrived patients are still answering.' },
  { key: 'active', label: 'In Care', note: '', empty: 'No visits are in Care.' },
  { key: 'completed', label: 'Finished recently', note: 'Last 7 days', empty: 'No visits finished in the last week.' },
];

export function queueGroupFor(item: CareQueueItem): QueueGroupKey {
  if (item.status === 'CARE') return 'active';
  if (item.status === 'COMPLETE') return 'completed';
  return item.assessmentStatus === 'complete' ? 'ready' : 'assessment';
}

const byArrival = (left: CareQueueItem, right: CareQueueItem) => (left.arrivedAt ?? '').localeCompare(right.arrivedAt ?? '') || left.id - right.id;
const byFinished = (left: CareQueueItem, right: CareQueueItem) => (right.departedAt ?? '').localeCompare(left.departedAt ?? '') || right.id - left.id;

export function matchesQueueSearch(item: CareQueueItem, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [item.patientName, item.chiefComplaint, String(item.id), item.briefing].some((value) => (value ?? '').toLowerCase().includes(needle));
}

/** Arrival order within each group; urgency is marked on rows, never used to reorder them. */
export function queueGroups(items: CareQueueItem[], query = ''): Array<{ key: QueueGroupKey; rows: CareQueueItem[] }> {
  const visible = items.filter((item) => matchesQueueSearch(item, query));
  return QUEUE_GROUPS.map((group) => ({
    key: group.key,
    rows: visible.filter((item) => queueGroupFor(item) === group.key).sort(group.key === 'completed' ? byFinished : byArrival),
  }));
}

/** Whoever has waited longest with a finished assessment. */
export function nextReady(items: CareQueueItem[]): CareQueueItem | null {
  return items.filter((item) => queueGroupFor(item) === 'ready').sort(byArrival)[0] ?? null;
}

export function minutesWaiting(arrivedAt: string | null, now: Date = new Date()): number | null {
  if (!arrivedAt) return null;
  return Math.max(0, Math.round((now.getTime() - new Date(arrivedAt).getTime()) / 60_000));
}

export function waitWords(minutes: number | null): string {
  if (minutes == null) return '';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hour${hours === 1 ? '' : 's'}`;
}

/** One status sentence per queue row: an emergency warning first, then urgency, then where the assessment is. */
export function queueStatus(item: CareQueueItem): { tone: Tone; text: string; detail: string | null } {
  const flags = item.redFlagCount ? `${item.redFlagCount} red flag${item.redFlagCount === 1 ? '' : 's'} reported` : null;
  if (item.emergency) return { tone: 'red', text: item.emergency.acknowledged ? 'Continued past an emergency warning' : 'Shown an emergency warning', detail: flags };
  if (item.urgency) return { tone: urgencyTone(item.urgency.level), text: urgencyWord(item.urgency.level), detail: flags };
  if (item.assessmentStatus === 'complete') return { tone: 'grey', text: 'Assessment finished', detail: null };
  if (item.assessmentStatus === 'in_progress') return { tone: 'blue', text: 'Still answering', detail: null };
  return { tone: 'grey', text: 'Hasn’t started the assessment', detail: null };
}

// ─── Words and times ────────────────────────────────────────────────────────

export function patientMeta(age: number | null, gender: string | null): string {
  const value = gender?.trim().toLowerCase();
  const sex = !value ? null : value === 'f' || value === 'female' ? 'female' : value === 'm' || value === 'male' ? 'male' : value;
  if (age != null) return sex ? `${age}, ${sex}` : String(age);
  return sex ? sex[0].toUpperCase() + sex.slice(1) : 'Age not recorded';
}

export function clockTime(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-CA', { hour: 'numeric', minute: '2-digit' }).format(new Date(iso)).replace(/\./g, '').replace(/\b(am|pm)\b/i, (match) => match.toUpperCase());
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return 'Not recorded';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return `${new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric' }).format(date)}, ${clockTime(iso)}`;
}

export function entryWords(entryMode: string | null, enteredByUserId: number | null): string {
  if (entryMode === 'STAFF_ASSISTED') return `Entered by staff${enteredByUserId ? ` (user #${enteredByUserId})` : ''}`;
  if (entryMode === 'WALKIN_SELF') return 'Patient, on the desk device';
  return 'Patient';
}

// ─── Finish and chart text ──────────────────────────────────────────────────

export interface FinishItem { key: string; tone: Tone; text: string }

/** What is still open before the note locks. Informational: nothing here blocks Finish. */
export function finishChecklist(state: CareState, noteSaved: boolean): FinishItem[] {
  const openComments = state.comments.filter((comment) => !comment.resolvedAt).length;
  const openQuestions = state.openQuestions.filter((question) => !question.addressedAt).length;
  return [
    noteSaved
      ? { key: 'note', tone: 'green', text: `Note saved, version ${state.note.version}` }
      : { key: 'note', tone: 'red', text: 'The note has unsaved changes' },
    ...(openComments ? [{ key: 'comments', tone: 'amber' as Tone, text: `${openComments} comment${openComments === 1 ? ' is' : 's are'} still open` }] : []),
    ...(openQuestions ? [{ key: 'questions', tone: 'amber' as Tone, text: `${openQuestions} of your questions ${openQuestions === 1 ? 'isn’t' : 'aren’t'} marked addressed` }] : []),
  ];
}

export type ChartSection = 'visit' | 'before' | 'answers' | 'gaps' | 'summary' | 'open_questions' | 'note' | 'comments';

export const CHART_SECTIONS: Array<{ key: ChartSection; label: string; audit: CareCopySection }> = [
  { key: 'visit', label: 'Visit details', audit: 'visit_record' },
  { key: 'before', label: 'Before you go in', audit: 'before_you_go_in' },
  { key: 'answers', label: 'Answers', audit: 'transcript' },
  { key: 'gaps', label: 'Not established', audit: 'gaps' },
  { key: 'summary', label: 'Case summary', audit: 'assessment_section' },
  { key: 'open_questions', label: 'Your questions', audit: 'open_question' },
  { key: 'note', label: 'Visit note', audit: 'physician_note' },
  { key: 'comments', label: 'Comments', audit: 'comment' },
];

function block(heading: string, lines: Array<string | null | undefined | false>): string {
  const body = lines.filter((line): line is string => !!line && !!line.trim());
  return body.length ? [heading, ...body].join('\n') : '';
}

/** Plain chart text. Every block says whose words it holds. */
export function composeChart(state: CareState, view: CareView | null, sections: ChartSection[]): string {
  const patient = state.encounter.patient;
  const name = [patient.firstName, patient.lastName].filter(Boolean).join(' ') || 'Patient';
  const parts: string[] = [];
  for (const key of CHART_SECTIONS.map((section) => section.key)) {
    if (!sections.includes(key)) continue;
    if (key === 'visit') {
      parts.push(block('Visit', [
        `${name}, ${patientMeta(patient.age, patient.gender)}. Visit ${state.encounter.id}.`,
        `Reason for visit (patient’s words): ${view?.visitRecord?.chiefComplaint || state.encounter.chiefComplaint || 'Not recorded'}`,
        view?.visitRecord?.patientNote ? `Patient’s note: ${view.visitRecord.patientNote}` : null,
        `Allergies: ${patient.allergies || 'Not recorded'}. Conditions: ${patient.conditions || 'Not recorded'}.`,
      ]));
    } else if (key === 'before' && view) {
      parts.push(block('Before you go in (generated by Priage, review against the answers)', [
        view.urgency ? view.urgency.sentence : null,
        ...(view.urgency?.reasons.map((reason) => `- ${reason.text}`) ?? []),
        `Briefing: ${view.briefing}`,
        ...view.redFlags.map((flag) => `Red flag: ${flag.label}`),
        ...view.emergencyEvents.map(({ segmentId }) => `Emergency warning: ${view.segments.get(segmentId)?.text ?? ''}`),
        ...view.nextSteps.map((step) => `Next step: ${step.text}`),
        ...view.askInRoom.map(({ item }) => `Ask in the room${item.priority === 'must' ? ' (must ask)' : ''}: ${item.text}`),
      ]));
    } else if (key === 'answers' && view) {
      const groups = groupAnswers(view.answers).map((group) => [group.label, ...group.answers.map((answer) => `Q: ${answer.question}\nA (patient): ${answer.answer}`)].join('\n'));
      parts.push(block('Patient answers', groups));
    } else if (key === 'gaps' && view) {
      parts.push(block('Not established (generated)', view.gaps.map((gap) => `- ${gap.text}`)));
    } else if (key === 'summary' && view) {
      parts.push(block('Case summary (generated by Priage)', [view.caseSummary]));
    } else if (key === 'open_questions') {
      parts.push(block('Clinician questions', state.openQuestions.map((question) => `- ${question.text}${question.addressedAt ? ' (addressed)' : ''}${question.answerText ? `\n  They said: ${question.answerText}` : ''}`)));
    } else if (key === 'note') {
      parts.push(block('Visit note (clinician)', [state.note.text]));
    } else if (key === 'comments') {
      parts.push(block('Clinician comments', state.comments.map((comment) => `- On “${comment.quote}”: ${comment.text}${comment.resolvedAt ? ' (resolved)' : ''}`)));
    }
  }
  return parts.filter(Boolean).join('\n\n');
}

// ─── Quoting and copying passages ───────────────────────────────────────────

/** A quoted line for the note that says whose words it is. */
export function quoteForNote(segment: CareSegment | undefined, quote: string): string {
  const text = `“${quote.trim()}”`;
  if (segment?.voice === 'patient') return `Patient: ${text}`;
  if (segment?.voice === 'generated') return `Priage (generated): ${text}`;
  return text;
}

export function appendToNote(draft: string, line: string): string {
  const trimmed = draft.replace(/\s+$/, '');
  return trimmed ? `${trimmed}\n${line}\n` : `${line}\n`;
}

/** An "Ask in the room" question and the answer, as the clinician's own record. */
export function askLineForNote(question: string, answer: string): string {
  return `Asked in the room: ${question.trim()}\nThey said: ${answer.trim()}`;
}

/** This clinician's feedback on one snapshot, by target. */
export function feedbackFor(feedback: CareFeedback[] | undefined, snapshotId: number | null | undefined): ReadonlyMap<string, CareFeedback> {
  return new Map((feedback ?? []).filter((item) => item.snapshotId === snapshotId).map((item) => [item.targetKey, item]));
}

const COPY_SECTION: Partial<Record<NonNullable<CareSegment['section']>, CareCopySection>> = {
  urgency: 'urgency', red_flags: 'before_you_go_in', emergency: 'before_you_go_in', next_steps: 'before_you_go_in',
  ask_in_room: 'ask_in_room', gaps: 'gaps', considerations: 'gaps', exam: 'gaps', timed_risks: 'gaps',
  transcript: 'question_answer', not_asked: 'open_question', questionnaire: 'questionnaire', visit_record: 'visit_record',
};

/** The copy-audit section for a copied passage. */
export function copySectionFor(segmentId: string, segment: CareSegment | undefined): CareCopySection {
  if (segment?.section === 'summary') return segmentId === 'summary:case' ? 'assessment_section' : 'before_you_go_in';
  const mapped = segment?.section && COPY_SECTION[segment.section];
  if (mapped) return mapped;
  return /^(question|answer|why):/.test(segmentId) ? 'question_answer' : 'assessment_section';
}

// ─── Where a passage lives ──────────────────────────────────────────────────

export type EvidenceTab = 'answers' | 'gaps' | 'summary' | 'visit';

/** The tab a passage is shown on, or null when it's in the always-visible top band. */
export function tabForSegment(segmentId: string): EvidenceTab | null {
  const prefix = segmentId.split(':')[0];
  if (prefix === 'question' || prefix === 'answer' || prefix === 'why' || prefix === 'unasked' || prefix === 'unasked-why') return 'answers';
  if (prefix === 'gap' || prefix === 'consider' || prefix === 'exam' || prefix === 'risk') return 'gaps';
  if (segmentId === 'summary:case') return 'summary';
  if (prefix === 'visit') return 'visit';
  return null;
}
