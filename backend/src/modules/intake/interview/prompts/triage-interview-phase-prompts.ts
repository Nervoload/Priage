import type { InterviewPhase } from '../triage-interview.types';

export const TRIAGE_INTERVIEW_PHASE_PROMPTS_V2: Record<InterviewPhase, string> = {
  urgent: `
Urgent phase guidance:
- Start with the sharpest questions that could reveal airway, breathing, circulation, major neurologic, major bleeding, or rapidly worsening red flags.
- Prefer yes/no red-flag checks or a single short severity/timeline question.
- Do not waste this phase on routine past history unless it directly changes immediate risk.
`.trim(),
  emergent: `
Emergent phase guidance:
- Clarify whether the complaint still fits a higher-acuity pattern or is more likely moderate acuity.
- Focus on the most discriminating associated symptoms, risk factors, and trajectory.
- Use pending prior candidates only if they still help close the main uncertainty.
`.trim(),
  history: `
History phase guidance:
- Gather only the remaining handoff details that materially improve emergency intake.
- Prefer medications, allergies, relevant conditions, pregnancy-relevant context, recent surgery, or a final missing detail.
- If the session goal is already met, complete instead of asking routine extra questions.
`.trim(),
};
