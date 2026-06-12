import { Role } from '@prisma/client';

export const HOSPITAL_PAGE_KEYS = ['admit', 'triage', 'waiting', 'analytics', 'settings'] as const;
export type HospitalPageKey = typeof HOSPITAL_PAGE_KEYS[number];

export const HOSPITAL_INTAKE_RESPONSE_TYPES = ['text', 'textarea', 'boolean', 'number', 'select'] as const;
export type HospitalIntakeResponseType = typeof HOSPITAL_INTAKE_RESPONSE_TYPES[number];

export const HOSPITAL_INTAKE_APPLIES_TO = ['admit', 'triage', 'both'] as const;
export type HospitalIntakeAppliesTo = typeof HOSPITAL_INTAKE_APPLIES_TO[number];

export const HOSPITAL_SURVEY_RESPONSE_TYPES = ['scale', 'text', 'boolean'] as const;
export type HospitalSurveyResponseType = typeof HOSPITAL_SURVEY_RESPONSE_TYPES[number];

export interface HospitalCustomIntakeQuestion {
  id: string;
  fieldKey: string;
  label: string;
  helpText: string;
  required: boolean;
  responseType: HospitalIntakeResponseType;
  appliesTo: HospitalIntakeAppliesTo;
}

export interface HospitalFeedbackSurveyQuestion {
  id: string;
  prompt: string;
  description: string;
  required: boolean;
  responseType: HospitalSurveyResponseType;
}

export interface HospitalOperationalConfig {
  version: 1;
  pageAccess: Record<Role, HospitalPageKey[]>;
  customIntakeQuestions: HospitalCustomIntakeQuestion[];
  admittanceFeedbackSurvey: HospitalFeedbackSurveyQuestion[];
}

export interface HospitalFeedbackSubmission {
  id: string;
  createdAt: string;
  submittedBy: {
    userId: number;
    email: string;
    role: Role;
  };
  responses: Array<{
    questionId: string;
    prompt: string;
    answer: string | number | boolean;
  }>;
  bugReport?: string | null;
}

const PAGE_ORDER = new Map<HospitalPageKey, number>(
  HOSPITAL_PAGE_KEYS.map((page, index) => [page, index]),
);

const DEFAULT_PAGE_ACCESS: Record<Role, HospitalPageKey[]> = {
  [Role.ADMIN]: [...HOSPITAL_PAGE_KEYS],
  [Role.NURSE]: ['triage', 'waiting', 'analytics', 'settings'],
  [Role.STAFF]: ['admit', 'waiting', 'settings'],
  [Role.DOCTOR]: ['triage', 'waiting', 'analytics', 'settings'],
};

const DEFAULT_CUSTOM_INTAKE_QUESTIONS: HospitalCustomIntakeQuestion[] = [
  {
    id: 'interpreter_needed',
    fieldKey: 'interpreterNeeded',
    label: 'Interpreter needed',
    helpText: 'Flag whether the patient needs live interpretation support on arrival.',
    required: false,
    responseType: 'boolean',
    appliesTo: 'admit',
  },
  {
    id: 'mobility_support',
    fieldKey: 'mobilitySupport',
    label: 'Mobility support needs',
    helpText: 'Note wheelchair, walker, transfer help, or other mobility concerns.',
    required: false,
    responseType: 'textarea',
    appliesTo: 'admit',
  },
  {
    id: 'medication_risk_notes',
    fieldKey: 'medicationRiskNotes',
    label: 'Medication and risk notes',
    helpText: 'Capture medications or safety notes the triage clinician should see immediately.',
    required: true,
    responseType: 'textarea',
    appliesTo: 'triage',
  },
];

const DEFAULT_ADMITTANCE_FEEDBACK_SURVEY: HospitalFeedbackSurveyQuestion[] = [
  {
    id: 'intake_flow_rating',
    prompt: 'How smooth was the admittance workflow for your shift today?',
    description: 'Use 1 for blocked and 5 for smooth.',
    required: true,
    responseType: 'scale',
  },
  {
    id: 'handoff_quality',
    prompt: 'Did the intake information support clean handoff into triage?',
    description: 'Capture whether the team had what they needed at handoff.',
    required: true,
    responseType: 'boolean',
  },
  {
    id: 'workflow_notes',
    prompt: 'What should we improve for the admittance team next?',
    description: 'Share friction points, missing data, or workflow suggestions.',
    required: false,
    responseType: 'text',
  },
];

