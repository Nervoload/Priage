import type { KnowledgePack, PackCause } from '../packs/types';
import type { BodySystem, Candidate } from './types';

// The dangerous-cause audit: after the model reasons (without seeing this
// list), code adds any dangerous cause for the complaint's body systems that
// the model didn't consider. A safety net, not a script.

/**
 * Body systems by keyword, in English and French. "general" always applies.
 * Short words carry \b so "dent" doesn't match "accident"; \b can't sit before
 * an accented letter in a non-unicode regex, so those words go without it.
 */
const SYSTEM_KEYWORDS: Array<[BodySystem, RegExp]> = [
  ['respiratory', /breath|cough|wheez|chest|lung|asthma|phlegm|sputum|\bcold\b|\bflu\b|respir|\btoux\b|poitrine|poumon|souffle/i],
  ['cardiovascular', /chest|heart|palpitat|racing heart|faint|pass(ed)? out|blood pressure|swollen (leg|ankle)|c(œ|oe)ur|poitrine|thorac|évanoui|evanoui/i],
  ['neuro', /\bhead|migraine|dizz|numb|tingl|\bweak|speech|confus|seizure|faint|memory|vertigo|tête|\btete\b|vertige|engourd|faiblesse|convuls|étourdi|etourdi/i],
  ['skin', /rash|\bskin|\bitch|hives?\b|\bred(ness)?\b|\bspots?\b|bruis|swell|\bbite|\bsting|\bburn|wound|\bcut\b|\blump|blister|purple|\bpeau\b|éruption|eruption|rougeur|démange|demange|enflure|piqûre|piqure|\bbleu\b|brûlure|brulure/i],
  ['abdominal', /stomach|belly|abdom|tummy|nause|vomit|diarr|constipat|bowel|stool|\bpoo|ventre|estomac|vomi|diarrh/i],
  ['urinary', /urin|\bpee\b|\bpeeing|bladder|burning when|kidney|\bflank|\buriner|\bpipi\b|vessie|\breins?\b/i],
  ['musculoskeletal', /\bback\b|\bneck|joint|\bknee|ankle|wrist|shoulder|\bhips?\b|\blegs?\b|\barms?\b|\bfoot|\bfeet\b|\bhands?\b|muscle|sprain|injur|\bfell\b|\bfall|\bbone|fractur|\bcalf|thigh|\bdos\b|\bcou\b|genou|cheville|poignet|épaule|epaule|hanche|jambe|\bbras\b|\bpieds?\b|\bmains?\b|entorse|blessure|\bchute|mollet|cuisse/i],
  ['ent', /throat|\bears?\b|earache|sinus|\bnose|tonsil|swallow|\bvoice|hoarse|\bmouth|tooth|teeth|\bgorge\b|oreille|\bnez\b|amygdale|avaler|\bvoix\b|bouche|\bdents?\b/i],
  ['eye', /\beyes?\b|vision|eyesight|blurr|floater|œil|\boeil|\byeux\b|\bvue\b/i],
  ['mental_health', /\bmood|depress|anxi|panic|stress|\bsleep|suicid|self[- ]harm|mental|worr|humeur|déprim|deprim|anxiét|anxiet|angoisse|sommeil/i],
  ['reproductive', /\bperiods?\b|vagin|pelvi|pregnan|testic|scrot|penis|genital|discharge|menstru|règles|\bregles\b|enceinte|testicul|pénis|génitaux|genitaux|\bpertes\b/i],
];

export function complaintSystems(texts: ReadonlyArray<string | null | undefined>): BodySystem[] {
  const joined = texts.filter(Boolean).join(' \n ');
  const found = new Set<BodySystem>(['general']);
  for (const [system, pattern] of SYSTEM_KEYWORDS) if (pattern.test(joined)) found.add(system);
  return [...found];
}

export function normalizeLabel(label: string): string {
  return label.toLowerCase().replace(/[’']/g, '').replace(/[()[\],.;:/]/g, ' ').replace(/\s+/g, ' ').trim();
}

function slug(label: string): string {
  return normalizeLabel(label).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'unnamed';
}

export function wholeWord(haystack: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`).test(haystack);
}

/** Short synonyms ("mi", "pe") only match exactly; longer ones may appear inside a longer label. */
function matchesCause(label: string, cause: PackCause): boolean {
  const normalized = normalizeLabel(label);
  if (normalized === cause.id.replace(/_/g, ' ') || normalized === normalizeLabel(cause.label)) return true;
  return cause.synonyms.some((synonym) => {
    const term = normalizeLabel(synonym);
    return normalized === term || ((term.length >= 4 || term.includes(' ')) && wholeWord(normalized, term));
  });
}

/** A model's cause as a pack id when it is one the pack knows, otherwise `other:<slug>`. */
export function resolveCauseId(pack: KnowledgePack, label: string, id?: string): string {
  if (id && pack.causes.some((cause) => cause.id === id)) return id;
  const match = pack.causes.find((cause) => matchesCause(label, cause));
  if (match) return match.id;
  if (id?.startsWith('other:')) return id;
  return `other:${slug(label)}`;
}

/** Every name a question must not say out loud: the pack's causes and whatever the case holds. */
export function causeTerms(pack: KnowledgePack, candidates: readonly Candidate[]): string[] {
  const terms = new Set<string>();
  for (const cause of pack.causes) {
    terms.add(normalizeLabel(cause.label));
    for (const synonym of cause.synonyms) terms.add(normalizeLabel(synonym));
  }
  for (const candidate of candidates) terms.add(normalizeLabel(candidate.label));
  return [...terms].filter(Boolean);
}

export interface AuditContext {
  systems: readonly BodySystem[];
  /** The patient's own words so far, for causes that need a keyword as well as a body system. */
  text: string;
  age: number | null;
  sex: 'female' | 'male' | null;
}

export function causeApplies(cause: PackCause, ctx: AuditContext): boolean {
  if (!cause.systems.includes('general') && !cause.systems.some((system) => ctx.systems.includes(system))) return false;
  if (cause.keywords && !cause.keywords.test(ctx.text)) return false;
  if (cause.sex && ctx.sex && cause.sex !== ctx.sex) return false;
  if (cause.ages && ctx.age != null) {
    if (cause.ages.min != null && ctx.age < cause.ages.min) return false;
    if (cause.ages.max != null && ctx.age > cause.ages.max) return false;
  }
  return true;
}

/** Dangerous causes for these systems, age and sex that aren't in the case yet. Unknown age or sex includes them. */
export function dangerousCauseAudit(pack: KnowledgePack, ctx: AuditContext, candidates: readonly Candidate[]): Candidate[] {
  const present = new Set(candidates.map((candidate) => candidate.id));
  return pack.causes
    .filter((cause) => !present.has(cause.id) && causeApplies(cause, ctx))
    .map((cause) => ({
      id: cause.id, label: cause.label, tier: cause.tier, status: 'not_enough_information' as const,
      for: [], against: [], askableNext: [...cause.screenBankIds], needsInPerson: [], addedBy: 'audit' as const,
    }));
}
