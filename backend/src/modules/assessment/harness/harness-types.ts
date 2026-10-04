import type {
  InterviewAnswerRecord, InterviewClientState, InterviewQuestion, InterviewStateSnapshot,
} from '../../intake/interview/triage-interview.types';
import type { RescueBankKey } from '../../intake/interview/rescue-question-bank';
import type { AnswerSpec } from '../case/answers';
import type { StopReason } from '../case/stop-rule';
import type {
  AnsweredBy, AssessmentInputType, CommunicationNeeds, DurationUnit, HistoryElement, Language, ModelUrgency, PlannedQuestion, RoundType,
} from '../case/types';
import type { AssessmentMode } from '../assessment-config';

export const HARNESS_ENGINE = 'assessment-harness@1';

export type QuestionSource = 'safety' | 'clinic' | 'bank' | 'model' | 'fallback' | 'follow_up';

/** A question as served. A superset of the legacy question, so existing readers (Care, emergency events) still parse it. */
export interface HarnessQuestion extends Omit<InterviewQuestion, 'inputType'> {
  inputType: AssessmentInputType;
  /** The prompt in English; `prompt` is in the patient's language. */
  englishPrompt: string;
  language: Language;
  machineTranslated: boolean;
  /** English canonical value for each shown choice. Server-only. */
  choiceKeys: string[];
  allowNotSure: boolean;
  notSureLabel: string;
  /** Multi-select offers an exclusive "None of these". */
  noneOption: boolean;
  noneLabel: string;
  scale?: { min: number; max: number; minLabel: string; maxLabel: string };
  units?: Record<DurationUnit, string>;
  maxLength?: number;
  source: QuestionSource;
  element?: HistoryElement;
  bankKey?: RescueBankKey;
  /** What the question is for. Server-only; it can name possible causes. */
  plan?: PlannedQuestion;
}

/** An answer as stored. A superset of the legacy record, so Care reads it unchanged. */
export interface HarnessAnswerRecord extends Omit<InterviewAnswerRecord, 'inputType'> {
  inputType: AssessmentInputType;
  /** Unique per answer: the question id, or `<qid>:correction:<n>` for a correction. */
  answerId: string;
  /** The answer this one corrects. */
  correctionOf?: string;
  /** What the patient chose or wrote, in their language. `answerText` is English. */
  originalText: string;
  displayPrompt: string;
  language: Language;
  machineTranslated: boolean;
  notSure: boolean;
  valueChoices?: string[];
  valueDuration?: { amount: number; unit: DurationUnit };
  answeredBy: AnsweredBy;
  questionSource: QuestionSource;
  element?: HistoryElement;
  bankKey?: RescueBankKey;
  /** How the answer was checked, so a correction is checked the same way. */
  spec: AnswerSpec;
  /** The question as served, without its plan, so the review screen can show and re-ask it. */
  question: ClientQuestion;
  /** What the question was for. Server-only. */
  plan?: PlannedQuestion;
}

export interface HarnessPlanning {
  token: string;
  startedAt: string;
  /** When the patient was left without a question; the fallback serves a bank question after the wait limit. */
  waitingSince: string | null;
  fallbackServed: boolean;
}

export interface HarnessBlock {
  engine: typeof HARNESS_ENGINE;
  packId: string;
  communication: CommunicationNeeds;
  /** Modes pinned when the assessment started. */
  modelQuestions: AssessmentMode;
  budget: number;
  minQuestions: number;
  round: number;
  roundType: RoundType | null;
  /** Planned questions not yet served. Server-only. */
  queue: PlannedQuestion[];
  planning: HarnessPlanning | null;
  caseVersion: number;
  urgency: { model: ModelUrgency; reasons: string[]; answerIds: string[] };
  stopReason: StopReason | null;
  /** Follow-ups asked so far, so a vague answer gets only one. */
  followUps: number;
}

/** The stored state: the legacy snapshot plus the harness block. */
export interface HarnessState extends Omit<InterviewStateSnapshot, 'status' | 'currentQuestion' | 'cachedQuestions' | 'pendingCandidates' | 'answers'> {
  status: InterviewStateSnapshot['status'] | 'review';
  currentQuestion: HarnessQuestion | null;
  /** Always empty for the harness: the queue lives in `harness.queue`. */
  cachedQuestions: [];
  pendingCandidates: [];
  answers: HarnessAnswerRecord[];
  harness: HarnessBlock;
}

/** A question as the patient app sees it: no plan, no English keys. */
export type ClientQuestion = Omit<HarnessQuestion, 'plan' | 'choiceKeys' | 'englishPrompt'>;

export interface ReviewItem {
  questionPublicId: string;
  prompt: string;
  answer: string;
  /** The safety question can't be changed here. */
  canChange: boolean;
  question: ClientQuestion | null;
}

export interface AssessmentClientState extends Omit<InterviewClientState, 'status' | 'currentQuestion' | 'cachedQuestions'> {
  status: HarnessState['status'];
  currentQuestion: ClientQuestion | null;
  cachedQuestions: [];
  harness: {
    engine: typeof HARNESS_ENGINE;
    language: Language;
    answeredBy: AnsweredBy;
    /** Set while the next question is being prepared; poll after this many ms. */
    waiting: { since: string; pollAfterMs: number } | null;
    review: ReviewItem[] | null;
  };
}
