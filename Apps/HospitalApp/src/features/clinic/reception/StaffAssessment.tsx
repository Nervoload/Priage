import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { client } from '../../../shared/api/client';
import { Dialog } from '../ui/Dialog';
import { Button, Spinner, cx, inputClass, textareaClass } from '../ui/controls';
import { Icon } from '../ui/Icon';
import { describeError } from '../ui/errors';
import { firstName, type ClinicRow } from './receptionModel';

type Question = {
  publicId: string; prompt: string; helpText?: string; placeholder?: string;
  inputType: 'text' | 'textarea' | 'number' | 'boolean' | 'single_select'; choices: string[]; required: boolean;
};
type InterviewState = {
  status: 'in_progress' | 'emergency_ack_required' | 'complete';
  currentQuestion: Question | null;
  emergencyAlert: { title: string; body: string; recommendation: string } | null;
  askedCount: number;
  maxQuestions?: number;
};
type Draft = { text: string; number: string; choice: string; bool: boolean | null };
const EMPTY_DRAFT: Draft = { text: '', number: '', choice: '', bool: null };

function isZeroToTenScale(question: Question): boolean {
  return /^\s*0\s*[-–to]+\s*10\s*$/i.test(question.placeholder ?? '') || /\b0 (?:to|-|–) 10\b/.test(question.prompt);
}

function payloadFor(question: Question, draft: Draft): Record<string, unknown> {
  const payload: Record<string, unknown> = { questionPublicId: question.publicId };
  if (question.inputType === 'boolean') payload.valueBoolean = draft.bool ?? undefined;
  else if (question.inputType === 'number') payload.valueNumber = draft.number ? Number.parseInt(draft.number, 10) : undefined;
  else if (question.inputType === 'single_select') payload.valueChoice = draft.choice;
  else payload.valueText = draft.text.trim();
  return payload;
}

function hasAnswer(question: Question, draft: Draft): boolean {
  if (question.inputType === 'boolean') return draft.bool !== null;
  if (question.inputType === 'number') return draft.number !== '';
  if (question.inputType === 'single_select') return draft.choice !== '';
  return draft.text.trim().length > 0;
}

function Choice({ label, on, onSelect }: { label: string; on: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onSelect}
      className={cx(
        'flex min-h-[60px] items-center gap-3.5 rounded-[14px] px-[18px] text-left text-[17px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        on ? 'border-[1.5px] border-brand bg-brand-select' : 'border border-line-strong bg-white hover:border-ink/30',
      )}
    >
      <span aria-hidden="true" className={cx('h-5 w-5 shrink-0 rounded-full bg-white', on ? 'border-[6px] border-brand' : 'border-[1.5px] border-ink/30')} />
      {label}
    </button>
  );
}

