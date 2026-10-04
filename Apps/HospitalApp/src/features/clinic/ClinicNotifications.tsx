import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { getSocket } from '../../shared/realtime/socket';
import { RealtimeEvents } from '../../shared/types/domain';
import { client } from '../../shared/api/client';
import type { Delivery } from './reception/receptionModel';
import { Button, Dot, StatusLine, type Tone } from './ui/controls';

type Settings = { enabled: boolean; replyTo: string | null; contactPhone: string | null; reminderMinutes: number[]; version: number };
type Envelope = { settings: Settings; mode: string };
const FIELD = 'w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm focus:border-priage-300 focus:outline-none focus:ring-2 focus:ring-priage-100';
const BUTTON = 'rounded-[14px] border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50';
const LABELS: Record<string, string> = { QUEUED: 'Queued', PROCESSING: 'Submitting', ACCEPTED: 'Provider accepted', DELIVERED: 'Delivered', FAILED: 'Failed', CANCELLED: 'Cancelled', NEEDS_REVIEW: 'Needs review' };

export function ClinicNotificationSettingsPanel() {
  const [envelope, setEnvelope] = useState<Envelope | null>(null);
  const [draft, setDraft] = useState<Settings | null>(null);
  const [recipient, setRecipient] = useState('');
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { const result = await client<Envelope>('/clinic-notifications/settings'); setEnvelope(result); setDraft(result.settings); }, []);
  useEffect(() => { void load().catch(() => setError('Email settings are unavailable.')); }, [load]);
  async function save(event: FormEvent) {
    event.preventDefault(); if (!draft) return; setBusy(true); setError(''); setMessage('');
    try { await client('/clinic-notifications/settings', { method: 'PUT', body: JSON.stringify({ enabled: draft.enabled, replyTo: draft.replyTo || undefined, contactPhone: draft.contactPhone || undefined, reminderMinutes: draft.reminderMinutes, expectedVersion: draft.version }) }); await load(); setMessage('Email settings saved.'); }
    catch { setError('Could not save email settings. Reload if another admin changed them.'); } finally { setBusy(false); }
  }
  async function test(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { await client('/clinic-notifications/test-send', { method: 'POST', body: JSON.stringify({ email: recipient }) }); setMessage('Test email queued. Check the captured inbox or provider delivery.'); }
    catch { setError('Test email could not be queued. Save Reply-To and check deployment email mode.'); } finally { setBusy(false); }
  }
  return <section className="mt-6 rounded-[22px] border border-slate-200 bg-white p-5" aria-labelledby="clinic-email-heading">
    <h2 id="clinic-email-heading" className="text-xl font-semibold">Appointment emails</h2>
    <p className="mt-1 text-sm text-slate-600">Confirmation follows Reception approval. Emails contain scheduling details and clinic contact only. Replies go to your clinic.</p>
    {envelope && <p className="mt-2 text-xs font-semibold text-slate-500">{envelope.mode === 'capture' ? 'Local test inbox: emails are captured and are not sent.' : envelope.mode === 'test' ? 'Restricted test delivery: only configured recipients receive emails.' : envelope.mode === 'live' ? 'Live email delivery configured.' : 'Email delivery is disabled on this deployment.'}</p>}
    {error && <p role="alert" className="mt-3 text-red-700">{error}</p>}{message && <p role="status" className="mt-3 text-emerald-700">{message}</p>}
    {draft && <form className="mt-4 grid max-w-2xl gap-4" onSubmit={(event) => void save(event)}>
      <label className="flex gap-2"><input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} />Enable appointment emails and email recovery</label>
      <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1 text-sm font-semibold">Clinic Reply-To email<input className={FIELD} type="email" required={draft.enabled} value={draft.replyTo || ''} onChange={(event) => setDraft({ ...draft, replyTo: event.target.value })} /></label><label className="grid gap-1 text-sm font-semibold">Clinic contact phone (optional)<input className={FIELD} maxLength={40} value={draft.contactPhone || ''} onChange={(event) => setDraft({ ...draft, contactPhone: event.target.value })} /></label></div>
      <fieldset><legend className="mb-2 text-sm font-semibold">Reminders before the appointment</legend>{draft.reminderMinutes.map((minutes, index) => <div key={index} className="mb-2 flex items-center gap-3"><input className={FIELD + ' max-w-36'} aria-label={'Reminder ' + (index + 1) + ' minutes'} type="number" min={1} max={10080} required value={minutes} onChange={(event) => setDraft({ ...draft, reminderMinutes: draft.reminderMinutes.map((value, position) => position === index ? Number(event.target.value) : value) })} /><span className="text-sm">minutes before</span><button type="button" className={BUTTON} onClick={() => setDraft({ ...draft, reminderMinutes: draft.reminderMinutes.filter((_, position) => position !== index) })}>Remove</button></div>)}{draft.reminderMinutes.length < 2 && <button type="button" className={BUTTON} onClick={() => setDraft({ ...draft, reminderMinutes: [...draft.reminderMinutes, draft.reminderMinutes.includes(120) ? 1440 : 120] })}>Add reminder</button>}<p className="mt-2 text-xs text-slate-500">Default: 24 hours (1440 minutes) and 2 hours (120 minutes). Remove both to disable reminders.</p></fieldset>
      <div className="flex gap-2"><button disabled={busy} className="rounded-[14px] bg-priage-700 px-4 py-2 font-semibold text-white disabled:opacity-50">Save email settings</button><button type="button" className={BUTTON} onClick={() => void client<{ text: string }>('/clinic-notifications/preview').then((value) => setPreview(value.text)).catch(() => setError('Preview unavailable.'))}>Preview template</button></div>
    </form>}
    {preview && <pre className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm">{preview}</pre>}
    <form className="mt-5 flex max-w-xl flex-wrap items-end gap-3" onSubmit={(event) => void test(event)}><label className="grid flex-1 gap-1 text-sm font-semibold">Send a test to<input type="email" className={FIELD} required value={recipient} onChange={(event) => setRecipient(event.target.value)} /></label><button className={BUTTON} disabled={busy}>Send test</button></form>
    <ClinicDeliveryHistory all={envelope?.mode === 'capture'} failures={envelope?.mode !== 'capture'} />
    <SuppressionList />
  </section>;
}

