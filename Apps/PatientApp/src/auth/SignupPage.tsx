import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { getMe } from '../shared/api/auth';
import { useAuth } from '../shared/hooks/useAuth';
import { useGuestSession } from '../shared/hooks/useGuestSession';
import { heroBackdrop, panelBorder, patientTheme } from '../shared/ui/theme';
import { useToast } from '../shared/ui/ToastContext';

interface SignupPageProps {
  onSwitchToLogin: () => void;
  onBack?: () => void;
}

export function SignupPage({ onSwitchToLogin, onBack }: SignupPageProps) {
  const { register, upgradeFromGuest } = useAuth();
  const { session: guestSession, clearSession: clearGuestSession } = useGuestSession();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const isGuestUpgrade = searchParams.get('mode') === 'guest-upgrade' && !!guestSession;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [allergies, setAllergies] = useState('');
  const [conditions, setConditions] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [prefilling, setPrefilling] = useState(isGuestUpgrade);

  useEffect(() => {
    if (!isGuestUpgrade) {
      setPrefilling(false);
      return;
    }

    let cancelled = false;

    async function loadPrefill() {
      try {
        const profile = await getMe();
        if (cancelled) return;
        setFirstName(profile.firstName ?? guestSession?.firstName ?? '');
        setLastName(profile.lastName ?? guestSession?.lastName ?? '');
        setPhone(profile.phone ?? '');
        setAge(profile.age != null ? String(profile.age) : guestSession?.age != null ? String(guestSession.age) : '');
        setGender(profile.gender ?? guestSession?.gender ?? '');
        setAllergies(profile.allergies ?? '');
        setConditions(profile.conditions ?? '');
      } catch {
        if (cancelled) return;
        setFirstName(guestSession?.firstName ?? '');
        setLastName(guestSession?.lastName ?? '');
        setAge(guestSession?.age != null ? String(guestSession.age) : '');
        setGender(guestSession?.gender ?? '');
      } finally {
        if (!cancelled) {
          setPrefilling(false);
        }
      }
    }

    void loadPrefill();
    return () => {
      cancelled = true;
    };
  }, [guestSession, isGuestUpgrade]);

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
      const normalizedEmail = email.trim().toLowerCase();
      const normalizedFirstName = firstName.trim() || undefined;
      const normalizedLastName = lastName.trim() || undefined;
      const normalizedPhone = phone.trim() || undefined;

      if (isGuestUpgrade) {
        await upgradeFromGuest({
          email: normalizedEmail,
          password,
          firstName: normalizedFirstName,
          lastName: normalizedLastName,
          phone: normalizedPhone,
          age: age ? parseInt(age, 10) : undefined,
          gender: gender.trim() || undefined,
          allergies: allergies.trim() || undefined,
          conditions: conditions.trim() || undefined,
        });
        clearGuestSession();
      } else {
        await register({
          email: normalizedEmail,
          password,
          firstName: normalizedFirstName,
          lastName: normalizedLastName,
          phone: normalizedPhone,
        });
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        {onBack && (
          <button style={styles.backButton} onClick={onBack} type="button">
            ← Back
          </button>
        )}
        <header style={styles.header}>
          <span style={styles.badge}>{isGuestUpgrade ? 'Secure Your Visit' : 'Create Account'}</span>
          <h1 style={styles.title}>{isGuestUpgrade ? 'Create your password to save this visit' : 'Set up your patient profile'}</h1>
          {isGuestUpgrade && (
            <p style={styles.subtitle}>
              We&apos;ll keep this encounter attached to your current patient record and prefill the details we already have.
            </p>
          )}
        </header>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.twoCol}>
            <label style={styles.fieldLabel}>
              First name
              <input
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                style={styles.input}
                autoComplete="given-name"
                disabled={submitting || prefilling}
              />
            </label>
            <label style={styles.fieldLabel}>
              Last name
              <input
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                style={styles.input}
                autoComplete="family-name"
                disabled={submitting || prefilling}
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
              disabled={submitting}
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
              disabled={submitting || prefilling}
            />
          </label>

          {isGuestUpgrade && (
            <>
              <div style={styles.twoCol}>
                <label style={styles.fieldLabel}>
                  Age
                  <input
                    type="number"
                    value={age}
                    onChange={(event) => setAge(event.target.value)}
                    style={styles.input}
                    min={0}
                    disabled={submitting || prefilling}
                  />
                </label>
                <label style={styles.fieldLabel}>
                  Gender
                  <input
                    value={gender}
                    onChange={(event) => setGender(event.target.value)}
                    style={styles.input}
                    disabled={submitting || prefilling}
                  />
                </label>
              </div>

              <label style={styles.fieldLabel}>
                Allergies
                <input
                  value={allergies}
                  onChange={(event) => setAllergies(event.target.value)}
                  style={styles.input}
                  disabled={submitting || prefilling}
                />
              </label>

              <label style={styles.fieldLabel}>
                Conditions
                <input
                  value={conditions}
                  onChange={(event) => setConditions(event.target.value)}
                  style={styles.input}
                  disabled={submitting || prefilling}
                />
              </label>
            </>
          )}

          <label style={styles.fieldLabel}>
            Password *
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              style={styles.input}
              autoComplete="new-password"
              disabled={submitting}
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
              disabled={submitting}
              required
            />
          </label>

          <button style={styles.primaryButton} type="submit" disabled={submitting}>
            {submitting ? (isGuestUpgrade ? 'Securing account…' : 'Creating account…') : (isGuestUpgrade ? 'Save this visit to my account' : 'Create account')}
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
  backButton: {
    border: 'none',
    background: 'none',
    color: patientTheme.colors.inkMuted,
    fontWeight: 600,
    fontSize: '0.84rem',
    cursor: 'pointer',
    padding: '0.2rem 0',
    fontFamily: patientTheme.fonts.body,
    justifySelf: 'start',
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
