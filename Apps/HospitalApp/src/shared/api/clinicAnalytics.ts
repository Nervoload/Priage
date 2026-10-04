import { client } from './client';

export interface FeedbackCounts { useful: number; notRight: number; missing: number }

export interface AssessmentAnalytics {
  days: number;
  since: string;
  truncated: boolean;
  visits: number;
  urgency: { clear: number; caution: number; escalate: number; unrated: number };
  emergency: { shown: number; continued: number };
  askInRoom: { suggested: number; asked: number; answered: number };
  clinicQuestions: { inInterview: number; afterInterview: number; missing: number };
  feedback: {
    totals: FeedbackCounts;
    bySection: Array<{ sectionKey: string } & FeedbackCounts>;
    byRule: Array<{ ruleId: string } & FeedbackCounts>;
    byGenerator: Array<{ generator: string } & FeedbackCounts>;
  };
  recentNotes: Array<{ kind: 'NOT_RIGHT' | 'MISSING'; sectionKey: string; ruleId: string | null; note: string; itemText: string | null; createdAt: string }>;
}

export const getAssessmentAnalytics = (days: number) => client<AssessmentAnalytics>(`/clinic-analytics/assessment?days=${days}`);
