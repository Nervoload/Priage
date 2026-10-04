import type { RescueBankKey } from '../../intake/interview/rescue-question-bank';
import type { EmergencyEvent } from './emergency-events';
import { findMention, isVagueAnswer, type Mention } from './patient-text';

/**
 * Deterministic clinician handoff for clinic Care.
 *
 * Decision support only. These rules read the patient's own words (complaint,
 * note, answers) and never the generated summary, never assign CTAS, and list
 * the answers behind every item so a clinician can check them. Changing any
 * rule needs clinical-owner sign-off and a new CLINIC_HANDOFF_RULES_VERSION.
 * See docs/CLINIC_CARE_HANDOFF.md.
 */
export const CLINIC_HANDOFF_RULES_VERSION = 'clinic-handoff-rules@1';

export type UrgencyLevel = 'clear' | 'caution' | 'escalate';
export type AnswerSource = 'safety' | 'clinic' | 'ai';

export interface HandoffAnswer {
  questionId: string;
  prompt: string;
  answerText: string;
  inputType: string;
  phase: string;
  answeredAt: string;
  valueBoolean?: boolean;
  valueNumber?: number;
  source: AnswerSource;
  bankKey: RescueBankKey | null;
}

export interface HandoffInput {
  complaint: string;
  patientNote: string | null;
  age: number | null;
  gender: string | null;
  allergies: string | null;
  conditions: string | null;
  answers: HandoffAnswer[];
  unasked: Array<{ questionId: string; question: string }>;
  interview: { askedCount: number; maxQuestions: number };
  emergencyEvents: EmergencyEvent[];
  partial: boolean;
  /** Model-written case summary, used only when the interview ran in AI mode. */
  modelCaseSummary: string | null;
  /** Whether the clinic had its own questions for this visit, and whether they were all answered. */
  clinicQuestions?: { expected: boolean; answered: boolean };
}

export interface Reason { id: string; ruleId: string; text: string; refs: string[] }
export interface RedFlag { id: string; ruleId: string; label: string; refs: string[] }
export interface ScreenRow { domain: string; label: string; status: 'reported' | 'denied' | 'not_screened'; refs: string[] }
export interface AskItem { id: string; ruleId: string; text: string; why: string; basedOn: string[]; priority: 'must' | 'worth'; category: 'clarify' | 'sensitive' | 'exam' | 'history' }
export interface Gap { id: string; ruleId: string; kind: string; text: string; refs: string[] }
export interface NextStep { id: string; ruleId: string; text: string; refs: string[] }

export interface ClinicHandoff {
  rulesVersion: string;
  urgency: { level: UrgencyLevel; sentence: string; reasons: Reason[] };
  redFlags: RedFlag[];
  redFlagScreen: ScreenRow[];
  briefing: string;
  caseSummary: string;
  nextSteps: NextStep[];
  askInRoom: AskItem[];
  gaps: Gap[];
}

export const answerRef = (questionId: string) => `answer:${questionId}`;

interface Domain {
  key: string;
  label: string;
  pattern: RegExp;
  highRisk: boolean;
  /** Screened for every complaint. */
  generic: boolean;
  /** Complaints this domain matters for, when it isn't generic. */
  complaintLink?: RegExp;
  ask: string;
  sensitive?: boolean;
}

