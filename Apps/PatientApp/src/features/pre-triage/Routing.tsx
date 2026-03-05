import { useEffect, useState } from 'react';

import { confirmIntent } from '../../shared/api/intake';
import { listHospitals } from '../../shared/api/priage';
import { useGuestSession } from '../../shared/hooks/useGuestSession';
import type { Hospital } from '../../shared/types/domain';
import { heroBackdrop, panelBorder, patientTheme } from '../../shared/ui/theme';
import { useToast } from '../../shared/ui/ToastContext';

interface RoutingProps {
  onConfirmed: (encounterId: number) => void;
}

function waitLabel(index: number): string {
  const ranges = ['~8 min', '~16 min', '~24 min', '~32 min'];
  return ranges[index % ranges.length];
}

export function Routing({ onConfirmed }: RoutingProps) {
  const { showToast } = useToast();
  const { session, setSession } = useGuestSession();
  const [hospitalSlug, setHospitalSlug] = useState(session?.hospitalSlug ?? '');
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loadingHospitals, setLoadingHospitals] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadHospitals() {
      try {
        const data = await listHospitals();
        if (cancelled) return;
        setHospitals(data);
      } catch {
        if (!cancelled) {
          showToast('Could not load hospital list. You can still enter a slug manually.');
        }
      } finally {
        if (!cancelled) {
          setLoadingHospitals(false);
        }
      }
    }
    void loadHospitals();
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  useEffect(() => {
    if (hospitalSlug) return;
    if (hospitals.length === 0) return;
    setHospitalSlug(hospitals[0].slug);
  }, [hospitalSlug, hospitals]);

  const sortedHospitals = [...hospitals].sort((first, second) =>
    first.name.localeCompare(second.name)
  );

  if (!session) return null;
  const currentSession = session;

  async function handleConfirm() {
    if (!hospitalSlug.trim()) {
      showToast('Please choose a hospital first.');
      return;
    }

    setSubmitting(true);
    try {
      const encounter = await confirmIntent({ hospitalSlug: hospitalSlug.trim() });
      setSession({
        ...currentSession,
        encounterId: encounter.id,
        hospitalSlug: hospitalSlug.trim(),
      });
      onConfirmed(encounter.id);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not confirm hospital.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <header style={styles.header}>
          <span style={styles.badge}>Final Step</span>
          <h1 style={styles.title}>Select your hospital</h1>
          <p style={styles.subtitle}>
            We will send your intake details immediately so staff can prepare before you arrive.
          </p>
        </header>

        {loadingHospitals ? (
          <p style={styles.loadingLabel}>Loading hospitals…</p>
        ) : sortedHospitals.length > 0 ? (
          <div style={styles.optionGrid}>
            {sortedHospitals.map((hospital, index) => {
              const selected = hospital.slug === hospitalSlug;
              return (
                <button
                  key={hospital.id}
                  style={{
                    ...styles.optionCard,
                    borderColor: selected ? patientTheme.colors.accent : patientTheme.colors.line,
                    boxShadow: selected ? '0 12px 26px rgba(25,73,184,0.18)' : patientTheme.shadows.card,
                  }}
                  onClick={() => setHospitalSlug(hospital.slug)}
                  type="button"
                >
                  <div style={styles.optionTop}>
                    <strong style={styles.optionTitle}>{hospital.name}</strong>
                  </div>
                  <span style={styles.optionMeta}>Slug: {hospital.slug}</span>
                  <span style={styles.optionMeta}>Current queue estimate: {waitLabel(index)}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <label style={styles.manualLabel}>
            Hospital slug
            <input
              value={hospitalSlug}
              onChange={(event) => setHospitalSlug(event.target.value)}
              placeholder="e.g. priage-general"
              style={styles.input}
              autoFocus
            />
          </label>
        )}

        <div style={styles.buttonRow}>
          <button style={styles.primaryButton} type="button" onClick={handleConfirm} disabled={submitting}>
            {submitting ? 'Notifying hospital…' : 'Notify hospital'}
          </button>
        </div>

        <footer style={styles.footer}>
          After confirmation, you will see live status updates and messaging from the care team.
        </footer>
      </section>
    </main>
  );
}

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
    maxWidth: '760px',
    border: panelBorder,
    borderRadius: patientTheme.radius.xl,
    background: 'rgba(255, 253, 248, 0.98)',
    boxShadow: patientTheme.shadows.panel,
    padding: '1rem',
    display: 'grid',
    gap: '0.72rem',
  },
  header: {
    display: 'grid',
    gap: '0.32rem',
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
    fontSize: '1.32rem',
  },
  subtitle: {
    margin: 0,
    color: patientTheme.colors.inkMuted,
    lineHeight: 1.45,
    fontSize: '0.9rem',
  },
  loadingLabel: {
    margin: 0,
    color: patientTheme.colors.inkMuted,
  },
  optionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '0.55rem',
  },
  optionCard: {
    border: panelBorder,
    borderRadius: patientTheme.radius.md,
    background: '#fff',
    textAlign: 'left',
    padding: '0.7rem',
    display: 'grid',
    gap: '0.22rem',
    cursor: 'pointer',
    fontFamily: patientTheme.fonts.body,
  },
  optionTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.4rem',
  },
  optionTitle: {
    fontSize: '0.9rem',
    lineHeight: 1.3,
  },
  optionMeta: {
    fontSize: '0.77rem',
    color: patientTheme.colors.inkMuted,
  },
  manualLabel: {
    display: 'grid',
    gap: '0.3rem',
    fontSize: '0.82rem',
    fontWeight: 700,
    color: patientTheme.colors.ink,
  },
  input: {
    border: panelBorder,
    borderRadius: patientTheme.radius.sm,
    background: '#fff',
    color: patientTheme.colors.ink,
    padding: '0.68rem 0.74rem',
    fontSize: '0.92rem',
    fontFamily: patientTheme.fonts.body,
  },
  buttonRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.52rem',
    justifyContent: 'space-between',
  },
  primaryButton: {
    border: 'none',
    borderRadius: patientTheme.radius.sm,
    background: patientTheme.colors.accent,
    color: '#fff',
    padding: '0.7rem 0.95rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: patientTheme.fonts.body,
    flex: 1,
    minWidth: '180px',
  },
  secondaryButton: {
    border: panelBorder,
    borderRadius: patientTheme.radius.sm,
    background: '#fff',
    color: patientTheme.colors.ink,
    padding: '0.7rem 0.95rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: patientTheme.fonts.body,
  },
  footer: {
    borderTop: panelBorder,
    paddingTop: '0.62rem',
    color: patientTheme.colors.inkMuted,
    fontSize: '0.8rem',
    lineHeight: 1.45,
  },
};
