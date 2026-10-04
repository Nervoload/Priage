import type { Audience, DurationUnit, Language, RoundType } from '../case/types';
import type { Localized, Wording } from './types';

// Wording code adds around every question. English matches the legacy engine
// where it overlaps. French is unreviewed until the clinical owner approves it.

export const FIXED_WORDING_REVIEWED = false;

export const SAFETY_QUESTION: { prompt: Wording; help: Wording } = {
  prompt: {
    en: {
      self: 'Are you in immediate danger right now?',
      child: 'Is your child in immediate danger right now?',
      other: 'Is the person you’re helping in immediate danger right now?',
    },
    fr: {
      self: 'Êtes-vous en danger immédiat en ce moment?',
      child: 'Votre enfant est-il en danger immédiat en ce moment?',
      other: 'La personne que vous aidez est-elle en danger immédiat en ce moment?',
    },
  },
  help: {
    en: {
      self: 'If you have severe trouble breathing, central chest pain, heavy bleeding, stroke-like symptoms, or you feel unsafe waiting, tell us now.',
      child: 'If your child has severe trouble breathing, chest pain, heavy bleeding, stroke-like symptoms, or you feel it’s unsafe to wait, tell us now.',
      other: 'If they have severe trouble breathing, chest pain, heavy bleeding, stroke-like symptoms, or you feel it’s unsafe to wait, tell us now.',
    },
    fr: {
      self: 'Si vous avez beaucoup de difficulté à respirer, une douleur au centre de la poitrine, un saignement abondant, des signes d’AVC, ou si vous ne vous sentez pas en sécurité pour attendre, dites-le-nous maintenant.',
      child: 'Si votre enfant a beaucoup de difficulté à respirer, une douleur à la poitrine, un saignement abondant, des signes d’AVC, ou si vous pensez qu’il n’est pas sécuritaire d’attendre, dites-le-nous maintenant.',
      other: 'Si cette personne a beaucoup de difficulté à respirer, une douleur à la poitrine, un saignement abondant, des signes d’AVC, ou si vous pensez qu’il n’est pas sécuritaire d’attendre, dites-le-nous maintenant.',
    },
  },
};

export const EMERGENCY_ALERT: Record<Language, { title: string; body: string; recommendation: string }> = {
  en: {
    title: 'Get emergency help now',
    body: 'Your answer suggests this may be a life-threatening emergency. Call 911 or go to the nearest emergency department immediately if you cannot get there safely on your own.',
    recommendation: 'Acknowledge this warning if you still want to continue the intake flow.',
  },
  fr: {
    title: 'Obtenez de l’aide d’urgence maintenant',
    body: 'Votre réponse indique qu’il pourrait s’agir d’une urgence mettant la vie en danger. Composez le 911 ou rendez-vous immédiatement à l’urgence la plus proche si vous ne pouvez pas vous y rendre en sécurité par vos propres moyens.',
    recommendation: 'Confirmez avoir lu cet avertissement si vous voulez tout de même continuer.',
  },
};

export const YES: Localized = { en: 'Yes', fr: 'Oui' };
export const NO: Localized = { en: 'No', fr: 'Non' };
export const NOT_SURE: Localized = { en: 'Not sure', fr: 'Je ne sais pas' };
export const NONE_OF_THESE: Localized = { en: 'None of these', fr: 'Aucun de ceux-ci' };

export const SCALE_ENDS: Record<Language, { min: string; max: string }> = {
  en: { min: 'None', max: 'Worst imaginable' },
  fr: { min: 'Aucun', max: 'Pire imaginable' },
};

const UNIT_WORDS: Record<Language, Record<DurationUnit, [string, string]>> = {
  en: { minutes: ['minute', 'minutes'], hours: ['hour', 'hours'], days: ['day', 'days'], weeks: ['week', 'weeks'], months: ['month', 'months'], years: ['year', 'years'] },
  fr: { minutes: ['minute', 'minutes'], hours: ['heure', 'heures'], days: ['jour', 'jours'], weeks: ['semaine', 'semaines'], months: ['mois', 'mois'], years: ['an', 'ans'] },
};

export function durationWords(amount: number, unit: DurationUnit, language: Language): string {
  const [one, many] = UNIT_WORDS[language][unit];
  // French uses the singular for 0 and 1; English only for exactly 1.
  const singular = language === 'fr' ? amount < 2 : amount === 1;
  return `${amount} ${singular ? one : many}`;
}

export function unitLabels(language: Language): Record<DurationUnit, string> {
  const words = UNIT_WORDS[language];
  return Object.fromEntries((Object.keys(words) as DurationUnit[]).map((unit) => [unit, words[unit][1]])) as Record<DurationUnit, string>;
}

/** "Why we ask" for questions the model wrote. Never the model's own reason, which could name a cause. */
export const PURPOSE_REASON: Record<RoundType, Localized> = {
  clarify: { en: 'This helps us understand what’s happening.', fr: 'Cela nous aide à comprendre ce qui se passe.' },
  danger: { en: 'We ask a few safety questions like this.', fr: 'Nous posons quelques questions de sécurité comme celle-ci.' },
  distinguish: { en: 'Your answer helps the clinic know what to look at first.', fr: 'Votre réponse aide la clinique à savoir quoi regarder en premier.' },
  history: { en: 'The clinic needs this to plan care safely.', fr: 'La clinique en a besoin pour planifier les soins de façon sécuritaire.' },
};

/** The one follow-up a vague free-text answer gets. */
export function followUpPrompt(answer: string, language: Language): string {
  const quoted = answer.trim().slice(0, 60);
  return language === 'fr'
    ? `Vous avez répondu « ${quoted} ». Pouvez-vous nous en dire un peu plus?`
    : `You answered “${quoted}”. Could you tell us a little more?`;
}

export function audienceFor(answeredBy: 'self' | 'parent' | 'caregiver' | 'other'): Audience {
  if (answeredBy === 'parent') return 'child';
  if (answeredBy === 'self') return 'self';
  return 'other';
}
