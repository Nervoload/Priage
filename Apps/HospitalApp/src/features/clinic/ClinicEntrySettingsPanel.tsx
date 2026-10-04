import { useEffect, useState, type FormEvent } from 'react';
import { client } from '../../shared/api/client';
import { ClipboardCopyButton } from '../../shared/ui/ClipboardCopyButton';

type Settings = { canonicalAlias: string; directoryListed: boolean; acceptsWalkIns: boolean; startPath: string; walkInPath: string };

export function ClinicEntrySettingsPanel() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [draft, setDraft] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    void client<Settings>('/clinic-intake/reception/entry-settings').then((value) => { setSettings(value); setDraft(value); })
      .catch(() => setError('Clinic entry settings are unavailable.'));
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft || busy) return;
    setBusy(true); setError(''); setSaved(false);
    try {
      const next = await client<Settings>('/clinic-intake/reception/entry-settings', { method: 'PUT', body: JSON.stringify({
        canonicalAlias: draft.canonicalAlias.trim().toLowerCase(), directoryListed: draft.directoryListed, acceptsWalkIns: draft.acceptsWalkIns,
      }) });
      setSettings(next); setDraft(next); setSaved(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save clinic entry settings.'); }
    finally { setBusy(false); }
  }

  const patientOrigin = (import.meta.env.VITE_PATIENT_APP_URL as string | undefined)?.replace(/\/$/, '');
  const startLink = settings && patientOrigin ? `${patientOrigin}${settings.startPath}` : settings?.startPath;
  const walkInLink = settings && patientOrigin ? `${patientOrigin}${settings.walkInPath}` : settings?.walkInPath;
  return <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5" aria-labelledby="clinic-entry-heading">
    <h2 id="clinic-entry-heading" className="text-xl font-semibold">Clinic patient access</h2>
    <p className="mt-1 text-sm text-slate-600">Choose whether this clinic appears in general Priage search and whether Reception accepts arrived walk-ins. These options are independent. An unlisted clinic remains accessible to anyone with its direct link. Public clinic entry remains gated in this preview; old links redirect after a path change.</p>
    {error && <p role="alert" className="mt-3 text-red-700">{error}</p>}
    {draft ? <form className="mt-4 grid max-w-xl gap-4" onSubmit={(event) => void save(event)}>
      <label className="grid gap-1">Clinic link name<input className="rounded border p-2" required pattern="[a-z0-9][a-z0-9_-]{2,47}" maxLength={48} value={draft.canonicalAlias} onChange={(event) => setDraft({ ...draft, canonicalAlias: event.target.value })} /></label>
      <label className="flex gap-2"><input type="checkbox" checked={draft.directoryListed} onChange={(event) => setDraft({ ...draft, directoryListed: event.target.checked })} />Show this clinic in the general Priage directory</label>
      <label className="flex gap-2"><input type="checkbox" checked={draft.acceptsWalkIns} onChange={(event) => setDraft({ ...draft, acceptsWalkIns: event.target.checked })} />Allow Reception to register arrived walk-ins</label>
      <button className="w-fit rounded bg-blue-800 px-4 py-2 text-white disabled:opacity-50" disabled={busy}>{busy ? 'Saving…' : 'Save clinic access'}</button>
      {saved && <span role="status">Clinic access saved.</span>}
    </form> : !error && <p role="status">Loading clinic access…</p>}
    {settings && <div className="mt-5 grid gap-2 text-sm"><div>Patient start: <code>{startLink}</code>{startLink && <ClipboardCopyButton text={startLink} label="Copy patient link" />}</div><div>Desk assessment QR target: <code>{walkInLink}#token=…</code></div></div>}
  </section>;
}
