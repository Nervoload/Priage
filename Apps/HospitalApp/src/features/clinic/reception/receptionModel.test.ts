import { describe, expect, it } from 'vitest';
import {
  buildAttention, buildSections, groupSlotsByDay, patientMeta, statusFor, timeOnly,
  type AppointmentRow, type ClinicRow, type Delivery, type Queue, type ReceptionList,
} from './receptionModel';

const TZ = 'America/Toronto';
// Monday, September 28 2026, 10:00 AM in Toronto.
const NOW = new Date('2026-09-28T14:00:00.000Z');

function appointment(id: number, overrides: Partial<AppointmentRow> = {}): AppointmentRow {
  return {
    id, encounterId: 1000 + id, patientId: id, encounterStatus: 'REQUESTED', patientName: `Patient ${id}`, age: 34, gender: 'F',
    chiefComplaint: 'Sore throat', createdAt: '2026-09-27T01:12:00.000Z', contactEmail: null, contactPhone: null,
    requestedStartAt: '2026-09-29T14:30:00.000Z', confirmedStartAt: null, expiresAt: null, timezone: TZ, revision: 1,
    allowedActions: ['confirm', 'decline', 'reschedule'], copyText: '', ...overrides,
  };
}

function walkIn(id: number, overrides: Partial<ClinicRow> = {}): ClinicRow {
  return {
    id, patientId: id, status: 'ADMITTED', patientName: `Walk-in ${id}`, age: 60, gender: 'male', chiefComplaint: 'Cut hand',
    contactEmail: null, contactPhone: null, interviewStatus: 'in_progress', createdAt: '2026-09-28T13:35:00.000Z', ...overrides,
  };
}

const EMPTY_RECEPTION: ReceptionList = { acceptsWalkIns: true, walkInPath: '/walk-in', walkIns: [], completedPrevisits: [] };

describe('buildSections', () => {
  it('shows a pending confirmation in Expected, in time order, and a pending arrival in Arrived', () => {
    const queue: Queue = {
      newAppointments: [appointment(1, { requestedStartAt: '2026-09-28T15:30:00.000Z' }), appointment(2)],
      expected: [appointment(3, { encounterStatus: 'EXPECTED', confirmedStartAt: '2026-09-28T16:00:00.000Z' }), appointment(4, { encounterStatus: 'EXPECTED', confirmedStartAt: '2026-09-28T18:00:00.000Z' })],
      arrived: [],
    };
    const sections = buildSections(queue, EMPTY_RECEPTION, new Map([[1, 'confirm'], [4, 'arrive']]));
    const ids = (key: string) => sections.find((section) => section.key === key)!.rows.map((item) => item.id);
    expect(ids('new')).toEqual([2]);
    expect(ids('expected')).toEqual([1, 3]);
    expect(ids('arrived')).toEqual([4]);
    expect(sections.find((section) => section.key === 'expected')!.rows[0].pending).toBe('confirm');
  });
});

describe('status sentences', () => {
  it('reads a request on another day as a full date', () => {
    const [section] = buildSections({ newAppointments: [appointment(1, { requestedStartAt: '2026-09-30T14:30:00.000Z' }), appointment(2)], expected: [], arrived: [] }, EMPTY_RECEPTION, new Map());
    expect(statusFor(section.rows[0], NOW)).toEqual({ tone: 'amber', text: 'Requested for Wednesday, September 30 at 10:30 AM' });
    expect(statusFor(section.rows[1], NOW).text).toBe('Requested for tomorrow at 10:30 AM');
  });

  it('reads an expected visit today as today', () => {
    const sections = buildSections({ newAppointments: [], expected: [appointment(3, { encounterStatus: 'EXPECTED', confirmedStartAt: '2026-09-28T15:00:00.000Z' })], arrived: [] }, EMPTY_RECEPTION, new Map());
    expect(statusFor(sections[1].rows[0], NOW)).toEqual({ tone: 'blue', text: 'Expected today at 11:00 AM' });
  });

  it('formats times without periods in AM and PM', () => {
    expect(timeOnly('2026-09-28T18:30:00.000Z', TZ)).toBe('2:30 PM');
  });

  it('says when a patient still owes the clinic’s questions before booking', () => {
    const awaiting = (clinicQuestions: ClinicRow['clinicQuestions']) => buildSections({ newAppointments: [], expected: [], arrived: [] }, { ...EMPTY_RECEPTION, completedPrevisits: [walkIn(8, { status: 'INTAKE', interviewStatus: 'complete', clinicQuestions })] }, new Map())
      .find((section) => section.key === 'awaiting')!.rows[0];
    expect(statusFor(awaiting('pending'), NOW)).toEqual({ tone: 'amber', text: 'Assessment finished, clinic questions not answered yet' });
    expect(statusFor(awaiting('answered'), NOW).text).toBe('Assessment finished, no time picked yet');
  });

  it('describes age and sex plainly', () => {
    expect(patientMeta(34, 'F')).toBe('34, female');
    expect(patientMeta(null, 'male')).toBe('Male');
    expect(patientMeta(null, null)).toBe('Age not recorded');
  });
});

