import { useEffect, useMemo, useState } from 'react';
import { Dialog } from '../ui/Dialog';
import { Button, cx } from '../ui/controls';
import { Icon } from '../ui/Icon';
import { groupSlotsByDay, slotSentence, slotStart, timeOnly, type AppointmentRow, type Availability } from './receptionModel';

// The same day-and-time picker patients use, with the places left on each time.
export function ChangeTimeDialog({ row, confirmed, availability, busy, error, onClose, onSubmit }: {
  row: AppointmentRow | null; confirmed: boolean; availability: Availability | null; busy: boolean; error: string;
  onClose: () => void; onSubmit: (startAt: string) => void;
}) {
  const timezone = availability?.timezone || row?.timezone || null;
  const days = useMemo(() => groupSlotsByDay(availability?.slots ?? [], timezone), [availability, timezone]);
  const current = row ? slotStart(row) : '';
  const [dayKey, setDayKey] = useState('');
  const [chosen, setChosen] = useState('');

  useEffect(() => {
    if (!row) return;
    setChosen('');
    const currentDay = days.find((day) => day.slots.some((slot) => slot.startAt === current));
    setDayKey(currentDay?.key ?? days[0]?.key ?? '');
  }, [row, days, current]);

  if (!row) return null;
  const day = days.find((item) => item.key === dayKey) ?? days[0];

  return (
    <Dialog
      open
      onClose={onClose}
      busy={busy}
      width={620}
      title={`Change ${row.patientName}’s time`}
      description={`${confirmed ? 'Confirmed' : 'Requested'} for ${slotSentence(current, row.timezone)}. Each time shows the places left.`}
      footer={<>
        <Button onClick={onClose} disabled={busy}>Keep current time</Button>
        <Button variant="primary" disabled={!chosen} busy={busy} onClick={() => onSubmit(chosen)}>{chosen ? `Change to ${timeOnly(chosen, timezone)}` : 'Change time'}</Button>
      </>}
    >
      {error && <p role="alert" className="rounded-xl bg-signal-red-bg px-3.5 py-2.5 text-sm text-signal-red">{error}</p>}
      {!days.length ? (
        <p className="text-sm text-ink-2">There are no open times in the clinic’s schedule right now. An admin can add hours in Settings.</p>
      ) : (
        <>
          <div role="group" aria-label="Day" className="flex gap-2 overflow-x-auto pb-1">
            {days.map((item) => {
              const on = item.key === day?.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  aria-pressed={on}
                  aria-label={item.label}
                  data-autofocus={on ? true : undefined}
                  onClick={() => { setDayKey(item.key); setChosen(''); }}
                  className={cx(
                    'flex h-[62px] min-w-[68px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
                    on ? 'border-ink bg-ink text-white' : 'border-line-strong bg-white text-ink hover:border-ink/30',
                  )}
                >
                  <span className={cx('text-xs', on ? 'text-white' : 'text-ink-3')}>{item.weekday}</span>
                  <span className="text-lg font-semibold tabular-nums">{item.day}</span>
                </button>
              );
            })}
          </div>
          {day && (
            <div role="radiogroup" aria-label={`Times on ${day.label}`} className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {day.slots.map((slot) => {
                const isCurrent = slot.startAt === current;
                const full = slot.remaining < 1;
                const on = slot.startAt === chosen;
                return (
                  <button
                    key={slot.startAt}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={isCurrent || full}
                    onClick={() => setChosen(slot.startAt)}
                    className={cx(
                      'flex h-14 flex-col justify-center rounded-xl border px-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
                      on ? 'border-brand bg-brand text-white' : isCurrent ? 'border-dashed border-ink/35 bg-white' : full ? 'border-line bg-[repeating-linear-gradient(135deg,rgba(14,22,48,.05)_0_4px,transparent_4px_8px)] text-ink-3' : 'border-line-strong bg-white hover:border-ink/30',
                    )}
                  >
                    <span className="font-semibold tabular-nums">{slot.time}</span>
                    <span className={cx('text-xs', on ? 'text-white' : 'text-ink-3')}>{isCurrent ? 'Current' : full ? 'Full' : `${slot.remaining} left`}</span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
      <p className="flex items-start gap-2.5 rounded-xl bg-brand-select px-3.5 py-3 text-[13px] text-ink">
        <span className="mt-px text-brand"><Icon name="mail" size={17} /></span>
        <span>
          {confirmed
            ? `Reminders for ${timeOnly(current, row.timezone)} stop${row.contactEmail ? `, and ${row.contactEmail} gets an email that the time is changing` : ''}. The new time goes back to New requests for you to confirm.`
            : 'The new time replaces the request. It stays in New requests until you confirm it.'}
        </span>
      </p>
    </Dialog>
  );
}
