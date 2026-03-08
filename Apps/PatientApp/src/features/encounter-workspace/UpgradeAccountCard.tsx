import { useEffect, useState, type CSSProperties } from 'react';

import { getMe } from '../../shared/api/auth';
import { useAuth } from '../../shared/hooks/useAuth';
import { useGuestSession } from '../../shared/hooks/useGuestSession';
import { panelBorder, patientTheme } from '../../shared/ui/theme';
import { useToast } from '../../shared/ui/ToastContext';

export function UpgradeAccountCard() {
  const { upgradeFromGuest } = useAuth();
  const { session: guestSession, clearSession: clearGuestSession } = useGuestSession();
  const { showToast } = useToast();

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
  const [expanded, setExpanded] = useState(false);
  const [prefilled, setPrefilled] = useState(false);

  // Autofill from guest profile when expanding
  useEffect(() => {
    if (!expanded || prefilled || !guestSession) return;
    let cancelled = false;

    async function loadProfile() {
      try {
        const profile = await getMe();
        if (cancelled) return;
        setFirstName(profile.firstName ?? '');
        setLastName(profile.lastName ?? '');
        setPhone(profile.phone ?? '');
        setAge(profile.age != null ? String(profile.age) : '');
        setGender(profile.gender ?? '');
        setAllergies(profile.allergies ?? '');
        setConditions(profile.conditions ?? '');
        setPrefilled(true);
      } catch {
        // Guest token might not work for getMe — ignore
      }
    }
    void loadProfile();
    return () => { cancelled = true; };
  }, [expanded, prefilled, guestSession]);

  if (!guestSession) return null;

  async function handleUpgrade() {
    if (!email.trim() || !password.trim()) {
      showToast('Email and password are required.');
      return;
    }
    if (password !== confirmPassword) {
      showToast('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      showToast('Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      await upgradeFromGuest({
        email: email.trim(),
        password,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        phone: phone.trim() || undefined,
        age: age ? parseInt(age, 10) : undefined,
        gender: gender.trim() || undefined,
        allergies: allergies.trim() || undefined,
        conditions: conditions.trim() || undefined,
      });
      clearGuestSession();
      showToast('Account created! Your visit data is preserved.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not create account.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!expanded) {
    return (
      <article style={styles.card}>
        <div style={styles.collapsedRow}>
          <div>
            <h3 style={styles.cardTitle}>Create an Account</h3>
            <p style={styles.cardSubtitle}>
              Save your visit history and access all features by setting up a free account.
            </p>
          </div>
          <button style={styles.ctaButton} onClick={() => setExpanded(true)}>
            Create Account
          </button>
        </div>
      </article>
    );
  }

  return (
    <article style={styles.card}>
      <header style={styles.cardHeader}>
        <h3 style={styles.cardTitle}>Create Your Account</h3>
        <p style={styles.cardSubtitle}>
          Your current visit and all messages will be linked to your new account.
        </p>
      </header>

      <div style={styles.fieldStack}>
        <div style={styles.twoCol}>
          <label style={styles.fieldLabel}>
            First name
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              style={styles.input}
              disabled={submitting}
              autoComplete="given-name"
            />
          </label>
          <label style={styles.fieldLabel}>
            Last name
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              style={styles.input}
              disabled={submitting}
              autoComplete="family-name"
            />
          </label>
        </div>

        <label style={styles.fieldLabel}>
          Email *
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={styles.input}
            disabled={submitting}
            autoComplete="email"
          />
        </label>

        <label style={styles.fieldLabel}>
          Phone
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(555) 123-4567"
            style={styles.input}
            disabled={submitting}
            autoComplete="tel"
          />
        </label>

        <div style={styles.twoCol}>
          <label style={styles.fieldLabel}>
            Age
            <input
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="e.g. 39"
              style={styles.input}
              disabled={submitting}
              min={0}
            />
          </label>
          <label style={styles.fieldLabel}>
            Gender
            <input
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              placeholder="e.g. Male, Female"
              style={styles.input}
              disabled={submitting}
            />
          </label>
        </div>

        <label style={styles.fieldLabel}>
          Allergies
          <input
            value={allergies}
            onChange={(e) => setAllergies(e.target.value)}
            placeholder="e.g. penicillin, peanuts, or none"
            style={styles.input}
            disabled={submitting}
          />
        </label>

        <label style={styles.fieldLabel}>
          Conditions
          <input
            value={conditions}
            onChange={(e) => setConditions(e.target.value)}
            placeholder="e.g. asthma, diabetes, or none"
            style={styles.input}
            disabled={submitting}
          />
        </label>

        <div style={styles.divider} />

        <label style={styles.fieldLabel}>
          Password *
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            style={styles.input}
            disabled={submitting}
            autoComplete="new-password"
          />
        </label>

        <label style={styles.fieldLabel}>
          Confirm Password *
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter password"
            style={styles.input}
            disabled={submitting}
            autoComplete="new-password"
          />
        </label>
      </div>

      <div style={styles.buttonRow}>
        <button
          style={styles.primaryButton}
          onClick={handleUpgrade}
          disabled={submitting}
        >
          {submitting ? 'Creating account…' : 'Create Account'}
        </button>
        <button
          style={styles.secondaryButton}
          onClick={() => setExpanded(false)}
          disabled={submitting}
        >
          Cancel
        </button>
      </div>
    </article>
  );
}

const sharedInput: CSSProperties = {
  width: '100%',
  border: panelBorder,
  borderRadius: patientTheme.radius.sm,
  background: '#fff',
  color: patientTheme.colors.ink,
  fontSize: '0.94rem',
  padding: '0.68rem 0.74rem',
  fontFamily: patientTheme.fonts.body,
  boxSizing: 'border-box',
};

const styles: Record<string, CSSProperties> = {
  card: {
    background: 'linear-gradient(135deg, #f0f7ff 0%, #fffdf8 100%)',
    border: '1px solid #bfdbfe',
    borderRadius: patientTheme.radius.md,
    padding: '0.95rem',
    boxShadow: patientTheme.shadows.card,
  },
  collapsedRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  cardHeader: {
    marginBottom: '0.75rem',
  },
  cardTitle: {
    margin: 0,
    fontFamily: patientTheme.fonts.heading,
    fontSize: '1rem',
    color: patientTheme.colors.ink,
  },
  cardSubtitle: {
    margin: '0.2rem 0 0',
    color: patientTheme.colors.inkMuted,
    fontSize: '0.86rem',
    lineHeight: 1.4,
  },
  fieldStack: {
    display: 'grid',
    gap: '0.65rem',
  },
  twoCol: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.55rem',
  },
  divider: {
    height: '1px',
    background: '#e2e8f0',
    margin: '0.2rem 0',
  },
  fieldLabel: {
    display: 'grid',
    gap: '0.35rem',
    fontSize: '0.82rem',
    fontWeight: 700,
    color: patientTheme.colors.ink,
  },
  input: sharedInput,
  buttonRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.55rem',
    marginTop: '0.85rem',
  },
  primaryButton: {
    border: 'none',
    borderRadius: patientTheme.radius.sm,
    padding: '0.65rem 1.1rem',
    background: patientTheme.colors.accent,
    color: '#fff',
    fontWeight: 700,
    fontFamily: patientTheme.fonts.body,
    fontSize: '0.9rem',
    cursor: 'pointer',
  },
  secondaryButton: {
    border: panelBorder,
    borderRadius: patientTheme.radius.sm,
    padding: '0.65rem 0.95rem',
    background: '#fff',
    color: patientTheme.colors.ink,
    fontWeight: 700,
    fontFamily: patientTheme.fonts.body,
    fontSize: '0.9rem',
    cursor: 'pointer',
  },
  ctaButton: {
    border: 'none',
    borderRadius: patientTheme.radius.sm,
    padding: '0.6rem 1rem',
    background: patientTheme.colors.accent,
    color: '#fff',
    fontWeight: 700,
    fontFamily: patientTheme.fonts.body,
    fontSize: '0.85rem',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
};
