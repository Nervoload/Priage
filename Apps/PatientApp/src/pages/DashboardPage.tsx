import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { listMyEncounters } from '../shared/api/encounters';
import { encounterPath, encounterStatusMeta, isActiveEncounter } from '../shared/encounters';
import { useAuth } from '../shared/hooks/useAuth';
import type { EncounterSummary } from '../shared/types/domain';
import { CtaLink, LoadingScreen, StatusPill } from '../shared/ui/Controls';
import { Icon } from '../shared/ui/Icon';
import { useToast } from '../shared/ui/ToastContext';

function formatDate(value: string, withTime = false): string {
  return new Date(value).toLocaleString(undefined, withTime
    ? { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
    : { month: 'short', day: 'numeric', year: 'numeric' });
}

export function DashboardPage() {
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
          showToast('We couldn’t load your visits. Please try again shortly.');
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
    const past = encounters.filter((encounter) => !isActiveEncounter(encounter.status)).slice(0, 5);
    return [active, past];
  }, [encounters]);

  const displayName = patient?.firstName || patient?.email?.split('@')[0] || 'there';

  return (
    <main id="main" className="page">
      <header className="page__header">
        <h1 className="display">Hi {displayName}.</h1>
        <p className="lede">{activeEncounter ? 'Here’s where your visit stands.' : 'Start a visit whenever you need care.'}</p>
      </header>

      {loading ? (
        <LoadingScreen label="Loading your visits…" />
      ) : (
        <>
          {activeEncounter ? (
            <Link to={encounterPath(activeEncounter)} className="card card--raised card--pad stack" style={{ textDecoration: 'none', color: 'var(--ink)' }}>
              <div className="cluster" style={{ justifyContent: 'space-between' }}>
                <StatusPill tone={encounterStatusMeta(activeEncounter.status).tone} dot={encounterStatusMeta(activeEncounter.status).dot} pulse>
                  {encounterStatusMeta(activeEncounter.status).label}
                </StatusPill>
                <Icon name="chevronRight" style={{ color: 'var(--ink-3)' }} />
              </div>
              <div className="stack stack--xs">
                <span className="title">{activeEncounter.chiefComplaint || 'Visit in progress'}</span>
                <span className="small">Started {formatDate(activeEncounter.createdAt, true)}</span>
              </div>
            </Link>
          ) : (
            <section className="card card--pad stack stack--lg" aria-labelledby="new-visit-title">
              <div className="stack stack--xs">
                <h2 id="new-visit-title" className="title">Need care?</h2>
                <p className="body">Answer a few questions and your care team will have your story before you arrive.</p>
              </div>
              <div style={{ maxWidth: 360 }}><CtaLink to="/priage">Start a visit</CtaLink></div>
            </section>
          )}

          {activeEncounter && (
            <Link to="/priage" className="link-card phone-only">
              <span className="tile__icon tile__icon--neutral"><Icon name="plus" /></span>
              <span className="row__main">
                <span className="heading">Start another visit</span>
                <span className="small">For a different concern</span>
              </span>
              <Icon name="chevronRight" />
            </Link>
          )}

          <section className="section" aria-labelledby="past-visits-title">
            <div className="section__head">
              <h2 id="past-visits-title" className="label">Past visits</h2>
            </div>
            {pastEncounters.length === 0 ? (
              <p className="small" style={{ padding: '0 4px' }}>Your completed visits will appear here.</p>
            ) : (
              <div className="card rows">
                {pastEncounters.map((encounter) => (
                  <Link key={encounter.id} to={encounterPath(encounter)} className="row row--link">
                    <span className="row__main">
                      <span className="row__value">{encounter.chiefComplaint || 'Visit'}</span>
                      <span className="small">
                        {formatDate(encounter.createdAt)}
                        {encounter.status !== 'COMPLETE' ? `, ${encounterStatusMeta(encounter.status).label.toLowerCase()}` : ''}
                      </span>
                    </span>
                    <Icon name="chevronRight" />
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
