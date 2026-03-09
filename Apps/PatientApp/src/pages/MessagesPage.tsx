import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { listMyEncounters } from '../shared/api/encounters';
import { ENCOUNTER_STATUS_META, isActiveEncounter } from '../shared/encounters';
import type { EncounterSummary } from '../shared/types/domain';
import { heroBackdrop, panelBorder, patientTheme } from '../shared/ui/theme';
import { useToast } from '../shared/ui/ToastContext';

export function MessagesPage() {
  const navigate = useNavigate();
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
          showToast('Failed to load conversations.');
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

  const [active, past] = useMemo(() => {
    const activeEncounters = encounters.filter((encounter) => isActiveEncounter(encounter.status));
    const pastEncounters = encounters.filter((encounter) => !isActiveEncounter(encounter.status));
    return [activeEncounters, pastEncounters];
  }, [encounters]);

  if (loading) {
    return (
      <div style={styles.center}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Loading conversations…</p>
      </div>
    );
  }

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <span style={styles.badge}>Messages</span>
        <h1 style={styles.title}>Care-team conversations</h1>
        <p style={styles.subtitle}>
          Open any encounter to continue messaging.
        </p>
      </section>

      {encounters.length === 0 ? (
        <section style={styles.emptyCard}>
          <h2 style={styles.emptyTitle}>No visit threads yet</h2>
          <p style={styles.emptyBody}>
            Start a visit from Priage AI and this area will show your active care conversations.
          </p>
          <button style={styles.primaryButton} onClick={() => navigate('/priage')}>
            Start New Visit
          </button>
        </section>
      ) : (
        <>
          {active.length > 0 && (
            <section style={styles.section}>
              <h2 style={styles.sectionTitle}>Active Visits</h2>
              <div style={styles.cardStack}>
                {active.map((encounter) => (
                  <EncounterCard key={encounter.id} encounter={encounter} onOpen={() => navigate(`/encounters/${encounter.id}/chat`)} />
                ))}
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section style={styles.section}>
              <h2 style={styles.sectionTitle}>Past Visits</h2>
              <div style={styles.cardStack}>
                {past.map((encounter) => (
                  <EncounterCard key={encounter.id} encounter={encounter} onOpen={() => navigate(`/encounters/${encounter.id}/current`)} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}

function EncounterCard({
  encounter,
  onOpen,
}: {
  encounter: EncounterSummary;
  onOpen: () => void;
}) {
  const statusMeta = ENCOUNTER_STATUS_META[encounter.status] ?? ENCOUNTER_STATUS_META.EXPECTED;

  return (
    <button style={styles.card} onClick={onOpen}>
      <div style={styles.cardBody}>
        <div style={styles.cardTitleRow}>
          <strong style={styles.cardTitle}>{encounter.chiefComplaint || 'Visit'}</strong>
          <span style={{ ...styles.statusPill, color: statusMeta.color, background: statusMeta.bg, borderColor: statusMeta.border }}>
            {statusMeta.shortLabel}
          </span>
        </div>
        <p style={styles.cardDate}>
          Opened {new Date(encounter.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
        </p>
      </div>
      <span style={styles.chevron}>→</span>
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: 'calc(100vh - 64px)',
    padding: '1rem 1rem 5.5rem',
    background: heroBackdrop,
    fontFamily: patientTheme.fonts.body,
  },
  center: {
    minHeight: 'calc(100vh - 64px)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.8rem',
    alignItems: 'center',
    justifyContent: 'center',
    background: heroBackdrop,
    fontFamily: patientTheme.fonts.body,
  },
  spinner: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    border: '4px solid #dbe3f3',
    borderTopColor: patientTheme.colors.accent,
    animation: 'spin 0.9s linear infinite',
  },
  loadingText: {
    margin: 0,
    color: patientTheme.colors.inkMuted,
  },
  hero: {
    maxWidth: '720px',
    margin: '0 auto 0.95rem',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.28rem 0.72rem',
    borderRadius: '999px',
    border: panelBorder,
    background: '#e9f1ff',
    color: patientTheme.colors.accentStrong,
    fontSize: '0.75rem',
    fontWeight: 700,
  },
  title: {
    margin: '0.7rem 0 0',
    fontFamily: patientTheme.fonts.heading,
    fontSize: '1.45rem',
  },
  subtitle: {
    margin: '0.3rem 0 0',
    color: patientTheme.colors.inkMuted,
    lineHeight: 1.45,
    fontSize: '0.93rem',
  },
  section: {
    maxWidth: '720px',
    margin: '0 auto 1rem',
  },
  sectionTitle: {
    margin: '0 0 0.5rem',
    fontFamily: patientTheme.fonts.heading,
    fontSize: '0.96rem',
    letterSpacing: '0.02em',
    color: patientTheme.colors.inkMuted,
    textTransform: 'uppercase',
  },
  cardStack: {
    display: 'grid',
    gap: '0.55rem',
  },
  card: {
    border: panelBorder,
    borderRadius: patientTheme.radius.md,
    background: '#fffdf8',
    boxShadow: patientTheme.shadows.card,
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: '0.7rem',
    textAlign: 'left',
    padding: '0.8rem 0.85rem',
    cursor: 'pointer',
    fontFamily: patientTheme.fonts.body,
  },
  cardBody: {
    display: 'grid',
    gap: '0.35rem',
  },
  cardTitleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
  },
  cardTitle: {
    fontSize: '0.94rem',
    color: patientTheme.colors.ink,
  },
  cardDate: {
    margin: 0,
    fontSize: '0.8rem',
    color: patientTheme.colors.inkMuted,
  },
  statusPill: {
    display: 'inline-flex',
    alignItems: 'center',
    border: '1px solid',
    borderRadius: '999px',
    padding: '0.22rem 0.58rem',
    fontSize: '0.7rem',
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  chevron: {
    alignSelf: 'center',
    color: patientTheme.colors.accent,
    fontWeight: 900,
  },
  emptyCard: {
    maxWidth: '640px',
    margin: '0.4rem auto 0',
    border: panelBorder,
    borderRadius: patientTheme.radius.lg,
    background: '#fffdf8',
    boxShadow: patientTheme.shadows.panel,
    padding: '1.3rem',
    textAlign: 'center',
  },
  emptyTitle: {
    margin: 0,
    fontFamily: patientTheme.fonts.heading,
    fontSize: '1.2rem',
  },
  emptyBody: {
    margin: '0.4rem 0 0',
    color: patientTheme.colors.inkMuted,
    lineHeight: 1.45,
    fontSize: '0.92rem',
  },
  primaryButton: {
    marginTop: '0.9rem',
    border: 'none',
    borderRadius: patientTheme.radius.sm,
    padding: '0.72rem 1.1rem',
    background: patientTheme.colors.accent,
    color: '#fff',
    fontWeight: 700,
    fontFamily: patientTheme.fonts.body,
    cursor: 'pointer',
  },
};
