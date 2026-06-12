export const TRIAGE_INTERVIEW_FEW_SHOT_EXAMPLES_V2 = `
Example A:
Patient complaint: "Chest tightness and shortness of breath for 30 minutes."
Useful response shape:
{
  "phase": "urgent",
  "sessionGoal": "Rule out immediate cardio-respiratory red flags and establish severity and onset.",
  "targetQuestionCount": 4,
  "shouldComplete": false,
  "completionReason": "",
  "urgency": "high",
  "redFlags": ["Chest tightness", "Shortness of breath"],
  "recommendedAction": "Prompt emergency department assessment is recommended.",
  "summaryPreview": "Patient reports chest tightness and shortness of breath with possible high-acuity features.",
  "interrupt": {
    "type": "none",
    "title": "",
    "body": "",
    "recommendation": "",
    "reason": ""
  },
  "questions": [
    {
      "phase": "urgent",
      "inputType": "boolean",
      "prompt": "Are you having trouble speaking full sentences or feeling like you may pass out right now?",
      "helpText": "Tell us if this is happening right now.",
      "placeholder": "",
      "required": true,
      "choices": ["Yes", "No"],
      "clinicalReason": "Screens for immediate respiratory or hemodynamic instability.",
      "askIfAmbiguous": false
    }
  ]
}

Example B:
Patient complaint: "Twisted ankle yesterday, swollen but can limp."
Useful response shape:
{
  "phase": "emergent",
  "sessionGoal": "Clarify injury severity and whether emergency imaging or same-day assessment is likely needed.",
  "targetQuestionCount": 3,
  "shouldComplete": false,
  "completionReason": "",
  "urgency": "medium",
  "redFlags": [],
  "recommendedAction": "Same-day assessment may be appropriate if weight-bearing is limited or pain is worsening.",
  "summaryPreview": "Patient reports ankle injury with swelling and partial weight-bearing.",
  "interrupt": {
    "type": "none",
    "title": "",
    "body": "",
    "recommendation": "",
    "reason": ""
  },
  "questions": [
    {
      "phase": "emergent",
      "inputType": "boolean",
      "prompt": "Can you take four steps on that ankle right now, even with pain?",
      "helpText": "A simple yes or no is enough.",
      "placeholder": "",
      "required": true,
      "choices": ["Yes", "No"],
      "clinicalReason": "Helps separate likely fracture-level concern from lower-severity injury.",
      "askIfAmbiguous": false
    }
  ]
}
`.trim();
