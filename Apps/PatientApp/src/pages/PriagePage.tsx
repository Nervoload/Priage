import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { GuestChatbotPage } from '../features/pre-triage/GuestChatbotPage';
import { Routing } from '../features/pre-triage/Routing';
import { updateIntakeDetails } from '../shared/api/intake';
import { useAuth } from '../shared/hooks/useAuth';
import { heroBackdrop, panelBorder, patientTheme } from '../shared/ui/theme';
import { useToast } from '../shared/ui/ToastContext';

type IntakeStep = 'capture' | 'interview' | 'routing';

export function PriagePage() {
  const navigate = useNavigate();
  const { patient } = useAuth();
  const { showToast } = useToast();

  const [step, setStep] = useState<IntakeStep>('capture');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleStartInterview(event: React.FormEvent) {
    event.preventDefault();

    const trimmedChiefComplaint = chiefComplaint.trim();
    const trimmedDetails = details.trim();
    if (!trimmedChiefComplaint) {
      showToast('Please describe what brings you in before continuing.');
      return;
    }

    setSubmitting(true);
    try {
      await updateIntakeDetails({
        chiefComplaint: trimmedChiefComplaint,
        details: trimmedDetails || undefined,
        firstName: patient?.firstName ?? undefined,
        lastName: patient?.lastName ?? undefined,
        age: patient?.age ?? undefined,
        allergies: patient?.allergies ?? undefined,
        conditions: patient?.conditions ?? undefined,
      });
      setStep('interview');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not start this visit.');
    } finally {
      setSubmitting(false);
    }
  }

  if (step === 'interview') {
    return (
      <GuestChatbotPage
        mode="authenticated"
        onChooseHospital={() => setStep('routing')}
        onBack={() => setStep('capture')}
      />
    );
  }

  if (step === 'routing') {
    return (
      <Routing
        mode="authenticated"
        onConfirmed={(encounterId) => navigate(`/encounters/${encounterId}/current`)}
        onBack={() => setStep('interview')}
      />
    );
  }

  const displayName =
    [patient?.firstName, patient?.lastName].filter(Boolean).join(' ')
    || patient?.email
    || 'your account';

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <header style={styles.header}>
          <span style={styles.badge}>New Visit</span>
          <h1 style={styles.title}>Start check-in from your patient account</h1>
          <p style={styles.subtitle}>
            This uses the same guided intake flow as guest check-in, but keeps the visit attached to {displayName}.
          </p>
        </header>

        <div style={styles.profileCard}>
          <strong style={styles.profileTitle}>Using account details</strong>
          <p style={styles.profileText}>
            {displayName}
            {patient?.age != null ? `, age ${patient.age}` : ''}
            {patient?.phone ? `, ${patient.phone}` : ''}
          </p>
          {(patient?.allergies || patient?.conditions) && (
            <p style={styles.profileMeta}>
              {patient?.allergies ? `Allergies: ${patient.allergies}` : 'No allergies saved'}
              {patient?.conditions ? ` | Conditions: ${patient.conditions}` : ''}
            </p>
          )}
        </div>

        <form style={styles.form} onSubmit={handleStartInterview}>
          <label style={styles.fieldLabel}>
            What brings you in today? *
            <input
              value={chiefComplaint}
              onChange={(event) => setChiefComplaint(event.target.value)}
              style={styles.input}
              placeholder="e.g. Chest pain, ankle injury, shortness of breath"
              maxLength={240}
              autoFocus
            />
          </label>

          <label style={styles.fieldLabel}>
            Add a short description
            <textarea
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              style={styles.textArea}
              placeholder="When did it start? What feels worse? Anything important the care team should know before the interview?"
              maxLength={4000}
            />
          </label>

          <button style={styles.primaryButton} type="submit" disabled={submitting}>
            {submitting ? 'Preparing intake…' : 'Continue to guided intake'}
          </button>
        </form>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: 'calc(100vh - 72px)',
    padding: '1.15rem 1rem 6rem',
    background: heroBackdrop,
    fontFamily: patientTheme.fonts.body,
    color: patientTheme.colors.ink,
  },
  card: {
    width: '100%',
    maxWidth: '760px',
    margin: '0 auto',
    border: panelBorder,
    borderRadius: patientTheme.radius.xl,
    background: 'rgba(255, 253, 248, 0.98)',
    padding: '1.12rem',
    display: 'grid',
    gap: '1rem',
    boxShadow: '0 24px 58px -42px rgba(20,33,61,0.45)',
  },
  header: {
    display: 'grid',
    gap: '0.38rem',
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
    textTransform: 'uppercase',
  },
  title: {
    margin: 0,
    fontFamily: patientTheme.fonts.heading,
    fontSize: '1.5rem',
    letterSpacing: '-0.02em',
  },
  subtitle: {
    margin: 0,
    color: patientTheme.colors.inkMuted,
    lineHeight: 1.45,
    fontSize: '0.95rem',
  },
  profileCard: {
    border: panelBorder,
    borderRadius: patientTheme.radius.md,
    background: '#fffdf8',
    padding: '0.95rem 1rem',
    display: 'grid',
    gap: '0.25rem',
    boxShadow: '0 18px 42px -38px rgba(20,33,61,0.36)',
  },
  profileTitle: {
    fontSize: '0.72rem',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: patientTheme.colors.inkMuted,
  },
  profileText: {
    margin: 0,
    color: patientTheme.colors.ink,
    fontSize: '0.93rem',
    fontWeight: 600,
  },
  profileMeta: {
    margin: 0,
    color: patientTheme.colors.inkMuted,
    fontSize: '0.8rem',
    lineHeight: 1.4,
  },
  form: {
    display: 'grid',
    gap: '0.78rem',
  },
  fieldLabel: {
    display: 'grid',
    gap: '0.3rem',
    fontSize: '0.78rem',
    fontWeight: 700,
    color: patientTheme.colors.ink,
  },
  input: {
    border: panelBorder,
    borderRadius: patientTheme.radius.sm,
    background: '#fff',
    color: patientTheme.colors.ink,
    padding: '0.78rem 0.82rem',
    fontSize: '0.92rem',
    fontFamily: patientTheme.fonts.body,
    boxSizing: 'border-box',
    boxShadow: '0 10px 24px -22px rgba(20,33,61,0.5)',
  },
  textArea: {
    minHeight: '144px',
    resize: 'vertical' as const,
    border: panelBorder,
    borderRadius: patientTheme.radius.sm,
    background: '#fff',
    color: patientTheme.colors.ink,
    padding: '0.82rem',
    fontSize: '0.92rem',
    fontFamily: patientTheme.fonts.body,
    lineHeight: 1.5,
    boxSizing: 'border-box',
    boxShadow: '0 10px 24px -22px rgba(20,33,61,0.5)',
  },
  primaryButton: {
    border: 'none',
    borderRadius: patientTheme.radius.sm,
    background: patientTheme.colors.accent,
    color: '#fff',
    padding: '0.82rem 1.06rem',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 18px 36px -24px rgba(25,73,184,0.72)',
    transition: 'all 0.18s ease',
    fontFamily: patientTheme.fonts.body,
  },
};