// Full screen, so the receptionist and patient can work through the questions
// together. The question screen mirrors the one patients see.
export function StaffAssessment({ row, onClose, onChanged }: { row: ClinicRow; onClose: () => void; onChanged: () => void }) {
  const [state, setState] = useState<InterviewState | null>(null);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const name = firstName(row.patientName);

  const start = useCallback(async () => {
    setLoadError(''); setError('');
    try { setState(await client<InterviewState>(`/clinic-intake/reception/walk-ins/${row.id}/interview/start`, { method: 'POST', body: '{}' })); }
    catch (cause) { setLoadError(describeError(cause, 'The assessment didn’t open. Check the connection and try again.')); }
  }, [row.id]);

  useEffect(() => { void start(); }, [start]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    backRef.current?.focus();
    return () => { document.body.style.overflow = overflow; if (previous && document.contains(previous)) previous.focus(); };
  }, []);

  const questionId = state?.currentQuestion?.publicId;
  useEffect(() => {
    setDraft(EMPTY_DRAFT);
    if (questionId) window.requestAnimationFrame(() => headingRef.current?.focus());
  }, [questionId]);

  async function advance(payload: Record<string, unknown>) {
    if (busy) return;
    setBusy(true); setError('');
    try {
      setState(await client<InterviewState>(`/clinic-intake/reception/walk-ins/${row.id}/interview/advance`, { method: 'POST', body: JSON.stringify(payload) }));
      onChanged();
    } catch (cause) {
      setError(describeError(cause, 'The answer didn’t save. Reload the question, then enter it again.'));
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const question = state?.currentQuestion;
    if (!question || !hasAnswer(question, draft)) return;
    void advance(payloadFor(question, draft));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); onClose(); }
  }

  const question = state?.status === 'in_progress' ? state.currentQuestion : null;
  const max = state?.maxQuestions ?? 0;
  const progress = state?.status === 'complete' ? 100 : max ? Math.min(100, Math.round((state!.askedCount / max) * 100)) : 0;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`Assessment with ${row.patientName}`} onKeyDown={onKeyDown} className="clinic-scrim-in fixed inset-0 z-[110] flex flex-col bg-white font-clinic text-ink">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-line px-4 sm:px-5">
        <button ref={backRef} type="button" onClick={onClose} className="inline-flex h-10 items-center gap-1 rounded-xl pl-1.5 pr-3 text-sm font-semibold text-ink hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-brand">
          <Icon name="chevronLeft" />Reception
        </button>
        <span aria-hidden="true" className="h-[22px] w-px bg-line-strong" />
        <span className="truncate font-semibold">Assessment with {row.patientName}</span>
        <span className="hidden text-[13px] text-ink-3 sm:inline">Visit {row.id}</span>
        <span className="flex-1" />
        <span className="hidden text-[13px] text-ink-3 md:inline">Answers are recorded as entered by you</span>
      </header>
      <div aria-hidden="true" className="h-[3px] shrink-0 bg-sunken"><div className="h-full bg-brand transition-[width] duration-500 ease-quiet" style={{ width: `${progress}%` }} /></div>

      <main className="flex min-h-0 flex-1 items-start justify-center overflow-y-auto px-5 pb-16 pt-12 sm:pt-16">
        <div className="flex w-full max-w-[640px] flex-col gap-7">
          {!state && !loadError && <p className="flex items-center gap-3 text-ink-2"><Spinner /> Opening the assessment…</p>}
          {loadError && (
            <div className="flex flex-col items-start gap-3">
              <p role="alert" className="text-[15px] text-signal-red">{loadError}</p>
              <Button onClick={() => void start()}>Try again</Button>
            </div>
          )}

          {state?.status === 'complete' && (
            <div className="flex flex-col items-start gap-4">
              <h1 className="font-display text-[48px] leading-[1.05] tracking-[-0.015em]">Assessment finished</h1>
              <p className="text-[17px] text-ink-2">Care can start when a physician is ready. {name} can take a seat.</p>
              <Button variant="primary" size="lg" onClick={onClose}>Back to Reception</Button>
            </div>
          )}

          {state?.status === 'in_progress' && !question && (
            <div className="flex flex-col items-start gap-4">
              <p className="text-[17px] text-ink-2">The next question is ready to load.</p>
              <Button variant="primary" busy={busy} onClick={() => void advance({})}>Load the next question</Button>
            </div>
          )}

          {question && (
            <form onSubmit={submit} className="flex flex-col gap-7" key={question.publicId}>
              <div className="flex flex-col gap-3.5">
                {max > 0 && <span className="text-[15px] font-medium text-ink-2">Question {Math.min(state!.askedCount + 1, max)} of up to {max}</span>}
                <h1 ref={headingRef} tabIndex={-1} id="staff-question" className={cx('font-display leading-[1.06] tracking-[-0.015em] outline-none', question.prompt.length > 80 ? 'text-[38px]' : 'text-[48px]')}>{question.prompt}</h1>
                <p className="text-[17px] text-ink-2">{question.helpText || `Read the question aloud and enter ${name}’s answer.`}</p>
              </div>

              {question.inputType === 'boolean' && (
                <div role="radiogroup" aria-labelledby="staff-question" className="flex flex-col gap-2.5">
                  <Choice label="Yes" on={draft.bool === true} onSelect={() => setDraft({ ...draft, bool: true })} />
                  <Choice label="No" on={draft.bool === false} onSelect={() => setDraft({ ...draft, bool: false })} />
                </div>
              )}
              {question.inputType === 'single_select' && (
                <div role="radiogroup" aria-labelledby="staff-question" className="flex flex-col gap-2.5">
                  {question.choices.map((choice) => <Choice key={choice} label={choice} on={draft.choice === choice} onSelect={() => setDraft({ ...draft, choice })} />)}
                </div>
              )}
              {question.inputType === 'number' && isZeroToTenScale(question) && (
                <div>
                  <div role="radiogroup" aria-labelledby="staff-question" className="grid grid-cols-11 gap-1.5">
                    {Array.from({ length: 11 }, (_, value) => String(value)).map((value) => (
                      <button key={value} type="button" role="radio" aria-checked={draft.number === value} onClick={() => setDraft({ ...draft, number: value })}
                        className={cx('h-14 rounded-xl text-lg font-semibold tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand', draft.number === value ? 'bg-brand text-white' : 'border border-line-strong bg-white hover:border-ink/30')}>
                        {value}
                      </button>
                    ))}
                  </div>
                  <div aria-hidden="true" className="mt-2 flex justify-between text-[13px] text-ink-3"><span>None</span><span>Worst imaginable</span></div>
                </div>
              )}
              {question.inputType === 'number' && !isZeroToTenScale(question) && (
                <input aria-labelledby="staff-question" className={cx(inputClass, 'h-[52px] max-w-[220px] text-lg')} inputMode="numeric" placeholder={question.placeholder || 'Enter a number'} value={draft.number} onChange={(event) => setDraft({ ...draft, number: event.target.value.replace(/[^\d]/g, '') })} />
              )}
              {question.inputType === 'textarea' && (
                <textarea aria-labelledby="staff-question" className={cx(textareaClass, 'text-[17px]')} rows={4} placeholder={question.placeholder || ''} value={draft.text} onChange={(event) => setDraft({ ...draft, text: event.target.value })} />
              )}
              {question.inputType === 'text' && (
                <input aria-labelledby="staff-question" className={cx(inputClass, 'h-[52px] text-[17px]')} placeholder={question.placeholder || ''} value={draft.text} onChange={(event) => setDraft({ ...draft, text: event.target.value })} />
              )}

              {error && (
                <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl bg-signal-red-bg px-4 py-3 text-sm text-signal-red">
                  <span className="flex-1">{error}</span>
                  <Button size="sm" onClick={() => void start()}>Reload question</Button>
                </div>
              )}
              <div><Button type="submit" variant="primary" size="lg" busy={busy} disabled={!hasAnswer(question, draft)}>Save answer</Button></div>
            </form>
          )}
        </div>
      </main>

      <Dialog
        open={state?.status === 'emergency_ack_required' && !!state.emergencyAlert}
        alert
        tone="danger"
        onClose={() => undefined}
        busy={busy}
        width={560}
        icon={<span className="mt-0.5 text-signal-red"><Icon name="alert" size={22} /></span>}
        title={state?.emergencyAlert?.title ?? 'This answer needs emergency care'}
        footerNote={<Button variant="quiet" className="-ml-2.5" onClick={onClose}>Back to Reception</Button>}
        footer={<>
          <a href="tel:911" className="inline-flex h-10 items-center gap-2 rounded-xl border border-line-strong bg-white px-4 text-sm font-semibold text-ink hover:border-ink/30"><Icon name="phone" size={16} />Call 911</a>
          <Button variant="primary" busy={busy} onClick={() => void advance({ action: 'acknowledge_emergency' })} data-autofocus>Record that {name} was told</Button>
        </>}
      >
        {error && <p role="alert" className="rounded-xl bg-signal-red-bg px-3.5 py-2.5 text-sm text-signal-red">{error}</p>}
        <p className="text-[15px] leading-relaxed">{state?.emergencyAlert?.body}</p>
        {state?.emergencyAlert?.recommendation && <p className="text-[15px] font-semibold leading-relaxed">{state.emergencyAlert.recommendation}</p>}
        <p className="text-[13px] text-ink-3">Based on {name}’s answers. It isn’t a diagnosis. The assessment continues once you record that {name} was told.</p>
      </Dialog>
    </div>,
    document.body,
  );
}
