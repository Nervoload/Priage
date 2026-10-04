import { describe, expect, it } from 'vitest';
import { clinicLocalParts, slotFitsWindow, validLocalDate, validateSchedule } from '../src/modules/clinic/clinic-schedule';

describe('clinic appointment schedule', () => {
  it('rejects invalid and overlapping hours before they can be saved', () => {
    expect(() => validateSchedule({ timezone: 'Not/AZone', slotMinutes: 30, capacity: 1, holdMinutes: 60, weeklyWindows: [] })).toThrow('IANA');
    expect(() => validateSchedule({ timezone: 'America/Toronto', slotMinutes: 30, capacity: 1, holdMinutes: 60,
      weeklyWindows: [{ day: 1, start: '09:00', end: '12:00' }, { day: 1, start: '11:00', end: '14:00' }] })).toThrow('overlap');
    expect(() => validLocalDate('2026-02-30')).toThrow('valid');
  });

  it('uses clinic local time and rejects a slot crossing a daylight-saving jump', () => {
    const timezone = 'America/Toronto';
    expect(clinicLocalParts(new Date('2026-09-28T13:00:00Z'), timezone)).toMatchObject({ localDate: '2026-09-28', minute: 540, day: 1 });
    expect(slotFitsWindow(new Date('2026-09-28T13:00:00Z'), 30, timezone, [{ start: '09:00', end: '17:00' }])).toBe(true);
    expect(slotFitsWindow(new Date('2026-03-08T06:30:00Z'), 30, timezone, [{ start: '01:00', end: '04:00' }])).toBe(false);
    expect(slotFitsWindow(new Date('2026-11-01T05:30:00Z'), 30, timezone, [{ start: '01:00', end: '02:00' }])).toBe(false);
    expect(slotFitsWindow(new Date('2026-11-01T06:00:00Z'), 30, timezone, [{ start: '01:00', end: '02:00' }])).toBe(true);
  });
});
