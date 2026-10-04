import { useState, type FormEvent } from 'react';
import { client } from '../../../shared/api/client';
import { Dialog } from '../ui/Dialog';
import { Button, Field, inputClass, textareaClass } from '../ui/controls';
import { describeError } from '../ui/errors';

const START_KEY = 'clinic-walkin-start-key';
const EMPTY = { firstName: '', lastName: '', chiefComplaint: '', details: '', phone: '', contactEmail: '' };

// Register someone standing at the desk. Two things are required; contact
// details are optional and the hint says what they are for.
export function WalkInDialog({ open, onClose, onRegistered }: { open: boolean; onClose: () => void; onRegistered: (visitId: number, name: string) => void }) {
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key: keyof typeof EMPTY) => (value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!form.firstName.trim() || !form.chiefComplaint.trim()) { setError('Add a first name and the reason for the visit.'); return; }
    setBusy(true); setError('');
    // The same key is reused if a slow network makes the first attempt look failed.
    const startKey = sessionStorage.getItem(START_KEY) || crypto.randomUUID();
    sessionStorage.setItem(START_KEY, startKey);
    try {
      const visit = await client<{ id: number }>('/clinic-intake/reception/walk-ins', {
        method: 'POST',
        body: JSON.stringify({
          startKey,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          contactEmail: form.contactEmail.trim() || undefined,
          phone: form.phone.trim() || undefined,
          chiefComplaint: form.chiefComplaint.trim(),
          details: form.details.trim(),
        }),
      });
      sessionStorage.removeItem(START_KEY);
      const name = [form.firstName.trim(), form.lastName.trim()].filter(Boolean).join(' ');
      setForm(EMPTY);
      onRegistered(visit.id, name);
    } catch (cause) {
      setError(describeError(cause, 'The walk-in wasn’t registered. Try again; nothing was saved twice.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={busy}
      width={560}
      title="Register a walk-in"
      description="For someone at the desk now. They don’t need an account."
      footerNote="Next, choose how the assessment is answered."
      footer={<>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="primary" type="submit" form="clinic-walkin-form" busy={busy}>Register walk-in</Button>
      </>}
    >
      <form id="clinic-walkin-form" onSubmit={(event) => void submit(event)} className="flex flex-col gap-4" noValidate>
        {error && <p role="alert" className="rounded-xl bg-signal-red-bg px-3.5 py-2.5 text-sm text-signal-red">{error}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="First name" htmlFor="walkin-first"><input id="walkin-first" data-autofocus className={inputClass} required maxLength={120} autoComplete="off" value={form.firstName} onChange={(event) => set('firstName')(event.target.value)} /></Field>
          <Field label="Last name" htmlFor="walkin-last"><input id="walkin-last" className={inputClass} maxLength={120} autoComplete="off" value={form.lastName} onChange={(event) => set('lastName')(event.target.value)} /></Field>
        </div>
        <Field label="Reason for visit, in their words" htmlFor="walkin-reason"><input id="walkin-reason" className={inputClass} required maxLength={240} autoComplete="off" value={form.chiefComplaint} onChange={(event) => set('chiefComplaint')(event.target.value)} /></Field>
        <Field label="Anything else they mention" htmlFor="walkin-details" hint="Optional"><textarea id="walkin-details" className={textareaClass} rows={2} maxLength={4000} value={form.details} onChange={(event) => set('details')(event.target.value)} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Phone" htmlFor="walkin-phone" hint="Optional"><input id="walkin-phone" type="tel" className={inputClass} maxLength={20} autoComplete="off" value={form.phone} onChange={(event) => set('phone')(event.target.value)} /></Field>
          <Field label="Email" htmlFor="walkin-email" hint="Optional. Lets the clinic send visit updates."><input id="walkin-email" type="email" className={inputClass} autoComplete="off" value={form.contactEmail} onChange={(event) => set('contactEmail')(event.target.value)} /></Field>
        </div>
      </form>
    </Dialog>
  );
}
