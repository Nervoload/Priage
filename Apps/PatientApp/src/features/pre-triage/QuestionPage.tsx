import { useId, type ReactNode } from 'react';

import { CtaButton, Disclosure } from '../../shared/ui/Controls';
import { cx } from '../../shared/ui/cx';
import { FlowScreen } from '../../shared/ui/FlowScreen';

interface QuestionPageProps {
  step: number;
  totalSteps: number;
  progressLabel?: string;
  question: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  onNext: () => void;
  onBack?: () => void;
  placeholder?: string;
  multiline?: boolean;
  children?: ReactNode | ((labelledBy: string) => ReactNode);
  required?: boolean;
  nextLabel?: string;
  chips?: string[];
  onChipSelect?: (value: string) => void;
  summary?: ReactNode;
  onClear?: () => void;
  /** Header title, e.g. "Assessment". */
  title?: string;
  /** Flow step position such as "Step 2 of 3". */
  counter?: string;
  /** Overrides the progress derived from step/totalSteps. */
  progress?: number;
  /** Why the care team asks this question. */
  why?: string;
  busy?: boolean;
  /** Changes when the question changes so the content can rise into place. */
  questionKey?: string;
  footerNote?: ReactNode;
}

export function QuestionPage({
  step,
  totalSteps,
  progressLabel,
  question,
  description,
  value,
  onChange,
  onNext,
  onBack,
  placeholder = '',
  multiline = false,
  children,
  required = false,
  nextLabel = 'Continue',
  chips,
  onChipSelect,
  summary,
  onClear,
  title = 'Assessment',
  counter,
  progress,
  why,
  busy = false,
  questionKey,
  footerNote,
}: QuestionPageProps) {
  const headingId = useId();
  const canAdvance = !required || value.trim().length > 0;

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Enter' && !multiline && canAdvance && !busy) {
      event.preventDefault();
      onNext();
    }
  }

  const input = typeof children === 'function'
    ? children(headingId)
    : children ?? (
      multiline ? (
        <textarea
          className="input"
          aria-labelledby={headingId}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={4}
          autoFocus
        />
      ) : (
        <input
          className="input"
          aria-labelledby={headingId}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          onKeyDown={handleKeyDown}
          autoFocus
        />
      )
    );

  return (
    <FlowScreen
      title={title}
      counter={counter}
      progress={progress ?? (step / Math.max(totalSteps, 1)) * 100}
      onBack={onBack}
      label={title}
      footer={(
        <>
          <CtaButton onClick={onNext} disabled={!canAdvance || busy} busy={busy}>
            {nextLabel}
          </CtaButton>
          {footerNote}
        </>
      )}
    >
      <div key={questionKey ?? question} className="stack stack--lg question-stage">
        <div className="stack stack--sm reveal">
          {progressLabel && <span className="counter">{progressLabel}</span>}
          <h1 id={headingId} className={cx('display display--question', question.length > 72 && 'display--question-long')}>{question}</h1>
          {description && <p className="lede">{description}</p>}
        </div>

        <div className="reveal">{input}</div>

        {chips && chips.length > 0 && (
          <div className="cluster reveal">
            {chips.map((chip) => (
              <button key={chip} type="button" className="btn btn--secondary btn--sm" onClick={() => onChipSelect?.(chip)}>
                {chip}
              </button>
            ))}
          </div>
        )}

        {why && (
          <div className="reveal">
            <Disclosure label="Why we ask">
              <p className="body">{why}</p>
            </Disclosure>
          </div>
        )}

        {summary && <aside className="notice reveal">{summary}</aside>}

        {onClear && (
          <div className="reveal">
            <button type="button" className="text-btn text-btn--muted" onClick={onClear}>Clear answer</button>
          </div>
        )}
      </div>
    </FlowScreen>
  );
}
