import type { EncounterStatus } from '../../../shared/types/domain';

export type ClinicRow = {
  id: number; patientId: number; status: 'INTAKE' | 'ADMITTED'; patientName: string;
  age: number | null; gender: string | null; chiefComplaint: string | null;
  contactEmail: string | null; contactPhone: string | null; interviewStatus: string; createdAt: string;
  /** Whether the clinic's own questions were answered. Reception never sees the answers. */
  clinicQuestions?: 'none' | 'pending' | 'answered';
};
export type ReceptionList = { acceptsWalkIns: boolean; walkInPath: string; walkIns: ClinicRow[]; completedPrevisits: ClinicRow[] };
export type AppointmentRow = {
  id: number; encounterId: number; patientId: number; encounterStatus: EncounterStatus;
  patientName: string; age: number | null; gender: string | null; chiefComplaint: string | null;
  createdAt: string; contactEmail: string | null; contactPhone: string | null;
  requestedStartAt: string; confirmedStartAt: string | null; expiresAt: string | null;
  timezone: string; revision: number; allowedActions: string[]; copyText: string;
};
export type Queue = { newAppointments: AppointmentRow[]; expected: AppointmentRow[]; arrived: AppointmentRow[] };
export type Availability = { timezone: string | null; slots: Array<{ startAt: string; remaining: number }> };
export type Delivery = {
  id: string; appointmentId: number | null; purpose: string; status: string; provider: string | null; providerEmailId: string | null;
  retryAllowed: boolean; recipientEmail: string; dueAt: string; lastError: string | null; deliveredAt?: string | null; acceptedAt?: string | null;
  attempts: Array<{ outcome: string; errorCode: string | null; createdAt: string }>; payload?: { text?: string } | null;
};

export type Group = 'new' | 'expected' | 'arrived' | 'walkins' | 'awaiting';
export type CommandKind = 'confirm' | 'decline' | 'reschedule' | 'cancel' | 'arrive' | 'no-show';
export type Selection = { kind: 'appointment' | 'walkin' | 'previsit'; id: number };

export type BoardItem =
  | { group: 'new' | 'expected' | 'arrived'; id: number; row: AppointmentRow; pending?: 'confirm' | 'arrive' }
  | { group: 'walkins' | 'awaiting'; id: number; row: ClinicRow; pending?: undefined };

export const GROUPS: Array<{ key: Group; label: string; short: string; note: string; empty: string }> = [
  { key: 'new', label: 'New requests', short: 'New', note: 'Confirm or change the time', empty: 'No requests waiting for a decision.' },
  { key: 'expected', label: 'Expected', short: 'Expected', note: 'Mark arrived when they check in', empty: 'No confirmed visits coming up.' },
  { key: 'arrived', label: 'Arrived', short: 'Arrived', note: 'Waiting for Care', empty: 'Nobody is waiting for Care.' },
  { key: 'walkins', label: 'Walk-ins', short: 'Walk-ins', note: 'Registered at the desk', empty: 'No walk-ins right now.' },
  { key: 'awaiting', label: 'Waiting to pick a time', short: 'Picking a time', note: 'No action needed', empty: 'Nobody is between the assessment and booking.' },
];

export function selectionFor(item: BoardItem): Selection {
  return { kind: item.group === 'walkins' ? 'walkin' : item.group === 'awaiting' ? 'previsit' : 'appointment', id: item.id };
}

export function sameSelection(item: BoardItem, selection: Selection | null): boolean {
  if (!selection || selection.id !== item.id) return false;
  return selectionFor(item).kind === selection.kind;
}

export function isAppointment(item: BoardItem): item is Extract<BoardItem, { row: AppointmentRow }> {
  return item.group === 'new' || item.group === 'expected' || item.group === 'arrived';
}

export function slotStart(row: AppointmentRow): string {
  return row.confirmedStartAt || row.requestedStartAt;
}