function SuppressionList() {
  const [rows, setRows] = useState<Array<{ email: string; reason: string }>>([]);
  const [error, setError] = useState('');
  const load = useCallback(() => client<Array<{ email: string; reason: string }>>('/clinic-notifications/suppressions').then(setRows), []);
  useEffect(() => { void load().catch(() => {}); }, [load]);
  return rows.length ? <div className="mt-4"><h3 className="font-semibold">Suppressed addresses</h3><p className="text-xs text-slate-500">Resolve the bounce or complaint with the patient before allowing more emails.</p>{error && <p role="alert">{error}</p>}{rows.map((row) => <div key={row.email} className="mt-2 flex items-center gap-3 text-sm"><span>{row.email} · {row.reason}</span><button className={BUTTON} onClick={() => { if (window.confirm('The address and reason have been reviewed with the patient. Allow future emails?')) void client('/clinic-notifications/clear-suppression', { method: 'POST', body: JSON.stringify({ email: row.email }) }).then(load).catch(() => setError('Could not clear suppression.')); }}>Clear after review</button></div>)}</div> : null;
}

const PURPOSE_LABELS: Record<string, string> = { confirmation: 'Confirmation', reminder: 'Reminder', change_pending: 'Time change notice', cancellation: 'Cancellation notice', recovery: 'Appointment link', test: 'Test email' };

function deliveryState(row: Delivery): { tone: Tone; text: string } {
  if (row.provider === 'capture' && row.status === 'ACCEPTED') return { tone: 'grey', text: 'Captured, not sent' };
  if (row.status === 'DELIVERED') return { tone: 'green', text: 'Delivered' };
  if (row.status === 'ACCEPTED') return { tone: 'blue', text: 'Sent' };
  if (row.status === 'FAILED') return { tone: 'red', text: 'Didn’t send' };
  if (row.status === 'NEEDS_REVIEW') return { tone: 'amber', text: 'Needs review' };
  if (row.status === 'CANCELLED') return { tone: 'grey', text: 'Cancelled' };
  if (row.status === 'QUEUED' && new Date(row.dueAt).getTime() > Date.now() + 60_000) return { tone: 'grey', text: 'Scheduled' };
  return { tone: 'blue', text: LABELS[row.status] || 'Sending' };
}

function when(value: string): string {
  return new Date(value).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).replace(/\./g, '').replace(/\b(am|pm)\b/i, (match) => match.toUpperCase());
}

