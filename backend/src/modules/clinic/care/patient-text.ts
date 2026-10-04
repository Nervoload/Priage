// Small, explainable text matching over the patient's own words. A match is
// "denied" when a negation appears earlier in the same clause ("no chest
// pain", "I haven't fainted"), otherwise "reported".

const NEGATION = /\b(no|not|denies|denied|without|never|none|nor|don'?t|doesn'?t|didn'?t|isn'?t|aren'?t|wasn'?t|haven'?t|hasn'?t|can'?t say)\b/i;

/** Phrases that look like a symptom keyword but are not one. */
const NOT_SYMPTOMS = /\b(blood (pressure|test|tests|work|sugar|sugars|type)|breathing (exercises?|treatments?|machine))\b/gi;

/** Phones type curly apostrophes ("isn’t"); the patterns are written with straight ones. */
const straightApostrophes = (text: string) => text.replace(/[\u2018\u2019\u02BC]/g, "'");

export type MentionStatus = 'reported' | 'denied' | 'none';

export interface Mention {
  status: MentionStatus;
  /** The clause the match was found in, trimmed. */
  clause: string | null;
}

export function splitClauses(text: string): string[] {
  return text
    .split(/[.;!?\n]+|,|\bbut\b|\bhowever\b/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Looks for a pattern in free text. A reported mention anywhere wins over a
 * denied one, so "no fever yesterday, but fever today" counts as reported.
 */
export function findMention(text: string | null | undefined, pattern: RegExp): Mention {
  if (!text?.trim()) return { status: 'none', clause: null };
  const flags = pattern.flags.replace('g', '');
  const matcher = new RegExp(pattern.source, flags.includes('i') ? flags : `${flags}i`);
  let denied: string | null = null;
  for (const clause of splitClauses(straightApostrophes(text))) {
    const cleaned = clause.replace(NOT_SYMPTOMS, ' ');
    const match = matcher.exec(cleaned);
    if (!match) continue;
    const before = cleaned.slice(0, match.index);
    if (NEGATION.test(before)) {
      denied ??= clause;
      continue;
    }
    return { status: 'reported', clause };
  }
  return denied ? { status: 'denied', clause: denied } : { status: 'none', clause: null };
}

const VAGUE_TOKENS = ['not sure', 'unsure', 'maybe', 'idk', "i don't know", 'i dont know', 'unknown', 'a bit', 'kind of', 'no idea', 'dunno'];

/**
 * Uses the interview engine's hedging words, for free-text answers only, but a
 * hedged answer that still says something ("Ice and ibuprofen, it helps a bit")
 * isn't vague: at least two real words have to be left once the hedging is removed.
 */
export function isVagueAnswer(answerText: string, inputType: string): boolean {
  if (inputType === 'boolean' || inputType === 'number' || inputType === 'single_select') return false;
  const normalized = straightApostrophes(answerText.trim().toLowerCase());
  if (normalized.length < 3) return true;
  if (!VAGUE_TOKENS.some((token) => normalized.includes(token))) return false;
  const rest = VAGUE_TOKENS.reduce((value, token) => value.split(token).join(' '), normalized);
  return rest.split(/[^a-z0-9]+/).filter((word) => word.length > 2).length < 2;
}
