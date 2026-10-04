import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/controls';
import { firstName, slotStart, slotSentence, timeOnly, type AppointmentRow } from './receptionModel';

export type DestructiveAction = 'decline' | 'cancel' | 'no-show';

function copyFor(action: DestructiveAction, row: AppointmentRow) {
  const when = slotSentence(slotStart(row), row.timezone);
  const time = timeOnly(slotStart(row), row.timezone);
  const name = firstName(row.patientName);
  if (action === 'decline') {
    return {
      title: `Decline ${row.patientName}’s request?`,
      body: `The time requested for ${when} is released for other patients. The visit stays in the record.`,
      keep: 'Keep request',
      confirm: 'Decline request',
    };
  }
  if (action === 'cancel') {
    return {
      title: `Cancel ${row.patientName}’s visit?`,
      body: `The ${time} appointment is cancelled and the time is released. ${row.contactEmail ? `A cancellation email goes to ${row.contactEmail}.` : `There’s no email on file, so let ${name} know another way.`}`,
      keep: 'Keep visit',
      confirm: 'Cancel visit',
    };
  }
  return {
    title: `Mark ${row.patientName} as a no-show?`,
    body: `This closes the ${time} appointment. It stays in the visit history.`,
    keep: 'Keep visit',
    confirm: 'Mark no-show',
  };
}

// Each destructive action says what happens to the record before it happens.
export function ConfirmActionDialog({ action, row, busy, error, onClose, onConfirm }: {
  action: DestructiveAction | null; row: AppointmentRow | null; busy: boolean; error: string; onClose: () => void; onConfirm: () => void;
}) {
  if (!action || !row) return null;
  const copy = copyFor(action, row);
  return (
    <Dialog
      open
      alert
      onClose={onClose}
      busy={busy}
      width={460}
      title={copy.title}
      footer={<>
        <Button onClick={onClose} disabled={busy} data-autofocus>{copy.keep}</Button>
        <Button variant="danger" busy={busy} onClick={onConfirm}>{copy.confirm}</Button>
      </>}
    >
      {error && <p role="alert" className="rounded-xl bg-signal-red-bg px-3.5 py-2.5 text-sm text-signal-red">{error}</p>}
      <p className="text-[15px] leading-relaxed text-ink-2">{copy.body}</p>
    </Dialog>
  );
}
