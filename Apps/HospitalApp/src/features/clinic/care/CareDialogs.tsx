import { useEffect, useMemo, useState } from 'react';
import { auditCareCopy, type CareState } from '../../../shared/api/care';
import { Dialog } from '../ui/Dialog';
import { Button, Dot, Field, cx, inputClass, textareaClass } from '../ui/controls';
import { Icon } from '../ui/Icon';
import { CHART_SECTIONS, composeChart, finishChecklist, type CareView, type ChartSection } from './careModel';

export function StartUrgentDialog({ open, patientName, asked, busy, error, onClose, onStart }: {
  open: boolean; patientName: string; asked: number; busy: boolean; error: string; onClose: () => void; onStart: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  useEffect(() => { if (open) setReason(''); }, [open]);
  const ready = reason.trim().length >= 10;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={busy}
      title="Start Care before the assessment is finished?"
      description={`${patientName}’s assessment stopped after ${asked} question${asked === 1 ? '' : 's'}. Care will show what was recorded so far, marked unfinished.`}
      footer={<><Button onClick={onClose} disabled={busy}>Cancel</Button><Button variant="primary" busy={busy} disabled={!ready} onClick={() => onStart(reason.trim())}>Start urgent Care</Button></>}
    >
      {error && <p role="alert" className="rounded-xl bg-signal-red-bg px-3.5 py-2.5 text-sm text-signal-red">{error}</p>}
      <Field label="Why it can’t wait" htmlFor="care-urgent-reason" hint={ready ? 'Saved with your name and the time.' : 'Required, at least 10 characters. Saved with your name and the time.'}>
        <textarea id="care-urgent-reason" data-autofocus className={textareaClass} rows={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
    </Dialog>
  );
}

export function FinishVisitDialog({ open, state, patientName, noteSaved, busy, error, onClose, onFinish }: {
  open: boolean; state: CareState; patientName: string; noteSaved: boolean; busy: boolean; error: string; onClose: () => void; onFinish: () => void;
}) {
  const items = finishChecklist(state, noteSaved);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={busy}
      width={480}
      title={`Finish ${patientName}’s visit?`}
      footer={<><Button onClick={onClose} disabled={busy}>Keep working</Button><Button variant="primary" busy={busy} disabled={!noteSaved} onClick={onFinish}>Finish visit</Button></>}
    >
      {error && <p role="alert" className="rounded-xl bg-signal-red-bg px-3.5 py-2.5 text-sm text-signal-red">{error}</p>}
      <ul className="flex flex-col">
        {items.map((item) => (
          <li key={item.key} className="flex items-center gap-3 border-t border-line py-2.5 text-[15px] first:border-t-0">
            {item.tone === 'green' ? <span className="text-signal-green"><Icon name="check" size={18} /></span> : <Dot tone={item.tone} className="mx-[5px]" />}
            {item.text}
          </li>
        ))}
      </ul>
      <p className="text-sm text-ink-2">Finishing locks the note and completes the visit and its appointment. Later changes need an amendment reason.</p>
    </Dialog>
  );
}

export function NoteConflictDialog({ open, mine, theirs, theirVersion, onClose, onUseTheirs, onKeepMine }: {
  open: boolean; mine: string; theirs: string; theirVersion: number; onClose: () => void; onUseTheirs: () => void; onKeepMine: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      width={720}
      title="A newer version of the note was saved elsewhere"
      description="Your text hasn’t been saved. Choose which version to keep."
      footerNote={<span className="inline-flex"><CopyMine text={mine} /></span>}
      footer={<><Button onClick={onUseTheirs}>Use version {theirVersion}</Button><Button variant="primary" onClick={onKeepMine}>Keep mine and save</Button></>}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink-2">Version {theirVersion}</span>
          <p className="h-[220px] overflow-y-auto whitespace-pre-wrap rounded-xl border border-line bg-white px-3.5 py-3 text-[13px] leading-relaxed">{theirs || <span className="text-ink-3">(Empty note)</span>}</p>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink-2">Your text, not saved</span>
          <p className="h-[220px] overflow-y-auto whitespace-pre-wrap rounded-xl border border-brand/40 bg-brand-select px-3.5 py-3 text-[13px] leading-relaxed">{mine || <span className="text-ink-3">(Empty note)</span>}</p>
        </div>
      </div>
    </Dialog>
  );
}

function CopyMine({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button size="sm" variant="quiet" icon={copied ? 'check' : 'copy'} onClick={() => void navigator.clipboard.writeText(text).then(() => setCopied(true)).catch(() => undefined)}>
      {copied ? 'Copied' : 'Copy my text'}
    </Button>
  );
}

export function AmendNoteDialog({ open, onClose, onContinue }: { open: boolean; onClose: () => void; onContinue: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  useEffect(() => { if (open) setReason(''); }, [open]);
  const ready = reason.trim().length >= 10;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Amend the finished note"
      description="The finished version stays in the history."
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!ready} onClick={() => onContinue(reason.trim())}>Edit note</Button></>}
    >
      <Field label="Reason for the amendment" htmlFor="care-amend-reason" hint="Required, at least 10 characters.">
        <input id="care-amend-reason" data-autofocus className={inputClass} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && ready) onContinue(reason.trim()); }} />
      </Field>
    </Dialog>
  );
}

