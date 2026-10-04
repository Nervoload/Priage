import type { AnswerOutcome, HistoryElement } from '../case/types';
import type { BankQuestion, KnowledgePack, Localized, PackCause, Wording } from './types';

// The generic pack for any complaint. Drafted for the first buildout and NOT
// clinically reviewed: every cause, question and translation needs the
// clinical owner's approval before it is used with real patients.

type Three = [self: string, child: string, other: string];
const w = (en: Three, fr: Three): Wording => ({
  en: { self: en[0], child: en[1], other: en[2] },
  fr: { self: fr[0], child: fr[1], other: fr[2] },
});
const c = (en: string, fr: string): Localized => ({ en, fr });

const fills = (element: HistoryElement, answers: string[]): AnswerOutcome[] =>
  answers.map((answer) => ({ answer, effects: [{ target: element, shift: 'fills' }] }));

/** A yes/no screen: Yes supports its causes, No weakens them. */
function screen(id: string, wording: Wording, targets: string[], opts: { emergency?: boolean; when?: BankQuestion['when'] } = {}): BankQuestion {
  return {
    id, role: 'screen', wording, format: 'boolean', purpose: 'danger', targets, allowNotSure: true, when: opts.when,
    ifAnswered: [
      { answer: 'Yes', effects: targets.map((target) => ({ target, shift: 'supports' as const })), ...(opts.emergency ? { emergency: true } : {}) },
      { answer: 'No', effects: targets.map((target) => ({ target, shift: 'weakens' as const })) },
    ],
  };
}

const FEMALE_CHILDBEARING = { sex: 'female' as const, ages: { min: 12, max: 55 }, audiences: ['self' as const] };

