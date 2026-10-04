import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { client } from '../../shared/api/client';

type Window = { day: number; start: string; end: string };
type Schedule = { timezone: string; slotMinutes: 15 | 30 | 60; capacity: number; holdMinutes: number; weeklyWindows: Window[] };
type ScheduleInfo = { schedule: Schedule | null; overrides: Array<{ id: number; localDate: string; windows: Array<{ start: string; end: string }> }>; blocks: Array<{ id: number; startAt: string; endAt: string; reason: string }> };
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const EMPTY_SCHEDULE: Schedule = { timezone: 'America/Toronto', slotMinutes: 30, capacity: 1, holdMinutes: 1440, weeklyWindows: [] };
const FIELD_CLASS = 'w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 focus:border-priage-300 focus:outline-none focus:ring-2 focus:ring-priage-200';
const TIME_CLASS = 'rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 focus:border-priage-300 focus:outline-none focus:ring-2 focus:ring-priage-200';
const PRIMARY_BUTTON_CLASS = 'w-fit rounded-[16px] bg-accent-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-700';
const SECONDARY_BUTTON_CLASS = 'w-fit rounded-[16px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50';
const SUBPANEL_CLASS = 'rounded-[22px] border border-slate-200 bg-slate-50/80 p-4';

function localTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(value));
}