/** Items per group, with deferred (undoable) commands shown where they will land. */
export function buildSections(queue: Queue, reception: ReceptionList, pending: ReadonlyMap<number, 'confirm' | 'arrive'>): Array<{ key: Group; rows: BoardItem[] }> {
  const fromNew: BoardItem[] = [];
  const fromExpected: BoardItem[] = [];
  const news: BoardItem[] = [];
  const expected: BoardItem[] = [];
  for (const row of queue.newAppointments) {
    if (pending.get(row.id) === 'confirm') fromNew.push({ group: 'expected', id: row.id, row, pending: 'confirm' });
    else news.push({ group: 'new', id: row.id, row });
  }
  for (const row of queue.expected) {
    if (pending.get(row.id) === 'arrive') fromExpected.push({ group: 'arrived', id: row.id, row, pending: 'arrive' });
    else expected.push({ group: 'expected', id: row.id, row });
  }
  const byStart = (left: BoardItem, right: BoardItem) =>
    isAppointment(left) && isAppointment(right) ? slotStart(left.row).localeCompare(slotStart(right.row)) : 0;
  return [
    { key: 'new', rows: news },
    { key: 'expected', rows: [...expected, ...fromNew].sort(byStart) },
    { key: 'arrived', rows: [...queue.arrived.map((row): BoardItem => ({ group: 'arrived', id: row.id, row })), ...fromExpected] },
    { key: 'walkins', rows: reception.walkIns.map((row): BoardItem => ({ group: 'walkins', id: row.id, row })) },
    { key: 'awaiting', rows: reception.completedPrevisits.map((row): BoardItem => ({ group: 'awaiting', id: row.id, row })) },
  ];
}

export function matchesSearch(item: BoardItem, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const visitId = isAppointment(item) ? item.row.encounterId : item.id;
  return [item.row.patientName, item.row.chiefComplaint, String(item.id), String(visitId)]
    .some((value) => (value ?? '').toLowerCase().includes(needle));
}

export function visitIdFor(item: BoardItem): number {
  return isAppointment(item) ? item.row.encounterId : item.id;
}

// ─── Words ──────────────────────────────────────────────────────────────────

export function sexWord(value: string | null | undefined): string | null {
  const lower = value?.trim().toLowerCase();
  if (!lower) return null;
  if (lower === 'm' || lower === 'male') return 'male';
  if (lower === 'f' || lower === 'female') return 'female';
  if (lower === 'nb' || lower === 'non-binary' || lower === 'nonbinary') return 'non-binary';
  return lower;
}

/** "34, female", "34", "Female", or "Age not recorded". */
export function patientMeta(age: number | null, gender: string | null): string {
  const sex = sexWord(gender);
  if (age != null) return sex ? `${age}, ${sex}` : String(age);
  return sex ? sex[0].toUpperCase() + sex.slice(1) : 'Age not recorded';
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'The patient';
}

function zone(timezone?: string | null): string | undefined {
  return timezone || undefined;
}

function dayKey(value: Date, timezone?: string | null): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zone(timezone), year: 'numeric', month: '2-digit', day: '2-digit' }).format(value);
}

export function timeOnly(iso: string, timezone?: string | null): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zone(timezone), hour: 'numeric', minute: '2-digit' }).format(new Date(iso)).replace(/\./g, '').replace(/\b(am|pm)\b/i, (match) => match.toUpperCase());
}

