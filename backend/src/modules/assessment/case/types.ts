// The case an assessment builds: evidence from answers, possible causes with
// support levels, history elements and gaps. See docs/AI_ASSESSMENT_HARNESS.md
// ("Formats"). Everything here is plain data so the rules stay pure functions.

export type Language = 'en' | 'fr';
export type AnsweredBy = 'self' | 'parent' | 'caregiver' | 'other';
/** Which wording variant a question uses: "you", "your child", or "the person you're helping". */
export type Audience = 'self' | 'child' | 'other';

export type HistoryElement =
  | 'onset' | 'location' | 'character' | 'radiation' | 'severity' | 'course'
  | 'better_worse' | 'associated_symptoms' | 'tried_so_far'
  | 'medications' | 'allergies' | 'conditions' | 'recent_events'
  | 'pregnancy_possible' | 'daily_impact';

export const HISTORY_ELEMENTS: readonly HistoryElement[] = [
  'onset', 'location', 'character', 'radiation', 'severity', 'course',
  'better_worse', 'associated_symptoms', 'tried_so_far',
  'medications', 'allergies', 'conditions', 'recent_events',
  'pregnancy_possible', 'daily_impact',
];

export type BodySystem =
  | 'general' | 'respiratory' | 'cardiovascular' | 'neuro' | 'skin' | 'abdominal'
  | 'urinary' | 'musculoskeletal' | 'ent' | 'eye' | 'mental_health' | 'reproductive';

export const BODY_SYSTEMS: readonly BodySystem[] = [
  'general', 'respiratory', 'cardiovascular', 'neuro', 'skin', 'abdominal',
  'urinary', 'musculoskeletal', 'ent', 'eye', 'mental_health', 'reproductive',
];

/** Wire input types: the legacy five plus the harness's own. */
export type AssessmentInputType =
  | 'text' | 'textarea' | 'number' | 'boolean' | 'single_select'
  | 'multi_select' | 'scale' | 'duration';

export const ASSESSMENT_INPUT_TYPES: readonly AssessmentInputType[] = [
  'text', 'textarea', 'number', 'boolean', 'single_select', 'multi_select', 'scale', 'duration',
];

export type DurationUnit = 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years';
export const DURATION_UNITS: readonly DurationUnit[] = ['minutes', 'hours', 'days', 'weeks', 'months', 'years'];

export type RoundType = 'clarify' | 'danger' | 'distinguish' | 'history';
export type CauseTier = 'cant_miss' | 'urgent' | 'routine';
export type SupportLevel = 'leading' | 'possible' | 'less_likely' | 'not_supported' | 'not_enough_information';
export type ModelUrgency = 'none' | 'caution' | 'escalate';
export type IntegrityFlag = 'ok' | 'nonsense' | 'off_topic' | 'instructions_in_answer';

export interface EvidenceItem {
  id: string;
  /** Answer id, or `visit:complaint` / `visit:note` for the patient's opening words. */
  answerId: string;
  kind: 'reported' | 'denied' | 'not_sure' | 'vague';
  element?: HistoryElement;
  /** Possible-cause ids and history elements, copied from the question that was asked. */
  targets: string[];
  /** Clinical English. */
  value: string;
  /** Exactly as the patient gave it. */
  patientWords: string;
  language: Language;
  answeredBy: AnsweredBy;
  source: 'structured' | 'reader' | 'description';
  /** For a Yes to a yes/no question: the question, whose words the patient has affirmed. */
  affirms?: string;
}

export interface InPersonItem {
  kind: 'exam' | 'test' | 'clinician_question';
  what: string;
  settles: string;
}

export interface Candidate {
  /** From the pack's cause list, or `other:<slug>`. */
  id: string;
  label: string;
  tier: CauseTier;
  status: SupportLevel;
  for: string[];
  against: string[];
  /** Patient-answerable questions that could still shift it. Empty means it has reached its askable limit. */
  askableNext: string[];
  needsInPerson: InPersonItem[];
  addedBy: 'model' | 'audit';
}

export interface AnswerEffect {
  target: string;
  shift: 'supports' | 'weakens' | 'fills';
}

export interface AnswerOutcome {
  /** A choice, "Yes"/"No", or a number range like "7-10" for scales. */
  answer: string;
  effects: AnswerEffect[];
  /** This answer means the patient should see the emergency warning now. */
  emergency?: boolean;
}

