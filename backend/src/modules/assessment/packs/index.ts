import type { Audience, PlannedQuestion } from '../case/types';
import type { Applicability, BankQuestion, KnowledgePack } from './types';
import { UNCLEAR_PACK } from './unclear.pack';

export type { BankQuestion, KnowledgePack, PackCause, Wording, Localized } from './types';

const PACKS: Record<string, KnowledgePack> = { [UNCLEAR_PACK.id]: UNCLEAR_PACK };

export const DEFAULT_PACK_ID = UNCLEAR_PACK.id;

export function packById(id: string): KnowledgePack {
  const pack = PACKS[id];
  if (!pack) throw new Error(`Unknown knowledge pack: ${id}`);
  return pack;
}

export function bankById(pack: KnowledgePack, id: string): BankQuestion | null {
  return pack.bank.find((question) => question.id === id) ?? null;
}

export interface SubjectContext {
  age: number | null;
  sex: 'female' | 'male' | null;
  audience: Audience;
}

/** Whether a bank item applies to this person. Unknown age or sex counts as a match. */
export function applies(when: Applicability | undefined, subject: SubjectContext): boolean {
  if (!when) return true;
  if (when.sex && subject.sex && when.sex !== subject.sex) return false;
  if (when.ages && subject.age != null) {
    if (when.ages.min != null && subject.age < when.ages.min) return false;
    if (when.ages.max != null && subject.age > when.ages.max) return false;
  }
  if (when.audiences && !when.audiences.includes(subject.audience)) return false;
  return true;
}

/** A bank item as a planned question. The text is the English "you" wording; the materializer picks the served wording. */
export function bankToPlanned(question: BankQuestion, source: PlannedQuestion['source'] = 'bank'): PlannedQuestion {
  return {
    key: question.id,
    text: question.wording.en.self,
    format: question.format,
    ...(question.choices ? { choices: question.choices.map((choice) => choice.en) } : {}),
    ...(question.scale ? { scale: question.scale } : {}),
    bankId: question.id,
    purpose: question.purpose,
    ...(question.element ? { element: question.element } : {}),
    targets: [...question.targets],
    ifAnswered: question.ifAnswered.map((outcome) => ({ ...outcome, effects: [...outcome.effects] })),
    patientCanAnswer: 'yes',
    burden: question.element === 'pregnancy_possible' ? 'medium' : 'low',
    allowNotSure: question.allowNotSure,
    source,
  };
}
