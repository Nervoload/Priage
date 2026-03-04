// PatientApp/src/features/pre-triage/QuestionPage.tsx
// Reusable single-question step for the pre-triage wizard.

import type { ReactNode } from 'react';

interface QuestionPageProps {
  /** Question number for progress display */
  step: number;
  totalSteps: number;
  /** The question text */
  question: string;
  /** Current answer value */
  value: string;
  /** Called when answer changes */
  onChange: (value: string) => void;
  /** Move to next step */
  onNext: () => void;
  /** Move to previous step */
  onBack?: () => void;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Use textarea instead of single-line input */
  multiline?: boolean;
  /** Custom input element instead of text */
  children?: ReactNode;
  /** Whether "Next" requires a non-empty value */
  required?: boolean;
  /** Label for the next button */
  nextLabel?: string;
}

export function QuestionPage({
  step,
  totalSteps,
  question,
  value,
  onChange,
  onNext,
  onBack,
  placeholder = '',
  multiline = false,
  children,
  required = false,
  nextLabel = 'Next',
}: QuestionPageProps) {
  const canAdvance = !required || value.trim().length > 0;

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !multiline && canAdvance) {
      e.preventDefault();
      onNext();
    }
  }

  return (
    <div style={styles.container}>
      {/* Progress bar */}
      <div style={styles.progressTrack}>
        <div
          style={{
            ...styles.progressFill,
            width: `${(step / totalSteps) * 100}%`,
          }}
        />
      </div>

      <p style={styles.stepLabel}>
        Step {step} of {totalSteps}
      </p>

      <h2 style={styles.question}>{question}</h2>

      {children ?? (
        multiline ? (
          <textarea
            style={{ ...styles.input, minHeight: '100px', resize: 'vertical' }}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            autoFocus
          />
        ) : (
          <input
            style={styles.input}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        )
      )}

      <div style={styles.buttons}>
        {onBack && (
          <button style={styles.backBtn} onClick={onBack} type="button">
            Back
          </button>
        )}
        <button
          style={{
            ...styles.nextBtn,
            opacity: canAdvance ? 1 : 0.5,
            cursor: canAdvance ? 'pointer' : 'not-allowed',
          }}
          onClick={onNext}
          disabled={!canAdvance}
          type="button"
        >
          {nextLabel}
        </button>
      </div>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
    padding: '1.5rem',
    maxWidth: '500px',
    margin: '0 auto',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  progressTrack: {
    height: '6px',
    borderRadius: '3px',
    background: '#e2e8f0',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: '#3b82f6',
    borderRadius: '3px',
    transition: 'width 0.3s ease',
  },
  stepLabel: {
    fontSize: '0.8rem',
    color: '#94a3b8',
    margin: 0,
  },
  question: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#0f172a',
    margin: 0,
    lineHeight: 1.3,
  },
  input: {
    padding: '0.75rem',
    border: '1px solid #cbd5e1',
    borderRadius: '10px',
    fontSize: '1rem',
    fontFamily: 'inherit',
    outline: 'none',
  },
  buttons: {
    display: 'flex',
    gap: '0.75rem',
    marginTop: '0.5rem',
  },
  backBtn: {
    padding: '0.7rem 1.25rem',
    background: '#f1f5f9',
    border: '1px solid #cbd5e1',
    borderRadius: '10px',
    fontSize: '0.9rem',
    fontWeight: 600,
    color: '#475569',
    cursor: 'pointer',
  },
  nextBtn: {
    flex: 1,
    padding: '0.7rem 1.25rem',
    background: '#1e3a5f',
    border: 'none',
    borderRadius: '10px',
    fontSize: '0.9rem',
    fontWeight: 600,
    color: '#fff',
  },
};
