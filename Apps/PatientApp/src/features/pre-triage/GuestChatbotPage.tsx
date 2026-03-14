import { useEffect, useMemo, useState } from 'react';

import { advanceInterview, startInterview } from '../../shared/api/intake';
import { useGuestSession } from '../../shared/hooks/useGuestSession';
import type { AdvanceInterviewPayload, InterviewQuestion, InterviewState } from '../../shared/types/domain';
import { heroBackdrop, panelBorder, patientTheme } from '../../shared/ui/theme';
import { useToast } from '../../shared/ui/ToastContext';
import { QuestionPage } from './QuestionPage';

interface GuestChatbotPageProps {
  onChooseHospital: () => void;
  onBack?: () => void;
}

export function GuestChatbotPage({ onChooseHospital, onBack }: GuestChatbotPageProps) {
  const { session } = useGuestSession();
  const { showToast } = useToast();

  const [interview, setInterview] = useState<InterviewState | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [draftNumber, setDraftNumber] = useState('');
  const [draftBoolean, setDraftBoolean] = useState<boolean | null>(null);
  const [draftChoice, setDraftChoice] = useState('');

  const currentQuestion = interview?.currentQuestion ?? null;

  useEffect(() => {
    let cancelled = false;

    async function loadInterview() {
      setLoading(true);
      try {
        const state = await startInterview();
        if (!cancelled) {
          setInterview(state);
        }
      } catch (error) {
        if (!cancelled) {
          showToast(error instanceof Error ? error.message : 'Could not load the intake interview.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadInterview();
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  useEffect(() => {
    setDraftText('');
    setDraftNumber('');
    setDraftBoolean(null);
    setDraftChoice('');
  }, [currentQuestion?.publicId]);

  const progressLabel = useMemo(() => {
    if (!interview) {
      return 'Loading interview…';
    }
    if (currentQuestion?.publicId === 'safety_immediate_danger') {
      return 'Safety check';
    }
    return `Question ${Math.min(interview.askedCount + 1, interview.maxQuestions)} of up to ${interview.maxQuestions}`;
  }, [currentQuestion?.publicId, interview]);

  const currentValue = useMemo(() => {
    if (!currentQuestion) {
      return '';
    }
    switch (currentQuestion.inputType) {
      case 'boolean':
        return draftBoolean == null ? '' : draftBoolean ? 'Yes' : 'No';
      case 'number':
        return draftNumber;
      case 'single_select':
        return draftChoice;
      default:
        return draftText;
    }
  }, [currentQuestion, draftBoolean, draftChoice, draftNumber, draftText]);

  function buildQuestionSummary(question: InterviewQuestion) {
    return (
      <div style={{ display: 'grid', gap: '0.34rem' }}>
        <div><strong>Phase:</strong> {formatPhaseLabel(interview?.phase ?? question.phase)}</div>
        <div><strong>Queued next:</strong> {interview?.cachedQuestions.length ?? 0}</div>
        {question.clinicalReason && <div><strong>Why we ask:</strong> {question.clinicalReason}</div>}
        {interview?.summaryPreview && <div><strong>Current summary:</strong> {interview.summaryPreview}</div>}
        {session?.chiefComplaint && <div><strong>Chief complaint:</strong> {session.chiefComplaint}</div>}
      </div>
    );
  }

  function renderQuestionInput(question: InterviewQuestion) {
    if (question.inputType === 'boolean') {
      return (
        <div style={styles.optionGrid}>
          {['Yes', 'No'].map((choice) => {
            const selected = (choice === 'Yes' && draftBoolean === true) || (choice === 'No' && draftBoolean === false);
            return (
              <button
                key={choice}
                type="button"
                style={{
                  ...styles.choiceButton,
                  ...(selected ? styles.choiceButtonSelected : null),
                }}
                onClick={() => setDraftBoolean(choice === 'Yes')}
              >
                {choice}
              </button>
            );
          })}
        </div>
      );
    }

    if (question.inputType === 'single_select') {
      return (
        <div style={styles.optionGrid}>
          {question.choices.map((choice) => (
            <button
              key={choice}
              type="button"
              style={{
                ...styles.choiceButton,
                ...(draftChoice === choice ? styles.choiceButtonSelected : null),
              }}
              onClick={() => setDraftChoice(choice)}
            >
              {choice}
            </button>
          ))}
        </div>
      );
    }

    if (question.inputType === 'number') {
      return (
        <input
          style={styles.input}
          value={draftNumber}
          onChange={(event) => setDraftNumber(event.target.value.replace(/[^\d]/g, ''))}
          inputMode="numeric"
          placeholder={question.placeholder || 'Enter a number'}
          autoFocus
        />
      );
    }

    if (question.inputType === 'textarea') {
      return (
        <textarea
          style={styles.textArea}
          value={draftText}
          onChange={(event) => setDraftText(event.target.value)}
          placeholder={question.placeholder || ''}
          autoFocus
        />
      );
    }

    return undefined;
  }

  async function handleAdvance() {
    if (!currentQuestion || submitting) {
      return;
    }

    const payload = buildAdvancePayload(currentQuestion, {
      draftText,
      draftNumber,
      draftBoolean,
      draftChoice,
    });

    setSubmitting(true);
    try {
      const nextState = await advanceInterview(payload);
      setInterview(nextState);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save your answer.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEmergencyAcknowledge() {
    if (submitting) {
      return;
    }

    setSubmitting(true);
    try {
      const nextState = await advanceInterview({ action: 'acknowledge_emergency' });
      setInterview(nextState);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not continue the intake interview.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <section style={styles.statusCard}>
          <div style={styles.spinner} />
          <p style={styles.statusText}>Loading your intake interview…</p>
        </section>
      </main>
    );
  }

  if (!interview) {
    return (
      <main style={styles.page}>
        <section style={styles.statusCard}>
          {onBack && (
            <button style={styles.backButton} onClick={onBack} type="button">
              ← Back
            </button>
          )}
          <h1 style={styles.title}>We could not load the interview</h1>
          <p style={styles.subtitle}>Please go back and try starting guest check-in again.</p>
        </section>
      </main>
    );
  }

  if (interview.status === 'emergency_ack_required' && interview.emergencyAlert) {
    return (
      <main style={styles.page}>
        <section style={styles.alertCard}>
          {onBack && (
            <button style={styles.backButton} onClick={onBack} type="button">
              ← Back
            </button>
          )}
          <span style={styles.alertBadge}>Emergency Warning</span>
          <h1 style={styles.title}>{interview.emergencyAlert.title}</h1>
          <p style={styles.subtitle}>{interview.emergencyAlert.body}</p>
          <p style={styles.alertRecommendation}>{interview.emergencyAlert.recommendation}</p>
          <button style={styles.primaryButton} type="button" onClick={() => void handleEmergencyAcknowledge()} disabled={submitting}>
            {submitting ? 'Continuing…' : 'I understand, continue intake'}
          </button>
        </section>
      </main>
    );
  }

  if (interview.status === 'complete') {
    return (
      <main style={styles.page}>
        <section style={styles.statusCard}>
          {onBack && (
            <button style={styles.backButton} onClick={onBack} type="button">
              ← Back
            </button>
          )}
          <span style={styles.badge}>Interview Complete</span>
          <h1 style={styles.title}>Your intake summary is ready</h1>
          <p style={styles.subtitle}>
            We captured the key details needed before you choose a hospital.
          </p>
          {interview.summaryPreview && (
            <div style={styles.summaryCard}>
              <strong style={styles.summaryTitle}>Summary preview</strong>
              <p style={styles.summaryText}>{interview.summaryPreview}</p>
            </div>
          )}
          <button style={styles.primaryButton} type="button" onClick={onChooseHospital}>
            Choose hospital
          </button>
        </section>
      </main>
    );
  }

  if (!currentQuestion) {
    return (
      <main style={styles.page}>
        <section style={styles.statusCard}>
          <div style={styles.spinner} />
          <p style={styles.statusText}>Preparing the next question…</p>
        </section>
      </main>
    );
  }

  return (
    <QuestionPage
      step={Math.min(interview.askedCount + 1, interview.maxQuestions)}
      totalSteps={interview.maxQuestions}
      progressLabel={progressLabel}
      question={currentQuestion.prompt}
      description={currentQuestion.helpText || `Focused ${formatPhaseLabel(currentQuestion.phase)} question`}
      value={currentValue}
      onChange={setDraftText}
      onNext={() => void handleAdvance()}
      onBack={onBack}
      placeholder={currentQuestion.placeholder || ''}
      multiline={currentQuestion.inputType === 'textarea'}
      required={currentQuestion.required}
      nextLabel={submitting ? 'Saving…' : currentQuestion.publicId === 'safety_immediate_danger' ? 'Continue' : 'Next'}
      summary={buildQuestionSummary(currentQuestion)}
    >
      {renderQuestionInput(currentQuestion)}
    </QuestionPage>
  );
}

function buildAdvancePayload(
  question: InterviewQuestion,
  values: {
    draftText: string;
    draftNumber: string;
    draftBoolean: boolean | null;
    draftChoice: string;
  },
): AdvanceInterviewPayload {
  const payload: AdvanceInterviewPayload = {
    questionPublicId: question.publicId,
  };

  if (question.inputType === 'boolean') {
    payload.valueBoolean = values.draftBoolean ?? undefined;
    return payload;
  }

  if (question.inputType === 'number') {
    payload.valueNumber = values.draftNumber ? Number.parseInt(values.draftNumber, 10) : undefined;
    return payload;
  }

  if (question.inputType === 'single_select') {
    payload.valueChoice = values.draftChoice;
    return payload;
  }

  payload.valueText = values.draftText;
  return payload;
}

function formatPhaseLabel(phase: string): string {
  if (phase === 'urgent') return 'Urgent';
  if (phase === 'emergent') return 'Emergent';
  return 'History';
}

const sharedInput: React.CSSProperties = {
  width: '100%',
  border: panelBorder,
  borderRadius: patientTheme.radius.sm,
  background: '#fff',
  color: patientTheme.colors.ink,
  fontSize: '0.95rem',
  fontFamily: patientTheme.fonts.body,
  padding: '0.72rem 0.78rem',
  boxSizing: 'border-box',
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    background: heroBackdrop,
    padding: '1rem',
    fontFamily: patientTheme.fonts.body,
  },
  statusCard: {
    width: '100%',
    maxWidth: '620px',
    border: panelBorder,
    borderRadius: patientTheme.radius.xl,
    background: 'rgba(255, 253, 248, 0.98)',
    boxShadow: patientTheme.shadows.panel,
    padding: '1rem',
    display: 'grid',
    gap: '0.8rem',
  },
  alertCard: {
    width: '100%',
    maxWidth: '620px',
    border: '1px solid #fca5a5',
    borderRadius: patientTheme.radius.xl,
    background: 'rgba(255, 248, 248, 0.98)',
    boxShadow: '0 18px 42px rgba(220, 38, 38, 0.14)',
    padding: '1rem',
    display: 'grid',
    gap: '0.8rem',
    fontFamily: patientTheme.fonts.body,
  },
  spinner: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    border: '4px solid #dbe3f3',
    borderTopColor: patientTheme.colors.accent,
    animation: 'spin 0.9s linear infinite',
    justifySelf: 'center',
  },
  statusText: {
    margin: 0,
    textAlign: 'center',
    color: patientTheme.colors.inkMuted,
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    width: 'fit-content',
    border: panelBorder,
    borderRadius: '999px',
    background: '#e9f1ff',
    color: patientTheme.colors.accentStrong,
    padding: '0.28rem 0.72rem',
    fontSize: '0.74rem',
    fontWeight: 700,
  },
  alertBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    width: 'fit-content',
    border: '1px solid #fecaca',
    borderRadius: '999px',
    background: '#fee2e2',
    color: '#b91c1c',
    padding: '0.28rem 0.72rem',
    fontSize: '0.74rem',
    fontWeight: 700,
  },
  title: {
    margin: 0,
    fontFamily: patientTheme.fonts.heading,
    fontSize: '1.35rem',
    color: patientTheme.colors.ink,
  },
  subtitle: {
    margin: 0,
    color: patientTheme.colors.inkMuted,
    lineHeight: 1.5,
  },
  alertRecommendation: {
    margin: 0,
    color: '#7f1d1d',
    lineHeight: 1.45,
    fontWeight: 700,
  },
  primaryButton: {
    border: 'none',
    borderRadius: patientTheme.radius.sm,
    background: patientTheme.colors.accent,
    color: '#fff',
    padding: '0.75rem 0.92rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: patientTheme.fonts.body,
  },
  backButton: {
    border: 'none',
    background: 'none',
    color: patientTheme.colors.inkMuted,
    fontWeight: 600,
    fontSize: '0.84rem',
    cursor: 'pointer',
    padding: 0,
    justifySelf: 'start',
    fontFamily: patientTheme.fonts.body,
  },
  summaryCard: {
    border: panelBorder,
    borderRadius: patientTheme.radius.md,
    background: '#fff',
    padding: '0.75rem',
    display: 'grid',
    gap: '0.28rem',
  },
  summaryTitle: {
    color: patientTheme.colors.ink,
    fontSize: '0.88rem',
  },
  summaryText: {
    margin: 0,
    color: patientTheme.colors.inkMuted,
    lineHeight: 1.45,
  },
  optionGrid: {
    display: 'grid',
    gap: '0.55rem',
  },
  choiceButton: {
    border: panelBorder,
    borderRadius: patientTheme.radius.md,
    background: '#fff',
    color: patientTheme.colors.ink,
    padding: '0.82rem 0.86rem',
    textAlign: 'left',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: patientTheme.fonts.body,
  },
  choiceButtonSelected: {
    borderColor: patientTheme.colors.accent,
    boxShadow: '0 10px 24px rgba(25, 73, 184, 0.14)',
    background: '#eef5ff',
    color: patientTheme.colors.accentStrong,
  },
  input: sharedInput,
  textArea: {
    ...sharedInput,
    minHeight: '108px',
    resize: 'vertical',
  },
};