const DOMAINS: Domain[] = [
  { key: 'breathing', label: 'Trouble breathing', highRisk: true, generic: true,
    pattern: /short(ness)? of breath|can'?t breathe|cannot breathe|trouble breathing|difficulty breathing|hard to breathe|struggling to breathe|wheez\w*|breathless/,
    ask: 'Any shortness of breath or trouble breathing right now?' },
  { key: 'chest', label: 'Chest pain or pressure', highRisk: true, generic: false, complaintLink: /chest|heart|palpitat|breath/,
    pattern: /chest (pain|pressure|tightness|discomfort)|crushing (pain|pressure)|pain in (my|the) chest/,
    ask: 'Any chest pain, pressure or tightness?' },
  { key: 'neuro', label: 'Stroke-like or neurological signs', highRisk: true, generic: false, complaintLink: /head|dizz|numb|weak|vision|speech|faint|confus|seizure/,
    pattern: /(sudden|new|one[- ]sided) (weakness|numbness)|(weakness|numbness) (in|on|down) (my|one|the) (arm|leg|face|side)|slurred speech|trouble (speaking|talking)|face (is )?droop\w*|worst headache|seizure\w*|confus(ed|ion)|lost (my )?vision|vision loss/,
    ask: 'Any new weakness, numbness, trouble speaking, vision loss or a sudden worst-ever headache?' },
  { key: 'heavy_bleeding', label: 'Heavy bleeding', highRisk: true, generic: true,
    pattern: /(heavy|severe|uncontrolled|a lot of) bleeding|bleeding (heavily|a lot|won'?t stop|that won'?t stop|through)|(won'?t|can'?t) stop bleeding|(keeps?|still) bleeding|soak(ed|ing|s)? (through )?(the |a |my )?(towel|bandage|cloth|gauze|pad)|(spurting|gushing|pouring) (blood|out)|(coughing|vomiting|throwing) up blood|blood in (my )?(vomit|stool|poo)/,
    ask: 'Any bleeding that is heavy or won’t stop?' },
  { key: 'fainting', label: 'Fainting or passing out', highRisk: true, generic: true,
    pattern: /faint(ed|ing)?|pass(ed|ing)? out|black(ed|ing)? out|lost consciousness|collaps(e|ed|ing)/,
    ask: 'Any fainting, near-fainting or blacking out?' },
  { key: 'allergic', label: 'Severe allergic reaction', highRisk: true, generic: false, complaintLink: /allerg|rash|hive|swell|sting|bite|react/,
    pattern: /throat (is )?(closing|swelling|tight)|(tongue|lips?|face) (is )?swell\w*|swollen (lips?|tongue|throat|face)|anaphyla\w*|hives all over/,
    ask: 'Any swelling of the lips, tongue or throat, or trouble swallowing?' },
  { key: 'self_harm', label: 'Thoughts of self-harm', highRisk: true, generic: false, complaintLink: /mood|depress|anxi|panic|mental|stress|sleep|suicid|self[- ]harm/, sensitive: true,
    pattern: /suicid\w*|kill (myself|me)|end (my life|it all)|self[- ]harm|hurt(ing)? myself|want to die/,
    ask: 'Ask privately about any thoughts of harming themselves.' },
  { key: 'rapid_worsening', label: 'Getting worse quickly', highRisk: false, generic: true,
    pattern: /rapidly worse|getting worse (quickly|fast)|worse(ning)? (quickly|fast|rapidly)|much worse|suddenly worse/,
    ask: 'Is it getting worse quickly?' },
];

const CAUTION_TEXT: Array<{ ruleId: string; text: string; pattern: RegExp }> = [
  { ruleId: 'caution.dehydration', text: 'Signs of dehydration', pattern: /can'?t keep (anything|fluids|water|food) down|haven'?t (peed|urinated)|not (peeing|urinating)|no urine|dehydrat\w*/ },
  { ruleId: 'caution.spreading', text: 'Redness or swelling that is spreading', pattern: /(redness|swelling|rash|red streaks?) (is |are )?(spreading|getting bigger)|spreading (redness|rash)|red streaks?/ },
  { ruleId: 'caution.high_fever', text: 'High fever', pattern: /(fever|temp(erature)?)( of| is| was|:)? ?(39\.[5-9]|4[0-2](\.\d)?|10[3-6](\.\d)?)/ },
  { ruleId: 'caution.dizziness', text: 'Dizziness or light-headedness', pattern: /dizz\w*|light[- ]?headed|room (is )?spinning|vertigo/ },
];
const SUDDEN_ONSET = /sudden(ly)?|all of a sudden|out of nowhere|came on (fast|quickly)|within (a few )?minutes/;
const PREGNANT = /pregnan\w*/;
const PREGNANCY_WARNING = /bleeding|abdominal pain|stomach pain|belly pain|cramp\w*/;

const SEVERITY_PROMPT = /0 to 10|0-10|scale|how severe|pain score/i;
const TIMELINE_PROMPT = /when did (this|it) start|how long/i;
const WORSE_ACTIVITY_PROMPT = /worse with (activity|walking|standing)/i;
const ALLERGY_PROMPT = /allerg/i;
const MEDICATION_PROMPT = /medication|medicine|taken anything|pills/i;

