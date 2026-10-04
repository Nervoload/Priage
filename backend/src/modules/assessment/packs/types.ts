import type { RescueBankKey } from '../../intake/interview/rescue-question-bank';
import type {
  AnswerOutcome, AssessmentInputType, Audience, BodySystem, CauseTier, HistoryElement, Language, RoundType, ScaleSpec,
} from '../case/types';

/** One string per language and audience ("you", "your child", "the person you're helping"). */
export type Wording = Record<Language, Record<Audience, string>>;
export type Localized = Record<Language, string>;

export interface AgeRange {
  min?: number;
  max?: number;
}

export interface Applicability {
  sex?: 'female' | 'male';
  ages?: AgeRange;
  /** Audiences the question may be asked to; others get it as an ask-in-the-room item. */
  audiences?: Audience[];
}

/** A dangerous cause the audit makes sure was considered. Never shown to the interpreter. */
export interface PackCause {
  id: string;
  label: string;
  tier: CauseTier;
  systems: BodySystem[];
  /** When set, the patient's words must also match before the audit adds it, so a sprained knee isn't screened for spinal compression. */
  keywords?: RegExp;
  sex?: 'female' | 'male';
  ages?: AgeRange;
  /** Lower-case names the model might use for it. */
  synonyms: string[];
  screenBankIds: string[];
  /** Set when the screen belongs with the clinician, not a self-administered form. */
  askInRoom?: Localized;
}

export interface BankQuestion {
  id: string;
  role: 'core' | 'filler' | 'screen' | 'closing';
  wording: Wording;
  help?: Localized;
  format: AssessmentInputType;
  /** English canonical choices with their French labels. */
  choices?: Localized[];
  scale?: ScaleSpec;
  /** Longest accepted text answer. */
  maxLength?: number;
  purpose: RoundType;
  element?: HistoryElement;
  targets: string[];
  /** Keyed by English answer. */
  ifAnswered: AnswerOutcome[];
  allowNotSure: boolean;
  when?: Applicability;
  /** Clinic Care rules recognise these questions by key. */
  bankKey?: RescueBankKey;
}

export interface KnowledgePack {
  id: string;
  version: string;
  /** False until the clinical owner approves the pack. */
  reviewed: boolean;
  approvedBy: string | null;
  coreHistory: HistoryElement[];
  /** Bank ids in the order they're asked: core facts, fillers (most needed first), then the closing question. */
  order: { core: string[]; fillers: string[]; closing: string };
  causes: PackCause[];
  bank: BankQuestion[];
}
