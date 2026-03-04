// Messages page — lists encounters with messaging.
// Each encounter card navigates to /messages/:id for chat view.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listMyEncounters } from '../shared/api/encounters';
import { useToast } from '../shared/ui/ToastContext';
import type { EncounterSummary } from '../shared/types/domain';

const STATUS_LABELS: Record<string, string> = {
  EXPECTED: 'Expected',
  WAITING: 'In Waiting Room',
  TRIAGED: 'Triaged',
  IN_PROGRESS: 'In Progress',
  ADMITTED: 'Admitted',
  DISCHARGED: 'Discharged',
  CANCELLED: 'Cancelled',
  LEFT_AMA: 'Left AMA',
};

const STATUS_COLORS: Record<string, string> = {
  EXPECTED: '#6366f1',
  WAITING: '#f59e0b',
  TRIAGED: '#3b82f6',
  IN_PROGRESS: '#3b82f6',
  ADMITTED: '#16a34a',
  DISCHARGED: '#64748b',
  CANCELLED: '#94a3b8',
  LEFT_AMA: '#94a3b8',
};

export function MessagesPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [encounters, setEncounters] = useState<EncounterSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await listMyEncounters();
        setEncounters(data);
      } catch (err) {
        showToast('Failed to load conversations');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const active = encounters.filter(e =>
    !['DISCHARGED', 'CANCELLED', 'LEFT_AMA'].includes(e.status)
  );
  const past = encounters.filter(e =>
    ['DISCHARGED', 'CANCELLED', 'LEFT_AMA'].includes(e.status)
  );

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  if (loading) {
    return (
      <div style={styles.center}>
        <p style={styles.loadingText}>Loading conversations…</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.pageTitle}>Messages</h2>

      {encounters.length === 0 ? (
        <div style={styles.emptyState}>
          <p style={styles.emptyIcon}>💬</p>
          <p style={styles.emptyTitle}>No conversations yet</p>
          <p style={styles.emptyDesc}>
            Start a Priage assessment to get checked in and
            begin messaging with your care team.
          </p>
          <button
            style={styles.ctaBtn}
            onClick={() => navigate('/priage')}
          >
            Start Assessment
          </button>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <section>
              <h3 style={styles.sectionTitle}>Active Visits</h3>
              {active.map(enc => (
                <EncounterCard
                  key={enc.id}
                  encounter={enc}
                  formatDate={formatDate}
                  onClick={() => navigate(`/messages/${enc.id}`)}
                />
              ))}
            </section>
          )}

          {past.length > 0 && (
            <section style={{ marginTop: '1.5rem' }}>
              <h3 style={styles.sectionTitle}>Past Visits</h3>
              {past.slice(0, 10).map(enc => (
                <EncounterCard
                  key={enc.id}
                  encounter={enc}
                  formatDate={formatDate}
                  onClick={() => navigate(`/messages/${enc.id}`)}
                />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function EncounterCard({
  encounter: enc,
  formatDate,
  onClick,
}: {
  encounter: EncounterSummary;
  formatDate: (d: string) => string;
  onClick: () => void;
}) {
  return (
    <div style={styles.card} onClick={onClick}>
      <div style={styles.cardLeft}>
        <p style={styles.cardTitle}>
          {enc.chiefComplaint || 'Visit'}
        </p>
        <p style={styles.cardDate}>{formatDate(enc.createdAt)}</p>
      </div>
      <div style={styles.cardRight}>
        <span
          style={{
            ...styles.statusBadge,
            background: `${STATUS_COLORS[enc.status] ?? '#94a3b8'}18`,
            color: STATUS_COLORS[enc.status] ?? '#94a3b8',
          }}
        >
          {STATUS_LABELS[enc.status] ?? enc.status}
        </span>
        <span style={styles.chevron}>›</span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '500px',
    margin: '0 auto',
    padding: '1rem',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  center: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 'calc(100vh - 64px)',
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: '0.9rem',
  },
  pageTitle: {
    fontSize: '1.35rem',
    fontWeight: 700,
    color: '#0f172a',
    margin: '0 0 1rem',
  },
  sectionTitle: {
    fontSize: '0.8rem',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    color: '#94a3b8',
    margin: '0 0 0.5rem',
  },
  card: {
    display: 'flex',
    alignItems: 'center',
    padding: '0.85rem 1rem',
    background: '#fff',
    borderRadius: '14px',
    border: '1px solid #f1f5f9',
    marginBottom: '0.5rem',
    cursor: 'pointer',
    transition: 'box-shadow 0.15s',
  },
  cardLeft: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: '0.95rem',
    fontWeight: 600,
    color: '#0f172a',
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  cardDate: {
    fontSize: '0.75rem',
    color: '#94a3b8',
    margin: '0.15rem 0 0',
  },
  cardRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flexShrink: 0,
  },
  statusBadge: {
    padding: '0.2rem 0.6rem',
    borderRadius: '10px',
    fontSize: '0.7rem',
    fontWeight: 700,
  },
  chevron: {
    color: '#cbd5e1',
    fontSize: '1.2rem',
    fontWeight: 700,
  },
  emptyState: {
    textAlign: 'center',
    padding: '3rem 1rem',
  },
  emptyIcon: {
    fontSize: '2.5rem',
    margin: '0 0 0.5rem',
  },
  emptyTitle: {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: '#1e293b',
    margin: '0 0 0.25rem',
  },
  emptyDesc: {
    fontSize: '0.85rem',
    color: '#94a3b8',
    lineHeight: 1.5,
    margin: '0 0 1.25rem',
  },
  ctaBtn: {
    padding: '0.7rem 1.5rem',
    background: '#1e3a5f',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    fontSize: '0.9rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};
