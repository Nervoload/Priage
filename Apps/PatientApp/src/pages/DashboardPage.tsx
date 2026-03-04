import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { listMyEncounters } from '../shared/api/encounters';
import { ENCOUNTER_STATUS_META, isActiveEncounter } from '../shared/encounters';
import { useDemo } from '../shared/demo';
import { useAuth } from '../shared/hooks/useAuth';
import { useGuestSession } from '../shared/hooks/useGuestSession';
import type { EncounterSummary } from '../shared/types/domain';
import { heroBackdrop, panelBorder, patientTheme } from '../shared/ui/theme';
import { useToast } from '../shared/ui/ToastContext';

export function DashboardPage() {
  const navigate = useNavigate();
  const { patient, logout } = useAuth();
  const { clearSession } = useGuestSession();
  const { showToast } = useToast();
  const { selectedScenario } = useDemo();
  const [encounters, setEncounters] = useState<EncounterSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [restarting, setRestarting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await listMyEncounters();
        if (!cancelled) {
          setEncounters(data);
        }
      } catch {
        if (!cancelled) {
          showToast('Could not load visit summary.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  const [activeEncounter, pastEncounters] = useMemo(() => {
    const active = encounters.find((encounter) => isActiveEncounter(encounter.status)) ?? null;
    const past = encounters.filter((encounter) => !isActiveEncounter(encounter.status)).slice(0, 3);
    return [active, past];
  }, [encounters]);

  const displayName = patient?.firstName || patient?.email?.split('@')[0] || 'Patient';

  async function handleRestartDemo() {
    if (restarting) return;
    setRestarting(true);
    try {
      await logout().catch(() => undefined);
      clearSession();
      navigate('/welcome', { replace: true });
    } finally {
      setRestarting(false);
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div style={styles.heroTop}>
          <span style={styles.badge}>Patient Home</span>
          <button style={styles.restartButton} onClick={handleRestartDemo} disabled={restarting}>
            {restarting ? 'Restarting…' : 'Restart Demo'}
          </button>
        </div>
        <h1 style={styles.title}>Welcome back, {displayName}</h1>
        <p style={styles.subtitle}>
          {loading
            ? 'Loading your visit summary...'
            : 'Use this dashboard to start new visits, review care updates, and prepare for your hospital arrival.'}
        </p>
      </section>

      <section style={styles.section}>
        <article style={styles.heroCard}>
          <h2 style={styles.heroCardTitle}>Start New Visit</h2>
          <p style={styles.heroCardText}>
            Launch the Priage intake assistant with prefilled demo prompts from <strong>{selectedScenario.label}</strong>.
          </p>
          <button style={styles.primaryButton} onClick={() => navigate('/priage')}>
            Start New Visit
          </button>
        </article>
      </section>

      {activeEncounter && (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Active Visit</h2>
          <button style={styles.visitCard} onClick={() => navigate(`/encounters/${activeEncounter.id}/current`)}>
            <div>
              <strong style={styles.visitTitle}>{activeEncounter.chiefComplaint || 'Visit in progress'}</strong>
              <p style={styles.visitMeta}>
                Opened {new Date(activeEncounter.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </p>
            </div>
            <span
              style={{
                ...styles.statusPill,
                color: ENCOUNTER_STATUS_META[activeEncounter.status].color,
                background: ENCOUNTER_STATUS_META[activeEncounter.status].bg,
                borderColor: ENCOUNTER_STATUS_META[activeEncounter.status].border,
              }}
            >
              {ENCOUNTER_STATUS_META[activeEncounter.status].shortLabel}
            </span>
          </button>
        </section>
      )}

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Quick Actions</h2>
        <div style={styles.grid}>
          <button style={styles.quickCard} onClick={() => navigate('/messages')}>
            <strong>Messages</strong>
            <span>Open all care-team conversations</span>
          </button>
          <button style={styles.quickCard} onClick={() => navigate('/settings')}>
            <strong>Profile & Settings</strong>
            <span>Update demographics and preferences</span>
          </button>
          <button style={styles.quickCard} onClick={() => navigate('/priage')}>
            <strong>AI Assessment</strong>
            <span>Prefilled symptom prompts for demo speed</span>
          </button>
        </div>
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Recent Visits</h2>
        {pastEncounters.length === 0 ? (
          <p style={styles.mutedText}>No past visits available yet.</p>
        ) : (
          <div style={styles.pastStack}>
            {pastEncounters.map((encounter) => (
              <button
                key={encounter.id}
                style={styles.pastCard}
                onClick={() => navigate(`/encounters/${encounter.id}/current`)}
              >
                <strong style={styles.pastTitle}>{encounter.chiefComplaint || 'Visit record'}</strong>
                <span style={styles.pastMeta}>
                  {new Date(encounter.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: 'calc(100vh - 64px)',
    padding: '1rem 1rem 5.5rem',
    background: heroBackdrop,
    fontFamily: patientTheme.fonts.body,
    color: patientTheme.colors.ink,
  },
  hero: {
    maxWidth: '760px',
    margin: '0 auto 0.95rem',
  },
  heroTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.65rem',
    flexWrap: 'wrap',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.3rem 0.72rem',
    borderRadius: '999px',
    border: panelBorder,
    background: '#e9f1ff',
    color: patientTheme.colors.accentStrong,
    fontSize: '0.74rem',
    fontWeight: 700,
  },
  restartButton: {
    border: '1px solid #fecaca',
    borderRadius: patientTheme.radius.sm,
    background: '#fff1f2',
    color: '#9f1239',
    fontWeight: 700,
    fontSize: '0.76rem',
    padding: '0.45rem 0.7rem',
    cursor: 'pointer',
    fontFamily: patientTheme.fonts.body,
  },
  title: {
    margin: '0.72rem 0 0',
    fontFamily: patientTheme.fonts.heading,
    fontSize: '1.5rem',
  },
  subtitle: {
    margin: '0.35rem 0 0',
    color: patientTheme.colors.inkMuted,
    lineHeight: 1.45,
  },
  section: {
    maxWidth: '760px',
    margin: '0 auto 0.95rem',
  },
  heroCard: {
    border: panelBorder,
    borderRadius: patientTheme.radius.lg,
    background: '#fffdf8',
    boxShadow: patientTheme.shadows.panel,
    padding: '1rem',
  },
  heroCardTitle: {
    margin: 0,
    fontFamily: patientTheme.fonts.heading,
    fontSize: '1.1rem',
  },
  heroCardText: {
    margin: '0.35rem 0 0',
    color: patientTheme.colors.inkMuted,
    lineHeight: 1.45,
  },
  primaryButton: {
    marginTop: '0.85rem',
    border: 'none',
    borderRadius: patientTheme.radius.sm,
    padding: '0.72rem 1rem',
    background: patientTheme.colors.accent,
    color: '#fff',
    fontWeight: 700,
    fontFamily: patientTheme.fonts.body,
    cursor: 'pointer',
  },
  sectionTitle: {
    margin: '0 0 0.5rem',
    fontFamily: patientTheme.fonts.heading,
    fontSize: '0.95rem',
    textTransform: 'uppercase',
    letterSpacing: '0.02em',
    color: patientTheme.colors.inkMuted,
  },
  visitCard: {
    border: panelBorder,
    borderRadius: patientTheme.radius.md,
    background: '#fffdf8',
    boxShadow: patientTheme.shadows.card,
    width: '100%',
    textAlign: 'left',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.8rem',
    padding: '0.82rem 0.9rem',
    cursor: 'pointer',
    fontFamily: patientTheme.fonts.body,
  },
  visitTitle: {
    display: 'block',
    fontSize: '0.94rem',
  },
  visitMeta: {
    margin: '0.25rem 0 0',
    fontSize: '0.79rem',
    color: patientTheme.colors.inkMuted,
  },
  statusPill: {
    border: '1px solid',
    borderRadius: '999px',
    padding: '0.22rem 0.58rem',
    fontSize: '0.7rem',
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '0.55rem',
  },
  quickCard: {
    border: panelBorder,
    borderRadius: patientTheme.radius.md,
    background: '#fffdf8',
    boxShadow: patientTheme.shadows.card,
    padding: '0.72rem 0.75rem',
    textAlign: 'left',
    display: 'grid',
    gap: '0.2rem',
    cursor: 'pointer',
    fontFamily: patientTheme.fonts.body,
  },
  mutedText: {
    margin: 0,
    color: patientTheme.colors.inkMuted,
    fontSize: '0.9rem',
  },
  pastStack: {
    display: 'grid',
    gap: '0.45rem',
  },
  pastCard: {
    border: panelBorder,
    borderRadius: patientTheme.radius.sm,
    background: '#fffdf8',
    padding: '0.62rem 0.68rem',
    textAlign: 'left',
    cursor: 'pointer',
    fontFamily: patientTheme.fonts.body,
  },
  pastTitle: {
    display: 'block',
    fontSize: '0.89rem',
  },
  pastMeta: {
    display: 'block',
    marginTop: '0.2rem',
    color: patientTheme.colors.inkMuted,
    fontSize: '0.77rem',
  },
};
