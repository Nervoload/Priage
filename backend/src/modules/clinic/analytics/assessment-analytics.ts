// Turns a clinic's Care snapshots, clinician feedback and ask-in-room ticks
// into the numbers admins use to judge Priage's suggestions. Pure, so the
// counting rules are tested on their own.

type JsonRecord = Record<string, unknown>;
const asRecord = (value: unknown): JsonRecord => value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const text = (value: unknown): string => typeof value === 'string' ? value : '';

export interface SnapshotRow { encounterId: number; version: number; content: unknown }
export interface FeedbackRow {
  kind: 'USEFUL' | 'NOT_RIGHT' | 'MISSING';
  sectionKey: string;
  ruleId: string | null;
  generatorKind: string;
  generatorVersion: string | null;
  segmentId: string | null;
  snapshotId: number;
  note: string | null;
  createdAt: Date;
}
export interface AskQuestionRow { addressedAt: Date | null; answerText: string | null }

export interface FeedbackCounts { useful: number; notRight: number; missing: number }

export interface AssessmentAnalytics {
  visits: number;
  urgency: { clear: number; caution: number; escalate: number; unrated: number };
  emergency: { shown: number; continued: number };
  askInRoom: { suggested: number; asked: number; answered: number };
  clinicQuestions: { inInterview: number; afterInterview: number; missing: number };
  feedback: {
    totals: FeedbackCounts;
    bySection: Array<{ sectionKey: string } & FeedbackCounts>;
    byRule: Array<{ ruleId: string } & FeedbackCounts>;
    byGenerator: Array<{ generator: string } & FeedbackCounts>;
  };
  recentNotes: Array<{ kind: 'NOT_RIGHT' | 'MISSING'; sectionKey: string; ruleId: string | null; note: string; itemText: string | null; createdAt: string }>;
}

const empty = (): FeedbackCounts => ({ useful: 0, notRight: 0, missing: 0 });

function add(counts: FeedbackCounts, kind: FeedbackRow['kind']) {
  if (kind === 'USEFUL') counts.useful += 1;
  else if (kind === 'NOT_RIGHT') counts.notRight += 1;
  else counts.missing += 1;
}

/** Most "not right" first, then most feedback overall, then by name. */
function ranked<K extends string>(map: Map<string, FeedbackCounts>, key: K): Array<Record<K, string> & FeedbackCounts> {
  return [...map.entries()]
    .map(([name, counts]) => ({ [key]: name, ...counts }) as Record<K, string> & FeedbackCounts)
    .sort((left, right) => right.notRight - left.notRight
      || (right.useful + right.notRight + right.missing) - (left.useful + left.notRight + left.missing)
      || String(left[key]).localeCompare(String(right[key])));
}

export function summarizeAssessments(input: {
  snapshots: SnapshotRow[];
  /** id → text of the generated item, for notes. */
  segmentText: (snapshotId: number, segmentId: string) => string | null;
  feedback: FeedbackRow[];
  askQuestions: AskQuestionRow[];
  noteLimit?: number;
}): AssessmentAnalytics {
  // The latest snapshot per visit is what clinicians read.
  const latest = new Map<number, SnapshotRow>();
  for (const row of input.snapshots) {
    const current = latest.get(row.encounterId);
    if (!current || row.version > current.version) latest.set(row.encounterId, row);
  }

  const urgency = { clear: 0, caution: 0, escalate: 0, unrated: 0 };
  const emergency = { shown: 0, continued: 0 };
  const clinicQuestions = { inInterview: 0, afterInterview: 0, missing: 0 };
  let suggested = 0;
  for (const { content } of latest.values()) {
    const value = asRecord(content);
    const level = text(asRecord(value.urgency).level);
    if (level === 'clear' || level === 'caution' || level === 'escalate') urgency[level] += 1;
    else urgency.unrated += 1;
    const events = list(value.emergencyEvents).map(asRecord);
    if (events.length) emergency.shown += 1;
    if (events.some((event) => text(event.acknowledgedAt))) emergency.continued += 1;
    suggested += list(value.askInRoom).length;
    const timing = text(asRecord(value.questionnaire).timing);
    if (timing === 'in_interview') clinicQuestions.inInterview += 1;
    else if (timing === 'after_interview') clinicQuestions.afterInterview += 1;
    if (list(value.gaps).some((gap) => text(asRecord(gap).kind) === 'clinic_questions_missing')) clinicQuestions.missing += 1;
  }

  const totals = empty();
  const bySection = new Map<string, FeedbackCounts>();
  const byRule = new Map<string, FeedbackCounts>();
  const byGenerator = new Map<string, FeedbackCounts>();
  const bump = (map: Map<string, FeedbackCounts>, name: string, kind: FeedbackRow['kind']) => {
    const counts = map.get(name) ?? empty();
    add(counts, kind);
    map.set(name, counts);
  };
  for (const row of input.feedback) {
    add(totals, row.kind);
    bump(bySection, row.sectionKey, row.kind);
    if (row.ruleId) bump(byRule, row.ruleId, row.kind);
    bump(byGenerator, row.generatorVersion ? `${row.generatorKind} ${row.generatorVersion}` : row.generatorKind, row.kind);
  }

  const recentNotes = input.feedback
    .filter((row): row is FeedbackRow & { kind: 'NOT_RIGHT' | 'MISSING'; note: string } => row.kind !== 'USEFUL' && !!row.note?.trim())
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .slice(0, input.noteLimit ?? 20)
    .map((row) => ({
      kind: row.kind, sectionKey: row.sectionKey, ruleId: row.ruleId, note: row.note.trim(),
      itemText: row.segmentId ? input.segmentText(row.snapshotId, row.segmentId) : null,
      createdAt: row.createdAt.toISOString(),
    }));

  return {
    visits: latest.size,
    urgency,
    emergency,
    askInRoom: {
      suggested,
      asked: input.askQuestions.filter((row) => row.addressedAt).length,
      answered: input.askQuestions.filter((row) => row.answerText?.trim()).length,
    },
    clinicQuestions,
    feedback: { totals, bySection: ranked(bySection, 'sectionKey'), byRule: ranked(byRule, 'ruleId'), byGenerator: ranked(byGenerator, 'generator') },
    recentNotes,
  };
}
