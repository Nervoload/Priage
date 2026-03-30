import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { listMyEncounters } from '../shared/api/encounters';
import { ENCOUNTER_STATUS_META, isActiveEncounter } from '../shared/encounters';
import { useAuth } from '../shared/hooks/useAuth';
import type { EncounterSummary } from '../shared/types/domain';
import { heroBackdrop, panelBorder, patientTheme } from '../shared/ui/theme';
import { useToast } from '../shared/ui/ToastContext';

export function DashboardPage() {
  const navigate = useNavigate();
  const { patient } = useAuth();
  const { showToast } = useToast();
  const [encounters, setEncounters] = useState<EncounterSummary[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div style={styles.heroTop}>
          <span style={styles.badge}>Patient Home</span>
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
            Launch the Priage intake assistant to begin a new emergency visit.
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
            <span>Describe symptoms for guided triage</span>
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
    minHeight: 'calc(100vh - 72px)',
    padding: '1.15rem 1rem 6rem',
    background: heroBackdrop,
    fontFamily: patientTheme.fonts.body,
    color: patientTheme.colors.ink,
  },
  hero: {
    maxWidth: '760px',
    margin: '0 auto 1rem',
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
    padding: '0.34rem 0.78rem',
    borderRadius: '999px',
    border: panelBorder,
    background: '#e9f1ff',
    color: patientTheme.colors.accentStrong,
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
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
    margin: '0.82rem 0 0',
    fontFamily: patientTheme.fonts.heading,
    fontSize: '1.62rem',
    letterSpacing: '-0.02em',
  },
  subtitle: {
    margin: '0.4rem 0 0',
    color: patientTheme.colors.inkMuted,
    lineHeight: 1.45,
    fontSize: '0.95rem',
  },
  section: {
    maxWidth: '760px',
    margin: '0 auto 1rem',
  },
  heroCard: {
    border: panelBorder,
    borderRadius: patientTheme.radius.lg,
    background: '#fffdf8',
    padding: '1.1rem',
    boxShadow: '0 22px 52px -40px rgba(20,33,61,0.45)',
  },
  heroCardTitle: {
    margin: 0,
    fontFamily: patientTheme.fonts.heading,
    fontSize: '1.16rem',
    letterSpacing: '-0.01em',
  },
  heroCardText: {
    margin: '0.42rem 0 0',
    color: patientTheme.colors.inkMuted,
    lineHeight: 1.45,
  },
  primaryButton: {
    marginTop: '0.95rem',
    border: 'none',
    borderRadius: patientTheme.radius.sm,
    padding: '0.78rem 1.06rem',
    background: patientTheme.colors.accent,
    color: '#fff',
    fontWeight: 700,
    fontFamily: patientTheme.fonts.body,
    cursor: 'pointer',
    boxShadow: '0 18px 36px -24px rgba(25,73,184,0.72)',
    transition: 'all 0.18s ease',
  },
  sectionTitle: {
    margin: '0 0 0.58rem',
    fontFamily: patientTheme.fonts.heading,
    fontSize: '0.8rem',
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
    color: patientTheme.colors.inkMuted,
  },
  visitCard: {
    border: panelBorder,
    borderRadius: patientTheme.radius.md,
    background: '#fffdf8',
    boxShadow: '0 18px 44px -36px rgba(20,33,61,0.42)',
    width: '100%',
    textAlign: 'left',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.85rem',
    padding: '0.94rem 1rem',
    cursor: 'pointer',
    fontFamily: patientTheme.fonts.body,
  },
  visitTitle: {
    display: 'block',
    fontSize: '0.98rem',
    letterSpacing: '-0.01em',
  },
  visitMeta: {
    margin: '0.25rem 0 0',
    fontSize: '0.78rem',
    color: patientTheme.colors.inkMuted,
  },
  statusPill: {
    border: '1px solid',
    borderRadius: '999px',
    padding: '0.24rem 0.62rem',
    fontSize: '0.66rem',
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
    gap: '0.62rem',
  },
  quickCard: {
    border: panelBorder,
    borderRadius: patientTheme.radius.md,
    background: '#fffdf8',
    boxShadow: '0 18px 42px -36px rgba(20,33,61,0.38)',
    padding: '0.84rem 0.86rem',
    textAlign: 'left',
    display: 'grid',
    gap: '0.26rem',
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
    gap: '0.5rem',
  },
  pastCard: {
    border: panelBorder,
    borderRadius: patientTheme.radius.sm,
    background: '#fffdf8',
    padding: '0.72rem 0.76rem',
    textAlign: 'left',
    cursor: 'pointer',
    fontFamily: patientTheme.fonts.body,
  },
  pastTitle: {
    display: 'block',
    fontSize: '0.91rem',
  },
  pastMeta: {
    display: 'block',
    marginTop: '0.2rem',
    color: patientTheme.colors.inkMuted,
    fontSize: '0.77rem',
  },
};