function slugify(value: string, fallback: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || fallback;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

function normalizePageAccessList(value: unknown, role: Role): HospitalPageKey[] {
  const raw = Array.isArray(value) ? value : DEFAULT_PAGE_ACCESS[role];
  const filtered = raw.filter((page): page is HospitalPageKey =>
    typeof page === 'string' && HOSPITAL_PAGE_KEYS.includes(page as HospitalPageKey),
  );
  const withSharedSettings = filtered.includes('settings') ? filtered : [...filtered, 'settings'];
  const deduped = uniqueStrings(withSharedSettings) as HospitalPageKey[];
  return deduped.sort((left, right) => (PAGE_ORDER.get(left) ?? 0) - (PAGE_ORDER.get(right) ?? 0));
}

function normalizeQuestionArray(value: unknown): HospitalCustomIntakeQuestion[] {
  if (!Array.isArray(value)) {
    return DEFAULT_CUSTOM_INTAKE_QUESTIONS;
  }

  return value
    .map((item, index): HospitalCustomIntakeQuestion | null => {
      if (!item || typeof item !== 'object') return null;

      const candidate = item as Record<string, unknown>;
      const label = typeof candidate.label === 'string' ? candidate.label.trim() : '';
      if (!label) return null;

      const fieldKey = slugify(
        typeof candidate.fieldKey === 'string' ? candidate.fieldKey : label,
        `custom_question_${index + 1}`,
      );
      const responseType = HOSPITAL_INTAKE_RESPONSE_TYPES.includes(candidate.responseType as HospitalIntakeResponseType)
        ? candidate.responseType as HospitalIntakeResponseType
        : 'text';
      const appliesTo = HOSPITAL_INTAKE_APPLIES_TO.includes(candidate.appliesTo as HospitalIntakeAppliesTo)
        ? candidate.appliesTo as HospitalIntakeAppliesTo
        : 'admit';

      return {
        id: slugify(typeof candidate.id === 'string' ? candidate.id : fieldKey, `custom_question_${index + 1}`),
        fieldKey,
        label,
        helpText: typeof candidate.helpText === 'string' ? candidate.helpText.trim() : '',
        required: Boolean(candidate.required),
        responseType,
        appliesTo,
      };
    })
    .filter((item): item is HospitalCustomIntakeQuestion => item !== null);
}

function normalizeSurveyArray(value: unknown): HospitalFeedbackSurveyQuestion[] {
  if (!Array.isArray(value)) {
    return DEFAULT_ADMITTANCE_FEEDBACK_SURVEY;
  }

  return value
    .map((item, index): HospitalFeedbackSurveyQuestion | null => {
      if (!item || typeof item !== 'object') return null;

      const candidate = item as Record<string, unknown>;
      const prompt = typeof candidate.prompt === 'string' ? candidate.prompt.trim() : '';
      if (!prompt) return null;

      const responseType = HOSPITAL_SURVEY_RESPONSE_TYPES.includes(candidate.responseType as HospitalSurveyResponseType)
        ? candidate.responseType as HospitalSurveyResponseType
        : 'text';

      return {
        id: slugify(
          typeof candidate.id === 'string' ? candidate.id : prompt,
          `feedback_question_${index + 1}`,
        ),
        prompt,
        description: typeof candidate.description === 'string' ? candidate.description.trim() : '',
        required: Boolean(candidate.required),
        responseType,
      };
    })
    .filter((item): item is HospitalFeedbackSurveyQuestion => item !== null);
}

export function getDefaultHospitalConfig(): HospitalOperationalConfig {
  return {
    version: 1,
    pageAccess: {
      [Role.ADMIN]: [...DEFAULT_PAGE_ACCESS[Role.ADMIN]],
      [Role.NURSE]: [...DEFAULT_PAGE_ACCESS[Role.NURSE]],
      [Role.STAFF]: [...DEFAULT_PAGE_ACCESS[Role.STAFF]],
      [Role.DOCTOR]: [...DEFAULT_PAGE_ACCESS[Role.DOCTOR]],
    },
    customIntakeQuestions: [...DEFAULT_CUSTOM_INTAKE_QUESTIONS],
    admittanceFeedbackSurvey: [...DEFAULT_ADMITTANCE_FEEDBACK_SURVEY],
  };
}

export function normalizeHospitalConfig(value: unknown): HospitalOperationalConfig {
  const defaults = getDefaultHospitalConfig();
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const pageAccess = raw.pageAccess && typeof raw.pageAccess === 'object'
    ? raw.pageAccess as Record<string, unknown>
    : {};

  return {
    version: 1,
    pageAccess: {
      [Role.ADMIN]: normalizePageAccessList(pageAccess.ADMIN, Role.ADMIN),
      [Role.NURSE]: normalizePageAccessList(pageAccess.NURSE, Role.NURSE),
      [Role.STAFF]: normalizePageAccessList(pageAccess.STAFF, Role.STAFF),
      [Role.DOCTOR]: normalizePageAccessList(pageAccess.DOCTOR, Role.DOCTOR),
    },
    customIntakeQuestions: normalizeQuestionArray(raw.customIntakeQuestions) || defaults.customIntakeQuestions,
    admittanceFeedbackSurvey: normalizeSurveyArray(raw.admittanceFeedbackSurvey) || defaults.admittanceFeedbackSurvey,
  };
}
