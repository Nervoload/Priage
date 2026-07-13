import { Injectable } from '@nestjs/common';

import type { AiTriagePatientContext } from '../types/ai-triage.types';

export interface AiTriageSafetyResult {
  urgent: boolean;
  redFlags: string[];
}

@Injectable()
export class AiTriageSafetyService {
  evaluate(patient: AiTriagePatientContext, latestAnswer = ''): AiTriageSafetyResult {
    const text = [patient.chiefComplaint, patient.details, latestAnswer]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const rules = [
      [/(can.?t breathe|cannot breathe|not breathing|blue lips)/, 'Severe breathing difficulty'],
      [/(severe|crushing|sudden|heavy).{0,30}(chest pain|chest pressure)|(chest pain|chest pressure).{0,50}(shortness of breath|can.?t breathe|sweating|faint)/, 'Possible high-risk chest symptoms'],
      [/(stroke|one.sided weakness|face droop|slurred speech)/, 'Possible stroke symptoms'],
      [/(unconscious|passed out|unresponsive|seizure)/, 'Loss of consciousness or seizure'],
      [/(heavy bleeding|won.?t stop bleeding|severe bleeding)/, 'Uncontrolled bleeding'],
      [/(anaphylaxis|throat closing|severe allergic)/, 'Severe allergic reaction'],
      [/(suicid|kill myself|harm myself|unsafe at home)/, 'Immediate safety concern'],
    ] as const;
    const redFlags = rules.filter(([pattern]) => pattern.test(text)).map(([, label]) => label);
    return { urgent: redFlags.length > 0, redFlags };
  }

  urgentMessage(): string {
    return 'Please alert a nearby hospital staff member immediately. If you are not currently at a healthcare facility, contact your local emergency service. This software cannot determine the cause or confirm the severity.';
  }
}