export function ClinicAppointmentsPanel() {
  const [scheduleInfo, setScheduleInfo] = useState<ScheduleInfo | null>(null);
  const [schedule, setSchedule] = useState<Schedule>(EMPTY_SCHEDULE);
  const scheduleDirty = useRef(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [closedDate, setClosedDate] = useState('');
  const [overrideDate, setOverrideDate] = useState('');
  const [overrideWindows, setOverrideWindows] = useState<Array<{ start: string; end: string }>>([{ start: '09:00', end: '17:00' }]);
  const [blockStart, setBlockStart] = useState('');
  const [blockEnd, setBlockEnd] = useState('');
  const [blockReason, setBlockReason] = useState('');

  const refresh = useCallback(async () => {
    const nextInfo = await client<ScheduleInfo>('/clinic-intake/reception/schedule');
    setScheduleInfo(nextInfo);
    if (nextInfo.schedule && !scheduleDirty.current) setSchedule(nextInfo.schedule);
  }, []);
  useEffect(() => {
    void refresh().catch(() => setError('Unable to load clinic availability.'));
    const timer = window.setInterval(() => void refresh().catch(() => {}), 15_000);
    const update = () => void refresh().catch(() => {});
    window.addEventListener('focus', update);
    window.addEventListener('online', update);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', update); window.removeEventListener('online', update); };
  }, [refresh]);

  async function saveSchedule(event: FormEvent) {
    event.preventDefault(); setError(''); setMessage('');
    try {
      await client('/clinic-intake/reception/schedule', { method: 'PUT', body: JSON.stringify(schedule) });
      scheduleDirty.current = false;
      setMessage('Clinic availability saved.'); await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save schedule.'); }
  }

  function setDayWindows(day: number, daily: Window[]) {
    scheduleDirty.current = true;
    setSchedule({ ...schedule, weeklyWindows: [...schedule.weeklyWindows.filter((window) => window.day !== day), ...daily].sort((left, right) => left.day - right.day || left.start.localeCompare(right.start)) });
  }

  function selectOverrideDate(localDate: string) {
    setOverrideDate(localDate);
    const existing = scheduleInfo?.overrides.find((item) => item.localDate === localDate);
    setOverrideWindows(existing ? existing.windows : [{ start: '09:00', end: '17:00' }]);
  }

  async function saveOverride(event: FormEvent) {
    event.preventDefault(); setError('');
    try {
      await client('/clinic-intake/reception/schedule/day-override', { method: 'PUT', body: JSON.stringify({ localDate: overrideDate, windows: overrideWindows }) });
      setOverrideDate(''); await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save custom date hours.'); }
  }

  async function closeDay(event: FormEvent) {
    event.preventDefault(); setError('');
    try { await client('/clinic-intake/reception/schedule/day-override', { method: 'PUT', body: JSON.stringify({ localDate: closedDate, windows: [] }) }); setClosedDate(''); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to close this day.'); }
  }

  async function addBlock(event: FormEvent) {
    event.preventDefault(); setError('');
    try {
      await client('/clinic-intake/reception/schedule/blocks', { method: 'POST', body: JSON.stringify({ startAt: new Date(blockStart).toISOString(), endAt: new Date(blockEnd).toISOString(), reason: blockReason }) });
      setBlockStart(''); setBlockEnd(''); setBlockReason(''); await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to add block.'); }
  }

  async function remove(path: string) {
    setError('');
    try { await client(path, { method: 'DELETE' }); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to remove schedule exception.'); }
  }

  return <div className="space-y-6">
    {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}
    {message && <p role="status" className="rounded bg-blue-50 p-3 text-blue-900">{message}</p>}
    <section className="rounded-[28px] border border-white/80 bg-white/90 px-5 py-5 shadow-[0_24px_70px_-46px_rgba(15,23,42,0.42)]">
      <h2 className="font-hospital-display text-2xl font-semibold tracking-[-0.03em] text-slate-950">Clinic availability</h2>
      <p className="mt-1 text-sm text-slate-600">Set the appointment hours patients can request. Existing bookings keep their recorded time when hours change.</p>
      <form onSubmit={(event) => void saveSchedule(event)} className="mt-5 grid gap-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-2 text-sm font-semibold text-slate-700">Clinic timezone (IANA)<input className={FIELD_CLASS} required value={schedule.timezone} onChange={(event) => { scheduleDirty.current = true; setSchedule({ ...schedule, timezone: event.target.value }); }} /></label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">Slot length<select className={FIELD_CLASS} value={schedule.slotMinutes} onChange={(event) => { scheduleDirty.current = true; setSchedule({ ...schedule, slotMinutes: Number(event.target.value) as 15 | 30 | 60 }); }}>{[15, 30, 60].map((value) => <option key={value} value={value}>{value} minutes</option>)}</select></label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">Capacity per overlapping slot<input className={FIELD_CLASS} type="number" min={1} max={50} value={schedule.capacity} onChange={(event) => { scheduleDirty.current = true; setSchedule({ ...schedule, capacity: Number(event.target.value) }); }} /></label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">Pending request hold (minutes)<input className={FIELD_CLASS} type="number" min={15} max={10080} value={schedule.holdMinutes} onChange={(event) => { scheduleDirty.current = true; setSchedule({ ...schedule, holdMinutes: Number(event.target.value) }); }} /></label>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {DAYS.map((name, day) => { const daily = schedule.weeklyWindows.filter((item) => item.day === day); return <div key={name} className={SUBPANEL_CLASS}>
            <div className="mb-3 flex items-center justify-between gap-3"><strong className="font-hospital-display text-lg text-slate-900">{name}</strong><span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{daily.length ? `${daily.length} window${daily.length === 1 ? '' : 's'}` : 'Closed'}</span></div>
            <div className="grid gap-2">{daily.map((window, index) => <div key={`${day}-${index}`} className="flex flex-wrap items-center gap-2"><input className={TIME_CLASS} type="time" step={900} value={window.start} onChange={(event) => setDayWindows(day, daily.map((item, i) => i === index ? { ...item, start: event.target.value } : item))} aria-label={`${name} window ${index + 1} opens`} /><span className="text-sm text-slate-500">to</span><input className={TIME_CLASS} type="time" step={900} value={window.end} onChange={(event) => setDayWindows(day, daily.map((item, i) => i === index ? { ...item, end: event.target.value } : item))} aria-label={`${name} window ${index + 1} closes`} /><button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setDayWindows(day, daily.filter((_, i) => i !== index))}>Remove</button></div>)}
              {daily.length < 3 && <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setDayWindows(day, [...daily, { day, start: '09:00', end: '17:00' }])}>+ Add opening window</button>}</div>
          </div>; })}
        </div>
        <button className={PRIMARY_BUTTON_CLASS}>Save availability</button>
      </form>
      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <form onSubmit={(event) => void closeDay(event)} className={`${SUBPANEL_CLASS} grid content-start gap-3`}><h3 className="font-hospital-display text-lg font-semibold">Close a clinic date</h3><input className={FIELD_CLASS} type="date" required value={closedDate} onChange={(event) => setClosedDate(event.target.value)} /><button className={SECONDARY_BUTTON_CLASS}>Close day</button>{scheduleInfo?.overrides.map((item) => <p key={item.id} className="flex flex-wrap items-center gap-2 text-sm text-slate-700">{item.localDate} · {item.windows.length ? 'custom hours' : 'closed'} <button type="button" className="font-semibold text-priage-700 underline" onClick={() => void remove(`/clinic-intake/reception/schedule/day-override/${item.id}`)}>Remove</button></p>)}</form>
        <form onSubmit={(event) => void addBlock(event)} className={`${SUBPANEL_CLASS} grid content-start gap-3`}><h3 className="font-hospital-display text-lg font-semibold">Block a time</h3><p className="text-xs text-slate-600">Enter times in this browser’s timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone}).</p><input className={FIELD_CLASS} type="datetime-local" required value={blockStart} onChange={(event) => setBlockStart(event.target.value)} aria-label="Block begins" /><input className={FIELD_CLASS} type="datetime-local" required value={blockEnd} onChange={(event) => setBlockEnd(event.target.value)} aria-label="Block ends" /><input className={FIELD_CLASS} required maxLength={200} placeholder="Reason" value={blockReason} onChange={(event) => setBlockReason(event.target.value)} /><button className={SECONDARY_BUTTON_CLASS}>Add block</button>{scheduleInfo?.blocks.map((item) => <p key={item.id} className="text-sm text-slate-700">{localTime(item.startAt, schedule.timezone)} · {item.reason} <button type="button" className="font-semibold text-priage-700 underline" onClick={() => void remove(`/clinic-intake/reception/schedule/blocks/${item.id}`)}>Remove</button></p>)}</form>
      </div>
      <form onSubmit={(event) => void saveOverride(event)} className={`${SUBPANEL_CLASS} mt-4 grid gap-3`}><h3 className="font-hospital-display text-lg font-semibold">Custom hours for one date</h3><input className={FIELD_CLASS} type="date" required value={overrideDate} onChange={(event) => selectOverrideDate(event.target.value)} />{overrideWindows.map((window, index) => <div key={index} className="flex flex-wrap items-center gap-2"><input className={TIME_CLASS} type="time" step={900} value={window.start} onChange={(event) => setOverrideWindows(overrideWindows.map((item, i) => i === index ? { ...item, start: event.target.value } : item))} aria-label={`Custom window ${index + 1} opens`} /><span className="text-sm text-slate-500">to</span><input className={TIME_CLASS} type="time" step={900} value={window.end} onChange={(event) => setOverrideWindows(overrideWindows.map((item, i) => i === index ? { ...item, end: event.target.value } : item))} aria-label={`Custom window ${index + 1} closes`} /><button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setOverrideWindows(overrideWindows.filter((_, i) => i !== index))}>Remove</button></div>)}{overrideWindows.length < 3 && <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setOverrideWindows([...overrideWindows, { start: '09:00', end: '17:00' }])}>+ Add custom window</button>}<button className={SECONDARY_BUTTON_CLASS}>Save custom hours</button></form>
    </section>
  </div>;
}