const SENSITIVE_TOPICS: Array<{ ruleId: string; pattern: RegExp; text: string; priority: 'must' | 'worth'; when?: (input: HandoffInput) => boolean }> = [
  { ruleId: 'ask.sensitive.pregnancy', priority: 'must', pattern: /abdominal|stomach|belly|pelvic|cramp|period|nausea|vomit|bleeding/,
    when: (input) => isFemale(input.gender) && input.age != null && input.age >= 12 && input.age <= 55,
    text: 'Ask privately whether they could be pregnant.' },
  { ruleId: 'ask.sensitive.sexual_health', priority: 'worth', pattern: /urin|\bpee\b|burning when|discharge|\bstds?\b|\bstis?\b|genital|vagin|penis|testic|pelvic/,
    text: 'Ask privately about sexual history and the chance of an STI.' },
  { ruleId: 'ask.sensitive.safety', priority: 'worth', pattern: /injur|bruis|\bfell\b|\bfall\b|assault|hit by|hit me/,
    text: 'Ask how the injury happened, and whether they feel safe at home.' },
];

function isFemale(gender: string | null): boolean {
  return /^(f|female|woman)$/i.test(gender?.trim() ?? '');
}

function sexWord(gender: string | null): string | null {
  const value = gender?.trim().toLowerCase();
  if (!value) return null;
  if (value === 'f' || value === 'female' || value === 'woman') return 'female';
  if (value === 'm' || value === 'male' || value === 'man') return 'male';
  if (value === 'nb' || value === 'non-binary' || value === 'nonbinary') return 'non-binary';
  return value;
}

