import { Injectable } from '@nestjs/common';

import type {
  AiTriageAnswer,
  AiTriageMandatoryAnswers,
  AiTriagePatientContext,
  AiTriageProviderOutput,
  AiTriageSummary,
} from '../types/ai-triage.types';

@Injectable()
export class AiTriageSummaryService {
  merge(
    patient: AiTriagePatientContext,
    mandatory: AiTriageMandatoryAnswers,
    answers: AiTriageAnswer[],
    output?: AiTriageProviderOutput | null,
    forcedRedFlags: string[] = [],
  ): AiTriageSummary {
    const redFlags = [...new Set([...(output?.redFlags ?? []), ...forcedRedFlags])];
    const urgency = forcedRedFlags.length > 0 ? 'emergency' : (output?.urgency ?? this.inferUrgency(patient, answers));
    const complaint = patient.chiefComplaint?.trim() || 'Not provided';
    const denied = answers
      .filter((entry) => /^(no|none|denied|not experiencing)\b/i.test(entry.answer.trim()))
      .map((entry) => `${entry.question}: ${entry.answer}`);
    const reported = answers
      .filter((entry) => !/^(no|none|unknown|prefer not|cannot answer|unable to answer)\b/i.test(entry.answer.trim()))
      .map((entry) => `${entry.question}: ${entry.answer}`);
    const unknown = answers
      .filter((entry) => /^(unknown|prefer not|cannot answer|unable to answer)\b/i.test(entry.answer.trim()))
      .map((entry) => entry.question);
    const historyUnknown = /^(unknown|prefer not|not applicable)$/i.test(mandatory.relevantHistory.trim());
    const historyNone = /^(none|no|not applicable)$/i.test(mandatory.relevantHistory.trim());
    const severity = typeof mandatory.severity === 'number'
      ? `${mandatory.severity}/10`
      : mandatory.severity.replaceAll('_', ' ');
    const briefing = output?.briefing?.trim()
      || [
        `Chief concern (patient's words): ${complaint}.`,
        `Onset: ${mandatory.onset}. Severity: ${severity}. Progression: ${mandatory.progression}.`,
        ...reported.slice(0, 6),
      ].join(' ');
    return {
      chiefComplaint: complaint,
      originalChiefComplaint: complaint,
      onset: mandatory.onset,
      severity,
      progression: mandatory.progression,
      relevantSymptoms: reported,
      relevantNegatives: denied,
      medicalHistory: historyUnknown || historyNone ? [] : [`Patient reported: ${mandatory.relevantHistory}`],
      medications: [],
      allergies: [],
      additionalContext: historyUnknown || historyNone ? [] : [mandatory.relevantHistory],
      unansweredImportantQuestions: [
        ...(historyUnknown ? ['Relevant medical conditions, allergies, or medications'] : []),
        ...unknown,
      ],
      urgentWarningSigns: redFlags,
      urgency,
      redFlags,
      briefing,
      recommendedAction: forcedRedFlags.length > 0
        ? 'Immediate staff review required; the software cannot determine the cause or confirm severity.'
        : output?.recommendedAction?.trim() || 'Qualified clinical review is required.',
    };
  }

  private inferUrgency(patient: AiTriagePatientContext, answers: AiTriageAnswer[]): AiTriageSummary['urgency'] {
    const text = [patient.chiefComplaint, patient.details, ...answers.map((entry) => entry.answer)].filter(Boolean).join(' ').toLowerCase();
    if (/(severe|rapidly worse|high fever|faint|blood|breath)/.test(text)) return 'high';
    if (/(pain|fever|vomit|dizz|worse)/.test(text)) return 'medium';
    return 'low';
  }
}
