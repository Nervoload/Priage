// Settings for the clinic assessment harness, read from the environment.
// See docs/AI_ASSESSMENT_HARNESS.md and backend/.env.example.

export type AssessmentEngine = 'harness' | 'legacy';
export type AssessmentDriverName = 'none' | 'openai' | 'fake';
export type AssessmentMode = 'off' | 'shadow' | 'on';

export interface AssessmentConfig {
  /** Which engine new clinic assessments use. A running assessment keeps the engine it started with. */
  engine: AssessmentEngine;
  driver: AssessmentDriverName;
  /** Whether model-planned questions are off, planned but not shown (shadow), or shown. */
  modelQuestions: AssessmentMode;
  /** Whether the model's handoff is off, stored but not shown in Care (shadow), or shown. */
  handoff: AssessmentMode;
  /** Harness questions per assessment; the safety question and the clinic's questions don't count. */
  budget: number;
  minQuestions: number;
  roundSize: number;
  /** How long a patient may wait with no question before the bank fallback, in ms. */
  waitFallbackMs: number;
}

const isTrue = (value: string | undefined) => ['1', 'true', 'yes', 'on'].includes((value || '').trim().toLowerCase());

function choice<T extends string>(raw: string | undefined, allowed: readonly T[], fallback: T, name: string): T {
  const value = (raw || '').trim().toLowerCase();
  if (!value) return fallback;
  if (!(allowed as readonly string[]).includes(value)) throw new Error(`${name} must be one of: ${allowed.join(', ')}`);
  return value as T;
}

function whole(raw: string | undefined, fallback: number, min: number, max: number, name: string): number {
  if (!raw?.trim()) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} must be a whole number from ${min} to ${max}`);
  return value;
}

const isProductionBuild = (env: NodeJS.ProcessEnv) => (env.NODE_ENV || '').trim().toLowerCase() === 'production';

export function readAssessmentConfig(env: NodeJS.ProcessEnv = process.env): AssessmentConfig {
  const production = isProductionBuild(env);
  return {
    // Legacy by default until the patient and staff apps can render every harness format.
    engine: choice(env.CLINIC_ASSESSMENT_ENGINE, ['harness', 'legacy'] as const, 'legacy', 'CLINIC_ASSESSMENT_ENGINE'),
    driver: choice(env.ASSESSMENT_AI_DRIVER, ['none', 'openai', 'fake'] as const, 'none', 'ASSESSMENT_AI_DRIVER'),
    modelQuestions: choice(env.ASSESSMENT_MODEL_QUESTIONS, ['off', 'shadow', 'on'] as const, 'on', 'ASSESSMENT_MODEL_QUESTIONS'),
    handoff: choice(env.CLINIC_HANDOFF_MODE, ['off', 'shadow', 'on'] as const, production ? 'off' : 'shadow', 'CLINIC_HANDOFF_MODE'),
    budget: whole(env.ASSESSMENT_QUESTION_BUDGET, 15, 3, 30, 'ASSESSMENT_QUESTION_BUDGET'),
    minQuestions: whole(env.ASSESSMENT_MIN_QUESTIONS, 3, 0, 10, 'ASSESSMENT_MIN_QUESTIONS'),
    roundSize: whole(env.ASSESSMENT_ROUND_SIZE, 3, 2, 4, 'ASSESSMENT_ROUND_SIZE'),
    waitFallbackMs: whole(env.ASSESSMENT_WAIT_FALLBACK_MS, 4000, 1000, 30000, 'ASSESSMENT_WAIT_FALLBACK_MS'),
  };
}

/**
 * Production builds keep the legacy clinic engine and no external model until
 * an approved Canadian provider exists. Internal staging (a production build
 * with PILOT_INTERNAL_STAGING=true) may run the harness with the bank-only or
 * fake driver to rehearse the flow; real model settings stay forbidden.
 */
export function assertAssessmentProductionConfig(env: NodeJS.ProcessEnv = process.env): void {
  if (!isProductionBuild(env)) return;
  const config = readAssessmentConfig(env);
  const staging = isTrue(env.PILOT_INTERNAL_STAGING);
  if (config.engine === 'harness' && !staging) {
    throw new Error('CLINIC_ASSESSMENT_ENGINE=harness is only allowed on internal staging until an approved regional provider is configured');
  }
  if (config.driver === 'openai') {
    throw new Error('ASSESSMENT_AI_DRIVER=openai is not permitted in production until an approved regional provider is configured');
  }
  if (env.ASSESSMENT_AI_API_KEY?.trim() || env.ASSESSMENT_AI_BASE_URL?.trim()) {
    throw new Error('External assessment AI configuration is not permitted in production');
  }
  if (config.handoff !== 'off' && !staging) {
    throw new Error('CLINIC_HANDOFF_MODE must be off in production');
  }
}
