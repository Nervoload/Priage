import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../../../shared/api/client';
import { getClinicQuestionnaire, publishClinicQuestionnaire, type ClinicQuestion, type ClinicQuestionnaireView } from '../../../shared/api/clinicQuestionnaire';
import { dateTime } from '../care/careModel';
import { useLeaveGuard } from '../ui/ClinicShell';
import { Dialog } from '../ui/Dialog';
import { describeError } from '../ui/errors';
import { Button, Dot, IconButton, StatusLine, cx, inputClass, textareaClass } from '../ui/controls';
import { Icon } from '../ui/Icon';
import { useClinicToast } from '../ui/toast';
import { INPUT_TYPES, missingDefaults, moveQuestion, newQuestion, normalizeQuestions, questionCountWords, questionProblems, sameQuestions, withInputType } from './questionnaireModel';

/**
 * Where a clinic admin edits the questions every patient answers right after
 * the safety question. Publishing creates a new version; assessments already
 * under way keep the version they started with.
 */
export function ClinicQuestionnairePanel() {
  const toast = useClinicToast();
  const [view, setView] = useState<ClinicQuestionnaireView | null>(null);
  const [draft, setDraft] = useState<ClinicQuestion[]>([]);
  const [selected, setSelected] = useState(-1);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [stale, setStale] = useState(false);
  const [showProblems, setShowProblems] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [leaveTo, setLeaveTo] = useState<(() => void) | null>(null);

  const load = useCallback(async () => {
    try {
      const next = await getClinicQuestionnaire();
      setView(next); setDraft(next.draft); setStale(false); setError(''); setLoadError(''); setShowProblems(false);
    } catch (cause) {
      setLoadError(describeError(cause, 'Your clinic’s questions didn’t load. Try again.'));
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const baseline = view ? view.current?.questions ?? view.draft : [];
  const dirty = !!view && !sameQuestions(draft, baseline);
  const problems = draft.map(questionProblems);
  const problemCount = problems.filter((list) => list.length).length;
  const nextVersion = (view?.current?.version ?? 0) + 1;
  const canPublish = !!view && !busy && (dirty || !view.current);

  useLeaveGuard((proceed) => {
    if (!dirty) return true;
    setLeaveTo(() => proceed);
    return false;
  });
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  if (!view) {
    return (
      <section aria-label="Your clinic’s questions" className="mt-6 rounded-2xl border border-line bg-white p-6 font-clinic text-ink">
        {loadError ? <div className="flex items-center gap-3"><p role="alert" className="flex-1 text-sm text-signal-red">{loadError}</p><Button size="sm" onClick={() => void load()}>Try again</Button></div> : <p className="text-sm text-ink-2">Loading your clinic’s questions…</p>}
      </section>
    );
  }

  const update = (index: number, change: Partial<ClinicQuestion>) => setDraft((list) => list.map((question, position) => (position === index ? { ...question, ...change } : question)));
  const add = (question: ClinicQuestion) => { setDraft((list) => [...list, question]); setSelected(draft.length); };
  const remove = (index: number) => { setDraft((list) => list.filter((_, position) => position !== index)); setSelected(-1); };
  const total = 1 + draft.length;

  function requestPublish() {
    setShowProblems(true);
    if (problemCount) { setError(`Fix ${problemCount === 1 ? 'the question' : `the ${problemCount} questions`} marked below before publishing.`); return; }
    setError('');
    setConfirming(true);
  }

  async function publish() {
    if (!view) return;
    setBusy(true); setError('');
    try {
      const next = await publishClinicQuestionnaire(view.current?.version ?? 0, normalizeQuestions(draft));
      setView(next); setDraft(next.draft); setConfirming(false); setShowProblems(false);
      toast.show({ message: `Version ${next.current?.version ?? nextVersion} is live` });
    } catch (cause) {
      setConfirming(false);
      if (cause instanceof ApiError && cause.status === 409) setStale(true);
      setError(describeError(cause, 'Your questions didn’t publish. Try again.'));
    } finally { setBusy(false); }
  }

  const previewIndex = selected >= 0 && selected < draft.length ? selected : -1;
  const preview = previewIndex === -1 ? { prompt: view.locked[0]?.prompt ?? '', helpText: null, inputType: 'boolean' as const, choices: [] } : draft[previewIndex];

  return (
    <section aria-labelledby="clinic-questions-heading" className="mt-6 overflow-hidden rounded-2xl border border-line bg-white font-clinic text-ink">
      <div className="flex flex-col gap-2 px-6 pb-4 pt-6">
        <h2 id="clinic-questions-heading" className="text-xl font-semibold tracking-[-0.01em]">Your clinic’s questions</h2>
        <p className="max-w-[70ch] text-sm text-ink-2">Every patient answers these right after the safety question, before the rest of the assessment. Patients who choose your clinic after an assessment elsewhere answer them before booking. Clinicians see the answers in Care.</p>
        {view.current
          ? <StatusLine tone="green">Version {view.current.version} is live: {questionCountWords(view.current.questions.length)} after the safety question. Published {dateTime(view.current.publishedAt)}.</StatusLine>
          : <StatusLine tone="amber">Not published yet. Patients get only the safety question and the assessment.</StatusLine>}
      </div>

      {error && (
        <div role="alert" className="mx-6 mb-4 flex items-center gap-3 rounded-xl bg-signal-red-bg px-4 py-3 text-sm text-signal-red">
          <span className="flex-1">{error}</span>
          {stale && <Button size="sm" onClick={() => void load()}>Load the latest version</Button>}
        </div>
      )}

      <div className="grid gap-6 px-6 pb-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <ol className="flex min-w-0 flex-col gap-3" aria-label="Questions in the order patients see them">
          {view.locked.map((locked) => (
            <li key={locked.key}>
              <button type="button" onClick={() => setSelected(-1)} className={cx('flex w-full items-start gap-3 rounded-xl border bg-paper px-4 py-3.5 text-left', previewIndex === -1 ? 'border-brand shadow-[0_0_0_3px_rgba(41,134,255,.15)]' : 'border-line')}>
                <span className="w-5 pt-0.5 text-[13px] tabular-nums text-ink-3">1</span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[15px] font-medium">{locked.prompt}</span>
                  <span className="text-[13px] text-ink-2">{locked.why}</span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1.5 text-[12px] text-ink-3"><Icon name="lock" size={14} />Can’t be changed</span>
              </button>
            </li>
          ))}
          {draft.map((question, index) => (
            <QuestionCard
              key={question.key}
              question={question}
              number={index + 2}
              selected={previewIndex === index}
              problems={showProblems ? problems[index] : []}
              first={index === 0}
              last={index === draft.length - 1}
              onSelect={() => setSelected(index)}
              onChange={(change) => update(index, change)}
              onMove={(delta) => { setDraft((list) => moveQuestion(list, index, delta)); setSelected(index + delta); }}
              onRemove={() => remove(index)}
            />
          ))}
          <li className="flex flex-wrap items-center gap-2 pt-1">
            <Button icon="plus" disabled={draft.length >= view.maxQuestions} onClick={() => add(newQuestion(draft))}>Add a question</Button>
            {missingDefaults(draft, view.defaults).map((question) => (
              <Button key={question.key} variant="quiet" disabled={draft.length >= view.maxQuestions} onClick={() => add(question)}>Add back “{question.prompt}”</Button>
            ))}
            <span className="text-[13px] text-ink-3">{draft.length >= view.maxQuestions ? `Up to ${view.maxQuestions} questions.` : 'Keep it short: every question adds time before the assessment.'}</span>
          </li>
        </ol>

        <aside aria-label="What patients see" className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
          <div className="flex flex-col gap-3 rounded-[28px] border border-line bg-paper p-5 shadow-[0_18px_40px_-28px_rgba(14,22,48,.35)]">
            <span className="text-[12px] text-ink-3">Question {previewIndex + 2} of {total}, then the assessment</span>
            <p className="font-display text-[22px] leading-tight text-ink">{preview.prompt.trim() || 'Your question'}</p>
            {preview.helpText?.trim() && <p className="text-[13px] text-ink-2">{preview.helpText}</p>}
            <PreviewAnswers inputType={preview.inputType} choices={preview.choices} />
          </div>
          <p className="text-[12px] text-ink-3">A preview of what patients see on their phone.</p>
          {view.history.length > 0 && (
            <details className="text-[13px] text-ink-2">
              <summary className="cursor-pointer font-semibold text-brand-700">Earlier versions</summary>
              <ul className="mt-2 flex flex-col gap-1">
                {view.history.map((item) => <li key={item.version}>Version {item.version}, {questionCountWords(item.questionCount)}, {dateTime(item.publishedAt)} by user #{item.publishedByUserId}</li>)}
              </ul>
            </details>
          )}
        </aside>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-line bg-rail px-6 py-3.5">
        <span className="flex flex-1 items-center gap-2 text-[13px] text-ink-2">
          {dirty ? <><Dot tone="amber" />Changes not published</> : view.current ? <><Dot tone="green" />Matches the live version</> : <><Dot tone="amber" />Priage’s suggested questions, not published</>}
        </span>
        {dirty && <Button variant="quiet" disabled={busy} onClick={() => { setDraft(baseline); setShowProblems(false); setError(''); }}>Discard changes</Button>}
        <Button variant="primary" disabled={!canPublish} onClick={requestPublish}>Publish version {nextVersion}</Button>
      </div>

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        busy={busy}
        title={`Publish version ${nextVersion}?`}
        description="New assessments ask these from now on. Assessments already under way keep the version they started with."
        footer={<><Button onClick={() => setConfirming(false)} disabled={busy}>Cancel</Button><Button variant="primary" busy={busy} onClick={() => void publish()}>Publish</Button></>}
      >
        <ol className="flex flex-col text-[15px]">
          {[...view.locked.map((locked) => locked.prompt), ...normalizeQuestions(draft).map((question) => question.prompt)].map((prompt, index) => (
            <li key={`${index}-${prompt}`} className="flex gap-3 border-t border-line py-2.5 first:border-t-0">
              <span className="w-5 text-[13px] tabular-nums text-ink-3">{index + 1}</span>
              <span className={index === 0 ? 'text-ink-2' : ''}>{prompt}</span>
            </li>
          ))}
        </ol>
      </Dialog>

      <Dialog
        open={!!leaveTo}
        alert
        onClose={() => setLeaveTo(null)}
        width={440}
        title="Leave without publishing?"
        footer={<><Button variant="dangerQuiet" onClick={() => { const go = leaveTo; setLeaveTo(null); go?.(); }}>Leave anyway</Button><Button variant="primary" data-autofocus onClick={() => setLeaveTo(null)}>Stay</Button></>}
      >
        <p className="text-[15px] text-ink-2">Your changes to the clinic’s questions haven’t been published. Patients still get version {view.current?.version ?? 'none'}.</p>
      </Dialog>
    </section>
  );
}

function QuestionCard({ question, number, selected, problems, first, last, onSelect, onChange, onMove, onRemove }: {
  question: ClinicQuestion; number: number; selected: boolean; problems: string[]; first: boolean; last: boolean;
  onSelect: () => void; onChange: (change: Partial<ClinicQuestion>) => void; onMove: (delta: -1 | 1) => void; onRemove: () => void;
}) {
  const id = `clinic-question-${question.key}`;
  return (
    <li
      onFocusCapture={onSelect}
      onClick={onSelect}
      className={cx('flex gap-3 rounded-xl border bg-white px-4 py-4 transition-shadow', selected ? 'border-brand shadow-[0_0_0_3px_rgba(41,134,255,.15)]' : problems.length ? 'border-signal-red/50' : 'border-line')}
    >
      <span className="w-5 pt-2.5 text-[13px] tabular-nums text-ink-3">{number}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <label htmlFor={`${id}-prompt`} className="sr-only">Question {number}</label>
        <textarea id={`${id}-prompt`} className={cx(textareaClass, 'text-[15px] font-medium')} rows={2} maxLength={200} placeholder="Write the question as patients will read it" value={question.prompt} onChange={(event) => onChange({ prompt: event.target.value })} />
        <input aria-label={`Help text for question ${number} (optional)`} className={cx(inputClass, 'h-10 text-sm')} maxLength={200} placeholder="Help text (optional)" value={question.helpText ?? ''} onChange={(event) => onChange({ helpText: event.target.value })} />
        <div role="radiogroup" aria-label={`Answer type for question ${number}`} className="flex w-fit gap-0.5 rounded-[12px] bg-ink/5 p-1">
          {INPUT_TYPES.map((type) => {
            const on = question.inputType === type.value;
            return (
              <button
                key={type.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onChange(withInputType(question, type.value))}
                className={cx('h-8 rounded-[9px] px-3 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-brand', on ? 'bg-white text-ink shadow-[0_1px_2px_rgba(14,22,48,.08)]' : 'text-ink-2 hover:text-ink')}
              >
                {type.label}
              </button>
            );
          })}
        </div>
        {question.inputType === 'single_select' && (
          <ul className="flex flex-col gap-2" aria-label={`Choices for question ${number}`}>
            {question.choices.map((choice, index) => (
              <li key={index} className="flex items-center gap-2">
                <span aria-hidden="true" className="h-4 w-4 shrink-0 rounded-full border border-line-strong" />
                <input aria-label={`Choice ${index + 1}`} className={cx(inputClass, 'h-9 text-sm')} maxLength={80} value={choice} placeholder={`Choice ${index + 1}`} onChange={(event) => onChange({ choices: question.choices.map((item, position) => (position === index ? event.target.value : item)) })} />
                <IconButton icon="x" label={`Remove choice ${index + 1}`} disabled={question.choices.length <= 2} onClick={() => onChange({ choices: question.choices.filter((_, position) => position !== index) })} />
              </li>
            ))}
            {question.choices.length < 6 && <li><Button size="sm" variant="quiet" icon="plus" onClick={() => onChange({ choices: [...question.choices, ''] })}>Add a choice</Button></li>}
          </ul>
        )}
        {problems.length > 0 && <ul className="flex flex-col gap-0.5 text-[13px] font-medium text-signal-red">{problems.map((problem) => <li key={problem}>{problem}</li>)}</ul>}
        <div className="flex flex-wrap items-center gap-1">
          <span className="flex-1 text-[12px] text-ink-3">{question.origin === 'default' ? 'Suggested by Priage. Edit or remove it.' : 'Added by your clinic.'}</span>
          <IconButton icon="chevronUp" label={`Move question ${number} up`} disabled={first} onClick={() => onMove(-1)} />
          <IconButton icon="chevronDown" label={`Move question ${number} down`} disabled={last} onClick={() => onMove(1)} />
          <Button size="sm" variant="dangerQuiet" onClick={onRemove}>Remove</Button>
        </div>
      </div>
    </li>
  );
}

function PreviewAnswers({ inputType, choices }: { inputType: ClinicQuestion['inputType']; choices: string[] }) {
  const option = 'flex h-11 items-center rounded-xl border border-line-strong bg-white px-4 text-[15px] text-ink';
  if (inputType === 'text') return <span className={cx(option, 'text-ink-3')}>Type your answer</span>;
  const labels = inputType === 'boolean' ? ['Yes', 'No'] : choices.map((choice) => choice.trim()).filter(Boolean);
  if (!labels.length) return <span className="text-[13px] text-ink-3">Add choices to see them here.</span>;
  return <div className="flex flex-col gap-2">{labels.map((label, index) => <span key={`${index}-${label}`} className={option}>{label}</span>)}</div>;
}
