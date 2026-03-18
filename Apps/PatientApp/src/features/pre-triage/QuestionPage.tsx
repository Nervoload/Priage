import type { ReactNode } from 'react';

import { panelBorder, patientTheme } from '../../shared/ui/theme';

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
  children?: ReactNode;
  required?: boolean;
  nextLabel?: string;
  chips?: string[];
  onChipSelect?: (value: string) => void;
  summary?: ReactNode;
  onClear?: () => void;
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
  nextLabel = 'Next',
  chips,
  onChipSelect,
  summary,
  onClear,
}: QuestionPageProps) {
  const canAdvance = !required || value.trim().length > 0;

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Enter' && !multiline && canAdvance) {
      event.preventDefault();
      onNext();
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <header style={styles.header}>
          <p style={styles.stepLabel}>{progressLabel ?? `Step ${step} of ${totalSteps}`}</p>
          <div style={styles.progressTrack}>
            <div style={{ ...styles.progressFill, width: `${(step / totalSteps) * 100}%` }} />
          </div>
          <h1 style={styles.question}>{question}</h1>
          {description && <p style={styles.description}>{description}</p>}
          {onClear && (
            <div style={styles.presetRow}>
              <button type="button" style={styles.secondaryButton} onClick={onClear}>
                Clear
              </button>
            </div>
          )}
        </header>

        {children ?? (
          multiline ? (
            <textarea
              style={styles.textArea}
              value={value}
              onChange={(event) => onChange(event.target.value)}
              placeholder={placeholder}
              autoFocus
            />
          ) : (
            <input
              style={styles.input}
              value={value}
              onChange={(event) => onChange(event.target.value)}
              placeholder={placeholder}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          )
        )}

        {chips && chips.length > 0 && (
          <div style={styles.chips}>
            {chips.map((chip) => (
              <button
                key={chip}
                type="button"
                style={styles.chip}
                onClick={() => onChipSelect?.(chip)}
              >
                {chip}
              </button>
            ))}
          </div>
        )}

        {summary && (
          <aside style={styles.summaryCard}>{summary}</aside>
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
              opacity: canAdvance ? 1 : 0.48,
              cursor: canAdvance ? 'pointer' : 'not-allowed',
            }}
            onClick={onNext}
            disabled={!canAdvance}
            type="button"
          >
            {nextLabel}
          </button>
        </div>
      </section>
    </main>
  );
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
    background: 'linear-gradient(180deg, #f7f3ea 0%, #fffdf8 56%, #f2f6fd 100%)',
    padding: '1rem',
    fontFamily: patientTheme.fonts.body,
  },
  card: {
    width: '100%',
    maxWidth: '620px',
    border: panelBorder,
    borderRadius: patientTheme.radius.xl,
    background: 'rgba(255, 253, 248, 0.96)',
    boxShadow: patientTheme.shadows.panel,
    padding: '1rem',
    display: 'grid',
    gap: '0.75rem',
  },
  header: {
    display: 'grid',
    gap: '0.36rem',
  },
  stepLabel: {
    margin: 0,
    color: patientTheme.colors.inkMuted,
    fontSize: '0.8rem',
    fontWeight: 700,
  },
  progressTrack: {
    height: '7px',
    borderRadius: '999px',
    overflow: 'hidden',
    background: '#e8e2d3',
  },
  progressFill: {
    height: '100%',
    background: patientTheme.colors.accent,
    borderRadius: '999px',
    transition: 'width 0.24s ease',
  },
  question: {
    margin: '0.1rem 0 0',
    fontFamily: patientTheme.fonts.heading,
    fontSize: '1.3rem',
    lineHeight: 1.22,
  },
  description: {
    margin: 0,
    color: patientTheme.colors.inkMuted,
    lineHeight: 1.45,
    fontSize: '0.9rem',
  },
  presetRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.45rem',
  },
  secondaryButton: {
    border: panelBorder,
    borderRadius: patientTheme.radius.sm,
    background: '#fff',
    color: patientTheme.colors.ink,
    padding: '0.45rem 0.72rem',
    fontWeight: 700,
    fontSize: '0.77rem',
    cursor: 'pointer',
    fontFamily: patientTheme.fonts.body,
  },
  input: sharedInput,
  textArea: {
    ...sharedInput,
    minHeight: '96px',
    resize: 'vertical',
  },
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.44rem',
  },
  chip: {
    border: '1px solid #b8d0ff',
    borderRadius: '999px',
    background: '#eef5ff',
    color: patientTheme.colors.accentStrong,
    padding: '0.28rem 0.66rem',
    fontSize: '0.76rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: patientTheme.fonts.body,
  },
  summaryCard: {
    border: panelBorder,
    borderRadius: patientTheme.radius.md,
    background: '#fff',
    padding: '0.65rem 0.72rem',
    fontSize: '0.84rem',
    color: patientTheme.colors.inkMuted,
    lineHeight: 1.45,
  },
  buttons: {
    display: 'flex',
    gap: '0.55rem',
  },
  backBtn: {
    border: panelBorder,
    borderRadius: patientTheme.radius.sm,
    background: '#fff',
    color: patientTheme.colors.inkMuted,
    fontWeight: 700,
    padding: '0.68rem 0.95rem',
    cursor: 'pointer',
    fontFamily: patientTheme.fonts.body,
  },
  nextBtn: {
    border: 'none',
    borderRadius: patientTheme.radius.sm,
    background: patientTheme.colors.accent,
    color: '#fff',
    fontWeight: 700,
    padding: '0.68rem 0.95rem',
    flex: 1,
    fontFamily: patientTheme.fonts.body,
  },
};
