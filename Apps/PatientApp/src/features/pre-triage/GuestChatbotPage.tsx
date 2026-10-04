import { useEffect, useMemo, useState } from 'react';

import { advanceInterview, startInterview } from '../../shared/api/intake';
import { friendlyError } from '../../shared/api/errors';
import { useGuestSession } from '../../shared/hooks/useGuestSession';
import type { AdvanceInterviewPayload, InterviewQuestion, InterviewState } from '../../shared/types/domain';
import { ChoiceList } from '../../shared/ui/ChoiceList';
import { CtaButton, CtaLink, LoadingScreen } from '../../shared/ui/Controls';
import { FlowScreen } from '../../shared/ui/FlowScreen';
import { Icon } from '../../shared/ui/Icon';
import { useToast } from '../../shared/ui/ToastContext';
import { QuestionPage } from './QuestionPage';

interface GuestChatbotPageProps {
  onChooseHospital: () => void;
  onBack?: () => void;
  mode?: 'guest' | 'authenticated' | 'clinic';
  startInterviewFn?: () => Promise<InterviewState>;
  advanceInterviewFn?: (payload: AdvanceInterviewPayload) => Promise<InterviewState>;
  chiefComplaint?: string | null;
  completion?: { badge: string; title: string; description: string; actionLabel: string };
  /** Flow step counter; pass null when the assessment is the whole flow. */
  counter?: string | null;
}

const SAFETY_QUESTION_ID = 'safety_immediate_danger';