describe('buildAttention', () => {
  it('lists holds ending soon, waiting walk-ins and failed emails for current visits', () => {
    const queue: Queue = {
      newAppointments: [
        appointment(1, { patientName: 'Maya Chen', expiresAt: '2026-09-28T15:30:00.000Z' }),
        appointment(2, { expiresAt: '2026-09-29T18:30:00.000Z' }),
      ],
      expected: [appointment(3, { patientName: 'Grace Thompson', encounterStatus: 'EXPECTED' })],
      arrived: [],
    };
    const reception: ReceptionList = { ...EMPTY_RECEPTION, walkIns: [walkIn(9, { patientName: 'Oliver Grant' }), walkIn(10, { createdAt: '2026-09-28T13:55:00.000Z' })] };
    const failures: Delivery[] = [
      { id: 'a', appointmentId: 3, purpose: 'reminder', status: 'FAILED', provider: 'resend', providerEmailId: null, retryAllowed: true, recipientEmail: 'g@example.com', dueAt: '', lastError: null, attempts: [] },
      { id: 'b', appointmentId: 3, purpose: 'confirmation', status: 'FAILED', provider: 'resend', providerEmailId: null, retryAllowed: false, recipientEmail: 'g@example.com', dueAt: '', lastError: null, attempts: [] },
      { id: 'c', appointmentId: 77, purpose: 'reminder', status: 'FAILED', provider: 'resend', providerEmailId: null, retryAllowed: false, recipientEmail: 'x@example.com', dueAt: '', lastError: null, attempts: [] },
    ];
    const items = buildAttention(buildSections(queue, reception, new Map()), failures, NOW);
    expect(items.map((item) => item.text)).toEqual([
      'The reminder email to Grace Thompson didn’t send.',
      'Maya Chen’s requested time is held until 11:30 AM.',
      'Oliver Grant registered 25 minutes ago and hasn’t finished the assessment.',
    ]);
    expect(items[0]).toMatchObject({ tone: 'red', tab: 'emails', target: { kind: 'appointment', id: 3 } });
  });

  it('puts an emergency check first', () => {
    const reception: ReceptionList = { ...EMPTY_RECEPTION, walkIns: [walkIn(9, { patientName: 'Oliver Grant', interviewStatus: 'emergency_ack_required', createdAt: NOW.toISOString() })] };
    const items = buildAttention(buildSections({ newAppointments: [appointment(1, { expiresAt: '2026-09-28T14:20:00.000Z' })], expected: [], arrived: [] }, reception, new Map()), [], NOW);
    expect(items[0]).toMatchObject({ tone: 'red', text: 'Oliver Grant’s assessment stopped at an emergency check.' });
  });
});

describe('groupSlotsByDay', () => {
  it('groups future times by clinic day', () => {
    const days = groupSlotsByDay([
      { startAt: '2026-09-29T13:00:00.000Z', remaining: 2 },
      { startAt: '2026-09-28T13:00:00.000Z', remaining: 1 },
      { startAt: '2026-09-28T17:30:00.000Z', remaining: 1 },
      { startAt: '2026-09-28T19:00:00.000Z', remaining: 2 },
    ], TZ, NOW);
    expect(days.map((day) => [day.weekday, day.slots.map((slot) => slot.time)])).toEqual([
      ['Today', ['1:30 PM', '3:00 PM']],
      ['Tue', ['9:00 AM']],
    ]);
  });
});
