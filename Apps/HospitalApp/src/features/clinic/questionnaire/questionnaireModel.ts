import type { ClinicQuestion, ClinicQuestionInputType } from '../../../shared/api/clinicQuestionnaire';

export const INPUT_TYPES: Array<{ value: ClinicQuestionInputType; label: string }> = [
  { value: 'boolean', label: 'Yes or no' },
  { value: 'single_select', label: 'One choice' },
  { value: 'text', label: 'Short answer' },
];

/** A new custom question with a key that won't clash with the others. */
export function newQuestion(existing: ClinicQuestion[], random: () => number = Math.random): ClinicQuestion {
  const taken = new Set(existing.map((question) => question.key));
  let key = '';
  do { key = `q_${Math.floor(random() * 36 ** 6).toString(36).padStart(6, '0')}`; } while (taken.has(key));
  return { key, origin: 'custom', prompt: '', helpText: null, inputType: 'boolean', choices: [] };
}

export function moveQuestion(list: ClinicQuestion[], index: number, delta: -1 | 1): ClinicQuestion[] {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** Switching to one-choice starts with two empty choices; other types have none. */
export function withInputType(question: ClinicQuestion, inputType: ClinicQuestionInputType): ClinicQuestion {
  if (question.inputType === inputType) return question;
  return { ...question, inputType, choices: inputType === 'single_select' ? (question.choices.length ? question.choices : ['', '']) : [] };
}

const clean = (value: string | null | undefined) => (value ?? '').trim().replace(/\s+/g, ' ');

/** What has to change before this question can be published. Mirrors the server's checks. */
export function questionProblems(question: ClinicQuestion): string[] {
  const problems: string[] = [];
  const prompt = clean(question.prompt);
  if (prompt.length < 5) problems.push('Write the question (at least 5 characters).');
  if (prompt.length > 200) problems.push('Keep the question under 200 characters.');
  if (clean(question.helpText).length > 200) problems.push('Keep the help text under 200 characters.');
  if (question.inputType === 'single_select') {
    const choices = question.choices.map(clean).filter(Boolean);
    if (choices.length < 2 || choices.length > 6) problems.push('Give 2 to 6 choices.');
    if (new Set(choices.map((choice) => choice.toLowerCase())).size !== choices.length) problems.push('Each choice needs to be different.');
    if (choices.some((choice) => choice.length > 80)) problems.push('Keep each choice under 80 characters.');
  }
  return problems;
}

/** The questions as they'll be sent: trimmed, with empty choices dropped. */
export function normalizeQuestions(list: ClinicQuestion[]): ClinicQuestion[] {
  return list.map((question) => ({
    ...question,
    prompt: clean(question.prompt),
    helpText: clean(question.helpText) || null,
    choices: question.inputType === 'single_select' ? question.choices.map(clean).filter(Boolean) : [],
  }));
}

export function sameQuestions(left: ClinicQuestion[], right: ClinicQuestion[]): boolean {
  return JSON.stringify(normalizeQuestions(left)) === JSON.stringify(normalizeQuestions(right));
}

/** Priage defaults the clinic removed, so they can be added back. */
export function missingDefaults(list: ClinicQuestion[], defaults: ClinicQuestion[]): ClinicQuestion[] {
  const keys = new Set(list.map((question) => question.key));
  return defaults.filter((question) => !keys.has(question.key));
}

export function questionCountWords(count: number): string {
  return count === 0 ? 'no questions' : `${count} question${count === 1 ? '' : 's'}`;
}
