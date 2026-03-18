export const TRIAGE_INTERVIEW_OUTPUT_SCHEMA_PROMPT_V2 = `
Return a strict JSON object with these fields:
- phase: "urgent" | "emergent" | "history"
- sessionGoal: short string describing the minimum information goal for this session
- targetQuestionCount: integer total dynamic-question target for the entire session
- shouldComplete: boolean
- completionReason: short string
- urgency: "low" | "medium" | "high" | "emergency"
- redFlags: string[]
- recommendedAction: short string for staff-facing handoff summary
- summaryPreview: short staff-facing summary of the current intake picture
- interrupt: object with:
  - type: "none" | "emergency_ack_required"
  - title: string
  - body: string
  - recommendation: string
  - reason: string
- questions: array of question objects where each item contains:
  - phase
  - inputType
  - prompt
  - helpText
  - placeholder
  - required
  - choices
  - clinicalReason
  - askIfAmbiguous

When no interrupt is needed, use interrupt.type="none" and leave the interrupt strings empty.
When no more questions are needed, return questions=[] and shouldComplete=true.
`.trim();
