// PatientApp/src/app/Login.tsx
// Patient intake entry screen.
// Step 1: Patient provides name + chief complaint → createIntent (public).
// Step 2: On success, saves session and hands off to the pre-triage flow.

import { useState } from 'react';
import type { PatientSession } from '../shared/types/domain';
import { createIntent } from '../shared/api/encounters';
import { useToast } from '../shared/ui/ToastContext';

interface LoginProps {
  onSessionCreated: (session: PatientSession) => void;
}

export function Login({ onSessionCreated }: LoginProps) {
  const { showToast } = useToast();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!chiefComplaint.trim()) {
      showToast('Please describe what brings you in today.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await createIntent({
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        chiefComplaint: chiefComplaint.trim(),
      });

      const session: PatientSession = {
        sessionToken: result.sessionToken,
        patientId: result.patientId,
        encounterId: result.encounterId,
        hospitalSlug: null,
      };

      localStorage.setItem('patientSession', JSON.stringify(session));
      onSessionCreated(session);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.logo}>Priage</h1>
          <p style={styles.subtitle}>Emergency Room Check-In</p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.row}>
            <label style={styles.label}>
              First Name
              <input
                style={styles.input}
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="John"
                autoComplete="given-name"
              />
            </label>
            <label style={styles.label}>
              Last Name
              <input
                style={styles.input}
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                placeholder="Doe"
                autoComplete="family-name"
              />
            </label>
          </div>

          <label style={styles.label}>
            What brings you in today? <span style={{ color: '#ef4444' }}>*</span>
            <textarea
              style={{ ...styles.input, minHeight: '80px', resize: 'vertical' }}
              value={chiefComplaint}
              onChange={e => setChiefComplaint(e.target.value)}
              placeholder="e.g. chest pain, broken arm, high fever..."
              required
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            style={{
              ...styles.button,
              opacity: submitting ? 0.6 : 1,
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Starting check-in...' : 'Start Check-In'}
          </button>
        </form>

        <p style={styles.footer}>
          Your information is secure and will only be shared with your care team.
        </p>
      </div>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
    padding: '1rem',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  card: {
    background: '#fff',
    borderRadius: '16px',
    padding: '2rem',
    maxWidth: '440px',
    width: '100%',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  header: {
    textAlign: 'center',
    marginBottom: '1.5rem',
  },
  logo: {
    fontSize: '2rem',
    fontWeight: 800,
    color: '#1e3a5f',
    margin: 0,
    letterSpacing: '-0.5px',
  },
  subtitle: {
    color: '#64748b',
    fontSize: '0.9rem',
    margin: '0.25rem 0 0',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.75rem',
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#334155',
  },
  input: {
    padding: '0.65rem 0.75rem',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    fontSize: '0.9rem',
    outline: 'none',
    fontFamily: 'inherit',
  },
  button: {
    padding: '0.75rem',
    backgroundColor: '#1e3a5f',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '1rem',
    fontWeight: 600,
    marginTop: '0.5rem',
  },
  footer: {
    textAlign: 'center',
    fontSize: '0.75rem',
    color: '#94a3b8',
    marginTop: '1rem',
  },
};
