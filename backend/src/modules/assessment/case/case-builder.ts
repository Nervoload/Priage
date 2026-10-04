import { audienceFor } from '../packs/fixed-wording';
import { applies, bankById, type SubjectContext } from '../packs';
import type { KnowledgePack } from '../packs/types';
import { complaintSystems, dangerousCauseAudit, resolveCauseId } from './audit';
import { descriptionEvidence } from './evidence';
import { citeKnown, raiseOnly, retainCantMiss, toCandidates } from './guards';
import type { BodySystem, Candidate, Case, CommunicationNeeds, HistoryElement, InterpreterOutput } from './types';

/** The elements that characterise a complaint when no model says otherwise. */
const CHARACTERISING: readonly HistoryElement[] = ['onset', 'severity', 'course'];

export interface CaseSeed {
  complaint: string;
  note: string | null;
  /** The person the visit is for. */
  patient: { age: number | null; sex: 'female' | 'male' | null };
  communication: CommunicationNeeds;
}

export function subjectOf(current: Case): SubjectContext {
  return { age: current.patient.age, sex: current.patient.sex, audience: audienceFor(current.communication.answeredBy) };
}

/** The case before any question: the patient's own words, code's body systems and the dangerous-cause audit. */
export function initialCase(seed: CaseSeed, pack: KnowledgePack): Case {
  const evidence = descriptionEvidence(seed.complaint, seed.note, { language: seed.communication.language, answeredBy: seed.communication.answeredBy });
  const blank: Case = {
    version: 0,
    complaints: [],
    systems: [],
    evidence,
    history: {},
    candidates: [],
    contradictions: [],
    askInRoom: [],
    notChosen: [],
    asked: [],
    followedUp: [],
    urgency: { model: 'none', reasons: [], answerIds: [] },
    patient: seed.patient,
    communication: seed.communication,
    omissions: [],
    auditAdded: [],
  };
  return { ...refresh(blank, pack, new Set()), version: 1 };
}

function knownAnswerIds(current: Case): Set<string> {
  return new Set(current.evidence.map((item) => item.answerId));
}

/**
 * Deterministic support level for a cause the model hasn't assessed: an
 * answer for it makes it possible, only answers against make it not supported
 * by history (never "excluded"), and nothing makes it not enough information.
 */
function deterministicCandidate(candidate: Candidate, current: Case, pack: KnowledgePack): Candidate {
  const about = current.evidence.filter((item) => item.targets.includes(candidate.id));
  const forIds = [...new Set(about.filter((item) => item.kind === 'reported').map((item) => item.answerId))];
  const againstIds = [...new Set(about.filter((item) => item.kind === 'denied').map((item) => item.answerId))];
  const unsure = about.some((item) => item.kind === 'not_sure');
  const status = forIds.length ? 'possible' : againstIds.length ? 'not_supported' : 'not_enough_information';

  // Screens: ask the first one; ask the rest only if an answer supported it or was unsure.
  const cause = pack.causes.find((entry) => entry.id === candidate.id);
  const asked = new Set(current.asked.map((question) => question.key));
  const subject = subjectOf(current);
  const screens = (cause?.screenBankIds ?? []).filter((id) => {
    const question = bankById(pack, id);
    return !!question && applies(question.when, subject);
  });
  // A cause counts as screened once any answer spoke to it, from the bank or from a model question.
  const unasked = screens.filter((id) => !asked.has(id));
  const screened = about.length > 0 || screens.some((id) => asked.has(id));
  const askableNext = !screened ? unasked.slice(0, 1) : forIds.length || unsure ? unasked : [];
  return { ...candidate, status, for: forIds, against: againstIds, askableNext };
}

