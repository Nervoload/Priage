import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { answerTriage, completeTriage, getTriage, startTriage } from '../../shared/api/triage';
import {
  clearTriageDraft,
  loadTriageDraft,
  saveTriageDraft,
} from '../../shared/session';
import type {
  TriageMandatoryAnswers,
  TriageQuestion,
  TriageSession,
} from '../../shared/types/domain';
import { heroBackdrop, panelBorder, patientTheme } from '../../shared/ui/theme';
import { QuestionPage } from './QuestionPage';

interface GuestChatbotPageProps {
  chiefComplaint: string;
  onChooseHospital: () => void;
  onBack?: () => void;
  onSessionChange?: (session: TriageSession) => void;
  mode?: 'guest' | 'authenticated';
}

const EMPTY_MANDATORY: TriageMandatoryAnswers = {
  onset: '',
  severity: '',
  progression: '',
  relevantHistory: '',
};

export function GuestChatbotPage({
  chiefComplaint,
  onChooseHospital,
  onBack,
  onSessionChange,
  mode = 'guest',
}: GuestChatbotPageProps) {
  const storedDraft = useMemo(() => loadTriageDraft(mode), [mode]);
  const [mandatoryAnswers, setMandatoryAnswers] = useState<TriageMandatoryAnswers>(
    storedDraft?.mandatoryAnswers ?? EMPTY_MANDATORY,
  );
  const [triage, setTriage] = useState<TriageSession | null>(null);
  const [answer, setAnswer] = useState(storedDraft?.currentAnswer ?? '');
  const [loading, setLoading] = useState(Boolean(storedDraft?.sessionId));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState<(() => void) | null>(null);
  const resumeAttempted = useRef(false);

  const effectiveComplaint = storedDraft?.chiefComplaint || chiefComplaint;
  const sessionId = triage?.sessionId ?? storedDraft?.sessionId;

  const applySession = useCallback((next: TriageSession) => {
    setTriage(next);
    setAnswer('');
    setError(null);
    setRetry(null);
    saveTriageDraft(mode, {
      chiefComplaint: effectiveComplaint,
      mandatoryAnswers,
      sessionId: next.sessionId,
      status: next.status,
      currentAnswer: '',
    });
    onSessionChange?.(next);
    if (next.status === 'submitted') {
      clearTriageDraft(mode);
      onChooseHospital();
    }
  }, [effectiveComplaint, mandatoryAnswers, mode, onChooseHospital, onSessionChange]);

  const resumeSession = useCallback(async () => {
    if (!storedDraft?.sessionId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      applySession(await getTriage(storedDraft.sessionId));
    } catch (resumeError) {
      setError(messageFor(resumeError, 'Could not restore your triage session.'));
      setRetry(() => () => void resumeSession());
    } finally {
      setLoading(false);
    }
  }, [applySession, storedDraft?.sessionId]);

  useEffect(() => {
    if (resumeAttempted.current) return;
    resumeAttempted.current = true;
    void resumeSession();
  }, [resumeSession]);

  useEffect(() => {
    if (!sessionId) {
      saveTriageDraft(mode, {
        chiefComplaint: effectiveComplaint,
        mandatoryAnswers,
        currentAnswer: answer,
      });
      return;
    }
    saveTriageDraft(mode, {
      chiefComplaint: effectiveComplaint,
      mandatoryAnswers,
      sessionId,
      status: triage?.status,
      currentAnswer: answer,
    });
  }, [answer, effectiveComplaint, mandatoryAnswers, mode, sessionId, triage?.status]);

  function updateMandatory(field: keyof TriageMandatoryAnswers, value: string) {
    setMandatoryAnswers((current) => ({ ...current, [field]: value }));
  }

  async function handleStart(event: React.FormEvent) {
    event.preventDefault();
    await performStart();
  }

  async function performStart() {
    if (!allMandatoryComplete(mandatoryAnswers) || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      applySession(await startTriage({
        chiefComplaint: effectiveComplaint.trim(),
        mandatoryAnswers: mapTrimmedMandatory(mandatoryAnswers),
      }));
    } catch (startError) {
      setError(messageFor(startError, 'Could not start triage.'));
      setRetry(() => () => void performStart());
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAnswer() {
    const question = normalizeQuestion(triage?.question);
    if (!triage || !question || !answer.trim() || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      applySession(await answerTriage(triage.sessionId, {
        questionId: question.id,
        answer: answer.trim(),
      }));
    } catch (answerError) {
      setError(messageFor(answerError, 'Could not save your answer.'));
      setRetry(() => () => void handleAnswer());
    } finally {
      setSubmitting(false);
    }
  }

  async function handleComplete() {
    if (!triage || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      applySession(await completeTriage(triage.sessionId));
    } catch (completeError) {
      setError(messageFor(completeError, 'Could not submit your triage review.'));
      setRetry(() => () => void handleComplete());
    } finally {
      setSubmitting(false);
    }
  }

  function renderQuestionInput(question: TriageQuestion) {
    if (question.inputType === 'boolean' || question.inputType === 'single_select') {
      const options = question.inputType === 'boolean' ? ['Yes', 'No', 'Unknown'] : question.options;
      return (
        <div style={styles.optionGrid} role="group" aria-label={question.text}>
          {options.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={answer === option}
              style={{
                ...styles.choiceButton,
                ...(answer === option ? styles.optionSelected : null),
              }}
              onClick={() => setAnswer(option)}
              disabled={submitting}
            >
              {option}
            </button>
          ))}
          {question.allowsOther && (
            <input
              style={styles.input}
              value={options.includes(answer) ? '' : answer}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder="Another answer"
              aria-label="Another answer"
              disabled={submitting}
            />
          )}
        </div>
      );
    }

    if (question.inputType === 'number') {
      return (
        <input
          style={styles.input}
          type="number"
          inputMode="numeric"
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          aria-label={question.text}
          disabled={submitting}
          autoFocus
        />
      );
    }

    return question.inputType === 'textarea' ? (
      <textarea
        style={styles.textArea}
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
        placeholder="Type your answer, or enter Unknown"
        aria-label={question.text}
        disabled={submitting}
        autoFocus
      />
    ) : (
      <input
        style={styles.input}
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
        placeholder="Type your answer, or enter Unknown"
        aria-label={question.text}
        disabled={submitting}
        autoFocus
      />
    );
  }

  if (loading) {
    return <StatusCard message="Restoring your triage session…" />;
  }

  if (error) {
    return (
      <main style={styles.page}>
        <section style={styles.card} role="alert">
          <h1 style={styles.title}>We could not continue triage</h1>
          <p style={styles.body}>{error}</p>
          <div style={styles.buttonRow}>
            {onBack && <button type="button" style={styles.secondaryButton} onClick={onBack}>Exit safely</button>}
            {retry && <button type="button" style={styles.primaryButton} onClick={retry}>Try again</button>}
          </div>
        </section>
      </main>
    );
  }

  if (!triage) {
    return (
      <main style={styles.page}>
        <section style={styles.card}>
          <header style={styles.header}>
            <span style={styles.badge}>Required baseline</span>
            <h1 style={styles.title}>Tell us the four essentials</h1>
            <p style={styles.body}>These answers are required before the guided questions begin.</p>
          </header>
          <aside style={styles.complaintCard}>
            <strong>Main concern</strong>
            <span>{effectiveComplaint}</span>
          </aside>
          <form style={styles.form} onSubmit={handleStart}>
            <BaselineField
              label="1. When did this start?"
              value={mandatoryAnswers.onset}
              onChange={(value) => updateMandatory('onset', value)}
              placeholder="e.g. About two hours ago"
              options={['Unknown']}
            />
            <fieldset style={styles.fieldset}>
              <legend style={styles.legend}>2. How severe is it right now, from 0 to 10?</legend>
              <div style={styles.optionRow}>
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={mandatoryAnswers.severity === value}
                    style={{
                      ...styles.optionButton,
                      ...(mandatoryAnswers.severity === value ? styles.optionSelected : null),
                    }}
                    onClick={() => setMandatoryAnswers((current) => ({ ...current, severity: value }))}
                  >
                    {value}
                  </button>
                ))}
              </div>
              <div style={styles.optionRow}>
                {[
                  ['unknown', 'Unknown'],
                  ['prefer_not_to_answer', 'Prefer not to answer'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={mandatoryAnswers.severity === value}
                    style={{
                      ...styles.optionButton,
                      ...(mandatoryAnswers.severity === value ? styles.optionSelected : null),
                    }}
                    onClick={() => setMandatoryAnswers((current) => ({
                      ...current,
                      severity: value as 'unknown' | 'prefer_not_to_answer',
                    }))}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset style={styles.fieldset}>
              <legend style={styles.legend}>3. Are the symptoms changing?</legend>
              <div style={styles.optionGrid}>
                {[
                  ['better', 'Getting better'],
                  ['worse', 'Getting worse'],
                  ['same', 'Staying the same'],
                  ['unknown', 'Unknown'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={mandatoryAnswers.progression === value}
                    style={{
                      ...styles.choiceButton,
                      ...(mandatoryAnswers.progression === value ? styles.optionSelected : null),
                    }}
                    onClick={() => setMandatoryAnswers((current) => ({
                      ...current,
                      progression: value as TriageMandatoryAnswers['progression'],
                    }))}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
            <BaselineField
              label="4. What relevant health history should we know?"
              value={mandatoryAnswers.relevantHistory}
              onChange={(value) => updateMandatory('relevantHistory', value)}
              placeholder="Conditions, medicines, allergies, pregnancy, or “none”"
              multiline
              options={['None', 'Unknown', 'Not applicable', 'Prefer not to answer']}
            />
            <div style={styles.buttonRow}>
              {onBack && <button type="button" style={styles.secondaryButton} onClick={onBack}>Back</button>}
              <button
                type="submit"
                style={styles.primaryButton}
                disabled={!allMandatoryComplete(mandatoryAnswers) || submitting}
              >
                {submitting ? 'Starting triage…' : 'Start guided questions'}
              </button>
            </div>
          </form>
        </section>
      </main>
    );
  }

  if (triage.status === 'urgent_review') {
    return (
      <main style={styles.page}>
        <section style={styles.urgentCard} role="alert" aria-live="assertive">
          <span style={styles.urgentBadge}>Urgent medical attention</span>
          <h1 style={styles.title}>Do not wait for online check-in</h1>
          <p style={styles.urgentMessage}>
            {triage.patientMessage || 'Call emergency services or go to the nearest emergency department now.'}
          </p>
          {triage.urgencyReason && <p style={styles.body}><strong>Reason:</strong> {triage.urgencyReason}</p>}
          {onBack && <button type="button" style={styles.secondaryButton} onClick={onBack}>Exit triage</button>}
        </section>
      </main>
    );
  }

  if (triage.status === 'complete') {
    return (
      <main style={styles.page}>
        <section style={styles.card}>
          <span style={styles.badge}>Review before submitting</span>
          <h1 style={styles.title}>Check your triage summary</h1>
          <p style={styles.body}>Make sure this reflects what you shared. Submitting locks this triage session.</p>
          <ReviewSection title="Main concern" content={effectiveComplaint} />
          <ReviewSection title="Summary" content={triage.summary.briefing || 'No summary was provided.'} />
          <ReviewSection title="Your baseline answers" content={formatMandatory(triage.mandatoryAnswers ?? mandatoryAnswers)} />
          {triage.answers && Array.isArray(triage.answers) && triage.answers.length > 0 && (
            <ReviewSection
              title="Your follow-up answers"
              content={triage.answers.map((item) => `${item.question || item.questionId}: ${item.answer}`).join('\n')}
            />
          )}
          {triage.patientMessage && <ReviewSection title="Message for you" content={triage.patientMessage} />}
          <div style={styles.buttonRow}>
            {onBack && <button type="button" style={styles.secondaryButton} onClick={onBack}>Save and exit</button>}
            <button type="button" style={styles.primaryButton} onClick={() => void handleComplete()} disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit and choose hospital'}
            </button>
          </div>
        </section>
      </main>
    );
  }

  const question = normalizeQuestion(triage.question);
  if (!question) {
    return <StatusCard message="Preparing the next question…" />;
  }

  return (
    <QuestionPage
      step={Math.min(triage.questionCount + 1, Math.max(1, triage.maxQuestions))}
      totalSteps={Math.max(1, triage.maxQuestions)}
      progressLabel={`Question ${Math.min(triage.questionCount + 1, triage.maxQuestions)} of up to ${triage.maxQuestions}`}
      question={question.text}
      description={triage.patientMessage || 'Answer in your own words. Do not include information unrelated to your care.'}
      value={answer}
      onChange={setAnswer}
      onNext={() => void handleAnswer()}
      onBack={onBack}
      placeholder="Type your answer"
      multiline={question.inputType === 'textarea'}
      required={question.required}
      busy={submitting}
      nextLabel={submitting ? 'Saving…' : 'Next question'}
    >
      {renderQuestionInput(question)}
    </QuestionPage>
  );
}

function BaselineField({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
  options = [],
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  options?: string[];
}) {
  return (
    <label style={styles.label}>
      {label}
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          style={styles.textArea}
          required
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          style={styles.input}
          required
        />
      )}
      {options.length > 0 && (
        <span style={styles.optionRow}>
          {options.map((option) => (
            <button
              key={option}
              type="button"
              style={{
                ...styles.optionButton,
                ...(value === option ? styles.optionSelected : null),
              }}
              onClick={() => onChange(option)}
            >
              {option}
            </button>
          ))}
        </span>
      )}
    </label>
  );
}

function ReviewSection({ title, content }: { title: string; content: string }) {
  return (
    <section style={styles.reviewCard}>
      <strong>{title}</strong>
      <p style={styles.reviewText}>{content}</p>
    </section>
  );
}

function StatusCard({ message }: { message: string }) {
  return (
    <main style={styles.page}>
      <section style={styles.card} role="status" aria-live="polite">
        <div style={styles.spinner} />
        <p style={{ ...styles.body, textAlign: 'center' }}>{message}</p>
      </section>
    </main>
  );
}

function normalizeQuestion(question: TriageSession['question'] | undefined): TriageQuestion | null {
  return question ?? null;
}

function allMandatoryComplete(answers: TriageMandatoryAnswers): boolean {
  return answers.onset.trim().length > 0
    && answers.severity !== ''
    && answers.progression !== ''
    && answers.relevantHistory.trim().length > 0;
}

function mapTrimmedMandatory(answers: TriageMandatoryAnswers): TriageMandatoryAnswers {
  return {
    onset: answers.onset.trim(),
    severity: answers.severity,
    progression: answers.progression,
    relevantHistory: answers.relevantHistory.trim(),
  };
}

function formatMandatory(answers: TriageMandatoryAnswers): string {
  return [
    `Onset: ${answers.onset}`,
    `Severity: ${typeof answers.severity === 'number' ? `${answers.severity}/10` : answers.severity.replace(/_/g, ' ')}`,
    `Progression: ${answers.progression}`,
    `Relevant history: ${answers.relevantHistory}`,
  ].join('\n');
}

function messageFor(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  border: panelBorder,
  borderRadius: patientTheme.radius.sm,
  background: '#fff',
  color: patientTheme.colors.ink,
  padding: '0.75rem',
  fontSize: '1rem',
  fontFamily: patientTheme.fonts.body,
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    padding: '1rem',
    background: heroBackdrop,
    fontFamily: patientTheme.fonts.body,
    color: patientTheme.colors.ink,
  },
  card: {
    width: '100%',
    maxWidth: '680px',
    boxSizing: 'border-box',
    border: panelBorder,
    borderRadius: patientTheme.radius.xl,
    background: 'rgba(255, 253, 248, 0.98)',
    boxShadow: patientTheme.shadows.panel,
    padding: 'clamp(1rem, 4vw, 1.5rem)',
    display: 'grid',
    gap: '0.9rem',
  },
  urgentCard: {
    width: '100%',
    maxWidth: '680px',
    boxSizing: 'border-box',
    border: '2px solid #dc2626',
    borderRadius: patientTheme.radius.xl,
    background: '#fff7f7',
    boxShadow: '0 20px 48px rgba(185, 28, 28, 0.2)',
    padding: 'clamp(1rem, 4vw, 1.5rem)',
    display: 'grid',
    gap: '1rem',
  },
  header: { display: 'grid', gap: '0.35rem' },
  badge: {
    width: 'fit-content',
    borderRadius: '999px',
    background: '#e9f1ff',
    color: patientTheme.colors.accentStrong,
    padding: '0.3rem 0.72rem',
    fontSize: '0.78rem',
    fontWeight: 700,
  },
  urgentBadge: {
    width: 'fit-content',
    borderRadius: '999px',
    background: '#fee2e2',
    color: '#991b1b',
    padding: '0.3rem 0.72rem',
    fontSize: '0.8rem',
    fontWeight: 800,
  },
  title: { margin: 0, fontFamily: patientTheme.fonts.heading, fontSize: 'clamp(1.35rem, 5vw, 1.8rem)' },
  body: { margin: 0, color: patientTheme.colors.inkMuted, lineHeight: 1.55, whiteSpace: 'pre-line' },
  urgentMessage: { margin: 0, color: '#7f1d1d', lineHeight: 1.55, fontSize: '1.05rem', fontWeight: 700 },
  complaintCard: {
    display: 'grid',
    gap: '0.25rem',
    border: panelBorder,
    borderRadius: patientTheme.radius.md,
    background: '#f7faff',
    padding: '0.8rem',
  },
  form: { display: 'grid', gap: '0.85rem' },
  label: { display: 'grid', gap: '0.35rem', fontSize: '0.9rem', fontWeight: 700 },
  fieldset: { margin: 0, border: 0, padding: 0, display: 'grid', gap: '0.55rem' },
  legend: { padding: 0, marginBottom: '0.35rem', fontSize: '0.9rem', fontWeight: 700 },
  optionRow: { display: 'flex', flexWrap: 'wrap', gap: '0.45rem' },
  optionGrid: { display: 'grid', gap: '0.5rem' },
  optionButton: {
    border: panelBorder,
    borderRadius: patientTheme.radius.sm,
    background: '#fff',
    color: patientTheme.colors.ink,
    padding: '0.55rem 0.7rem',
    fontFamily: patientTheme.fonts.body,
    fontWeight: 700,
    cursor: 'pointer',
  },
  choiceButton: {
    border: panelBorder,
    borderRadius: patientTheme.radius.sm,
    background: '#fff',
    color: patientTheme.colors.ink,
    padding: '0.72rem 0.8rem',
    fontFamily: patientTheme.fonts.body,
    fontWeight: 700,
    textAlign: 'left',
    cursor: 'pointer',
  },
  optionSelected: {
    borderColor: patientTheme.colors.accent,
    background: '#eef5ff',
    color: patientTheme.colors.accentStrong,
    boxShadow: '0 0 0 1px rgba(25, 73, 184, 0.12)',
  },
  input: inputStyle,
  textArea: { ...inputStyle, minHeight: '92px', resize: 'vertical' },
  reviewCard: {
    border: panelBorder,
    borderRadius: patientTheme.radius.md,
    background: '#fff',
    padding: '0.8rem',
  },
  reviewText: { margin: '0.35rem 0 0', lineHeight: 1.55, whiteSpace: 'pre-line', color: patientTheme.colors.inkMuted },
  buttonRow: { display: 'flex', flexWrap: 'wrap', gap: '0.65rem' },
  primaryButton: {
    flex: 1,
    minWidth: '190px',
    border: 0,
    borderRadius: patientTheme.radius.sm,
    background: patientTheme.colors.accent,
    color: '#fff',
    padding: '0.78rem 1rem',
    fontWeight: 700,
    fontFamily: patientTheme.fonts.body,
    cursor: 'pointer',
  },
  secondaryButton: {
    border: panelBorder,
    borderRadius: patientTheme.radius.sm,
    background: '#fff',
    color: patientTheme.colors.ink,
    padding: '0.78rem 1rem',
    fontWeight: 700,
    fontFamily: patientTheme.fonts.body,
    cursor: 'pointer',
  },
  spinner: {
    width: '38px',
    height: '38px',
    justifySelf: 'center',
    border: '4px solid #dbe3f3',
    borderTopColor: patientTheme.colors.accent,
    borderRadius: '50%',
    animation: 'spin 0.9s linear infinite',
  },
};