export function GuestChatbotPage({
  onChooseHospital,
  onBack,
  mode = 'guest',
  startInterviewFn = startInterview,
  advanceInterviewFn = advanceInterview,
  chiefComplaint,
  completion,
  counter = 'Step 2 of 3',
}: GuestChatbotPageProps) {
  const { session } = useGuestSession();
  const { showToast } = useToast();

  const [interview, setInterview] = useState<InterviewState | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
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
        const state = await startInterviewFn();
        if (!cancelled) {
          setInterview(state);
        }
      } catch (error) {
        if (!cancelled) {
          showToast(friendlyError(error, 'We couldn’t load your questions.'));
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
  }, [showToast, startInterviewFn, reloadKey]);

  useEffect(() => {
    setDraftText('');
    setDraftNumber('');
    setDraftBoolean(null);
    setDraftChoice('');
  }, [currentQuestion?.publicId]);

  const progressLabel = useMemo(() => {
    if (!interview) {
      return '';
    }
    if (currentQuestion?.publicId === SAFETY_QUESTION_ID) {
      return 'Safety check';
    }
    const number = Math.min(interview.askedCount + 1, interview.maxQuestions);
    return `Question ${number} of up to ${interview.maxQuestions}`;
  }, [currentQuestion?.publicId, interview]);

  // The assessment is step two of three; fill the middle third as questions are answered.
  const progress = useMemo(() => {
    if (!interview) return 34;
    const ratio = Math.min(interview.askedCount / Math.max(interview.maxQuestions, 1), 1);
    return 34 + ratio * 32;
  }, [interview]);

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

  function renderChoices(question: InterviewQuestion, labelledBy: string, options: string[], selected: (choice: string) => boolean, onPick: (choice: string) => void) {
    return <ChoiceList name={`question-${question.publicId}`} labelledBy={labelledBy} options={options} selected={options.find(selected) ?? null} onPick={onPick} />;
  }

  function renderQuestionInput(question: InterviewQuestion, labelledBy: string) {
    if (question.inputType === 'boolean') {
      return renderChoices(
        question,
        labelledBy,
        ['Yes', 'No'],
        (choice) => (choice === 'Yes' && draftBoolean === true) || (choice === 'No' && draftBoolean === false),
        (choice) => setDraftBoolean(choice === 'Yes'),
      );
    }

    if (question.inputType === 'single_select') {
      return renderChoices(question, labelledBy, question.choices, (choice) => draftChoice === choice, setDraftChoice);
    }

    if (question.inputType === 'number' && isZeroToTenScale(question)) {
      const groupName = `question-${question.publicId}`;
      return (
        <div>
          <fieldset className="scale" aria-labelledby={labelledBy}>
            {Array.from({ length: 11 }, (_, value) => String(value)).map((value) => (
              <label key={value} className="slot">
                <input type="radio" name={groupName} value={value} checked={draftNumber === value} onChange={() => setDraftNumber(value)} />
                {value}
              </label>
            ))}
          </fieldset>
          <div className="scale__ends" aria-hidden="true"><span>None</span><span>Worst imaginable</span></div>
        </div>
      );
    }

    if (question.inputType === 'number') {
      return (
        <input
          className="input"
          aria-labelledby={labelledBy}
          value={draftNumber}
          onChange={(event) => setDraftNumber(event.target.value.replace(/[^\d]/g, ''))}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && draftNumber) {
              event.preventDefault();
              void handleAdvance();
            }
          }}
          inputMode="numeric"
          placeholder={question.placeholder || 'Enter a number'}
          autoFocus
        />
      );
    }

    if (question.inputType === 'textarea') {
      return (
        <textarea
          className="input"
          aria-labelledby={labelledBy}
          value={draftText}
          onChange={(event) => setDraftText(event.target.value)}
          placeholder={question.placeholder || ''}
          rows={4}
          autoFocus
        />
      );
    }

    return null;
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
      const nextState = await advanceInterviewFn(payload);
      setInterview(nextState);
    } catch (error) {
      showToast(friendlyError(error, 'We couldn’t save your answer. Please try again.'));
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
      const nextState = await advanceInterviewFn({ action: 'acknowledge_emergency' });
      setInterview(nextState);
    } catch (error) {
      showToast(friendlyError(error, 'We couldn’t continue. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <LoadingScreen full label="Preparing your questions…" />;
  }

  if (!interview) {
    return (
      <FlowScreen title="Assessment" onBack={onBack} label="Assessment unavailable">
        <div className="stack stack--sm">
          <h1 className="display">We couldn’t load your questions</h1>
          <p className="lede">
            {mode === 'authenticated'
              ? 'Check your connection and try again. Your visit details are saved.'
              : mode === 'clinic'
                ? 'Check your connection and try again, or reopen this clinic visit.'
                : 'Check your connection and try again. If it keeps happening, start your check-in again.'}
          </p>
        </div>
        <div>
          <button type="button" className="btn btn--secondary" onClick={() => setReloadKey((key) => key + 1)}>
            Try again
          </button>
        </div>
      </FlowScreen>
    );
  }

  if (interview.status === 'emergency_ack_required' && interview.emergencyAlert) {
    return (
      <FlowScreen
        tone="white"
        title="Safety check"
        onBack={onBack}
        label="Safety check"
        footer={(
          <>
            <CtaLink href="tel:911" tone="danger" icon="phone">Call 911</CtaLink>
            <button type="button" className="btn btn--quiet btn--block" onClick={() => void handleEmergencyAcknowledge()} disabled={submitting}>
              {submitting ? 'Continuing…' : 'I understand — continue'}
            </button>
          </>
        )}
      >
        <div className="stack stack--lg" style={{ paddingTop: 12 }}>
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: 22, background: 'var(--red-bg)', color: 'var(--red)' }}>
            <Icon name="alertTriangle" size={30} />
          </span>
          <h1 className="display">{interview.emergencyAlert.title}</h1>
          <p className="lede">{interview.emergencyAlert.body}</p>
          {interview.emergencyAlert.recommendation && (
            <p className="notice">
              <Icon name="info" size={18} />
              <span>{interview.emergencyAlert.recommendation}</span>
            </p>
          )}
          <p className="small">This message is based on your answers. It isn’t a diagnosis, and no one has reviewed it yet.</p>
        </div>
      </FlowScreen>
    );
  }

  if (interview.status === 'complete') {
    const summaryText = interview.summaryPreview || chiefComplaint || session?.chiefComplaint;
    return (
      <FlowScreen
        title="Assessment"
        counter={counter ?? undefined}
        progress={66}
        onBack={onBack}
        label="Assessment complete"
        footer={<CtaButton onClick={onChooseHospital}>{completion?.actionLabel || 'Choose where to go'}</CtaButton>}
      >
        <div className="stack stack--lg" style={{ paddingTop: 12 }}>
          <div className="stack stack--sm">
            <h1 className="display">{completion?.title || 'Your answers are ready'}</h1>
            <p className="lede">{completion?.description || 'Next, choose where you’d like to receive care. They’ll see your answers right away.'}</p>
          </div>
          {summaryText && (
            <div className="card card--pad stack stack--sm">
              <span className="label">{interview.summaryPreview ? 'Summary for the clinic' : 'What you told us'}</span>
              <p className="body" style={{ color: 'var(--ink)' }}>{summaryText}</p>
              {interview.summaryPreview && <p className="small">Created from your answers. The clinic reviews it before your visit.</p>}
            </div>
          )}
        </div>
      </FlowScreen>
    );
  }

  if (!currentQuestion) {
    return <LoadingScreen full label="Preparing the next question…" />;
  }

  const customInput = currentQuestion.inputType !== 'text';

  return (
    <QuestionPage
      step={Math.min(interview.askedCount + 1, interview.maxQuestions)}
      totalSteps={interview.maxQuestions}
      title="Assessment"
      counter={progressLabel || counter || undefined}
      progress={progress}
      questionKey={currentQuestion.publicId}
      question={currentQuestion.prompt}
      description={currentQuestion.helpText}
      why={currentQuestion.clinicalReason}
      value={currentValue}
      onChange={setDraftText}
      onNext={() => void handleAdvance()}
      onBack={onBack}
      placeholder={currentQuestion.placeholder || ''}
      multiline={currentQuestion.inputType === 'textarea'}
      required
      busy={submitting}
      nextLabel={submitting ? 'Saving…' : 'Continue'}
      footerNote={(
        <span className="flow__note">
          <Icon name="check" size={15} style={{ color: 'var(--green)' }} />
          Your answers are saved as you go
        </span>
      )}
    >
      {customInput ? (labelledBy: string) => renderQuestionInput(currentQuestion, labelledBy) : undefined}
    </QuestionPage>
  );
}

// Rating questions arrive as plain numbers; render the common 0–10 pain or
// severity scale as tappable steps instead of a free-text box.
function isZeroToTenScale(question: InterviewQuestion): boolean {
  return /^\s*0\s*[-–to]+\s*10\s*$/i.test(question.placeholder ?? '') || /\b0 (?:to|-|–) 10\b/.test(question.prompt);
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
