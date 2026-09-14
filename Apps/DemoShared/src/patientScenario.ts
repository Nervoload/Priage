// Scripted patient journey used only by the static browser runtime.
export const PATIENT_SCENARIO = {
  firstName: 'Taylor',
  lastName: 'Morgan',
  phone: '(416) 555-0199',
  age: 34,
  gender: 'Female',
  chiefComplaint: 'Headache after falling off my bike',
  details: 'I fell off my bike about two hours ago and hit the side of my helmet on the pavement. Since then, I have had a headache and felt a little dizzy.',
  allergies: 'No known allergies',
  conditions: 'No ongoing medical conditions',
  preferredLanguage: 'English',
  arrivalNote: 'A friend is bringing me to the emergency entrance.',
};

export const PATIENT_TEXT_ANSWERS: Record<string, string> = {
  'head-impact': 'My front wheel slipped while I was turning. I landed on my side and hit the right side of my helmet on the pavement. My helmet stayed on.',
  'head-context': 'I do not take any regular medications or blood thinners. No known allergies. My friend stayed with me after the fall.',
};

type ScriptedQuestion = {
  publicId: string;
  phase: 'urgent' | 'emergent' | 'history';
  inputType: 'boolean' | 'single_select' | 'number' | 'textarea';
  prompt: string;
  helpText: string;
  placeholder: string;
  required: boolean;
  choices: string[];
  clinicalReason: string;
  askIfAmbiguous: boolean;
};

const question = (value: Partial<ScriptedQuestion> & Pick<ScriptedQuestion, 'publicId' | 'prompt' | 'inputType'>): ScriptedQuestion => ({
  phase: 'history', helpText: '', placeholder: '', required: true, choices: [], clinicalReason: '', askIfAmbiguous: false, ...value,
});

export const PATIENT_QUESTIONS: ScriptedQuestion[] = [
  // Keep the mandatory gate identical to buildSafetyGateQuestion in the live intake service.
  question({
    publicId: 'safety_immediate_danger', phase: 'urgent', inputType: 'boolean',
    prompt: 'Are you in immediate danger right now?',
    helpText: 'If you have severe trouble breathing, central chest pain, heavy bleeding, stroke-like symptoms, or you feel unsafe waiting, tell us now.',
    choices: ['Yes', 'No'],
    clinicalReason: 'Immediate life-threatening check before the dynamic interview begins.',
  }),
  question({ publicId: 'head-impact', inputType: 'textarea', prompt: 'Can you tell us how you fell?', helpText: 'Include where you hit your head and whether you were wearing a helmet.' }),
  question({ publicId: 'head-onset', inputType: 'single_select', prompt: 'When did the fall happen?', helpText: 'Choose the closest time.', choices: ['Less than an hour ago', '1–3 hours ago', '3–24 hours ago', 'More than a day ago'] }),
  question({ publicId: 'head-consciousness', phase: 'urgent', inputType: 'single_select', prompt: 'Did you black out or lose consciousness?', helpText: 'Even a brief moment is helpful to mention.', choices: ['Yes', 'No', 'I’m not sure'] }),
  question({ publicId: 'head-symptoms', phase: 'emergent', inputType: 'single_select', prompt: 'Besides the headache, what are you noticing most?', helpText: 'Choose the option that best describes how you feel.', choices: ['Dizziness or feeling off balance', 'Nausea or vomiting', 'Blurred vision or sensitivity to light', 'Confusion or trouble remembering', 'None of these'] }),
  question({ publicId: 'head-pain', inputType: 'number', prompt: 'How strong is your headache right now?', helpText: 'Choose a number from 0 (no pain) to 10 (worst pain).' }),
  question({ publicId: 'head-worsening', phase: 'emergent', inputType: 'boolean', prompt: 'Has your headache been getting worse?', helpText: 'Think about how it feels now compared with just after the fall.' }),
  question({ publicId: 'head-context', inputType: 'textarea', prompt: 'Anything else your care team should know?', helpText: 'Include medications, blood thinners, allergies, or someone accompanying you.', required: false }),
];