/** "Today", "Tomorrow", or "Tue, Sep 29" in the clinic's timezone. */
export function dayWord(iso: string, timezone: string | null | undefined, now: Date = new Date()): string {
  const target = dayKey(new Date(iso), timezone);
  if (target === dayKey(now, timezone)) return 'Today';
  if (target === dayKey(new Date(now.getTime() + 86_400_000), timezone)) return 'Tomorrow';
  return new Intl.DateTimeFormat('en-CA', { timeZone: zone(timezone), weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(iso));
}

/** "Tue, Sep 29, 10:30 AM" or "Today, 10:30 AM". */
export function slotLabel(iso: string, timezone: string | null | undefined, now: Date = new Date()): string {
  return `${dayWord(iso, timezone, now)}, ${timeOnly(iso, timezone)}`;
}

/** "today at 11:00 AM" or "Tuesday, September 29 at 10:30 AM", for sentences. */
export function slotSentence(iso: string, timezone: string | null | undefined, now: Date = new Date()): string {
  const day = dayWord(iso, timezone, now);
  const time = timeOnly(iso, timezone);
  if (day === 'Today' || day === 'Tomorrow') return `${day.toLowerCase()} at ${time}`;
  const long = new Intl.DateTimeFormat('en-CA', { timeZone: zone(timezone), weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(iso));
  return `${long} at ${time}`;
}

export function minutesBetween(fromIso: string, to: Date): number {
  return Math.round((to.getTime() - new Date(fromIso).getTime()) / 60_000);
}

/** "in 14 minutes", "in 2 hours", "now". */
export function untilWords(iso: string, now: Date = new Date()): string {
  const minutes = Math.round((new Date(iso).getTime() - now.getTime()) / 60_000);
  if (minutes <= 0) return 'now';
  if (minutes < 60) return `in ${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.round(minutes / 60);
  return `in ${hours} hour${hours === 1 ? '' : 's'}`;
}

/** "25 minutes" or "2 hours". */
export function durationWords(minutes: number): string {
  if (minutes < 60) return `${Math.max(minutes, 1)} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hour${hours === 1 ? '' : 's'}`;
}

export function interviewWords(status: string): string {
  if (status === 'complete') return 'Assessment finished';
  if (status === 'in_progress') return 'Assessment in progress';
  if (status === 'emergency_ack_required') return 'Emergency check needs attention';
  return 'Assessment not started';
}

export type Tone = 'amber' | 'blue' | 'green' | 'grey' | 'red';

/** The one sentence under a patient's name. */
export function statusFor(item: BoardItem, now: Date = new Date()): { tone: Tone; text: string } {
  if (isAppointment(item)) {
    const row = item.row;
    const when = slotSentence(slotStart(row), row.timezone, now);
    if (item.pending === 'confirm') return { tone: 'blue', text: `Confirming for ${when}` };
    if (item.pending === 'arrive') return { tone: 'green', text: 'Marking arrived' };
    if (item.group === 'new') return { tone: 'amber', text: `Requested for ${when}` };
    if (item.group === 'expected') return { tone: 'blue', text: `Expected ${when}` };
    return { tone: 'green', text: 'Arrived, waiting for Care' };
  }
  if (item.group === 'awaiting') {
    return item.row.clinicQuestions === 'pending'
      ? { tone: 'amber', text: 'Assessment finished, clinic questions not answered yet' }
      : { tone: 'grey', text: 'Assessment finished, no time picked yet' };
  }
  const status = item.row.interviewStatus;
  if (status === 'complete') return { tone: 'green', text: 'Walk-in, assessment finished' };
  if (status === 'emergency_ack_required') return { tone: 'red', text: 'Walk-in, emergency check needs attention' };
  return { tone: 'amber', text: `Walk-in, ${interviewWords(status).toLowerCase()}` };
}

/** Left column of a list row: a time and what it refers to. */
export function rowTime(item: BoardItem, now: Date = new Date()): { time: string; caption: string } {
  if (isAppointment(item)) {
    const start = slotStart(item.row);
    return { time: timeOnly(start, item.row.timezone), caption: item.group === 'arrived' ? 'Arrived' : dayWord(start, item.row.timezone, now) };
  }
  return { time: timeOnly(item.row.createdAt), caption: item.group === 'walkins' ? 'Registered' : 'Started' };
}

/** Right column of a list row, when there is room for it. */
export function rowHint(item: BoardItem): { tone: Tone; text: string } | null {
  if (item.pending === 'confirm') return { tone: 'blue', text: 'Confirming' };
  if (item.pending === 'arrive') return { tone: 'green', text: 'Marking arrived' };
  if (item.group === 'new' && item.row.expiresAt) return { tone: 'amber', text: `Held until ${timeOnly(item.row.expiresAt, item.row.timezone)}` };
  if (item.group === 'walkins') {
    const status = item.row.interviewStatus;
    return { tone: status === 'complete' ? 'green' : status === 'emergency_ack_required' ? 'red' : 'amber', text: interviewWords(status) };
  }
  return null;
}

// ─── Needs you ──────────────────────────────────────────────────────────────

export const EMAIL_PURPOSE_WORDS: Record<string, string> = {
  confirmation: 'confirmation',
  reminder: 'reminder',
  change_pending: 'time change',
  cancellation: 'cancellation',
  recovery: 'appointment link',
  test: 'test',
};

export type AttentionItem = { key: string; tone: Tone; text: string; target: Selection; tab: 'visit' | 'emails' | 'assessment' };

const HOLD_WARNING_MINUTES = 120;
const WALK_IN_WAIT_MINUTES = 15;

/** Things a receptionist should look at now, most urgent first. */
export function buildAttention(sections: Array<{ key: Group; rows: BoardItem[] }>, failures: Delivery[], now: Date = new Date()): AttentionItem[] {
  const items: Array<AttentionItem & { rank: number }> = [];
  const appointments = new Map<number, Extract<BoardItem, { row: AppointmentRow }>>();
  for (const section of sections) {
    for (const item of section.rows) {
      if (isAppointment(item)) appointments.set(item.row.id, item);
      if (item.group === 'new' && !item.pending && item.row.expiresAt) {
        const left = Math.round((new Date(item.row.expiresAt).getTime() - now.getTime()) / 60_000);
        if (left > 0 && left <= HOLD_WARNING_MINUTES) {
          items.push({ key: `hold-${item.id}`, rank: left, tone: 'amber', target: selectionFor(item), tab: 'visit',
            text: `${item.row.patientName}’s requested time is held until ${timeOnly(item.row.expiresAt, item.row.timezone)}.` });
        }
      }
      if (item.group === 'walkins' && item.row.interviewStatus === 'emergency_ack_required') {
        items.push({ key: `emergency-${item.id}`, rank: -1, tone: 'red', target: selectionFor(item), tab: 'assessment',
          text: `${item.row.patientName}’s assessment stopped at an emergency check.` });
      } else if (item.group === 'walkins' && item.row.interviewStatus !== 'complete') {
        const waited = minutesBetween(item.row.createdAt, now);
        if (waited >= WALK_IN_WAIT_MINUTES) {
          items.push({ key: `walkin-${item.id}`, rank: 200 - waited, tone: 'amber', target: selectionFor(item), tab: 'assessment',
            text: `${item.row.patientName} registered ${durationWords(waited)} ago and hasn’t finished the assessment.` });
        }
      }
    }
  }
  const seen = new Set<number>();
  for (const failure of failures) {
    if (failure.appointmentId == null || seen.has(failure.appointmentId)) continue;
    const item = appointments.get(failure.appointmentId);
    if (!item) continue;
    seen.add(failure.appointmentId);
    const what = EMAIL_PURPOSE_WORDS[failure.purpose] ?? 'appointment';
    const review = failure.status === 'NEEDS_REVIEW';
    items.push({ key: `email-${failure.id}`, rank: 0, tone: review ? 'amber' : 'red', target: selectionFor(item), tab: 'emails',
      text: review ? `Check whether the ${what} email to ${item.row.patientName} was delivered.` : `The ${what} email to ${item.row.patientName} didn’t send.` });
  }
  return items.sort((left, right) => left.rank - right.rank).map(({ rank: _rank, ...item }) => item);
}

// ─── Times for rescheduling ─────────────────────────────────────────────────

export type SlotDay = { key: string; weekday: string; day: string; label: string; slots: Array<{ startAt: string; remaining: number; time: string }> };

/** Groups open times by local day in the clinic's timezone, earliest first. */
export function groupSlotsByDay(slots: Availability['slots'], timezone: string | null | undefined, now: Date = new Date()): SlotDay[] {
  const days = new Map<string, SlotDay>();
  for (const slot of [...slots].sort((left, right) => left.startAt.localeCompare(right.startAt))) {
    if (new Date(slot.startAt) <= now) continue;
    const key = dayKey(new Date(slot.startAt), timezone);
    let day = days.get(key);
    if (!day) {
      const date = new Date(slot.startAt);
      const word = dayWord(slot.startAt, timezone, now);
      day = {
        key,
        weekday: word === 'Today' ? 'Today' : new Intl.DateTimeFormat('en-CA', { timeZone: zone(timezone), weekday: 'short' }).format(date),
        day: new Intl.DateTimeFormat('en-CA', { timeZone: zone(timezone), day: 'numeric' }).format(date),
        label: new Intl.DateTimeFormat('en-CA', { timeZone: zone(timezone), weekday: 'long', month: 'long', day: 'numeric' }).format(date),
        slots: [],
      };
      days.set(key, day);
    }
    day.slots.push({ ...slot, time: timeOnly(slot.startAt, timezone) });
  }
  return [...days.values()];
}
