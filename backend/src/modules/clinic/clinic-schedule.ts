import { BadRequestException } from '@nestjs/common';

export type ScheduleWindow = { day: number; start: string; end: string };
export type DailyWindow = { start: string; end: string };
export type ClinicScheduleShape = {
  timezone: string;
  slotMinutes: 15 | 30 | 60;
  capacity: number;
  holdMinutes: number;
  weeklyWindows: ScheduleWindow[];
};

const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function minuteOfDay(value: string): number {
  const match = CLOCK.exec(value);
  if (!match) throw new BadRequestException('Schedule times must use HH:mm');
  return Number(match[1]) * 60 + Number(match[2]);
}

export function validLocalDate(value: string): string {
  if (!DATE.test(value) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) {
    throw new BadRequestException('Date must use a valid YYYY-MM-DD calendar day');
  }
  return value;
}

function parseWindows(value: unknown, withDay: boolean): Array<ScheduleWindow | DailyWindow> {
  if (!Array.isArray(value) || value.length > (withDay ? 21 : 3)) throw new BadRequestException('Invalid schedule windows');
  const windows = value.map((raw) => {
    if (!raw || typeof raw !== 'object') throw new BadRequestException('Invalid schedule window');
    const item = raw as Record<string, unknown>;
    const keys = Object.keys(item).sort().join(',');
    if (keys !== (withDay ? 'day,end,start' : 'end,start')) throw new BadRequestException('Invalid schedule window fields');
    if (typeof item.start !== 'string' || typeof item.end !== 'string') throw new BadRequestException('Invalid schedule time');
    const start = minuteOfDay(item.start);
    const end = minuteOfDay(item.end);
    if (start >= end || start % 15 !== 0 || end % 15 !== 0) throw new BadRequestException('Schedule windows must be positive and aligned to 15 minutes');
    if (withDay && (!Number.isInteger(item.day) || (item.day as number) < 0 || (item.day as number) > 6)) throw new BadRequestException('Schedule day must be Sunday=0 through Saturday=6');
    return withDay ? { day: item.day as number, start: item.start, end: item.end } : { start: item.start, end: item.end };
  });
  for (let day = 0; day < (withDay ? 7 : 1); day++) {
    const daily = windows.filter((window) => !withDay || (window as ScheduleWindow).day === day)
      .sort((left, right) => minuteOfDay(left.start) - minuteOfDay(right.start));
    for (let i = 1; i < daily.length; i++) {
      if (minuteOfDay(daily[i].start) < minuteOfDay(daily[i - 1].end)) throw new BadRequestException('Schedule windows overlap');
    }
  }
  return windows;
}

export function validateWeeklyWindows(value: unknown): ScheduleWindow[] {
  return parseWindows(value, true) as ScheduleWindow[];
}

export function validateDailyWindows(value: unknown): DailyWindow[] {
  return parseWindows(value, false) as DailyWindow[];
}

export function validateSchedule(value: ClinicScheduleShape): ClinicScheduleShape {
  try { new Intl.DateTimeFormat('en-CA', { timeZone: value.timezone }); }
  catch { throw new BadRequestException('Use a valid IANA timezone'); }
  if (![15, 30, 60].includes(value.slotMinutes)) throw new BadRequestException('Slot length must be 15, 30, or 60 minutes');
  if (!Number.isInteger(value.capacity) || value.capacity < 1 || value.capacity > 50) throw new BadRequestException('Capacity must be 1–50');
  if (!Number.isInteger(value.holdMinutes) || value.holdMinutes < 15 || value.holdMinutes > 10080) throw new BadRequestException('Request hold must be 15–10080 minutes');
  return { ...value, weeklyWindows: validateWeeklyWindows(value.weeklyWindows) };
}

const formatters = new Map<string, Intl.DateTimeFormat>();
export function clinicLocalParts(instant: Date, timezone: string) {
  let formatter = formatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    formatters.set(timezone, formatter);
  }
  const parts = Object.fromEntries(formatter.formatToParts(instant).map((part) => [part.type, part.value]));
  const localDate = `${parts.year}-${parts.month}-${parts.day}`;
  return { localDate, minute: Number(parts.hour) * 60 + Number(parts.minute), day: new Date(`${localDate}T00:00:00Z`).getUTCDay() };
}

export function slotFitsWindow(startAt: Date, slotMinutes: number, timezone: string, windows: DailyWindow[]): boolean {
  const start = clinicLocalParts(startAt, timezone);
  const end = clinicLocalParts(new Date(startAt.getTime() + slotMinutes * 60_000), timezone);
  // A slot cannot silently jump across a daylight-saving transition.
  if (end.localDate !== start.localDate || end.minute !== start.minute + slotMinutes) return false;
  return windows.some((window) => start.minute >= minuteOfDay(window.start) && end.minute <= minuteOfDay(window.end)
    && (start.minute - minuteOfDay(window.start)) % slotMinutes === 0);
}
