import { useState } from 'react';
import { useAuth } from '../shared/hooks/useAuth';
import { heroBackdrop, panelBorder, patientTheme } from '../shared/ui/theme';
import { useToast } from '../shared/ui/ToastContext';

interface LoginPageProps {
  onSwitchToSignup: () => void;
  onBack?: () => void;
}

export function LoginPage({ onSwitchToSignup, onBack }: LoginPageProps) {
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
      {onBack && (
        <button style={styles.backButton} onClick={onBack} type="button">
          ← Back
        </button>
      )}

      <div style={styles.splitLayout}>
        {/* Left: Value Proposition */}
        <section style={styles.valueSection}>
          <div style={styles.valueBrand}>
            <span style={styles.logoPill}>PRIAGE PATIENT</span>
            <h1 style={styles.heroTitle}>Welcome back</h1>
            <p style={styles.heroSubtitle}>
              Your health info is saved. Future visits take seconds, not minutes.
            </p>
          </div>

          <div style={styles.benefitsGrid}>
            <div style={styles.benefitCard}>
              <span style={styles.benefitIcon}>⚡</span>
              <div>
                <strong style={styles.benefitTitle}>30-Second Check-Ins</strong>
                <p style={styles.benefitText}>Your demographics are pre-filled. Just describe what brings you in.</p>
              </div>
            </div>
            <div style={styles.benefitCard}>
              <span style={styles.benefitIcon}>📋</span>
              <div>
                <strong style={styles.benefitTitle}>Visit History</strong>
                <p style={styles.benefitText}>Access all past visits, triage results, and care-team messages.</p>
              </div>
            </div>
            <div style={styles.benefitCard}>
              <span style={styles.benefitIcon}>💊</span>
              <div>
                <strong style={styles.benefitTitle}>Health Profile</strong>
                <p style={styles.benefitText}>Allergies, medications, and conditions auto-fill every intake form.</p>
              </div>
            </div>
            <div style={styles.benefitCard}>
              <span style={styles.benefitIcon}>📡</span>
              <div>
                <strong style={styles.benefitTitle}>Live Updates</strong>
                <p style={styles.benefitText}>Real-time queue position, status changes, and care-team messaging.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Right: Login Form */}
        <section style={styles.formSection}>
          <div style={styles.formCard}>
            <header style={styles.formHeader}>
              <span style={styles.badge}>Sign In</span>
              <h2 style={styles.formTitle}>Continue with your patient account</h2>
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

            <div style={styles.divider}>
              <span style={styles.dividerText}>or</span>
            </div>

            <div style={styles.altActions}>
              <button style={styles.switchButton} onClick={onSwitchToSignup}>
                Create a new account
              </button>
              {onBack && (
                <button style={styles.guestLink} onClick={onBack}>
                  Use guest check-in instead
                </button>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

const sharedInput: React.CSSProperties = {
  width: '100%',
  border: panelBorder,
  borderRadius: patientTheme.radius.sm,
  background: '#fff',
  color: patientTheme.colors.ink,
  padding: '0.82rem 0.86rem',
  fontSize: '0.92rem',
  fontFamily: patientTheme.fonts.body,
  boxSizing: 'border-box',
  boxShadow: '0 10px 24px -22px rgba(20,33,61,0.5)',
  transition: 'border-color 0.15s ease',
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: heroBackdrop,
    padding: '1rem',
    fontFamily: patientTheme.fonts.body,
    color: patientTheme.colors.ink,
  },
  backButton: {
    border: 'none',
    background: 'none',
    color: patientTheme.colors.inkMuted,
    fontWeight: 600,
    fontSize: '0.84rem',
    cursor: 'pointer',
    padding: '0.3rem 0',
    fontFamily: patientTheme.fonts.body,
    alignSelf: 'flex-start',
    marginBottom: '0.5rem',
  },
  splitLayout: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
    gap: '1.5rem',
    alignItems: 'center',
    maxWidth: '1060px',
    margin: '0 auto',
    width: '100%',
  },

  // ── Left: Value ──
  valueSection: {
    display: 'grid',
    gap: '1.4rem',
    padding: '0.5rem 0',
  },
  valueBrand: {
    display: 'grid',
    gap: '0.5rem',
  },
  logoPill: {
    display: 'inline-flex',
    alignItems: 'center',
    width: 'fit-content',
    border: panelBorder,
    borderRadius: '999px',
    background: '#e9f1ff',
    color: patientTheme.colors.accentStrong,
    padding: '0.34rem 0.78rem',
    fontSize: '0.65rem',
    fontWeight: 800,
    letterSpacing: '0.12em',
  },
  heroTitle: {
    margin: 0,
    fontFamily: patientTheme.fonts.heading,
    fontSize: 'clamp(1.7rem, 3.5vw, 2.4rem)',
    letterSpacing: '-0.03em',
    lineHeight: 1.1,
  },
  heroSubtitle: {
    margin: 0,
    color: patientTheme.colors.inkMuted,
    fontSize: '1.02rem',
    lineHeight: 1.5,
    maxWidth: '420px',
  },
  benefitsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.72rem',
  },
  benefitCard: {
    display: 'flex',
    gap: '0.62rem',
    padding: '0.82rem 0.78rem',
    border: panelBorder,
    borderRadius: patientTheme.radius.md,
    background: 'rgba(255, 253, 248, 0.85)',
    boxShadow: '0 14px 32px -28px rgba(20,33,61,0.28)',
    transition: 'transform 0.18s ease, box-shadow 0.18s ease',
  },
  benefitIcon: {
    fontSize: '1.35rem',
    lineHeight: 1,
    flexShrink: 0,
    marginTop: '2px',
  },
  benefitTitle: {
    display: 'block',
    fontSize: '0.82rem',
    fontWeight: 700,
    letterSpacing: '-0.01em',
    marginBottom: '0.15rem',
  },
  benefitText: {
    margin: 0,
    fontSize: '0.76rem',
    color: patientTheme.colors.inkMuted,
    lineHeight: 1.4,
  },

  // ── Right: Form ──
  formSection: {
    display: 'flex',
    justifyContent: 'center',
  },
  formCard: {
    width: '100%',
    maxWidth: '420px',
    border: panelBorder,
    borderRadius: patientTheme.radius.xl,
    background: 'rgba(255, 253, 248, 0.98)',
    padding: '1.3rem',
    display: 'grid',
    gap: '0.92rem',
    boxShadow: '0 28px 64px -42px rgba(20,33,61,0.5)',
  },
  formHeader: {
    display: 'grid',
    gap: '0.35rem',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    width: 'fit-content',
    border: panelBorder,
    borderRadius: '999px',
    background: '#e9f1ff',
    color: patientTheme.colors.accentStrong,
    padding: '0.34rem 0.78rem',
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
  },
  formTitle: {
    margin: 0,
    fontFamily: patientTheme.fonts.heading,
    fontSize: '1.28rem',
    letterSpacing: '-0.02em',
  },
  form: {
    display: 'grid',
    gap: '0.76rem',
  },
  fieldLabel: {
    display: 'grid',
    gap: '0.3rem',
    fontSize: '0.75rem',
    fontWeight: 700,
    color: patientTheme.colors.ink,
  },
  input: sharedInput,
  primaryButton: {
    border: 'none',
    borderRadius: patientTheme.radius.sm,
    background: 'linear-gradient(135deg, #1949b8 0%, #2156d1 100%)',
    color: '#fff',
    padding: '0.86rem 1rem',
    fontWeight: 700,
    fontSize: '0.94rem',
    cursor: 'pointer',
    boxShadow: '0 18px 36px -24px rgba(25,73,184,0.72)',
    transition: 'all 0.18s ease',
    fontFamily: patientTheme.fonts.body,
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.7rem',
  },
  dividerText: {
    flex: 1,
    textAlign: 'center' as const,
    fontSize: '0.76rem',
    color: patientTheme.colors.inkMuted,
    fontWeight: 600,
    position: 'relative' as const,
  },
  altActions: {
    display: 'grid',
    gap: '0.5rem',
  },
  switchButton: {
    border: panelBorder,
    borderRadius: patientTheme.radius.sm,
    background: '#fff',
    color: patientTheme.colors.ink,
    padding: '0.72rem 0.86rem',
    fontWeight: 700,
    fontSize: '0.88rem',
    cursor: 'pointer',
    fontFamily: patientTheme.fonts.body,
    transition: 'all 0.15s ease',
  },
  guestLink: {
    border: 'none',
    background: 'transparent',
    color: patientTheme.colors.accent,
    fontWeight: 600,
    fontSize: '0.82rem',
    cursor: 'pointer',
    padding: '0.3rem 0',
    fontFamily: patientTheme.fonts.body,
    textAlign: 'center' as const,
  },
};
