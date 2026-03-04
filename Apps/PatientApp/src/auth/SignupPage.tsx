import { useEffect, useState } from 'react';

import { useAuth } from '../shared/hooks/useAuth';
import { useDemo } from '../shared/demo';
import { heroBackdrop, panelBorder, patientTheme } from '../shared/ui/theme';
import { useToast } from '../shared/ui/ToastContext';

interface SignupPageProps {
  onSwitchToLogin: () => void;
}

export function SignupPage({ onSwitchToLogin }: SignupPageProps) {
  const { register } = useAuth();
  const { showToast } = useToast();
  const { selectedScenario } = useDemo();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function applyDemoDefaults() {
    const defaults = selectedScenario.signupDefaults;
    if (!defaults) {
      showToast('No signup defaults for this scenario.');
      return;
    }
    setFirstName(defaults.firstName);
    setLastName(defaults.lastName);
    setEmail(defaults.email);
    setPhone(defaults.phone);
    setPassword(defaults.password);
    setConfirmPassword(defaults.password);
  }

  function clearFields() {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setPassword('');
    setConfirmPassword('');
  }

  useEffect(() => {
    if (firstName || lastName || email || phone || password || confirmPassword) {
      return;
    }
    applyDemoDefaults();
    // Autofill defaults on scenario changes for demo speed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedScenario.id]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!email.trim()) {
      showToast('Please enter your email.');
      return;
    }
    if (password.length < 6) {
      showToast('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      showToast('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await register({
        email: email.trim().toLowerCase(),
        password,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        phone: phone.trim() || undefined,
      });
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <header style={styles.header}>
          <span style={styles.badge}>Create Account</span>
          <h1 style={styles.title}>Set up your patient profile</h1>
          <p style={styles.subtitle}>
            Scenario defaults are editable and optimized for fast demo walkthroughs.
          </p>
        </header>

        <div style={styles.presetRow}>
          <button type="button" style={styles.secondaryButton} onClick={applyDemoDefaults}>
            Use demo defaults
          </button>
          <button type="button" style={styles.secondaryButton} onClick={clearFields}>
            Clear
          </button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.twoCol}>
            <label style={styles.fieldLabel}>
              First name
              <input
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                style={styles.input}
                autoComplete="given-name"
              />
            </label>
            <label style={styles.fieldLabel}>
              Last name
              <input
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                style={styles.input}
                autoComplete="family-name"
              />
            </label>
          </div>

          <label style={styles.fieldLabel}>
            Email *
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              style={styles.input}
              autoComplete="email"
              required
            />
          </label>

          <label style={styles.fieldLabel}>
            Phone
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              style={styles.input}
              autoComplete="tel"
            />
          </label>

          <label style={styles.fieldLabel}>
            Password *
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              style={styles.input}
              autoComplete="new-password"
              required
            />
          </label>

          <label style={styles.fieldLabel}>
            Confirm password *
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              style={styles.input}
              autoComplete="new-password"
              required
            />
          </label>

          <button style={styles.primaryButton} type="submit" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <div style={styles.switchRow}>
          <span>Already have an account?</span>
          <button style={styles.switchButton} onClick={onSwitchToLogin}>
            Sign in
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
    maxWidth: '580px',
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
    fontSize: '0.9rem',
    lineHeight: 1.45,
  },
  presetRow: {
    display: 'flex',
    gap: '0.45rem',
    flexWrap: 'wrap',
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
  twoCol: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.5rem',
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
