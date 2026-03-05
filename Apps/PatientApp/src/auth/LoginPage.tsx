import { useState } from 'react';
import { useAuth } from '../shared/hooks/useAuth';
import { heroBackdrop, panelBorder, patientTheme } from '../shared/ui/theme';
import { useToast } from '../shared/ui/ToastContext';

interface LoginPageProps {
  onSwitchToSignup: () => void;
}

export function LoginPage({ onSwitchToSignup }: LoginPageProps) {
  const { login } = useAuth();
  const { showToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) {
      showToast('Please enter your email and password.');
      return;
    }

    setSubmitting(true);
    try {
      await login({ email: email.trim().toLowerCase(), password });
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <header style={styles.header}>
          <span style={styles.badge}>Sign In</span>
          <h1 style={styles.title}>Continue with your patient account</h1>
        </header>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.fieldLabel}>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              style={styles.input}
              autoComplete="email"
              autoFocus
              placeholder="patient@example.com"
            />
          </label>

          <label style={styles.fieldLabel}>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              style={styles.input}
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </label>

          <button style={styles.primaryButton} type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div style={styles.switchRow}>
          <span>Need an account?</span>
          <button style={styles.switchButton} onClick={onSwitchToSignup}>
            Create one
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
    padding: '1rem',
    display: 'grid',
    gap: '0.76rem',
  },
  header: {
    display: 'grid',
    gap: '0.3rem',
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
  title: {
    margin: 0,
    fontFamily: patientTheme.fonts.heading,
    fontSize: '1.3rem',
  },
  subtitle: {
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
    fontSize: '0.78rem',
    cursor: 'pointer',
    fontFamily: patientTheme.fonts.body,
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
    cursor: 'pointer',
    fontFamily: patientTheme.fonts.body,
  },
  seedCard: {
    border: panelBorder,
    borderRadius: patientTheme.radius.md,
    background: '#fff',
    padding: '0.72rem',
    display: 'grid',
    gap: '0.48rem',
  },
  seedTitle: {
    margin: 0,
    fontFamily: patientTheme.fonts.heading,
    fontSize: '0.93rem',
  },
  seedGrid: {
    display: 'grid',
    gap: '0.42rem',
  },
  seedButton: {
    border: panelBorder,
    borderRadius: patientTheme.radius.sm,
    background: '#fffdf8',
    padding: '0.55rem 0.62rem',
    textAlign: 'left',
    cursor: 'pointer',
    display: 'grid',
    gap: '0.12rem',
    fontFamily: patientTheme.fonts.body,
  },
  switchRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTop: panelBorder,
    paddingTop: '0.62rem',
    color: patientTheme.colors.inkMuted,
    fontSize: '0.84rem',
  },
  switchButton: {
    border: 'none',
    background: 'transparent',
    color: patientTheme.colors.accent,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: patientTheme.fonts.body,
  },
};
