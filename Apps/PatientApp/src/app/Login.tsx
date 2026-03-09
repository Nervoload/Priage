import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { createIntent } from '../shared/api/intake';
import { useGuestSession } from '../shared/hooks/useGuestSession';
import { heroBackdrop, panelBorder, patientTheme } from '../shared/ui/theme';
import { useToast } from '../shared/ui/ToastContext';

export function Login() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { setSession } = useGuestSession();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!firstName.trim()) {
      showToast('Please enter your first name.');
      return;
    }
    if (!phone.trim()) {
      showToast('Please enter your phone number.');
      return;
    }
    if (!chiefComplaint.trim()) {
      showToast('Please describe what brings you in today.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await createIntent({
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        phone: phone.trim(),
        chiefComplaint: chiefComplaint.trim(),
      });

      setSession({
        sessionToken: result.sessionToken,
        patientId: result.patientId,
        encounterId: result.encounterId,
        hospitalSlug: null,
      });
      navigate('/guest/routing');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not start guest check-in.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <button style={styles.backButton} onClick={() => navigate('/welcome')} type="button">
          ← Back
        </button>
        <header style={styles.header}>
          <span style={styles.badge}>Guest Check-In</span>
          <h1 style={styles.title}>Fast emergency intake</h1>
          <p style={styles.subtitle}>
            Tell us what brings you in. Your information will be shared with the hospital care team.
          </p>
        </header>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.twoCol}>
            <label style={styles.fieldLabel}>
              First name *
              <input
                style={styles.input}
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                autoComplete="given-name"
                placeholder="First name"
              />
            </label>
            <label style={styles.fieldLabel}>
              Phone number *
              <input
                style={styles.input}
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                autoComplete="tel"
                inputMode="tel"
                placeholder="(555) 123-4567"
              />
            </label>
          </div>

          <label style={styles.fieldLabel}>
            Last name
            <input
              style={styles.input}
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              autoComplete="family-name"
              placeholder="Last name"
            />
          </label>

          <label style={styles.fieldLabel}>
            What brings you in today? *
            <textarea
              style={styles.textArea}
              value={chiefComplaint}
              onChange={(event) => setChiefComplaint(event.target.value)}
              placeholder="Describe the main concern and how quickly it changed."
              required
            />
          </label>

          <button style={styles.primaryButton} type="submit" disabled={submitting}>
            {submitting ? 'Starting check-in…' : 'Choose hospital'}
          </button>
        </form>

        <footer style={styles.footer}>
          <strong>What happens next:</strong> choose your hospital, notify the care team, then fill in any optional health details while you are on the way.
        </footer>
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
  padding: '0.67rem 0.74rem',
  fontSize: '0.92rem',
  fontFamily: patientTheme.fonts.body,
  boxSizing: 'border-box',
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    padding: '1rem',
    background: heroBackdrop,
    fontFamily: patientTheme.fonts.body,
  },
  card: {
    width: '100%',
    maxWidth: '620px',
    border: panelBorder,
    borderRadius: patientTheme.radius.xl,
    background: 'rgba(255, 253, 248, 0.98)',
    boxShadow: patientTheme.shadows.panel,
    padding: '1rem',
    display: 'grid',
    gap: '0.82rem',
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
    fontSize: '1.35rem',
  },
  subtitle: {
    margin: 0,
    fontSize: '0.9rem',
    lineHeight: 1.45,
    color: patientTheme.colors.inkMuted,
  },
  scenarioSummary: {
    border: panelBorder,
    borderRadius: patientTheme.radius.md,
    background: '#fff',
    padding: '0.75rem',
  },
  summaryTitle: {
    margin: 0,
    fontSize: '0.9rem',
    fontFamily: patientTheme.fonts.heading,
  },
  summaryBody: {
    margin: '0.3rem 0 0',
    color: patientTheme.colors.inkMuted,
    fontSize: '0.86rem',
    lineHeight: 1.45,
  },
  summaryFoot: {
    margin: '0.35rem 0 0',
    color: patientTheme.colors.ink,
    fontSize: '0.82rem',
  },
  presetRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.45rem',
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
    gap: '0.32rem',
    fontSize: '0.8rem',
    fontWeight: 700,
    color: patientTheme.colors.ink,
  },
  input: sharedInput,
  textArea: {
    ...sharedInput,
    minHeight: '88px',
    resize: 'vertical',
  },
  primaryButton: {
    border: 'none',
    borderRadius: patientTheme.radius.sm,
    background: patientTheme.colors.accent,
    color: '#fff',
    fontWeight: 700,
    fontSize: '0.92rem',
    padding: '0.74rem 0.9rem',
    cursor: 'pointer',
    fontFamily: patientTheme.fonts.body,
  },
  secondaryButton: {
    border: panelBorder,
    borderRadius: patientTheme.radius.sm,
    background: '#fff',
    color: patientTheme.colors.ink,
    padding: '0.48rem 0.74rem',
    fontWeight: 700,
    fontSize: '0.8rem',
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
  footer: {
    borderTop: panelBorder,
    paddingTop: '0.65rem',
    color: patientTheme.colors.inkMuted,
    fontSize: '0.81rem',
    lineHeight: 1.45,
  },
};