function joinWords(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

interface PatientText { ref: string; text: string }

function patientTexts(input: HandoffInput): PatientText[] {
  const texts: PatientText[] = [{ ref: 'visit:complaint', text: input.complaint }];
  if (input.patientNote) texts.push({ ref: 'visit:note', text: input.patientNote });
  for (const answer of input.answers) {
    if (answer.inputType !== 'boolean' && answer.inputType !== 'number') texts.push({ ref: answerRef(answer.questionId), text: answer.answerText });
  }
  return texts;
}

function mentionsIn(texts: PatientText[], pattern: RegExp): Array<Mention & { ref: string }> {
  return texts.map((item) => ({ ...findMention(item.text, pattern), ref: item.ref })).filter((mention) => mention.status !== 'none');
}

function severityAnswer(input: HandoffInput): { answer: HandoffAnswer; value: number } | null {
  for (const answer of [...input.answers].reverse()) {
    if (answer.inputType !== 'number' || !SEVERITY_PROMPT.test(answer.prompt)) continue;
    const value = typeof answer.valueNumber === 'number' ? answer.valueNumber : Number(answer.answerText);
    if (Number.isFinite(value)) return { answer, value };
  }
  return null;
}

function findAnswer(input: HandoffInput, bankKey: RescueBankKey, prompt: RegExp): HandoffAnswer | null {
  return [...input.answers].reverse().find((answer) => answer.bankKey === bankKey || prompt.test(answer.prompt)) ?? null;
}

const PROPER_START = /^(I|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December)\b/;

/** The first sentence of the timeline answer, written to follow "started". */
function timelinePhrase(answerText: string): string {
  const first = answerText.trim().split(/(?<=[.!?])\s+/)[0].replace(/[.!?\s]+$/, '');
  return /^[A-Z][a-z]/.test(first) && !PROPER_START.test(first) ? first[0].toLowerCase() + first.slice(1) : first;
}

export function buildClinicHandoff(input: HandoffInput): ClinicHandoff {
  const texts = patientTexts(input);
  const complaintText = `${input.complaint} ${input.patientNote ?? ''}`.toLowerCase();
  const booleans = input.answers.filter((answer) => answer.inputType === 'boolean' && answer.source !== 'safety' && typeof answer.valueBoolean === 'boolean');

  // Red-flag screen: reported / denied / not screened, per domain.
  const screen: Array<ScreenRow & { domainDef: Domain; applicable: boolean }> = DOMAINS.map((domain) => {
    const reported: string[] = [];
    const denied: string[] = [];
    for (const mention of mentionsIn(texts, domain.pattern)) (mention.status === 'reported' ? reported : denied).push(mention.ref);
    for (const answer of booleans) {
      if (!new RegExp(domain.pattern.source, 'i').test(answer.prompt)) continue;
      (answer.valueBoolean ? reported : denied).push(answerRef(answer.questionId));
    }
    const status: ScreenRow['status'] = reported.length ? 'reported' : denied.length ? 'denied' : 'not_screened';
    const applicable = domain.generic || !!domain.complaintLink?.test(complaintText) || status !== 'not_screened';
    return { domain: domain.key, label: domain.label, status, refs: reported.length ? reported : denied, domainDef: domain, applicable };
  });
  const applicableScreen = screen.filter((row) => row.applicable);

  // Urgency.
  const escalate: Reason[] = [];
  const caution: Reason[] = [];
  const safety = input.answers.find((answer) => answer.source === 'safety');
  if (safety?.valueBoolean === true) {
    escalate.push({ id: 'urgency:safety', ruleId: 'escalate.safety_gate', text: 'Said they were in immediate danger', refs: [answerRef(safety.questionId)] });
  }
  input.emergencyEvents.forEach((event, index) => {
    if (event.trigger === 'safety_gate') return;
    escalate.push({ id: `urgency:emergency:${index}`, ruleId: 'escalate.emergency_warning', text: 'Answers triggered an emergency warning', refs: [`emergency:${index}`] });
  });
  for (const row of applicableScreen) {
    if (row.status !== 'reported') continue;
    const target = row.domainDef.highRisk ? escalate : caution;
    target.push({ id: `urgency:${row.domain}`, ruleId: `${row.domainDef.highRisk ? 'escalate' : 'caution'}.${row.domain}`, text: row.label, refs: row.refs });
  }
  const severity = severityAnswer(input);
  if (severity && severity.value >= 9) escalate.push({ id: 'urgency:severity', ruleId: 'escalate.severity', text: `Severity ${severity.value}/10`, refs: [answerRef(severity.answer.questionId)] });
  else if (severity && severity.value >= 7) caution.push({ id: 'urgency:severity', ruleId: 'caution.severity', text: `Severity ${severity.value}/10`, refs: [answerRef(severity.answer.questionId)] });
  const worseWithActivity = findAnswer(input, 'emergent.worse_activity', WORSE_ACTIVITY_PROMPT);
  if (worseWithActivity?.valueBoolean === true) caution.push({ id: 'urgency:worse_activity', ruleId: 'caution.worse_activity', text: 'Worse with activity or standing', refs: [answerRef(worseWithActivity.questionId)] });
  const timeline = findAnswer(input, 'urgent.timeline', TIMELINE_PROMPT);
  const sudden = mentionsIn(texts.filter((item) => item.ref === 'visit:complaint' || item.ref === 'visit:note' || (timeline && item.ref === answerRef(timeline.questionId))), SUDDEN_ONSET).filter((mention) => mention.status === 'reported');
  if (sudden.length) caution.push({ id: 'urgency:sudden', ruleId: 'caution.sudden_onset', text: 'Sudden onset', refs: sudden.map((mention) => mention.ref) });
  for (const rule of CAUTION_TEXT) {
    const found = mentionsIn(texts, rule.pattern).filter((mention) => mention.status === 'reported');
    if (found.length) caution.push({ id: `urgency:${rule.ruleId}`, ruleId: rule.ruleId, text: rule.text, refs: found.map((mention) => mention.ref) });
  }
  const pregnant = mentionsIn(texts, PREGNANT).filter((mention) => mention.status === 'reported');
  const pregnancyWarning = mentionsIn(texts, PREGNANCY_WARNING).filter((mention) => mention.status === 'reported');
  if (pregnant.length && pregnancyWarning.length) caution.push({ id: 'urgency:pregnancy', ruleId: 'caution.pregnancy', text: 'Pregnant, with pain or bleeding', refs: [...new Set([...pregnant, ...pregnancyWarning].map((mention) => mention.ref))] });

  const level: UrgencyLevel = escalate.length ? 'escalate' : caution.length ? 'caution' : 'clear';
  let reasons: Reason[] = level === 'escalate' ? escalate : level === 'caution' ? caution : [];
  if (level === 'clear') {
    if (safety?.valueBoolean === false) reasons.push({ id: 'urgency:safety', ruleId: 'clear.safety_gate', text: 'Said they were not in immediate danger', refs: [answerRef(safety.questionId)] });
    const deniedRows = applicableScreen.filter((row) => row.status === 'denied' && row.domainDef.highRisk);
    if (deniedRows.length) reasons.push({ id: 'urgency:denied', ruleId: 'clear.denied', text: `Denied ${joinWords(deniedRows.map((row) => row.label.toLowerCase()))}`, refs: [...new Set(deniedRows.flatMap((row) => row.refs))] });
    if (severity) reasons.push({ id: 'urgency:severity', ruleId: 'clear.severity', text: `Severity ${severity.value}/10`, refs: [answerRef(severity.answer.questionId)] });
    if (!reasons.length) reasons = [{ id: 'urgency:none', ruleId: 'clear.none', text: 'No high-risk answers recorded', refs: [] }];
  }
  const sentenceBase = level === 'escalate' ? 'Escalate: possible emergency signs' : level === 'caution' ? 'Caution: worth checking early in the visit' : 'Clear: no high-risk answers';
  const sentence = input.partial ? `${sentenceBase}, based on an unfinished assessment` : sentenceBase;

  // Red flags: the high-risk items behind an Escalate, in the patient's terms.
  const redFlags: RedFlag[] = [];
  if (safety?.valueBoolean === true) redFlags.push({ id: 'red-flag:safety', ruleId: 'escalate.safety_gate', label: 'Said they were in immediate danger', refs: [answerRef(safety.questionId)] });
  for (const row of applicableScreen) {
    if (row.status === 'reported' && row.domainDef.highRisk) redFlags.push({ id: `red-flag:${row.domain}`, ruleId: `escalate.${row.domain}`, label: row.label, refs: row.refs });
  }

  // History that wasn't established.
  const established = (pattern: RegExp) => input.answers.some((answer) => pattern.test(answer.prompt) && !isVagueAnswer(answer.answerText, answer.inputType));
  const allergiesKnown = !!input.allergies?.trim() || established(ALLERGY_PROMPT);
  const medicationsKnown = established(MEDICATION_PROMPT);
  const vague = input.answers.filter((answer) => answer.source !== 'safety' && isVagueAnswer(answer.answerText, answer.inputType));

  // Ask in the room.
  const ask: AskItem[] = [];
  for (const answer of vague) {
    ask.push({ id: `ask:clarify:${answer.questionId}`, ruleId: 'ask.clarify', category: 'clarify', priority: answer.phase === 'urgent' ? 'must' : 'worth',
      text: `Ask again: ${answer.prompt}`, why: `They answered “${answer.answerText}”, which doesn’t settle it.`, basedOn: [answerRef(answer.questionId)] });
  }
  for (const row of applicableScreen) {
    if (row.status !== 'not_screened') continue;
    const linked = !!row.domainDef.complaintLink?.test(complaintText);
    ask.push({ id: `ask:screen:${row.domain}`, ruleId: `ask.screen.${row.domain}`, category: row.domainDef.sensitive ? 'sensitive' : 'history',
      priority: level !== 'clear' || linked ? 'must' : 'worth', text: row.domainDef.ask,
      why: linked ? `Relevant to “${input.complaint}” and not asked yet.` : 'Not asked during the assessment.', basedOn: ['visit:complaint'] });
  }
  if (!medicationsKnown || !allergiesKnown) {
    const bleedingRow = screen.find((row) => row.domain === 'heavy_bleeding');
    const missing = [!medicationsKnown ? 'medications' : null, !allergiesKnown ? 'allergies' : null].filter((item): item is string => !!item);
    ask.push({ id: 'ask:history:meds_allergies', ruleId: 'ask.history.meds_allergies', category: 'history',
      priority: (input.age != null && input.age >= 65) || bleedingRow?.status === 'reported' ? 'must' : 'worth',
      text: !medicationsKnown && !allergiesKnown ? 'Which medications do they take, and do they have any allergies?' : !medicationsKnown ? 'Which medications do they take?' : 'Do they have any allergies?',
      why: `${missing.length === 2 ? 'Medications and allergies weren’t' : `${missing[0][0].toUpperCase()}${missing[0].slice(1)} weren’t`} established in the assessment.`, basedOn: [] });
  }
  for (const topic of SENSITIVE_TOPICS) {
    if (!topic.pattern.test(complaintText) || (topic.when && !topic.when(input))) continue;
    ask.push({ id: `ask:${topic.ruleId}`, ruleId: topic.ruleId, category: 'sensitive', priority: topic.priority, text: topic.text, why: `Better asked in person for “${input.complaint}”.`, basedOn: ['visit:complaint'] });
  }
  if (severity && severity.value >= 7) {
    ask.push({ id: 'ask:exam:severity', ruleId: 'ask.exam.severity', category: 'exam', priority: severity.value >= 9 ? 'must' : 'worth',
      text: 'Recheck the pain score now.', why: `It was ${severity.value}/10 when they answered.`, basedOn: [answerRef(severity.answer.questionId)] });
  }
  // The default clinic question about travel; clinics can reword or remove it.
  const travel = input.answers.find((answer) => answer.questionId === 'clinic:travel_14d');
  if (travel?.valueBoolean === true) {
    ask.push({ id: 'ask:clinic:travel', ruleId: 'ask.clinic.travel', category: 'history', priority: 'worth',
      text: 'Ask where they travelled and when they got back.', why: 'They said they travelled outside Canada in the last 14 days.', basedOn: [answerRef(travel.questionId)] });
  }
  if (worseWithActivity?.valueBoolean === true) {
    ask.push({ id: 'ask:exam:activity', ruleId: 'ask.exam.activity', category: 'exam', priority: 'worth',
      text: 'Ask what brings it on, and check it during the exam.', why: 'They said it gets worse with activity or standing.', basedOn: [answerRef(worseWithActivity.questionId)] });
  }
  const categoryOrder = { clarify: 0, history: 1, sensitive: 2, exam: 3 } as const;
  const askInRoom = ask
    .map((item, index) => ({ item, index }))
    .sort((left, right) => (left.item.priority === right.item.priority ? 0 : left.item.priority === 'must' ? -1 : 1)
      || categoryOrder[left.item.category] - categoryOrder[right.item.category] || left.index - right.index)
    .slice(0, 6)
    .map(({ item }) => item);

  // Gaps: what the assessment couldn't establish.
  const gaps: Gap[] = [];
  for (const row of applicableScreen) {
    if (row.status === 'not_screened') gaps.push({ id: `gap:screen:${row.domain}`, ruleId: 'gap.not_screened', kind: 'red_flag_not_screened', text: `Not screened: ${row.label.toLowerCase()}`, refs: [] });
  }
  if (input.clinicQuestions?.expected && !input.clinicQuestions.answered) {
    gaps.push({ id: 'gap:clinic_questions', ruleId: 'gap.clinic_questions', kind: 'clinic_questions_missing', text: 'Your clinic’s own questions weren’t all answered', refs: [] });
  }
  for (const answer of vague) gaps.push({ id: `gap:vague:${answer.questionId}`, ruleId: 'gap.vague_answer', kind: 'vague_answer', text: `Unclear answer to “${answer.prompt}”`, refs: [answerRef(answer.questionId)] });
  if (!medicationsKnown || !allergiesKnown) {
    gaps.push({ id: 'gap:history', ruleId: 'gap.missing_history', kind: 'missing_history',
      text: !medicationsKnown && !allergiesKnown ? 'Medications and allergies weren’t established' : !medicationsKnown ? 'Medications weren’t established' : 'Allergies weren’t established', refs: [] });
  }
  if (input.unasked.length) gaps.push({ id: 'gap:not_asked', ruleId: 'gap.not_asked', kind: 'not_asked', text: `${plural(input.unasked.length, 'generated question')} ${input.unasked.length === 1 ? 'wasn’t' : 'weren’t'} asked`, refs: input.unasked.map((item) => `unasked:${item.questionId}`) });
  if (input.interview.askedCount >= input.interview.maxQuestions) gaps.push({ id: 'gap:limit', ruleId: 'gap.question_limit', kind: 'question_limit', text: `The assessment stopped at its ${input.interview.maxQuestions}-question limit`, refs: [] });
  input.emergencyEvents.forEach((event, index) => {
    gaps.push(event.acknowledgedAt
      ? { id: `gap:emergency:${index}`, ruleId: 'gap.emergency_continued', kind: 'emergency_continued', text: 'Continued after an emergency warning', refs: [`emergency:${index}`] }
      : { id: `gap:emergency:${index}`, ruleId: 'gap.emergency_open', kind: 'emergency_open', text: 'Stopped at an emergency warning', refs: [`emergency:${index}`] });
  });
  if (input.partial) {
    const asked = input.answers.filter((answer) => answer.source === 'ai').length;
    gaps.push({ id: 'gap:unfinished', ruleId: 'gap.unfinished', kind: 'interview_unfinished', text: `The assessment wasn’t finished; it stopped after ${plural(asked, 'question')}`, refs: [] });
  }

  // Briefing and case summary, in plain words. No CTAS, no ED wording.
  const whoWords = [input.age != null ? `${input.age}-year-old` : null, sexWord(input.gender)].filter(Boolean).join(' ');
  const who = whoWords ? whoWords[0].toUpperCase() + whoWords.slice(1) : 'Patient';
  const timelineText = timeline && !isVagueAnswer(timeline.answerText, timeline.inputType) ? `, started ${timelinePhrase(timeline.answerText)}` : '';
  const severityText = severity ? `, severity ${severity.value}/10` : '';
  const briefing = [
    `${who} with “${input.complaint.replace(/[.\s]+$/, '')}”${timelineText}${severityText}.`,
    redFlags.length ? `${plural(redFlags.length, 'red flag')} reported.` : '',
    input.emergencyEvents.length ? (input.emergencyEvents.some((event) => event.acknowledgedAt) ? 'Saw an emergency warning and continued.' : 'Stopped at an emergency warning.') : '',
  ].filter(Boolean).join(' ');
  const associated = findAnswer(input, 'emergent.associated', /what other symptoms/i);
  const selfCare = findAnswer(input, 'emergent.self_care', /taken anything or done anything/i);
  const conditions = findAnswer(input, 'history.conditions', /medical conditions/i);
  const medsAllergies = findAnswer(input, 'history.meds_allergies', /medications or allergies/i);
  const other = findAnswer(input, 'history.other', /anything else important/i);
  const caseSummary = input.modelCaseSummary?.trim() || [
    `Chief concern: ${input.complaint.replace(/[.\s]+$/, '')}.`,
    timeline ? `Timeline: ${timeline.answerText}.` : '',
    severity ? `Severity: ${severity.value}/10.` : '',
    associated ? `Other symptoms: ${associated.answerText}.` : '',
    selfCare ? `Tried so far: ${selfCare.answerText}.` : '',
    conditions ? `Conditions: ${conditions.answerText}.` : input.conditions ? `Conditions: ${input.conditions}.` : '',
    medsAllergies ? `Medications and allergies: ${medsAllergies.answerText}.` : input.allergies ? `Allergies: ${input.allergies}.` : '',
    other ? `Also mentioned: ${other.answerText}.` : '',
  ].filter(Boolean).join(' ').replace(/\.\./g, '.');

  // Next steps, templated per level.
  const mustAsk = askInRoom.filter((item) => item.priority === 'must').length;
  const nextSteps: NextStep[] = [];
  const urgencyRefs = [...new Set(reasons.flatMap((reason) => reason.refs))];
  if (level === 'escalate') nextSteps.push({ id: 'next:level', ruleId: 'next.escalate', text: 'Review this patient first. Confirm the reasons above in person; if they’re still present, arrange emergency care.', refs: urgencyRefs });
  else if (level === 'caution') nextSteps.push({ id: 'next:level', ruleId: 'next.caution', text: 'Check the reasons above early in the visit.', refs: urgencyRefs });
  else nextSteps.push({ id: 'next:level', ruleId: 'next.clear', text: 'No high-risk answers. Routine visit.', refs: [] });
  if (mustAsk) nextSteps.push({ id: 'next:ask', ruleId: 'next.must_ask', text: `Ask the ${plural(mustAsk, 'must-ask question')} in the room.`, refs: [] });
  if (input.emergencyEvents.length) nextSteps.push({ id: 'next:emergency', ruleId: 'next.emergency_followup', text: 'Ask how they are now compared with when they saw the emergency warning.', refs: input.emergencyEvents.map((_, index) => `emergency:${index}`) });

  return {
    rulesVersion: CLINIC_HANDOFF_RULES_VERSION,
    urgency: { level, sentence, reasons },
    redFlags,
    redFlagScreen: applicableScreen.map(({ domain, label, status, refs }) => ({ domain, label, status, refs })),
    briefing,
    caseSummary,
    nextSteps,
    askInRoom,
    gaps,
  };
}