export function UnsavedNoteDialog({ open, failed, onStay, onLeave }: { open: boolean; failed: boolean; onStay: () => void; onLeave: () => void }) {
  return (
    <Dialog
      open={open}
      alert
      onClose={onStay}
      width={440}
      title="Leave before your note saves?"
      footer={<><Button variant="dangerQuiet" onClick={onLeave}>Leave anyway</Button><Button variant="primary" data-autofocus onClick={onStay}>Stay</Button></>}
    >
      <p className="text-[15px] text-ink-2">{failed ? 'The last change didn’t save because of a connection problem. It’s still on this screen.' : 'Your latest changes are still saving. Leaving now may lose them.'}</p>
    </Dialog>
  );
}

const DEFAULT_SECTIONS: ChartSection[] = ['visit', 'before', 'answers', 'note'];

export function CopyChartDialog({ open, state, view, onClose, onError }: {
  open: boolean; state: CareState; view: CareView | null; onClose: () => void; onError: (message: string) => void;
}) {
  const [sections, setSections] = useState<ChartSection[]>(DEFAULT_SECTIONS);
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (open) { setSections(DEFAULT_SECTIONS); setCopied(false); } }, [open]);
  const text = useMemo(() => composeChart(state, view, sections), [state, view, sections]);
  const available = CHART_SECTIONS.filter((section) => view || !['before', 'answers', 'gaps', 'summary'].includes(section.key));
  const audits = CHART_SECTIONS.filter((section) => sections.includes(section.key)).map((section) => section.audit);

  async function copy() {
    try {
      await auditCareCopy(state.encounter.id, ['chart_composer', ...audits], state.snapshot?.id);
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      onError('The chart text didn’t copy. Select the preview and copy it instead.');
    }
  }

  async function download() {
    try {
      await auditCareCopy(state.encounter.id, ['chart_composer', ...audits], state.snapshot?.id);
      const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `priage-visit-${state.encounter.id}.txt`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      onError('The chart text didn’t download. Try again.');
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      width={820}
      title="Copy chart for PS-SUITE"
      description="Pick what goes in. Each part keeps a heading that says whose words it holds."
      footerNote="Copies and downloads are recorded in the visit history."
      footer={<>
        <Button icon="download" onClick={() => void download()} disabled={!text}>Download text</Button>
        <Button variant="primary" icon={copied ? 'check' : 'copy'} onClick={() => void copy()} disabled={!text}>{copied ? 'Copied' : `Copy ${sections.length} part${sections.length === 1 ? '' : 's'}`}</Button>
      </>}
    >
      <div className="flex flex-col gap-4 sm:flex-row">
        <fieldset className="flex shrink-0 flex-col sm:w-[220px]">
          <legend className="sr-only">Parts to copy</legend>
          {available.map((section) => {
            const on = sections.includes(section.key);
            return (
              <label key={section.key} className="flex cursor-pointer items-center gap-3 border-t border-line py-2.5 text-sm first:border-t-0">
                <input type="checkbox" className="h-[18px] w-[18px] accent-brand" checked={on} onChange={() => { setCopied(false); setSections(on ? sections.filter((key) => key !== section.key) : [...sections, section.key]); }} />
                {section.label}
              </label>
            );
          })}
        </fieldset>
        <pre className={cx('h-[360px] min-w-0 flex-1 overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-paper px-4 py-3.5 font-clinic text-[13px] leading-relaxed text-[#1E2643]', !text && 'flex items-center justify-center text-ink-3')}>{text || 'Choose at least one part.'}</pre>
      </div>
    </Dialog>
  );
}

const SECTION_LABELS: Record<string, string> = {
  summary: 'Case summary', urgency: 'Urgency', red_flags: 'Red flags', next_steps: 'Next steps', ask_in_room: 'Ask in the room',
  gaps: 'Not established', considerations: 'Possible considerations', exam: 'Focused exam suggestions', timed_risks: 'Watch for',
};

/**
 * Asks for the note behind "Not right" (optional) or "Something missing?"
 * (required). Feedback goes to clinic admins to evaluate Priage's suggestions.
 */
export function FeedbackNoteDialog({ open, mode, quote, sectionKey, existingNote, busy, error, onClose, onSave, onRemove }: {
  open: boolean; mode: 'not_right' | 'missing'; quote: string; sectionKey: string; existingNote: string | null; busy: boolean; error: string;
  onClose: () => void; onSave: (note: string) => void; onRemove: (() => void) | null;
}) {
  const [note, setNote] = useState('');
  useEffect(() => { if (open) setNote(existingNote ?? ''); }, [existingNote, open]);
  const missing = mode === 'missing';
  const ready = !missing || note.trim().length >= 3;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={busy}
      title={missing ? `What did ${SECTION_LABELS[sectionKey] ?? 'this section'} miss?` : 'What’s not right?'}
      description={missing ? 'Only your clinic’s admins see this, to check how well Priage’s suggestions work.' : undefined}
      footerNote={!missing ? 'Only your clinic’s admins see this.' : undefined}
      footer={<>
        {onRemove && <Button variant="dangerQuiet" onClick={onRemove} disabled={busy}>Remove</Button>}
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="primary" busy={busy} disabled={!ready} onClick={() => onSave(note.trim())}>Save</Button>
      </>}
    >
      {error && <p role="alert" className="rounded-xl bg-signal-red-bg px-3.5 py-2.5 text-sm text-signal-red">{error}</p>}
      {!missing && quote && <p className="border-l-2 border-dashed border-brand-rule pl-3.5 text-[15px] text-[#1E2643]">{quote}</p>}
      <Field label={missing ? 'What should it have included?' : 'What’s wrong with it? (optional)'} htmlFor="care-feedback-note" hint={missing ? 'Required.' : undefined}>
        <textarea id="care-feedback-note" data-autofocus className={textareaClass} rows={3} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>
    </Dialog>
  );
}