const BANK: BankQuestion[] = [
  // Core facts: characterise the complaint.
  {
    id: 'u.onset', role: 'core', format: 'duration', purpose: 'clarify', element: 'onset', targets: ['onset'], allowNotSure: true, bankKey: 'urgent.timeline',
    wording: w(
      ['How long ago did this start?', 'How long ago did this start for your child?', 'How long ago did this start for them?'],
      ['Il y a combien de temps que cela a commencé?', 'Il y a combien de temps que cela a commencé chez votre enfant?', 'Il y a combien de temps que cela a commencé chez cette personne?'],
    ),
    ifAnswered: [],
  },
  {
    id: 'u.severity', role: 'core', format: 'scale', scale: { min: 0, max: 10 }, purpose: 'clarify', element: 'severity', targets: ['severity'], allowNotSure: true, bankKey: 'urgent.severity',
    wording: w(
      ['How bad is it right now, on a scale from 0 to 10?', 'How bad is it for your child right now, on a scale from 0 to 10?', 'How bad is it for them right now, on a scale from 0 to 10?'],
      ['À quel point est-ce intense en ce moment, sur une échelle de 0 à 10?', 'À quel point est-ce intense pour votre enfant en ce moment, sur une échelle de 0 à 10?', 'À quel point est-ce intense pour cette personne en ce moment, sur une échelle de 0 à 10?'],
    ),
    ifAnswered: [],
  },
  {
    id: 'u.course', role: 'core', format: 'single_select', purpose: 'clarify', element: 'course', targets: ['course'], allowNotSure: true,
    wording: w(
      ['Since it started, how has it changed?', 'Since it started, how has it changed for your child?', 'Since it started, how has it changed for them?'],
      ['Depuis le début, comment cela a-t-il changé?', 'Depuis le début, comment cela a-t-il changé chez votre enfant?', 'Depuis le début, comment cela a-t-il changé chez cette personne?'],
    ),
    choices: [c('Getting better', 'Ça s’améliore'), c('Staying about the same', 'À peu près pareil'), c('Getting worse slowly', 'Ça empire lentement'), c('Getting worse quickly', 'Ça empire rapidement'), c('It comes and goes', 'Ça va et vient')],
    ifAnswered: fills('course', ['Getting better', 'Staying about the same', 'Getting worse slowly', 'Getting worse quickly', 'It comes and goes']),
  },
  {
    id: 'u.location', role: 'core', format: 'text', maxLength: 60, purpose: 'clarify', element: 'location', targets: ['location'], allowNotSure: true,
    wording: w(
      ['Where on your body is the problem?', 'Where on your child’s body is the problem?', 'Where on their body is the problem?'],
      ['À quel endroit du corps se trouve le problème?', 'À quel endroit du corps de votre enfant se trouve le problème?', 'À quel endroit du corps de cette personne se trouve le problème?'],
    ),
    help: c('For example: lower back, left ear, all over.', 'Par exemple : bas du dos, oreille gauche, partout.'),
    ifAnswered: [],
  },
  {
    id: 'u.character', role: 'core', format: 'text', maxLength: 60, purpose: 'clarify', element: 'character', targets: ['character'], allowNotSure: true,
    wording: w(
      ['In a few words, what does it feel like?', 'In a few words, what does your child say it feels like?', 'In a few words, what does it feel like for them?'],
      ['En quelques mots, comment décririez-vous la sensation?', 'En quelques mots, comment votre enfant décrit-il la sensation?', 'En quelques mots, comment cette personne décrit-elle la sensation?'],
    ),
    ifAnswered: [],
  },

  // Fillers: useful whatever the earlier answers were, asked while the next round is planned.
  {
    id: 'u.medications', role: 'filler', format: 'text', maxLength: 200, purpose: 'history', element: 'medications', targets: ['medications'], allowNotSure: true, bankKey: 'history.meds_allergies',
    wording: w(
      ['Which medicines do you take regularly? Write “none” if you don’t take any.', 'Which medicines does your child take regularly? Write “none” if they don’t take any.', 'Which medicines do they take regularly? Write “none” if they don’t take any.'],
      ['Quels médicaments prenez-vous régulièrement? Écrivez « aucun » si vous n’en prenez pas.', 'Quels médicaments votre enfant prend-il régulièrement? Écrivez « aucun » s’il n’en prend pas.', 'Quels médicaments cette personne prend-elle régulièrement? Écrivez « aucun » si elle n’en prend pas.'],
    ),
    ifAnswered: [],
  },
  {
    id: 'u.allergies', role: 'filler', format: 'text', maxLength: 120, purpose: 'history', element: 'allergies', targets: ['allergies'], allowNotSure: true,
    wording: w(
      ['Are you allergic to any medicines? Write “none” if not.', 'Is your child allergic to any medicines? Write “none” if not.', 'Are they allergic to any medicines? Write “none” if not.'],
      ['Êtes-vous allergique à des médicaments? Écrivez « aucun » si ce n’est pas le cas.', 'Votre enfant est-il allergique à des médicaments? Écrivez « aucun » si ce n’est pas le cas.', 'Cette personne est-elle allergique à des médicaments? Écrivez « aucun » si ce n’est pas le cas.'],
    ),
    ifAnswered: [],
  },
  {
    id: 'u.conditions', role: 'filler', format: 'text', maxLength: 200, purpose: 'history', element: 'conditions', targets: ['conditions'], allowNotSure: true, bankKey: 'history.conditions',
    wording: w(
      ['Do you have any ongoing health conditions, like asthma or diabetes? Write “none” if not.', 'Does your child have any ongoing health conditions, like asthma or diabetes? Write “none” if not.', 'Do they have any ongoing health conditions, like asthma or diabetes? Write “none” if not.'],
      ['Avez-vous des problèmes de santé de longue durée, comme l’asthme ou le diabète? Écrivez « aucun » si ce n’est pas le cas.', 'Votre enfant a-t-il des problèmes de santé de longue durée, comme l’asthme ou le diabète? Écrivez « aucun » si ce n’est pas le cas.', 'Cette personne a-t-elle des problèmes de santé de longue durée, comme l’asthme ou le diabète? Écrivez « aucun » si ce n’est pas le cas.'],
    ),
    ifAnswered: [],
  },
  {
    id: 'u.associated', role: 'filler', format: 'multi_select', purpose: 'history', element: 'associated_symptoms', targets: ['associated_symptoms'], allowNotSure: true,
    wording: w(
      ['Do you have any of these right now?', 'Does your child have any of these right now?', 'Do they have any of these right now?'],
      ['Avez-vous l’un de ces symptômes en ce moment?', 'Votre enfant a-t-il l’un de ces symptômes en ce moment?', 'Cette personne a-t-elle l’un de ces symptômes en ce moment?'],
    ),
    choices: [c('Fever or chills', 'Fièvre ou frissons'), c('Nausea or vomiting', 'Nausées ou vomissements'), c('Dizziness', 'Étourdissements'), c('A rash', 'Une éruption cutanée'), c('Cough', 'Toux')],
    ifAnswered: fills('associated_symptoms', ['Fever or chills', 'Nausea or vomiting', 'Dizziness', 'A rash', 'Cough']),
  },
  {
    id: 'u.tried', role: 'filler', format: 'text', maxLength: 120, purpose: 'history', element: 'tried_so_far', targets: ['tried_so_far'], allowNotSure: false, bankKey: 'emergent.self_care',
    wording: w(
      ['Have you tried anything for this yet, like rest, ice or something from the pharmacy?', 'Have you tried anything for your child yet, like rest, ice or something from the pharmacy?', 'Have they tried anything for this yet, like rest, ice or something from the pharmacy?'],
      ['Avez-vous essayé quelque chose pour cela, comme le repos, de la glace ou un produit de la pharmacie?', 'Avez-vous essayé quelque chose pour votre enfant, comme le repos, de la glace ou un produit de la pharmacie?', 'Cette personne a-t-elle essayé quelque chose, comme le repos, de la glace ou un produit de la pharmacie?'],
    ),
    ifAnswered: [],
  },
  {
    id: 'u.worse_activity', role: 'filler', format: 'boolean', purpose: 'history', element: 'better_worse', targets: ['better_worse'], allowNotSure: true, bankKey: 'emergent.worse_activity',
    wording: w(
      ['Do you feel worse with activity, walking, or standing up?', 'Does your child feel worse with activity, walking, or standing up?', 'Do they feel worse with activity, walking, or standing up?'],
      ['Vous sentez-vous plus mal quand vous bougez, marchez ou vous levez?', 'Votre enfant se sent-il plus mal quand il bouge, marche ou se lève?', 'Cette personne se sent-elle plus mal quand elle bouge, marche ou se lève?'],
    ),
    ifAnswered: fills('better_worse', ['Yes', 'No']),
  },
  {
    id: 'u.recent_events', role: 'filler', format: 'multi_select', purpose: 'history', element: 'recent_events', targets: ['recent_events'], allowNotSure: true,
    wording: w(
      ['In the last two weeks, have you had any of these?', 'In the last two weeks, has your child had any of these?', 'In the last two weeks, have they had any of these?'],
      ['Au cours des deux dernières semaines, avez-vous eu l’un de ces événements?', 'Au cours des deux dernières semaines, votre enfant a-t-il eu l’un de ces événements?', 'Au cours des deux dernières semaines, cette personne a-t-elle eu l’un de ces événements?'],
    ),
    choices: [c('An injury or fall', 'Une blessure ou une chute'), c('Surgery or a hospital stay', 'Une chirurgie ou une hospitalisation'), c('A long trip sitting for more than 4 hours', 'Un long trajet assis de plus de 4 heures'), c('Close contact with someone sick', 'Un contact proche avec une personne malade')],
    ifAnswered: [
      { answer: 'An injury or fall', effects: [{ target: 'recent_events', shift: 'fills' }, { target: 'compartment_syndrome', shift: 'supports' }] },
      { answer: 'Surgery or a hospital stay', effects: [{ target: 'recent_events', shift: 'fills' }, { target: 'dvt', shift: 'supports' }, { target: 'pulmonary_embolism', shift: 'supports' }] },
      { answer: 'A long trip sitting for more than 4 hours', effects: [{ target: 'recent_events', shift: 'fills' }, { target: 'dvt', shift: 'supports' }, { target: 'pulmonary_embolism', shift: 'supports' }] },
      { answer: 'Close contact with someone sick', effects: [{ target: 'recent_events', shift: 'fills' }] },
    ],
  },
  {
    id: 'u.daily_impact', role: 'filler', format: 'single_select', purpose: 'history', element: 'daily_impact', targets: ['daily_impact'], allowNotSure: false,
    wording: w(
      ['How much is this getting in the way of your usual day?', 'How much is this getting in the way of your child’s usual day?', 'How much is this getting in the way of their usual day?'],
      ['À quel point cela nuit-il à votre journée habituelle?', 'À quel point cela nuit-il à la journée habituelle de votre enfant?', 'À quel point cela nuit-il à la journée habituelle de cette personne?'],
    ),
    choices: [c('Not at all', 'Pas du tout'), c('A little', 'Un peu'), c('A lot', 'Beaucoup'), c('Can’t do usual activities', 'Impossible de faire les activités habituelles')],
    ifAnswered: fills('daily_impact', ['Not at all', 'A little', 'A lot', 'Can’t do usual activities']),
  },
  {
    id: 'u.pregnancy', role: 'filler', format: 'boolean', purpose: 'history', element: 'pregnancy_possible', targets: ['pregnancy_possible', 'ectopic_pregnancy'], allowNotSure: true,
    when: FEMALE_CHILDBEARING,
    wording: w(
      ['Is there any chance you could be pregnant?', 'Is there any chance your child could be pregnant?', 'Is there any chance they could be pregnant?'],
      ['Est-il possible que vous soyez enceinte?', 'Est-il possible que votre enfant soit enceinte?', 'Est-il possible que cette personne soit enceinte?'],
    ),
    ifAnswered: [
      { answer: 'Yes', effects: [{ target: 'pregnancy_possible', shift: 'fills' }, { target: 'ectopic_pregnancy', shift: 'supports' }] },
      { answer: 'No', effects: [{ target: 'pregnancy_possible', shift: 'fills' }, { target: 'ectopic_pregnancy', shift: 'weakens' }] },
    ],
  },

  // Closing: the only long free-text question after the opening description.
  {
    id: 'u.anything_else', role: 'closing', format: 'textarea', maxLength: 1000, purpose: 'history', targets: [], allowNotSure: false, bankKey: 'history.other',
    wording: w(
      ['Anything else important the care team should know before your visit?', 'Anything else important the care team should know about your child before the visit?', 'Anything else important the care team should know about them before the visit?'],
      ['Y a-t-il autre chose d’important que l’équipe de soins devrait savoir avant la visite?', 'Y a-t-il autre chose d’important que l’équipe de soins devrait savoir au sujet de votre enfant avant la visite?', 'Y a-t-il autre chose d’important que l’équipe de soins devrait savoir au sujet de cette personne avant la visite?'],
    ),
    help: c('Write “no” if there’s nothing else.', 'Écrivez « non » s’il n’y a rien d’autre.'),
    ifAnswered: [],
  },

  // Screens for dangerous causes the audit adds. Yes supports, No weakens.
  screen('s.chest', w(
    ['Do you have any chest pain, pressure or tightness right now?', 'Does your child have any chest pain, pressure or tightness right now?', 'Do they have any chest pain, pressure or tightness right now?'],
    ['Ressentez-vous une douleur, une pression ou un serrement à la poitrine en ce moment?', 'Votre enfant ressent-il une douleur, une pression ou un serrement à la poitrine en ce moment?', 'Cette personne ressent-elle une douleur, une pression ou un serrement à la poitrine en ce moment?'],
  ), ['heart_attack', 'pulmonary_embolism']),
  screen('s.sweaty', w(
    ['Do you also feel sweaty or sick to your stomach?', 'Does your child also seem sweaty or sick to their stomach?', 'Do they also feel sweaty or sick to their stomach?'],
    ['Vous sentez-vous aussi en sueur ou avez-vous la nausée?', 'Votre enfant semble-t-il aussi en sueur ou a-t-il la nausée?', 'Cette personne est-elle aussi en sueur ou a-t-elle la nausée?'],
  ), ['heart_attack']),
  screen('s.breathing', w(
    ['Are you struggling to breathe right now, even when resting?', 'Is your child struggling to breathe right now, even when resting?', 'Are they struggling to breathe right now, even when resting?'],
    ['Avez-vous beaucoup de difficulté à respirer en ce moment, même au repos?', 'Votre enfant a-t-il beaucoup de difficulté à respirer en ce moment, même au repos?', 'Cette personne a-t-elle beaucoup de difficulté à respirer en ce moment, même au repos?'],
  ), ['pulmonary_embolism', 'heart_attack', 'anaphylaxis', 'sepsis', 'epiglottitis'], { emergency: true }),
  screen('s.breath_pain', w(
    ['Does your chest hurt more when you breathe in?', 'Does your child’s chest hurt more when they breathe in?', 'Does their chest hurt more when they breathe in?'],
    ['Avez-vous plus mal à la poitrine quand vous inspirez?', 'Votre enfant a-t-il plus mal à la poitrine quand il inspire?', 'Cette personne a-t-elle plus mal à la poitrine quand elle inspire?'],
  ), ['pulmonary_embolism']),
  screen('s.leg_swelling', w(
    ['Is one of your legs more swollen than the other?', 'Is one of your child’s legs more swollen than the other?', 'Is one of their legs more swollen than the other?'],
    ['Une de vos jambes est-elle plus enflée que l’autre?', 'Une des jambes de votre enfant est-elle plus enflée que l’autre?', 'Une des jambes de cette personne est-elle plus enflée que l’autre?'],
  ), ['dvt', 'pulmonary_embolism']),
  screen('s.stroke', w(
    ['Right now, do you have sudden weakness or numbness on one side, a drooping face, or trouble speaking?', 'Right now, does your child have sudden weakness or numbness on one side, a drooping face, or trouble speaking?', 'Right now, do they have sudden weakness or numbness on one side, a drooping face, or trouble speaking?'],
    ['En ce moment, avez-vous une faiblesse ou un engourdissement soudain d’un côté du corps, le visage affaissé ou de la difficulté à parler?', 'En ce moment, votre enfant a-t-il une faiblesse ou un engourdissement soudain d’un côté du corps, le visage affaissé ou de la difficulté à parler?', 'En ce moment, cette personne a-t-elle une faiblesse ou un engourdissement soudain d’un côté du corps, le visage affaissé ou de la difficulté à parler?'],
  ), ['stroke'], { emergency: true }),
  screen('s.thunderclap', w(
    ['Did you get a sudden, severe headache that reached its worst within a minute?', 'Did your child get a sudden, severe headache that reached its worst within a minute?', 'Did they get a sudden, severe headache that reached its worst within a minute?'],
    ['Avez-vous eu un mal de tête soudain et intense qui a atteint son pire en moins d’une minute?', 'Votre enfant a-t-il eu un mal de tête soudain et intense qui a atteint son pire en moins d’une minute?', 'Cette personne a-t-elle eu un mal de tête soudain et intense qui a atteint son pire en moins d’une minute?'],
  ), ['subarachnoid_hemorrhage'], { emergency: true }),
  screen('s.neck_light', w(
    ['Do you have a stiff neck, or does light hurt your eyes?', 'Does your child have a stiff neck, or does light hurt their eyes?', 'Do they have a stiff neck, or does light hurt their eyes?'],
    ['Avez-vous la nuque raide, ou la lumière vous fait-elle mal aux yeux?', 'Votre enfant a-t-il la nuque raide, ou la lumière lui fait-elle mal aux yeux?', 'Cette personne a-t-elle la nuque raide, ou la lumière lui fait-elle mal aux yeux?'],
  ), ['meningitis']),
  screen('s.rash_fade', w(
    ['Do you have a rash of small red or purple spots that doesn’t fade when you press on it?', 'Does your child have a rash of small red or purple spots that doesn’t fade when you press on it?', 'Do they have a rash of small red or purple spots that doesn’t fade when you press on it?'],
    ['Avez-vous une éruption de petits points rouges ou violets qui ne pâlissent pas quand on appuie dessus?', 'Votre enfant a-t-il une éruption de petits points rouges ou violets qui ne pâlissent pas quand on appuie dessus?', 'Cette personne a-t-elle une éruption de petits points rouges ou violets qui ne pâlissent pas quand on appuie dessus?'],
  ), ['meningitis', 'sepsis']),
  screen('s.fever_unwell', w(
    ['Do you have a fever and feel very unwell, confused or very drowsy?', 'Does your child have a fever and seem very unwell, confused or very drowsy?', 'Do they have a fever and seem very unwell, confused or very drowsy?'],
    ['Avez-vous de la fièvre et vous sentez-vous très malade, avec de la confusion ou une grande somnolence?', 'Votre enfant a-t-il de la fièvre et semble-t-il très malade, avec de la confusion ou une grande somnolence?', 'Cette personne a-t-elle de la fièvre et semble-t-elle très malade, avec de la confusion ou une grande somnolence?'],
  ), ['sepsis', 'meningitis']),
  screen('s.airway', w(
    ['Is there any swelling of your lips, tongue or throat, or trouble swallowing?', 'Is there any swelling of your child’s lips, tongue or throat, or trouble swallowing?', 'Is there any swelling of their lips, tongue or throat, or trouble swallowing?'],
    ['Avez-vous une enflure des lèvres, de la langue ou de la gorge, ou de la difficulté à avaler?', 'Votre enfant a-t-il une enflure des lèvres, de la langue ou de la gorge, ou de la difficulté à avaler?', 'Cette personne a-t-elle une enflure des lèvres, de la langue ou de la gorge, ou de la difficulté à avaler?'],
  ), ['anaphylaxis', 'epiglottitis'], { emergency: true }),
  screen('s.pain_proportion', w(
    ['Is the pain much worse than you’d expect from how it looks?', 'Is your child’s pain much worse than you’d expect from how it looks?', 'Is their pain much worse than you’d expect from how it looks?'],
    ['La douleur est-elle beaucoup plus forte que ce que l’apparence laisse croire?', 'La douleur de votre enfant est-elle beaucoup plus forte que ce que l’apparence laisse croire?', 'La douleur de cette personne est-elle beaucoup plus forte que ce que l’apparence laisse croire?'],
  ), ['necrotizing_fasciitis', 'compartment_syndrome']),
  screen('s.spreading_fast', w(
    ['Is the redness or swelling spreading quickly, over a few hours?', 'Is the redness or swelling spreading quickly, over a few hours?', 'Is the redness or swelling spreading quickly, over a few hours?'],
    ['La rougeur ou l’enflure s’étend-elle rapidement, en quelques heures?', 'La rougeur ou l’enflure s’étend-elle rapidement, en quelques heures?', 'La rougeur ou l’enflure s’étend-elle rapidement, en quelques heures?'],
  ), ['necrotizing_fasciitis']),
  screen('s.saddle', w(
    ['Do you have numbness between your legs or around your bottom, or new trouble controlling your bladder or bowels?', 'Does your child have numbness between their legs or around their bottom, or new trouble controlling their bladder or bowels?', 'Do they have numbness between their legs or around their bottom, or new trouble controlling their bladder or bowels?'],
    ['Avez-vous un engourdissement entre les jambes ou autour des fesses, ou une nouvelle difficulté à contrôler votre vessie ou vos intestins?', 'Votre enfant a-t-il un engourdissement entre les jambes ou autour des fesses, ou une nouvelle difficulté à contrôler sa vessie ou ses intestins?', 'Cette personne a-t-elle un engourdissement entre les jambes ou autour des fesses, ou une nouvelle difficulté à contrôler sa vessie ou ses intestins?'],
  ), ['cauda_equina']),
  screen('s.pregnancy_bleeding', w(
    ['Do you have any vaginal bleeding along with the pain?', 'Does your child have any vaginal bleeding along with the pain?', 'Do they have any vaginal bleeding along with the pain?'],
    ['Avez-vous des saignements vaginaux en plus de la douleur?', 'Votre enfant a-t-elle des saignements vaginaux en plus de la douleur?', 'Cette personne a-t-elle des saignements vaginaux en plus de la douleur?'],
  ), ['ectopic_pregnancy'], { when: FEMALE_CHILDBEARING }),
  screen('s.rlq', w(
    ['Has the pain moved to the lower right side of your belly?', 'Has your child’s pain moved to the lower right side of their belly?', 'Has their pain moved to the lower right side of their belly?'],
    ['La douleur s’est-elle déplacée vers le bas du ventre, du côté droit?', 'La douleur de votre enfant s’est-elle déplacée vers le bas du ventre, du côté droit?', 'La douleur de cette personne s’est-elle déplacée vers le bas du ventre, du côté droit?'],
  ), ['appendicitis']),
  screen('s.testicle', w(
    ['Do you have a sudden, severe pain in one testicle?', 'Does your child have a sudden, severe pain in one testicle?', 'Do they have a sudden, severe pain in one testicle?'],
    ['Avez-vous une douleur soudaine et intense dans un testicule?', 'Votre enfant a-t-il une douleur soudaine et intense dans un testicule?', 'Cette personne a-t-elle une douleur soudaine et intense dans un testicule?'],
  ), ['testicular_torsion'], { when: { sex: 'male' } }),
  screen('s.flank_fever', w(
    ['Do you have a fever along with pain in your back or side, below the ribs?', 'Does your child have a fever along with pain in their back or side, below the ribs?', 'Do they have a fever along with pain in their back or side, below the ribs?'],
    ['Avez-vous de la fièvre avec une douleur au dos ou au côté, sous les côtes?', 'Votre enfant a-t-il de la fièvre avec une douleur au dos ou au côté, sous les côtes?', 'Cette personne a-t-elle de la fièvre avec une douleur au dos ou au côté, sous les côtes?'],
  ), ['pyelonephritis']),
  screen('s.vision', w(
    ['Have you suddenly lost vision, or seen a curtain or many new floaters, in one eye?', 'Has your child suddenly lost vision, or seen a curtain or many new floaters, in one eye?', 'Have they suddenly lost vision, or seen a curtain or many new floaters, in one eye?'],
    ['Avez-vous soudainement perdu la vue, ou vu un rideau ou beaucoup de nouveaux corps flottants, dans un œil?', 'Votre enfant a-t-il soudainement perdu la vue, ou vu un rideau ou beaucoup de nouveaux corps flottants, dans un œil?', 'Cette personne a-t-elle soudainement perdu la vue, ou vu un rideau ou beaucoup de nouveaux corps flottants, dans un œil?'],
  ), ['retinal_detachment', 'stroke']),
];

