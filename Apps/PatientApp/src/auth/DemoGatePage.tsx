import { useState } from 'react';
import { heroBackdrop, panelBorder, patientTheme } from '../shared/ui/theme';

interface DemoGatePageProps {
  onVerify: (code: string) => Promise<void>;
  error: string | null;
}

export function DemoGatePage({ onVerify, error }: DemoGatePageProps) {
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onVerify(code.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <header style={styles.header}>
          <span style={styles.badge}>Demo Access</span>
          <h1 style={styles.title}>Priage</h1>
          <p style={styles.subtitle}>Enter your access code to continue</p>
        </header>

        <form onSubmit={handleSubmit} style={styles.form}>
          {error && (
            <div style={styles.errorBox}>{error}</div>
          )}

          <label style={styles.fieldLabel}>
            Access Code
            <input
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              style={styles.input}
              autoFocus
              placeholder="Enter demo access code"
              required
            />
          </label>

          <button
            style={{
              ...styles.primaryButton,
              opacity: submitting || !code.trim() ? 0.6 : 1,
              cursor: submitting || !code.trim() ? 'not-allowed' : 'pointer',
            }}
            type="submit"
            disabled={submitting || !code.trim()}
          >
            {submitting ? 'Verifying…' : 'Continue'}
          </button>
        </form>
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
  padding: '0.68rem 0.74rem',
  fontSize: '0.92rem',
  fontFamily: patientTheme.fonts.body,
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
  card: {
    width: '100%',
    maxWidth: '560px',
    border: panelBorder,
    borderRadius: patientTheme.radius.xl,
    background: 'rgba(255, 253, 248, 0.98)',
    boxShadow: patientTheme.shadows.panel,
    padding: '1.5rem',
    display: 'grid',
    gap: '1rem',
  },
  header: {
    display: 'grid',
    gap: '0.3rem',
    textAlign: 'center',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifySelf: 'center',
    width: 'fit-content',
    border: panelBorder,
    borderRadius: '999px',
    background: '#e9f1ff',
    color: patientTheme.colors.accentStrong,
    padding: '0.28rem 0.72rem',
    fontSize: '0.74rem',
    fontWeight: 700,
  },
  title: {
    margin: 0,
    fontFamily: patientTheme.fonts.heading,
    fontSize: '2rem',
    color: patientTheme.colors.accent,
  },
  subtitle: {
    margin: 0,
    color: patientTheme.colors.inkMuted,
    lineHeight: 1.45,
    fontSize: '0.9rem',
  },
  form: {
    display: 'grid',
    gap: '0.68rem',
  },
  fieldLabel: {
    display: 'grid',
    gap: '0.3rem',
    fontSize: '0.8rem',
    fontWeight: 700,
    color: patientTheme.colors.ink,
  },
  input: sharedInput,
  primaryButton: {
    border: 'none',
    borderRadius: patientTheme.radius.sm,
    background: patientTheme.colors.accent,
    color: '#fff',
    padding: '0.72rem 0.9rem',
    fontWeight: 700,
    fontFamily: patientTheme.fonts.body,
    fontSize: '0.92rem',
  },
  errorBox: {
    border: `1px solid ${patientTheme.colors.danger}`,
    borderRadius: patientTheme.radius.sm,
    background: '#fef2f2',
    color: patientTheme.colors.danger,
    padding: '0.55rem 0.74rem',
    fontSize: '0.84rem',
  },
};
