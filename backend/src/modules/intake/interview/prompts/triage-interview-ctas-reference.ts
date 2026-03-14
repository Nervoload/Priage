import type { InterviewAnswerRecord, InterviewPatientContext } from '../triage-interview.types';

type CueFamily = {
  id: string;
  title: string;
  keywords: RegExp[];
  cues: string[];
  redFlags: string[];
};

const CTAS_CUE_FAMILIES_V2: CueFamily[] = [
  {
    id: 'general',
    title: 'General emergency cues',
    keywords: [/.*/],
    cues: [
      'Identify abrupt worsening, instability, or inability to wait safely.',
      'Prefer fewer sharper questions over broad surveys.',
      'Escalate if severe pain, collapse, or rapid deterioration appears.',
    ],
    redFlags: [
      'Sudden collapse',
      'Rapidly worsening symptoms',
      'Unable to wait safely',
    ],
  },
  {
    id: 'cardio_respiratory',
    title: 'Cardio-respiratory cues',
    keywords: [
      /\b(chest|pressure|palpitation|heart)\b/,
      /\b(shortness of breath|trouble breathing|can.?t breathe|cannot breathe|wheez)\b/,
      /\b(blue lips|cyanosis)\b/,
    ],
    cues: [
      'Clarify chest pressure, breathing difficulty, collapse, or exertional worsening early.',
      'Ask quickly about associated diaphoresis, fainting, and inability to speak full sentences.',
    ],
    redFlags: [
      'Central chest pain',
      'Severe shortness of breath',
      'Cyanosis or near-collapse',
    ],
  },
  {
    id: 'neurologic',
    title: 'Neurologic cues',
    keywords: [
      /\b(stroke|weakness|numb|speech|confusion|seizure|vision|faint|headache)\b/,
    ],
    cues: [
      'Clarify new focal deficits, altered mental status, seizure, or thunderclap headache early.',
      'Prioritize timing, persistence, and associated neurologic symptoms.',
    ],
    redFlags: [
      'New weakness or facial droop',
      'Speech difficulty or confusion',
      'Seizure or sudden severe headache',
    ],
  },
  {
    id: 'abdominal_pelvic',
    title: 'Abdominal and pelvic cues',
    keywords: [
      /\b(abdominal|abdomen|stomach|belly|pelvic|vomit|vomiting|diarrhea|pregnan)\b/,
    ],
    cues: [
      'Clarify severity, repeated vomiting, blood loss, dehydration, pregnancy-relevant context, and migration of pain.',
      'Differentiate severe constant pain from milder self-limited symptoms.',
    ],
    redFlags: [
      'Severe constant abdominal pain',
      'Repeated vomiting or dehydration',
      'Pregnancy-relevant bleeding or pain',
    ],
  },
  {
    id: 'trauma_orthopedic',
    title: 'Trauma and orthopedic cues',
    keywords: [
      /\b(injury|fall|fracture|broken|sprain|cut|bleed|bleeding|wound|burn)\b/,
    ],
    cues: [
      'Clarify mechanism, inability to move or bear weight, heavy bleeding, and head injury symptoms.',
      'Prioritize instability and major trauma features before routine pain questions.',
    ],
    redFlags: [
      'Heavy bleeding',
      'Major fall or head injury',
      'Unable to move or bear weight',
    ],
  },
  {
    id: 'infection_fever',
    title: 'Infection and fever cues',
    keywords: [
      /\b(fever|infection|chills|cough|sore throat|urine|burning|rash)\b/,
    ],
    cues: [
      'Clarify fever, dehydration, breathing difficulty, severe pain, and immunocompromise.',
      'Differentiate mild infectious symptoms from systemic decline.',
    ],
    redFlags: [
      'Fever with shortness of breath',
      'Severe dehydration',
      'Rapid systemic worsening',
    ],
  },
  {
    id: 'allergy_anaphylaxis',
    title: 'Allergy and anaphylaxis cues',
    keywords: [
      /\b(allergy|allergic|anaphylaxis|hives|swelling|tongue|throat)\b/,
    ],
    cues: [
      'Clarify throat swelling, breathing changes, fainting, and rapid progression immediately.',
      'Do not delay emergency interruption if breathing or swelling red flags appear.',
    ],
    redFlags: [
      'Throat swelling',
      'Breathing change after exposure',
      'Rapid spreading reaction',
    ],
  },
];

function buildContextText(patient: InterviewPatientContext, answers: InterviewAnswerRecord[]): string {
  return [
    patient.chiefComplaint,
    patient.details,
    ...answers.map((answer) => `${answer.prompt} ${answer.answerText}`),
  ].filter(Boolean).join(' ').toLowerCase();
}

export function selectCtasCueFamilies(
  patient: InterviewPatientContext,
  answers: InterviewAnswerRecord[],
): CueFamily[] {
  const context = buildContextText(patient, answers);

  const ranked = CTAS_CUE_FAMILIES_V2
    .map((family) => ({
      family,
      score: family.keywords.reduce((total, pattern) => total + (pattern.test(context) ? 1 : 0), 0),
    }))
    .filter((entry) => entry.family.id === 'general' || entry.score > 0)
    .sort((left, right) => right.score - left.score);

  const selected = ranked
    .filter((entry) => entry.family.id !== 'general')
    .slice(0, 3)
    .map((entry) => entry.family);

  if (selected.length === 0) {
    return [CTAS_CUE_FAMILIES_V2[0]];
  }

  return [CTAS_CUE_FAMILIES_V2[0], ...selected];
}

export function renderSelectedCtasCues(
  patient: InterviewPatientContext,
  answers: InterviewAnswerRecord[],
): string {
  const families = selectCtasCueFamilies(patient, answers);

  return [
    'CTAS-oriented reference cues for this patient context:',
    ...families.map((family) => [
      `${family.title}:`,
      ...family.cues.map((cue) => `- ${cue}`),
      ...family.redFlags.map((flag) => `- Red flag example: ${flag}`),
    ].join('\n')),
    'Use CTAS only as a questioning aid. Do not state CTAS levels, diagnose, or provide treatment plans.',
  ].join('\n\n');
}
