// The clinic's own questions, for patients who chose the clinic after an assessment elsewhere.

export type ClinicQuestion = { key: string; prompt: string; helpText: string | null; inputType: 'boolean' | 'single_select' | 'text'; choices: string[] };
export type ClinicQuestions = { status: 'none' | 'pending' | 'answered'; version: number | null; questions: ClinicQuestion[] };
export type Answer = { key: string; valueBoolean?: boolean; valueChoice?: string; valueText?: string };

/** The answer a field holds, or null when it still needs one. */
export function answerFor(question: ClinicQuestion, value: string | undefined): Answer | null {
  const text = value?.trim() ?? '';
  if (!text) return null;
  if (question.inputType === 'boolean') return text === 'Yes' || text === 'No' ? { key: question.key, valueBoolean: text === 'Yes' } : null;
  if (question.inputType === 'single_select') return question.choices.includes(text) ? { key: question.key, valueChoice: text } : null;
  return { key: question.key, valueText: text };
}
