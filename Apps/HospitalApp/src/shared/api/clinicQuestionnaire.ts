import { client } from './client';

export type ClinicQuestionInputType = 'boolean' | 'single_select' | 'text';

export interface ClinicQuestion {
  key: string;
  origin: 'default' | 'custom';
  prompt: string;
  helpText: string | null;
  inputType: ClinicQuestionInputType;
  choices: string[];
}

export interface ClinicQuestionnaireView {
  locked: Array<{ key: string; prompt: string; inputType: 'boolean'; why: string }>;
  defaults: ClinicQuestion[];
  maxQuestions: number;
  current: { version: number; questions: ClinicQuestion[]; publishedAt: string; publishedByUserId: number } | null;
  draft: ClinicQuestion[];
  history: Array<{ version: number; questionCount: number; publishedAt: string; publishedByUserId: number }>;
}

export type ClinicQuestionsStatus = 'none' | 'pending' | 'answered';

export const getClinicQuestionnaire = () => client<ClinicQuestionnaireView>('/clinic-questionnaire');
export const publishClinicQuestionnaire = (expectedVersion: number, questions: ClinicQuestion[]) =>
  client<ClinicQuestionnaireView>('/clinic-questionnaire', { method: 'PUT', body: JSON.stringify({ expectedVersion, questions }) });