const CAUSES: PackCause[] = [
  { id: 'sepsis', label: 'Sepsis', tier: 'cant_miss', systems: ['general'], synonyms: ['sepsis', 'septic', 'septicemia', 'septic shock', 'blood infection'], screenBankIds: ['s.fever_unwell', 's.rash_fade'] },
  { id: 'heart_attack', label: 'Heart attack (acute coronary syndrome)', tier: 'cant_miss', systems: ['cardiovascular', 'respiratory', 'abdominal'], ages: { min: 25 },
    synonyms: ['heart attack', 'myocardial infarction', 'acute coronary syndrome', 'acs', 'mi', 'stemi', 'nstemi', 'unstable angina', 'cardiac ischemia'], screenBankIds: ['s.chest', 's.sweaty'] },
  { id: 'pulmonary_embolism', label: 'Pulmonary embolism', tier: 'cant_miss', systems: ['respiratory', 'cardiovascular'], ages: { min: 12 },
    synonyms: ['pulmonary embolism', 'pulmonary embolus', 'pe', 'blood clot in the lung', 'lung clot'], screenBankIds: ['s.breathing', 's.breath_pain', 's.leg_swelling'] },
  { id: 'dvt', label: 'Deep vein clot (DVT)', tier: 'cant_miss', systems: ['musculoskeletal', 'skin', 'cardiovascular'], keywords: /\bleg|calf|thigh|ankle|swell|jambe|mollet|cuisse|cheville|enfl/i, ages: { min: 12 },
    synonyms: ['deep vein thrombosis', 'deep vein clot', 'dvt', 'blood clot in the leg', 'leg clot'], screenBankIds: ['s.leg_swelling'] },
  { id: 'stroke', label: 'Stroke or mini-stroke', tier: 'cant_miss', systems: ['neuro', 'eye'], ages: { min: 18 },
    synonyms: ['stroke', 'cva', 'cerebrovascular accident', 'tia', 'transient ischemic attack', 'mini-stroke', 'mini stroke'], screenBankIds: ['s.stroke', 's.vision'] },
  { id: 'subarachnoid_hemorrhage', label: 'Bleeding in the brain (subarachnoid haemorrhage)', tier: 'cant_miss', systems: ['neuro'], keywords: /\bhead|migraine|neck|tête|\btete\b|nuque|\bcou\b/i,
    synonyms: ['subarachnoid hemorrhage', 'subarachnoid haemorrhage', 'sah', 'brain bleed', 'bleeding in the brain', 'intracranial hemorrhage', 'intracranial haemorrhage', 'ruptured aneurysm'], screenBankIds: ['s.thunderclap'] },
  { id: 'meningitis', label: 'Meningitis', tier: 'cant_miss', systems: ['neuro', 'skin'], keywords: /\bhead|neck|fever|rash|spots?\b|purple|confus|drows|stiff|tête|nuque|fièvre|fievre|éruption|eruption|points|somnol|raide/i,
    synonyms: ['meningitis', 'meningococcal', 'meningococcemia', 'meningococcal disease'], screenBankIds: ['s.neck_light', 's.rash_fade', 's.fever_unwell'] },
  { id: 'anaphylaxis', label: 'Severe allergic reaction (anaphylaxis)', tier: 'cant_miss', systems: ['skin', 'respiratory', 'ent'], keywords: /rash|hives?\b|swell|\bitch|allerg|sting|\bbite|throat|\blips?\b|tongue|breath|urticaire|enfl|piqûre|piqure|gorge|lèvre|levre|langue|souffle|respir/i,
    synonyms: ['anaphylaxis', 'anaphylactic', 'anaphylactic shock', 'severe allergic reaction'], screenBankIds: ['s.airway', 's.breathing'] },
  { id: 'epiglottitis', label: 'Airway-threatening throat infection', tier: 'cant_miss', systems: ['ent', 'respiratory'], keywords: /throat|swallow|drool|voice|hoarse|\bgorge\b|avaler|\bvoix\b|\bbave/i,
    synonyms: ['epiglottitis', 'peritonsillar abscess', 'quinsy', 'retropharyngeal abscess', 'airway obstruction'], screenBankIds: ['s.airway', 's.breathing'] },
  { id: 'necrotizing_fasciitis', label: 'Flesh-eating infection (necrotising fasciitis)', tier: 'cant_miss', systems: ['skin', 'musculoskeletal'], keywords: /\bred|spread|\bhot\b|warm|swell|wound|\bcut\b|\bbite|infect|purple|spots?\b|rouge|chaud|enfl|plaie|coupure|infect|violet|s’étend|s'étend/i,
    synonyms: ['necrotizing fasciitis', 'necrotising fasciitis', 'flesh-eating', 'flesh eating', 'flesh-eating bacteria', 'flesh-eating infection', 'nec fasc'], screenBankIds: ['s.pain_proportion', 's.spreading_fast'] },
  { id: 'compartment_syndrome', label: 'Compartment syndrome', tier: 'cant_miss', systems: ['musculoskeletal'], keywords: /injur|\bfell\b|\bfall|crush|fractur|broke|\bcast\b|\bhit\b|blessure|chute|écras|ecras|plâtre|platre|frapp/i,
    synonyms: ['compartment syndrome'], screenBankIds: ['s.pain_proportion'] },
  { id: 'cauda_equina', label: 'Spinal nerve compression (cauda equina)', tier: 'cant_miss', systems: ['musculoskeletal', 'neuro', 'urinary'], keywords: /\bback\b|spine|sciatic|bladder|bowel|\bdos\b|colonne|sciatique|vessie/i, ages: { min: 18 },
    synonyms: ['cauda equina', 'cauda equina syndrome', 'spinal cord compression'], screenBankIds: ['s.saddle'] },
  { id: 'ectopic_pregnancy', label: 'Ectopic pregnancy', tier: 'cant_miss', systems: ['abdominal', 'reproductive'], sex: 'female', ages: { min: 12, max: 55 },
    synonyms: ['ectopic pregnancy', 'ectopic', 'tubal pregnancy'], screenBankIds: ['u.pregnancy', 's.pregnancy_bleeding'] },
  { id: 'testicular_torsion', label: 'Testicular torsion', tier: 'cant_miss', systems: ['reproductive', 'abdominal'], sex: 'male', ages: { max: 40 },
    synonyms: ['testicular torsion', 'torsion', 'twisted testicle'], screenBankIds: ['s.testicle'] },
  { id: 'retinal_detachment', label: 'Retinal detachment', tier: 'cant_miss', systems: ['eye'], keywords: /vision|sight|floater|flash|curtain|blur|\bvue\b|flottant|éclair|eclair|rideau|flou/i, ages: { min: 18 },
    synonyms: ['retinal detachment', 'detached retina'], screenBankIds: ['s.vision'] },
  { id: 'self_harm_risk', label: 'Risk of self-harm', tier: 'cant_miss', systems: ['mental_health'], ages: { min: 8 },
    synonyms: ['suicide', 'suicidal', 'suicide risk', 'self-harm', 'self harm', 'suicidal ideation'], screenBankIds: [],
    askInRoom: { en: 'Ask privately about any thoughts of self-harm or suicide.', fr: 'Demander en privé s’il y a des pensées d’automutilation ou de suicide.' } },
  { id: 'appendicitis', label: 'Appendicitis', tier: 'urgent', systems: ['abdominal'], keywords: /belly|abdom|stomach|tummy|ventre|estomac/i,
    synonyms: ['appendicitis', 'appendix'], screenBankIds: ['s.rlq'] },
  { id: 'pyelonephritis', label: 'Kidney infection (pyelonephritis)', tier: 'urgent', systems: ['urinary', 'abdominal'], keywords: /urin|\bpee|burn|\bback\b|\bside\b|flank|kidney|fever|uriner|pipi|brûl|brul|\bdos\b|côté|\bcote\b|\breins?\b|fièvre|fievre/i,
    synonyms: ['pyelonephritis', 'kidney infection', 'urosepsis'], screenBankIds: ['s.flank_fever'] },
];

export const UNCLEAR_PACK: KnowledgePack = {
  id: 'unclear',
  version: 'unclear@1',
  reviewed: false,
  approvedBy: null,
  coreHistory: ['onset', 'severity', 'course', 'medications', 'allergies', 'conditions'],
  order: {
    core: ['u.onset', 'u.severity', 'u.course', 'u.location', 'u.character'],
    fillers: ['u.medications', 'u.allergies', 'u.conditions', 'u.associated', 'u.pregnancy', 'u.tried', 'u.worse_activity', 'u.recent_events', 'u.daily_impact'],
    closing: 'u.anything_else',
  },
  causes: CAUSES,
  bank: BANK,
};