/** Recomputes everything code owns: systems, characterisation, the audit, and causes the model didn't assess this round. */
function refresh(current: Case, pack: KnowledgePack, assessedByModel: ReadonlySet<string>): Case {
  // The patient's words, plus any yes/no question they said Yes to ("did anything hit your leg?").
  const freeText = current.evidence.filter((item) => item.kind !== 'denied' && item.kind !== 'not_sure').map((item) => [item.affirms, item.patientWords].filter(Boolean).join(' '));
  const systems = [...new Set<BodySystem>([...current.systems, ...complaintSystems(freeText), ...current.complaints.flatMap((complaint) => complaint.systems)])];

  const settled = CHARACTERISING.every((element) => !!current.history[element]);
  const description = current.evidence.find((item) => item.answerId === 'visit:complaint')?.patientWords ?? '';
  const complaints = (current.complaints.length ? current.complaints : [{ id: 'complaint', patientWords: description, systems, characterized: false }])
    .map((complaint) => ({ ...complaint, characterized: complaint.characterized || settled }));

  const added = dangerousCauseAudit(pack, { systems, text: freeText.join(' \n '), age: current.patient.age, sex: current.patient.sex }, current.candidates);
  const withAudit = { ...current, systems, complaints, candidates: [...current.candidates, ...added] };
  const candidates = withAudit.candidates.map((candidate) =>
    candidate.addedBy === 'audit' && !assessedByModel.has(candidate.id) ? deterministicCandidate(candidate, withAudit, pack) : candidate);

  // Dangerous causes whose screen belongs with the clinician become ask-in-the-room items.
  const askInRoom = [...current.askInRoom];
  for (const candidate of candidates) {
    const cause = pack.causes.find((entry) => entry.id === candidate.id);
    if (!cause?.askInRoom || askInRoom.some((item) => item.text === cause.askInRoom?.en)) continue;
    askInRoom.push({ text: cause.askInRoom.en, reason: 'Sensitive; better asked in person.', answerIds: [] });
  }

  return {
    ...withAudit,
    candidates,
    askInRoom,
    auditAdded: [...new Set([...current.auditAdded, ...added.map((candidate) => candidate.id)])],
  };
}

export interface RoundResult {
  case: Case;
  droppedCitations: number;
  omissions: string[];
}

/**
 * Builds the next case version from the interpreter's output (or none, in
 * bank-only mode). Code checks every claim: citations must exist, support
 * levels must match their evidence, dangerous causes are never dropped, and
 * urgency only rises.
 */
export function applyRound(previous: Case, pack: KnowledgePack, interpreter: InterpreterOutput | null): RoundResult {
  if (!interpreter) return { case: { ...refresh(previous, pack, new Set()), version: previous.version + 1 }, droppedCitations: 0, omissions: [] };

  const known = knownAnswerIds(previous);
  const { candidates: drafted, droppedCitations } = toCandidates(interpreter.candidates, (draft) => resolveCauseId(pack, draft.label, draft.id), known);
  // A cause the pack calls dangerous stays dangerous whatever the model says.
  const tiered = drafted.map((candidate) => {
    const cause = pack.causes.find((entry) => entry.id === candidate.id);
    return cause?.tier === 'cant_miss' ? { ...candidate, tier: 'cant_miss' as const } : candidate;
  });
  const assessed = new Set(tiered.map((candidate) => candidate.id));
  const { candidates, omissions } = retainCantMiss(previous.candidates, tiered);

  const evidenceIdsFor = (answerIds: string[]) => previous.evidence.filter((item) => answerIds.includes(item.answerId)).map((item) => item.id);
  const history = { ...previous.history };
  for (const entry of interpreter.history) {
    const answerIds = citeKnown(entry.answerIds, known);
    if (entry.status === 'filled' && !answerIds.length) continue;
    if (history[entry.element]?.status === 'filled' && entry.status === 'unknown') continue;
    history[entry.element] = { status: entry.status, evidenceIds: evidenceIdsFor(answerIds) };
  }

  const contradictions = [...previous.contradictions];
  for (const item of interpreter.contradictions) {
    const answerIds = citeKnown(item.answerIds, known).sort();
    if (answerIds.length < 2 || contradictions.some((existing) => existing.answerIds.join() === answerIds.join())) continue;
    contradictions.push({ answerIds, note: item.note.trim(), clarified: false });
  }

  const escalateIds = citeKnown(interpreter.escalate.answerIds, known);
  const raised = escalateIds.length ? raiseOnly(previous.urgency.model, interpreter.escalate.level) : previous.urgency.model;
  const urgency = raised === previous.urgency.model ? previous.urgency : {
    model: raised,
    reasons: [...previous.urgency.reasons, interpreter.escalate.reason.trim()].filter(Boolean),
    answerIds: [...new Set([...previous.urgency.answerIds, ...escalateIds])],
  };

  const complaints = interpreter.complaints.length ? interpreter.complaints : previous.complaints;
  const next = refresh({ ...previous, complaints, history, candidates, contradictions, urgency }, pack, assessed);
  return {
    case: { ...next, version: previous.version + 1, omissions: [...new Set([...previous.omissions, ...omissions])] },
    droppedCitations,
    omissions,
  };
}
