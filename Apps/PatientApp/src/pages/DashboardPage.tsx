// Dashboard — patient home screen.
// Shows greeting, active encounters, and quick action to start Priage AI.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../shared/hooks/useAuth';
import { listMyEncounters } from '../shared/api/encounters';
import type { EncounterSummary } from '../shared/types/domain';

const STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  EXPECTED:   { bg: '#eff6ff',  color: '#2563eb', label: 'Expected' },
  ADMITTED:   { bg: '#f0fdf4',  color: '#16a34a', label: 'Checked In' },
  TRIAGE:     { bg: '#fffbeb',  color: '#d97706', label: 'In Triage' },
  WAITING:    { bg: '#f5f3ff',  color: '#7c3aed', label: 'Waiting' },
  COMPLETE:   { bg: '#ecfdf5',  color: '#059669', label: 'Complete' },
  CANCELLED:  { bg: '#fef2f2',  color: '#dc2626', label: 'Cancelled' },
  UNRESOLVED: { bg: '#fef2f2',  color: '#dc2626', label: 'Unresolved' },
};

export function DashboardPage() {
  const { patient } = useAuth();
  const navigate = useNavigate();
  const [encounters, setEncounters] = useState<EncounterSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetch() {
      try {
        const data = await listMyEncounters();
        if (!cancelled) setEncounters(data);
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetch();
    return () => { cancelled = true; };
  }, []);

  const activeEncounters = encounters.filter(e =>
    !['COMPLETE', 'CANCELLED', 'UNRESOLVED'].includes(e.status)
  );
  const pastEncounters = encounters.filter(e =>
    ['COMPLETE', 'CANCELLED', 'UNRESOLVED'].includes(e.status)
  );

  const greeting = getGreeting();
  const displayName = patient?.firstName || 'there';

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.greeting}>{greeting}, {displayName}!</h1>
        <p style={styles.subGreeting}>How are you feeling today?</p>
      </div>

      {/* Quick Action */}
      <button
        style={styles.priageCard}
        onClick={() => navigate('/priage')}
      >
        <div style={styles.priageIcon}>🩺</div>
        <div style={styles.priageContent}>
          <h3 style={styles.priageTitle}>Start Priage Assessment</h3>
          <p style={styles.priageDesc}>
            Talk to our AI to assess your symptoms and get connected with care
          </p>
        </div>
        <div style={styles.priageArrow}>→</div>
      </button>

      {/* Active Encounters */}
      {activeEncounters.length > 0 && (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Active Visits</h2>
          {activeEncounters.map(enc => (
            <EncounterCard
              key={enc.id}
              encounter={enc}
              onClick={() => navigate(`/messages/${enc.id}`)}
            />
          ))}
        </section>
      )}

      {/* Past Encounters */}
      {pastEncounters.length > 0 && (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Past Visits</h2>
          {pastEncounters.slice(0, 5).map(enc => (
            <EncounterCard
              key={enc.id}
              encounter={enc}
              onClick={() => navigate(`/messages/${enc.id}`)}
            />
          ))}
        </section>
      )}

      {/* Empty state */}
      {!loading && encounters.length === 0 && (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>🏥</div>
          <p style={styles.emptyText}>No visits yet.</p>
          <p style={styles.emptySubtext}>
            Start a Priage assessment to check in to a hospital.
          </p>
        </div>
      )}

      {loading && (
        <div style={styles.loadingContainer}>
          <p style={styles.loadingText}>Loading visits…</p>
        </div>
      )}
    </div>
  );
}

function EncounterCard({ encounter, onClick }: { encounter: EncounterSummary; onClick: () => void }) {
  const status = STATUS_COLORS[encounter.status] ?? STATUS_COLORS.EXPECTED;
  const date = new Date(encounter.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <button style={styles.encounterCard} onClick={onClick}>
      <div style={styles.encounterLeft}>
        <p style={styles.encounterComplaint}>
          {encounter.chiefComplaint || 'Visit'}
        </p>
        <p style={styles.encounterDate}>{date}</p>
      </div>
      <span style={{ ...styles.encounterBadge, background: status.bg, color: status.color }}>
        {status.label}
      </span>
    </button>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '1rem',
    paddingBottom: '80px',
    maxWidth: '500px',
    margin: '0 auto',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: {
    marginBottom: '1.25rem',
  },
  greeting: {
    fontSize: '1.5rem',
    fontWeight: 800,
    color: '#0f172a',
    margin: 0,
  },
  subGreeting: {
    fontSize: '0.95rem',
    color: '#64748b',
    margin: '0.25rem 0 0',
  },
  priageCard: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '1.25rem',
    background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
    borderRadius: '16px',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    color: '#fff',
    marginBottom: '1.5rem',
    fontFamily: 'inherit',
  },
  priageIcon: {
    fontSize: '2rem',
    flexShrink: 0,
  },
  priageContent: {
    flex: 1,
  },
  priageTitle: {
    fontSize: '1.05rem',
    fontWeight: 700,
    margin: 0,
  },
  priageDesc: {
    fontSize: '0.8rem',
    margin: '0.25rem 0 0',
    opacity: 0.85,
  },
  priageArrow: {
    fontSize: '1.5rem',
    fontWeight: 700,
    flexShrink: 0,
  },
  section: {
    marginBottom: '1.5rem',
  },
  sectionTitle: {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#334155',
    margin: '0 0 0.75rem',
  },
  encounterCard: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem',
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    cursor: 'pointer',
    marginBottom: '0.5rem',
    fontFamily: 'inherit',
    textAlign: 'left',
  },
  encounterLeft: {
    flex: 1,
    minWidth: 0,
  },
  encounterComplaint: {
    fontSize: '0.95rem',
    fontWeight: 600,
    color: '#0f172a',
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  encounterDate: {
    fontSize: '0.8rem',
    color: '#94a3b8',
    margin: '0.15rem 0 0',
  },
  encounterBadge: {
    padding: '0.3rem 0.75rem',
    borderRadius: '20px',
    fontSize: '0.75rem',
    fontWeight: 600,
    flexShrink: 0,
    marginLeft: '0.5rem',
  },
  emptyState: {
    textAlign: 'center',
    padding: '3rem 1rem',
  },
  emptyIcon: {
    fontSize: '3rem',
    marginBottom: '1rem',
  },
  emptyText: {
    fontSize: '1.1rem',
    fontWeight: 600,
    color: '#334155',
    margin: 0,
  },
  emptySubtext: {
    fontSize: '0.9rem',
    color: '#94a3b8',
    margin: '0.5rem 0 0',
  },
  loadingContainer: {
    textAlign: 'center',
    padding: '2rem',
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: '0.9rem',
  },
};
