import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ApiError, client } from '../shared/api/client';
import { friendlyError } from '../shared/api/errors';
import { ChoiceList } from '../shared/ui/ChoiceList';
import { CtaButton, LoadingScreen } from '../shared/ui/Controls';
import { TextField } from '../shared/ui/Field';
import { Icon } from '../shared/ui/Icon';
import { answerFor, type ClinicQuestions } from './clinicQuestions';

/**
 * For patients who finished an assessment elsewhere and then chose this clinic:
 * the clinic's own questions, answered once before choosing a time.
 */
export function ClinicQuestionsStep({ encounterId, onAnswered }: { encounterId: number; onAnswered: () => Promise<void> | void }) {
  const [data, setData] = useState<ClinicQuestions | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);

  const load = useCallback(async () => {
    try {
      const next = await client<ClinicQuestions>(`/clinic-intake/visits/${encounterId}/clinic-questions`);
      setData(next);
      if (next.status !== 'pending' || !next.questions.length) await onAnswered();
    } catch (cause) { setError(friendlyError(cause, 'We couldn’t load the clinic’s questions. Please try again.')); }
  }, [encounterId, onAnswered]);
  useEffect(() => { void load(); }, [load]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!data?.version || busy) return;
    setChecked(true);
    const answers = data.questions.map((question) => answerFor(question, values[question.key]));
    if (answers.some((answer) => !answer)) { setError('Please answer every question.'); return; }
    setBusy(true); setError('');
    try {
      await client(`/clinic-intake/visits/${encounterId}/clinic-questions`, { method: 'POST', body: JSON.stringify({ version: data.version, answers }) });
      await onAnswered();
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) { await load(); setError('The clinic just updated its questions. Please check your answers.'); }
      else setError(friendlyError(cause, 'We couldn’t send your answers. Please try again.'));
    } finally { setBusy(false); }
  }

  if (!data) {
    return error
      ? <p role="alert" className="notice notice--danger"><Icon name="alertCircle" size={18} /><span>{error}</span></p>
      : <LoadingScreen label="Loading the clinic’s questions…" />;
  }
  if (data.status !== 'pending' || !data.questions.length) return <LoadingScreen label="Opening booking…" />;

  return (
    <section className="card card--raised card--pad stack" aria-labelledby="clinic-questions-title">
      <div className="stack stack--xs">
        <h2 id="clinic-questions-title" className="heading">From the clinic</h2>
        <p className="small">Your answers go to the clinic with your assessment.</p>
      </div>
      {error && <p role="alert" className="notice notice--danger"><Icon name="alertCircle" size={18} /><span>{error}</span></p>}
      <form className="form" onSubmit={(event) => void submit(event)} noValidate>
        {data.questions.map((question) => {
          const labelId = `clinic-question-${question.key}`;
          const missing = checked && !answerFor(question, values[question.key]);
          const set = (value: string) => setValues((current) => ({ ...current, [question.key]: value }));
          if (question.inputType === 'text') {
            return <TextField key={question.key} label={question.prompt} hint={question.helpText ?? undefined} error={missing ? 'Please answer this question.' : undefined} value={values[question.key] ?? ''} maxLength={1000} onChange={(event) => set(event.target.value)} />;
          }
          return (
            <div key={question.key} className="stack stack--xs">
              <span id={labelId} className="field__label">{question.prompt}</span>
              {question.helpText && <span className="small">{question.helpText}</span>}
              <ChoiceList name={labelId} labelledBy={labelId} options={question.inputType === 'boolean' ? ['Yes', 'No'] : question.choices} selected={values[question.key] ?? null} onPick={set} />
              {missing && <span className="field__error">Please choose an answer.</span>}
            </div>
          );
        })}
        <CtaButton type="submit" busy={busy}>Continue to booking</CtaButton>
      </form>
    </section>
  );
}