/** Email timeline for one appointment, recent failures, or the captured inbox. */
export function ClinicDeliveryHistory({ appointmentId, failures = false, all = false, bare = false, emptyText = 'No emails recorded.' }: { appointmentId?: number; failures?: boolean; all?: boolean; bare?: boolean; emptyText?: string }) {
  const [rows, setRows] = useState<Delivery[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [retrying, setRetrying] = useState<string | null>(null);
  const load = useCallback(async () => { setRows(await client<Delivery[]>(all ? '/clinic-notifications/history' : failures ? '/clinic-notifications/failures' : '/clinic-notifications/appointments/' + appointmentId)); setError(''); setLoaded(true); }, [appointmentId, failures, all]);
  useEffect(() => { const update = () => void load().catch(() => setError('Email history is unavailable right now. It refreshes on its own.')); update(); const socket = getSocket(); socket.on(RealtimeEvents.EncounterUpdated, update); socket.on('connect', update); const timer = window.setInterval(update, 15_000); window.addEventListener('focus', update); window.addEventListener('online', update); return () => { socket.off(RealtimeEvents.EncounterUpdated, update); socket.off('connect', update); clearInterval(timer); window.removeEventListener('focus', update); window.removeEventListener('online', update); }; }, [load]);

  async function retry(row: Delivery) {
    setRetrying(row.id); setError('');
    try { await client('/clinic-notifications/' + row.id + '/retry', { method: 'POST', body: '{}' }); await load(); }
    catch { setError('This email can’t be retried safely. Check its current status first.'); }
    finally { setRetrying(null); }
  }

  const list = <div className="font-clinic text-ink">
    {error && <p role="alert" className="mb-3 text-sm text-signal-red">{error}</p>}
    {loaded && !rows.length && !error && <p className="text-sm text-ink-2">{emptyText}</p>}
    <ul className="flex flex-col">{rows.map((row) => {
      const state = deliveryState(row);
      return <li key={row.id} className="flex items-start gap-3.5 border-b border-line py-3.5 last:border-b-0">
        <Dot tone={state.tone} className="mt-2" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-semibold">{PURPOSE_LABELS[row.purpose] ?? row.purpose.replace(/_/g, ' ')}</span>
          <span className="truncate text-[13px] text-ink-3">{row.lastError ? row.lastError : 'To ' + row.recipientEmail}</span>
          {row.status === 'NEEDS_REVIEW' && <span className="mt-1 text-[13px] text-signal-amber">The provider didn’t confirm the outcome. Check its history before sending anything else. Reference clinic-email/{row.id}.</span>}
          {row.provider === 'resend' && row.providerEmailId && <span className="text-xs text-ink-3">Provider receipt {row.providerEmailId}</span>}
          {(row.retryAllowed || row.payload?.text || row.attempts.length > 0) && <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            {row.retryAllowed && <Button size="sm" busy={retrying === row.id} onClick={() => void retry(row)}>Retry</Button>}
            {row.payload?.text && <details className="text-[13px]"><summary className="cursor-pointer font-semibold text-brand-700">Show captured email</summary><pre className="mt-2 whitespace-pre-wrap rounded-xl bg-paper p-3 font-clinic text-xs text-ink-2">{row.payload.text}</pre></details>}
            {row.attempts.length > 0 && <details className="text-[13px]"><summary className="cursor-pointer text-ink-3">Attempts ({row.attempts.length})</summary>{row.attempts.map((attempt, index) => <p key={index} className="mt-1 text-xs text-ink-3">{when(attempt.createdAt)}, {attempt.outcome.toLowerCase().replace(/_/g, ' ')}{attempt.errorCode ? ' (' + attempt.errorCode + ')' : ''}</p>)}</details>}
          </div>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5 text-right"><StatusLine tone={state.tone} className="text-[13px]">{state.text}</StatusLine><span className="text-xs tabular-nums text-ink-3">{when(row.deliveredAt || row.acceptedAt || row.dueAt)}</span></div>
      </li>;
    })}</ul>
    <p className="mt-3 text-xs text-ink-3">Delivered means the recipient’s mail server accepted it, not that it was read.</p>
  </div>;

  if (bare) return list;
  return <div className="mt-5 rounded-2xl border border-line bg-white p-4"><h3 className="mb-2 font-semibold">{all ? 'Captured inbox' : failures ? 'Emails that need attention' : 'Email delivery'}</h3>{list}</div>;
}
