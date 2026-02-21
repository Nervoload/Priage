// PatientApp/src/features/pre-triage/Routing.tsx
// Routing/hospital selection step.
// Patient selects which hospital they're heading to, then we confirm the intent.

import { useState } from 'react';
import { confirmIntent } from '../../shared/api/encounters';
import { useToast } from '../../shared/ui/ToastContext';
import type { PatientSession, Encounter } from '../../shared/types/domain';

interface RoutingProps {
  session: PatientSession;
  onConfirmed: (encounter: Encounter, updatedSession: PatientSession) => void;
}

export function Routing({ session, onConfirmed }: RoutingProps) {
  const { showToast } = useToast();
  const [hospitalSlug, setHospitalSlug] = useState(session.hospitalSlug ?? '');
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    if (!hospitalSlug.trim()) {
      showToast('Please enter a hospital name or code.');
      return;
    }

    setSubmitting(true);
    try {
      const encounter = await confirmIntent({ hospitalSlug: hospitalSlug.trim() });

      const updatedSession: PatientSession = {
        ...session,
        encounterId: encounter.id,
        hospitalSlug: hospitalSlug.trim(),
      };
      localStorage.setItem('patientSession', JSON.stringify(updatedSession));
      onConfirmed(encounter, updatedSession);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not confirm. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Where are you heading?</h2>
      <p style={styles.subtitle}>
        Enter the hospital code or name so we can notify them you&apos;re on your way.
      </p>

      <input
        style={styles.input}
        value={hospitalSlug}
        onChange={e => setHospitalSlug(e.target.value)}
        placeholder="e.g. general-hospital"
        autoFocus
        onKeyDown={e => {
          if (e.key === 'Enter' && !submitting) handleConfirm();
        }}
      />

      <button
        style={{
          ...styles.button,
          opacity: submitting ? 0.6 : 1,
          cursor: submitting ? 'not-allowed' : 'pointer',
        }}
        onClick={handleConfirm}
        disabled={submitting}
      >
        {submitting ? 'Notifying hospital...' : 'Notify Hospital'}
      </button>

      <p style={styles.hint}>
        The ER team will see your information and prepare for your arrival.
      </p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    padding: '1.5rem',
    maxWidth: '500px',
    margin: '0 auto',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  heading: {
    fontSize: '1.3rem',
    fontWeight: 700,
    color: '#0f172a',
    margin: 0,
  },
  subtitle: {
    fontSize: '0.9rem',
    color: '#64748b',
    margin: 0,
    lineHeight: 1.5,
  },
  input: {
    padding: '0.75rem',
    border: '1px solid #cbd5e1',
    borderRadius: '10px',
    fontSize: '1rem',
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
  },
  hint: {
    fontSize: '0.8rem',
    color: '#94a3b8',
    textAlign: 'center',
    margin: 0,
  },
};