export interface ScaleSpec {
  min: number;
  max: number;
}

export interface PlannedQuestion {
  /** Stable within the case: a bank id, or `m<round>.<n>` for a model question. */
  key: string;
  /** English, plain language, one idea. */
  text: string;
  format: AssessmentInputType;
  /** English canonical choices for single and multi select. */
  choices?: string[];
  scale?: ScaleSpec;
  bankId?: string;
  purpose: RoundType;
  element?: HistoryElement;
  targets: string[];
  ifAnswered: AnswerOutcome[];
  patientCanAnswer: 'yes' | 'partly';
  burden: 'low' | 'medium' | 'high';
  /** Reason, when the clinician should ask it instead. */
  betterInRoom?: string;
  group?: string;
  allowNotSure: boolean;
  source: 'bank' | 'model' | 'fallback' | 'follow_up';
}

export interface ComplaintType {
  id: string;
  patientWords: string;
  systems: BodySystem[];
  characterized: boolean;
}

export interface HistoryEntry {
  status: 'filled' | 'unknown';
  evidenceIds: string[];
}

export interface Contradiction {
  answerIds: string[];
  note: string;
  clarified: boolean;
}

export interface AskInRoomItem {
  text: string;
  reason: string;
  answerIds: string[];
}

export interface CommunicationNeeds {
  language: Language;
  readingLevel: 'simple' | 'standard';
  answeredBy: AnsweredBy;
  subjectAge: number | null;
  input: Array<'voice' | 'screen_reader' | 'large_text'>;
}

export interface AskedQuestion {
  key: string;
  text: string;
  targets: string[];
  element?: HistoryElement;
  answerId: string;
}

export interface Case {
  version: number;
  complaints: ComplaintType[];
  /** Body systems from the patient's words (code) united with the interpreter's. */
  systems: BodySystem[];
  evidence: EvidenceItem[];
  history: Partial<Record<HistoryElement, HistoryEntry>>;
  candidates: Candidate[];
  contradictions: Contradiction[];
  askInRoom: AskInRoomItem[];
  notChosen: Array<{ question: PlannedQuestion; reason: string }>;
  asked: AskedQuestion[];
  /** Answer ids that already had their one follow-up. */
  followedUp: string[];
  urgency: { model: ModelUrgency; reasons: string[]; answerIds: string[] };
  patient: { age: number | null; sex: 'female' | 'male' | null };
  communication: CommunicationNeeds;
  /** Dangerous causes the model left out and code kept, for testing. */
  omissions: string[];
  /** Dangerous causes the audit added, for testing. */
  auditAdded: string[];
}

// Role outputs. Validators turn raw model JSON into these shapes; code then
// applies the guards before anything reaches the case.

export interface CandidateDraft {
  id?: string;
  label: string;
  tier: CauseTier;
  status: SupportLevel;
  for: string[];
  against: string[];
  askableNext: string[];
  needsInPerson: InPersonItem[];
}

export interface InterpreterOutput {
  complaints: ComplaintType[];
  history: Array<{ element: HistoryElement; status: 'filled' | 'unknown'; answerIds: string[] }>;
  candidates: CandidateDraft[];
  whatElse: string;
  contradictions: Array<{ answerIds: string[]; note: string }>;
  escalate: { level: ModelUrgency; reason: string; answerIds: string[] };
  emergency: { flagged: boolean; reason: string; answerIds: string[] };
  integrity: IntegrityFlag;
}

export interface PlannerOutput {
  questions: PlannedQuestion[];
  done: { proposed: boolean; reason: string };
}

export interface ReaderOutput {
  evidence: Array<Pick<EvidenceItem, 'kind' | 'element' | 'value' | 'patientWords' | 'language'>>;
  vague: boolean;
  followUp?: string;
  contradicts: string[];
  integrity: IntegrityFlag;
}

export interface CitedSentence {
  text: string;
  answerIds: string[];
}

export interface WriterOutput {
  briefing: CitedSentence[];
  summary: CitedSentence[];
  considerations: Array<{ causeId: string; status: SupportLevel; for: string[]; against: string[]; note: CitedSentence }>;
  exams: Array<{ what: string; settles: string[]; why: CitedSentence }>;
  askInRoom: AskInRoomItem[];
}
