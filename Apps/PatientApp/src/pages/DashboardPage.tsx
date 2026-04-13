import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import { listMyEncounters, getQueueInfo } from '../shared/api/encounters';
import { ENCOUNTER_STATUS_META, isActiveEncounter, isTerminalEncounter } from '../shared/encounters';
import { updateIntakeDetails } from '../shared/api/intake';
import { useAuth } from '../shared/hooks/useAuth';
import type { EncounterSummary, QueueInfo } from '../shared/types/domain';
import { heroBackdrop, panelBorder, patientTheme } from '../shared/ui/theme';
import { useToast } from '../shared/ui/ToastContext';

// ─── Constants ────────────────────────────────────────────────────────────────

const TIMELINE_STEPS = [
  { key: 'EXPECTED', label: 'Expected' },
  { key: 'ADMITTED', label: 'Admitted' },
  { key: 'TRIAGE', label: 'Triage' },
  { key: 'WAITING', label: 'Waiting' },
  { key: 'COMPLETE', label: 'Complete' },
] as const;

function getStepIndex(status: string): number {
  const idx = TIMELINE_STEPS.findIndex(s => s.key === status);
  return idx === -1 ? 0 : idx;
}

const SYMPTOM_CHIPS = [
  'Chest pain',
  'Headache',
  'Shortness of breath',
  'Abdominal pain',
  'Injury / Fall',
  'Fever',
  'Back pain',
  'Dizziness',
  'Allergic reaction',
  'Nausea / Vomiting',
];

const HEALTH_TIPS = [
  'Listing your allergies helps the ER team avoid dangerous drug interactions. Update them in your profile.',
  'Providing your current medications before arrival saves an average of 8 minutes per visit.',
  'A pre-filled profile means less paperwork and faster care when every minute counts.',
  'You can revisit any past encounter to start a new visit with the same chief complaint pre-filled.',
  'Emergency rooms triage by severity, not arrival time. Pre-triaging through Priage can speed up your assessment.',
];

const PREP_ITEMS = [
  { icon: '🪪', label: 'Health card / ID' },
  { icon: '💊', label: 'Medication list' },
  { icon: '📋', label: 'Insurance info' },
  { icon: '👕', label: 'Comfortable clothes' },
];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getGreetingSub(): string {
  const hour = new Date().getHours();
  if (hour >= 1 && hour < 6) return 'ERs are typically less busy right now.';
  if (hour >= 6 && hour < 10) return 'Start your day healthy — keep your profile up to date.';
  if (hour >= 17 && hour < 21) return 'Evening ER visits tend to have shorter waits than afternoons.';
  return 'Your info is saved — start a visit in seconds.';
}

// ─── Profile Completion ───────────────────────────────────────────────────────

interface ProfileField { label: string; check: (p: any) => boolean }

const PROFILE_FIELDS: ProfileField[] = [
  { label: 'Name', check: p => !!(p?.firstName && p?.lastName) },
  { label: 'Phone', check: p => !!p?.phone },
  { label: 'Age', check: p => p?.age != null },
  { label: 'Allergies', check: p => !!p?.allergies },
  { label: 'Conditions', check: p => !!p?.conditions },
  { label: 'Height', check: p => p?.heightCm != null },
  { label: 'Weight', check: p => p?.weightKg != null },
];

function getProfileCompletion(patient: any): { pct: number; completed: string[]; missing: string[] } {
  const completed = PROFILE_FIELDS.filter(f => f.check(patient)).map(f => f.label);
  const missing = PROFILE_FIELDS.filter(f => !f.check(patient)).map(f => f.label);
  const pct = Math.round((completed.length / PROFILE_FIELDS.length) * 100);
  return { pct, completed, missing };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

export function DashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { patient } = useAuth();
  const { showToast } = useToast();
  const [encounters, setEncounters] = useState<EncounterSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [queueInfo, setQueueInfo] = useState<QueueInfo | null>(null);

  // Start visit state
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Visit history expansion
  const [expandedVisitId, setExpandedVisitId] = useState<number | null>(null);

  // Health tip rotation
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * HEALTH_TIPS.length));

  // Pick up pre-fill from re-visit navigation
  useEffect(() => {
    const state = location.state as { prefillComplaint?: string; prefillDetails?: string } | null;
    if (state?.prefillComplaint) {
      setChiefComplaint(state.prefillComplaint);
      setDetails(state.prefillDetails ?? '');
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  // Load encounters
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await listMyEncounters();
        if (!cancelled) setEncounters(data);
      } catch {
        if (!cancelled) showToast('Could not load visit summary.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [showToast]);

  const [activeEncounter, pastEncounters] = useMemo(() => {
    const active = encounters.find(e => isActiveEncounter(e.status)) ?? null;
    const past = encounters.filter(e => isTerminalEncounter(e.status)).slice(0, 10);
    return [active, past] as const;
  }, [encounters]);

  // Fetch queue info for active encounter
  useEffect(() => {
    if (!activeEncounter) { setQueueInfo(null); return; }
    let cancelled = false;
    async function loadQueue() {
      try {
        const qi = await getQueueInfo(activeEncounter!.id).catch(() => null);
        if (!cancelled) setQueueInfo(qi);
      } catch { /* ignore */ }
    }
    void loadQueue();
    const interval = setInterval(loadQueue, 15_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [activeEncounter]);

  // Inline start visit handler
  async function handleStartVisit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = chiefComplaint.trim();
    if (!trimmed) {
      showToast('Please describe what brings you in before continuing.');
      return;
    }
    setSubmitting(true);
    try {
      await updateIntakeDetails({
        chiefComplaint: trimmed,
        details: details.trim() || undefined,
        firstName: patient?.firstName ?? undefined,
        lastName: patient?.lastName ?? undefined,
        age: patient?.age ?? undefined,
        allergies: patient?.allergies ?? undefined,
        conditions: patient?.conditions ?? undefined,
      });
      navigate('/priage', { state: { skipCapture: true } });
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not start this visit.');
    } finally {
      setSubmitting(false);
    }
  }

  const displayName = patient?.firstName || patient?.email?.split('@')[0] || 'Patient';
  const { pct, completed, missing } = getProfileCompletion(patient);

  // ─── RENDER ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={s.center}>
        <div style={s.spinner} />
        <p style={s.loadingText}>Loading dashboard…</p>
      </div>
    );
  }

  return (
    <main style={s.page}>
      {/* ── Smart Greeting ── */}
      <section style={s.hero}>
        <span style={s.badge}>Patient Home</span>
        <h1 style={s.title}>{getGreeting()}, {displayName}</h1>
        <p style={s.subtitle}>{getGreetingSub()}</p>
      </section>

      {/* ── Active Visit Tracker ── */}
      {activeEncounter && (
        <section style={s.section}>
          <ActiveVisitTracker
            encounter={activeEncounter}
            queueInfo={queueInfo}
            onMessage={() => navigate(`/encounters/${activeEncounter.id}/chat`)}
            onViewWorkspace={() => navigate(`/encounters/${activeEncounter.id}/current`)}
          />
        </section>
      )}

      {/* ── Visit Prep Checklist (when active visit) ── */}
      {activeEncounter && (
        <section style={s.section}>
          <article style={s.prepCard}>
            <h2 style={s.sectionTitle}>📝 Things to Bring</h2>
            <div style={s.prepGrid}>
              {PREP_ITEMS.map(item => (
                <div key={item.label} style={s.prepItem}>
                  <span style={s.prepIcon}>{item.icon}</span>
                  <span style={s.prepLabel}>{item.label}</span>
                </div>
              ))}
            </div>
          </article>
        </section>
      )}

      {/* ── Start New Visit (only when no active visit) ── */}
      {!activeEncounter && (
        <section style={s.section}>
          <article style={s.startCard}>
            <div style={s.startHeader}>
              <h2 style={s.startTitle}>Start New Visit</h2>
              <span style={s.fastBadge}>⚡ Fast — your info is pre-filled</span>
            </div>

            {/* Symptom quick-picks */}
            <div style={s.chipWrap}>
              {SYMPTOM_CHIPS.map(chip => (
                <button
                  key={chip}
                  style={{
                    ...s.chip,
                    ...(chiefComplaint === chip ? s.chipActive : {}),
                  }}
                  type="button"
                  onClick={() => setChiefComplaint(prev => prev === chip ? '' : chip)}
                >
                  {chip}
                </button>
              ))}
            </div>

            <form onSubmit={handleStartVisit} style={s.inlineForm}>
              <label style={s.fieldLabel}>
                What brings you in today? *
                <input
                  value={chiefComplaint}
                  onChange={e => setChiefComplaint(e.target.value)}
                  style={s.input}
                  placeholder="Or type your own symptom…"
                  maxLength={240}
                />
              </label>
              <label style={s.fieldLabel}>
                Brief description (optional)
                <textarea
                  value={details}
                  onChange={e => setDetails(e.target.value)}
                  style={s.textArea}
                  placeholder="When did it start? What changed?"
                  maxLength={4000}
                />
              </label>
              <button style={s.primaryButton} type="submit" disabled={submitting}>
                {submitting ? 'Preparing intake…' : 'Continue to guided intake →'}
              </button>
            </form>
          </article>
        </section>
      )}

      {/* ── Profile Completion ── */}
      {pct < 100 && (
        <section style={s.section}>
          <article style={s.profileCompCard}>
            <div style={s.profileCompHeader}>
              <h2 style={s.sectionTitle}>Complete Your Profile</h2>
              <span style={s.profilePct}>{pct}%</span>
            </div>
            <div style={s.progressTrack}>
              <div style={{ ...s.progressFill, width: `${pct}%` }} />
            </div>
            <div style={s.profileChecks}>
              {completed.map(f => (
                <span key={f} style={s.checkDone}>✓ {f}</span>
              ))}
              {missing.map(f => (
                <span key={f} style={s.checkMissing}>✗ {f}</span>
              ))}
            </div>
            <p style={s.profileCompNote}>A complete profile saves ~8 min per visit.</p>
            <button style={s.outlineButton} onClick={() => navigate('/settings')}>
              Complete Profile →
            </button>
          </article>
        </section>
      )}

      {/* ── Visit History ── */}
      <section style={s.section}>
        <h2 style={s.sectionTitle}>Visit History</h2>
        {pastEncounters.length === 0 ? (
          <p style={s.mutedText}>No past visits yet. Start your first visit above.</p>
        ) : (
          <div style={s.visitStack}>
            {pastEncounters.map(encounter => (
              <VisitHistoryCard
                key={encounter.id}
                encounter={encounter}
                isExpanded={expandedVisitId === encounter.id}
                onToggle={() => setExpandedVisitId(prev => prev === encounter.id ? null : encounter.id)}
                onRevisit={() => {
                  setChiefComplaint(encounter.chiefComplaint ?? '');
                  setDetails('');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                onViewDetails={() => navigate(`/encounters/${encounter.id}/current`)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Health Info Snapshot ── */}
      <section style={s.section}>
        <article style={s.healthCard}>
          <div style={s.healthCardHeader}>
            <h2 style={s.sectionTitle}>❤️ Health Info</h2>
            <button style={s.editLink} onClick={() => navigate('/settings')}>Edit →</button>
          </div>
          <div style={s.healthGrid}>
            <HealthItem label="Allergies" value={patient?.allergies} fallback="None saved" />
            <HealthItem label="Conditions" value={patient?.conditions} fallback="None saved" />
            <HealthItem label="Age" value={patient?.age != null ? `${patient.age} years` : null} fallback="—" />
            <HealthItem label="Phone" value={patient?.phone} fallback="—" />
            <HealthItem label="Height" value={patient?.heightCm != null ? `${patient.heightCm} cm` : null} fallback="—" />
            <HealthItem label="Weight" value={patient?.weightKg != null ? `${patient.weightKg} kg` : null} fallback="—" />
          </div>
        </article>
      </section>

      {/* ── When Should I Go to the ER? ── */}
      <section style={s.section}>
        <article style={s.erGuideCard}>
          <h2 style={s.erGuideTitle}>When Should I Go to the ER?</h2>
          <div style={s.erTier}>
            <div style={s.erTierHeader}>
              <span style={s.erIcon911}>🚨</span>
              <strong style={s.erTierLabel911}>Call 911 Immediately</strong>
            </div>
            <p style={s.erTierBody}>Chest pain or pressure • Difficulty breathing • Signs of stroke (FAST) • Severe bleeding • Loss of consciousness</p>
          </div>
          <div style={s.erTier}>
            <div style={s.erTierHeader}>
              <span style={s.erIconER}>🏥</span>
              <strong style={s.erTierLabelER}>Visit the ER</strong>
            </div>
            <p style={s.erTierBody}>Broken bones • Deep cuts needing stitches • High fever ({'>'} 40°C / 104°F) • Severe abdominal pain • Head injuries</p>
          </div>
          <div style={s.erTier}>
            <div style={s.erTierHeader}>
              <span style={s.erIconUC}>🩺</span>
              <strong style={s.erTierLabelUC}>Consider Urgent Care</strong>
            </div>
            <p style={s.erTierBody}>Minor sprains • Ear / sinus infections • Mild allergic reactions • Minor burns • UTI symptoms</p>
          </div>
        </article>
      </section>

      {/* ── Emergency Quick Dial ── */}
      <section style={s.section}>
        <div style={s.emergencyRow}>
          <a href="tel:911" style={s.emergencyBtn911}>🚨 Call 911</a>
          <a href="tel:18002221222" style={s.emergencyBtnOther}>☠️ Poison Control</a>
          <a href="tel:811" style={s.emergencyBtnOther}>📞 Health Line 811</a>
        </div>
      </section>

      {/* ── How Priage Works ── */}
      <section style={s.section}>
        <article style={s.howCard}>
          <h2 style={s.sectionTitle}>How Priage Works</h2>
          <div style={s.howSteps}>
            {[
              { num: '①', title: 'Describe', desc: "Tell us what's wrong" },
              { num: '②', title: 'AI Interview', desc: 'Answer a few questions' },
              { num: '③', title: 'Choose Hospital', desc: 'Pick nearby ER' },
              { num: '④', title: 'Arrive Ready', desc: 'Skip paperwork' },
            ].map((step, i) => (
              <div key={i} style={s.howStep}>
                <span style={s.howNum}>{step.num}</span>
                <strong style={s.howTitle}>{step.title}</strong>
                <span style={s.howDesc}>{step.desc}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      {/* ── Health Tip Rotator ── */}
      <section style={s.section}>
        <article style={s.tipCard}>
          <div style={s.tipHeader}>
            <span style={s.tipIcon}>💡</span>
            <strong>Did You Know?</strong>
          </div>
          <p style={s.tipBody}>{HEALTH_TIPS[tipIndex]}</p>
          <button
            style={s.tipNext}
            onClick={() => setTipIndex((tipIndex + 1) % HEALTH_TIPS.length)}
          >
            Next tip → ({tipIndex + 1}/{HEALTH_TIPS.length})
          </button>
        </article>
      </section>

      {/* ── Family Profiles Teaser ── */}
      <section style={s.section}>
        <article style={s.familyCard}>
          <div style={s.familyIcon}>👨‍👩‍👧‍👦</div>
          <div>
            <strong style={s.familyTitle}>Family Profiles</strong>
            <p style={s.familyDesc}>Soon you'll be able to start visits for family members — kids, parents, or anyone in your care.</p>
          </div>
          <span style={s.comingSoon}>Coming Soon</span>
        </article>
      </section>

      {/* ── Footer ── */}
      <footer style={s.footer}>
        <p style={s.footerText}>Priage v1.0 — Pre-triage, simplified.</p>
        <p style={s.footerDisclaimer}>
          Priage is not a substitute for emergency medical care. If you are experiencing a life-threatening emergency, call 911 immediately.
        </p>
      </footer>
    </main>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function ActiveVisitTracker({
  encounter,
  queueInfo,
  onMessage,
  onViewWorkspace,
}: {
  encounter: EncounterSummary;
  queueInfo: QueueInfo | null;
  onMessage: () => void;
  onViewWorkspace: () => void;
}) {
  const statusMeta = ENCOUNTER_STATUS_META[encounter.status];
  const stepIdx = getStepIndex(encounter.status);

  return (
    <article style={s.activeCard}>
      <div style={s.activeHeader}>
        <span style={s.activeBadge}>🟢 Active Visit</span>
        <span style={{
          ...s.statusPill,
          color: statusMeta.color,
          background: statusMeta.bg,
          borderColor: statusMeta.border,
        }}>
          {statusMeta.shortLabel}
        </span>
      </div>

      <h2 style={s.activeTitle}>
        {encounter.chiefComplaint || 'Visit in progress'}
      </h2>

      {queueInfo && encounter.status === 'WAITING' && (
        <div style={s.queueBanner}>
          <strong style={s.queuePosition}>You're #{queueInfo.position} in line</strong>
          <span style={s.queueEta}>Est. wait: ~{queueInfo.estimatedMinutes} min</span>
        </div>
      )}

      <div style={s.timeline}>
        {TIMELINE_STEPS.map((step, i) => (
          <div key={step.key} style={s.timelineStep}>
            <div style={{
              ...s.timelineDot,
              background: i <= stepIdx ? statusMeta.color : '#d1d5db',
              boxShadow: i === stepIdx ? `0 0 0 4px ${statusMeta.bg}` : 'none',
            }} />
            <span style={{
              ...s.timelineLabel,
              color: i <= stepIdx ? patientTheme.colors.ink : patientTheme.colors.inkMuted,
              fontWeight: i === stepIdx ? 700 : 500,
            }}>
              {step.label}
            </span>
            {i < TIMELINE_STEPS.length - 1 && (
              <div style={{
                ...s.timelineBar,
                background: i < stepIdx ? statusMeta.color : '#e5e7eb',
              }} />
            )}
          </div>
        ))}
      </div>

      <p style={s.activeMeta}>
        Checked in {new Date(encounter.createdAt).toLocaleString(undefined, {
          month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
        })}
      </p>

      <div style={s.activeActions}>
        <button style={s.primaryButton} onClick={onViewWorkspace}>
          View Full Visit →
        </button>
        <button style={s.messageButton} onClick={onMessage}>
          💬 Message Team
        </button>
      </div>
    </article>
  );
}

function HealthItem({ label, value, fallback }: { label: string; value: string | null | undefined; fallback: string }) {
  return (
    <div style={s.healthItem}>
      <span style={s.healthLabel}>{label}</span>
      <span style={{ ...s.healthValue, color: value ? patientTheme.colors.ink : patientTheme.colors.inkMuted }}>
        {value || fallback}
      </span>
    </div>
  );
}

function VisitHistoryCard({
  encounter,
  isExpanded,
  onToggle,
  onRevisit,
  onViewDetails,
}: {
  encounter: EncounterSummary;
  isExpanded: boolean;
  onToggle: () => void;
  onRevisit: () => void;
  onViewDetails: () => void;
}) {
  const statusMeta = ENCOUNTER_STATUS_META[encounter.status] ?? ENCOUNTER_STATUS_META.COMPLETE;

  return (
    <article style={s.visitCard}>
      <button style={s.visitCardMain} onClick={onToggle}>
        <div style={s.visitCardLeft}>
          <strong style={s.visitTitle}>{encounter.chiefComplaint || 'Visit record'}</strong>
          <span style={s.visitDate}>
            {new Date(encounter.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
        <div style={s.visitCardRight}>
          <span style={{
            ...s.statusPill,
            color: statusMeta.color,
            background: statusMeta.bg,
            borderColor: statusMeta.border,
          }}>
            {statusMeta.shortLabel}
          </span>
          <span style={s.expandChevron}>{isExpanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {isExpanded && (
        <div style={s.visitExpanded}>
          <div style={s.visitExpandedMeta}>
            <span>Opened: {new Date(encounter.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
            {encounter.arrivedAt && (
              <span>Arrived: {new Date(encounter.arrivedAt).toLocaleString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>
            )}
          </div>
          <div style={s.visitExpandedActions}>
            <button style={s.secondaryButton} onClick={onViewDetails}>
              View Full Details
            </button>
            <button style={s.revisitButton} onClick={onRevisit}>
              🔄 Having this issue again?
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const card: React.CSSProperties = {
  border: panelBorder,
  borderRadius: patientTheme.radius.lg,
  background: 'rgba(255, 253, 248, 0.98)',
  padding: '1.1rem',
  boxShadow: '0 22px 52px -40px rgba(20,33,61,0.42)',
};

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: 'calc(100vh - 54px)',
    padding: '1.15rem 1rem 3rem',
    background: heroBackdrop,
    fontFamily: patientTheme.fonts.body,
    color: patientTheme.colors.ink,
  },
  center: {
    minHeight: 'calc(100vh - 54px)',
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
    fontSize: '0.9rem',
    fontWeight: 600,
  },
  section: {
    maxWidth: '760px',
    margin: '0 auto 1rem',
  },

  // Hero / greeting
  hero: {
    maxWidth: '760px',
    margin: '0 auto 1rem',
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
    textTransform: 'uppercase' as const,
  },
  title: {
    margin: '0.6rem 0 0',
    fontFamily: patientTheme.fonts.heading,
    fontSize: '1.62rem',
    letterSpacing: '-0.02em',
  },
  subtitle: {
    margin: '0.35rem 0 0',
    color: patientTheme.colors.inkMuted,
    lineHeight: 1.45,
    fontSize: '0.95rem',
  },

  // Start Visit card
  startCard: {
    ...card,
    background: 'linear-gradient(135deg, rgba(241, 247, 255, 0.98) 0%, rgba(255, 253, 248, 0.98) 100%)',
  },
  startHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap' as const,
    gap: '0.5rem',
    marginBottom: '0.6rem',
  },
  startTitle: {
    margin: 0,
    fontFamily: patientTheme.fonts.heading,
    fontSize: '1.16rem',
    letterSpacing: '-0.01em',
  },
  fastBadge: {
    fontSize: '0.72rem',
    fontWeight: 700,
    color: patientTheme.colors.success,
    background: '#edfdf5',
    border: '1px solid #a7f3d0',
    borderRadius: '999px',
    padding: '0.24rem 0.62rem',
  },
  chipWrap: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '0.42rem',
    marginBottom: '0.72rem',
  },
  chip: {
    border: panelBorder,
    borderRadius: '999px',
    background: '#fff',
    color: patientTheme.colors.ink,
    padding: '0.36rem 0.72rem',
    fontSize: '0.76rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: patientTheme.fonts.body,
    transition: 'all 0.15s ease',
  },
  chipActive: {
    background: patientTheme.colors.accent,
    color: '#fff',
    borderColor: patientTheme.colors.accent,
  },
  inlineForm: {
    display: 'grid',
    gap: '0.72rem',
  },
  fieldLabel: {
    display: 'grid',
    gap: '0.3rem',
    fontSize: '0.78rem',
    fontWeight: 700,
    color: patientTheme.colors.ink,
  },
  input: {
    width: '100%',
    border: panelBorder,
    borderRadius: patientTheme.radius.sm,
    background: '#fff',
    color: patientTheme.colors.ink,
    padding: '0.78rem 0.82rem',
    fontSize: '0.92rem',
    fontFamily: patientTheme.fonts.body,
    boxSizing: 'border-box' as const,
    boxShadow: '0 10px 24px -22px rgba(20,33,61,0.5)',
  },
  textArea: {
    width: '100%',
    minHeight: '72px',
    resize: 'vertical' as const,
    border: panelBorder,
    borderRadius: patientTheme.radius.sm,
    background: '#fff',
    color: patientTheme.colors.ink,
    padding: '0.78rem 0.82rem',
    fontSize: '0.92rem',
    fontFamily: patientTheme.fonts.body,
    lineHeight: 1.5,
    boxSizing: 'border-box' as const,
    boxShadow: '0 10px 24px -22px rgba(20,33,61,0.5)',
  },
  primaryButton: {
    border: 'none',
    borderRadius: patientTheme.radius.sm,
    padding: '0.82rem 1.06rem',
    background: 'linear-gradient(135deg, #1949b8 0%, #2156d1 100%)',
    color: '#fff',
    fontWeight: 700,
    fontFamily: patientTheme.fonts.body,
    cursor: 'pointer',
    boxShadow: '0 18px 36px -24px rgba(25,73,184,0.72)',
    transition: 'all 0.18s ease',
    fontSize: '0.92rem',
  },

  // Profile Completion
  profileCompCard: {
    ...card,
    background: 'linear-gradient(135deg, #f0f7ff 0%, #fef9f0 100%)',
  },
  profileCompHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '0.62rem',
  },
  profilePct: {
    fontWeight: 800,
    fontSize: '1.1rem',
    color: patientTheme.colors.accent,
  },
  progressTrack: {
    width: '100%',
    height: '8px',
    borderRadius: '4px',
    background: '#e2e8f0',
    overflow: 'hidden',
    marginBottom: '0.62rem',
  },
  progressFill: {
    height: '100%',
    borderRadius: '4px',
    background: 'linear-gradient(90deg, #1949b8, #3b82f6)',
    transition: 'width 0.5s ease',
  },
  profileChecks: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '0.42rem',
    marginBottom: '0.52rem',
  },
  checkDone: {
    fontSize: '0.72rem',
    fontWeight: 600,
    color: patientTheme.colors.success,
    background: '#edfdf5',
    border: '1px solid #a7f3d0',
    borderRadius: '999px',
    padding: '0.22rem 0.56rem',
  },
  checkMissing: {
    fontSize: '0.72rem',
    fontWeight: 600,
    color: patientTheme.colors.inkMuted,
    background: '#f8fafc',
    border: panelBorder,
    borderRadius: '999px',
    padding: '0.22rem 0.56rem',
  },
  profileCompNote: {
    margin: '0 0 0.52rem',
    fontSize: '0.78rem',
    color: patientTheme.colors.inkMuted,
  },
  outlineButton: {
    border: panelBorder,
    borderRadius: patientTheme.radius.sm,
    background: '#fff',
    color: patientTheme.colors.accent,
    padding: '0.62rem 0.92rem',
    fontWeight: 700,
    fontSize: '0.82rem',
    cursor: 'pointer',
    fontFamily: patientTheme.fonts.body,
    transition: 'all 0.15s ease',
  },

  // Health Info
  healthCard: {
    ...card,
  },
  healthCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.72rem',
  },
  editLink: {
    border: 'none',
    background: 'none',
    color: patientTheme.colors.accent,
    fontWeight: 700,
    fontSize: '0.78rem',
    cursor: 'pointer',
    fontFamily: patientTheme.fonts.body,
    padding: 0,
  },
  healthGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '0.72rem',
  },
  healthItem: {
    display: 'grid',
    gap: '0.18rem',
  },
  healthLabel: {
    fontSize: '0.66rem',
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    color: patientTheme.colors.inkMuted,
  },
  healthValue: {
    fontSize: '0.86rem',
    fontWeight: 600,
  },

  // Section Title
  sectionTitle: {
    margin: '0 0 0.58rem',
    fontFamily: patientTheme.fonts.heading,
    fontSize: '0.82rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.12em',
    color: patientTheme.colors.inkMuted,
  },

  // Visit History
  visitStack: { display: 'grid', gap: '0.56rem' },
  visitCard: {
    border: panelBorder,
    borderRadius: patientTheme.radius.md,
    background: '#fffdf8',
    overflow: 'hidden',
    boxShadow: '0 18px 42px -36px rgba(20,33,61,0.36)',
  },
  visitCardMain: {
    width: '100%',
    border: 'none',
    background: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.85rem',
    padding: '0.88rem 0.95rem',
    cursor: 'pointer',
    fontFamily: patientTheme.fonts.body,
    textAlign: 'left' as const,
  },
  visitCardLeft: { display: 'grid', gap: '0.2rem' },
  visitTitle: { fontSize: '0.95rem', color: patientTheme.colors.ink },
  visitDate: { fontSize: '0.76rem', color: patientTheme.colors.inkMuted },
  visitCardRight: { display: 'flex', alignItems: 'center', gap: '0.62rem' },
  expandChevron: { fontSize: '0.62rem', color: patientTheme.colors.inkMuted },
  visitExpanded: {
    borderTop: panelBorder,
    padding: '0.82rem 0.95rem',
    display: 'grid',
    gap: '0.72rem',
    background: 'rgba(241, 247, 255, 0.4)',
  },
  visitExpandedMeta: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '0.82rem',
    fontSize: '0.78rem',
    color: patientTheme.colors.inkMuted,
  },
  visitExpandedActions: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '0.52rem',
  },
  secondaryButton: {
    border: panelBorder,
    borderRadius: patientTheme.radius.sm,
    background: '#fff',
    color: patientTheme.colors.ink,
    padding: '0.58rem 0.82rem',
    fontWeight: 700,
    fontSize: '0.82rem',
    cursor: 'pointer',
    fontFamily: patientTheme.fonts.body,
    transition: 'all 0.15s ease',
  },
  revisitButton: {
    border: '1px solid #a7f3d0',
    borderRadius: patientTheme.radius.sm,
    background: '#edfdf5',
    color: patientTheme.colors.success,
    padding: '0.58rem 0.82rem',
    fontWeight: 700,
    fontSize: '0.82rem',
    cursor: 'pointer',
    fontFamily: patientTheme.fonts.body,
    transition: 'all 0.15s ease',
  },
  statusPill: {
    border: '1px solid',
    borderRadius: '999px',
    padding: '0.24rem 0.62rem',
    fontSize: '0.66rem',
    fontWeight: 700,
    whiteSpace: 'nowrap' as const,
  },
  mutedText: {
    color: patientTheme.colors.inkMuted,
    fontSize: '0.88rem',
    margin: 0,
  },

  // Active Visit
  activeCard: {
    ...card,
    borderColor: '#a7f3d0',
    background: 'linear-gradient(135deg, #edfdf5 0%, #f0f7ff 100%)',
  },
  activeHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '0.52rem',
  },
  activeBadge: {
    fontSize: '0.72rem',
    fontWeight: 800,
    color: patientTheme.colors.success,
  },
  activeTitle: {
    margin: '0 0 0.52rem',
    fontFamily: patientTheme.fonts.heading,
    fontSize: '1.24rem',
    letterSpacing: '-0.01em',
  },
  queueBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.82rem',
    background: 'rgba(255,255,255,0.72)',
    border: panelBorder,
    borderRadius: patientTheme.radius.sm,
    padding: '0.62rem 0.82rem',
    marginBottom: '0.62rum',
  },
  queuePosition: {
    fontSize: '0.92rem',
    color: patientTheme.colors.accent,
  },
  queueEta: {
    fontSize: '0.82rem',
    color: patientTheme.colors.inkMuted,
  },
  timeline: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 0,
    margin: '0.82rem 0',
  },
  timelineStep: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '0.32rem',
    flex: 1,
    position: 'relative' as const,
  },
  timelineDot: {
    width: '14px',
    height: '14px',
    borderRadius: '50%',
    transition: 'all 0.3s ease',
    zIndex: 2,
  },
  timelineLabel: {
    fontSize: '0.66rem',
    fontWeight: 500,
    textAlign: 'center' as const,
    lineHeight: 1.2,
  },
  timelineBar: {
    position: 'absolute' as const,
    top: '6px',
    left: '50%',
    right: '-50%',
    height: '3px',
    borderRadius: '2px',
    zIndex: 1,
  },
  activeMeta: {
    margin: '0.32rem 0 0.62rem',
    fontSize: '0.78rem',
    color: patientTheme.colors.inkMuted,
  },
  activeActions: {
    display: 'flex',
    gap: '0.52rem',
    flexWrap: 'wrap' as const,
  },
  messageButton: {
    border: panelBorder,
    borderRadius: patientTheme.radius.sm,
    background: '#fff',
    color: patientTheme.colors.ink,
    padding: '0.72rem 0.92rem',
    fontWeight: 700,
    fontSize: '0.86rem',
    cursor: 'pointer',
    fontFamily: patientTheme.fonts.body,
    transition: 'all 0.15s ease',
  },

  // Prep checklist
  prepCard: {
    ...card,
    background: '#fffbf0',
    borderColor: '#fde68a',
  },
  prepGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.52rem',
  },
  prepItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.52rem',
    padding: '0.52rem 0.62rem',
    border: panelBorder,
    borderRadius: patientTheme.radius.sm,
    background: '#fff',
  },
  prepIcon: { fontSize: '1.1rem' },
  prepLabel: { fontSize: '0.82rem', fontWeight: 600 },

  // ER Guide
  erGuideCard: {
    ...card,
  },
  erGuideTitle: {
    margin: '0 0 0.82rem',
    fontFamily: patientTheme.fonts.heading,
    fontSize: '1.08rem',
    letterSpacing: '-0.01em',
  },
  erTier: {
    marginBottom: '0.72rem',
  },
  erTierHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.42rem',
    marginBottom: '0.22rem',
  },
  erIcon911: { fontSize: '1.1rem' },
  erTierLabel911: { color: '#b91c1c', fontSize: '0.86rem' },
  erIconER: { fontSize: '1.1rem' },
  erTierLabelER: { color: patientTheme.colors.warning, fontSize: '0.86rem' },
  erIconUC: { fontSize: '1.1rem' },
  erTierLabelUC: { color: patientTheme.colors.accent, fontSize: '0.86rem' },
  erTierBody: {
    margin: 0,
    fontSize: '0.8rem',
    color: patientTheme.colors.inkMuted,
    lineHeight: 1.5,
    paddingLeft: '1.52rem',
  },

  // Emergency dial
  emergencyRow: {
    display: 'flex',
    gap: '0.52rem',
    flexWrap: 'wrap' as const,
  },
  emergencyBtn911: {
    flex: 1,
    minWidth: '140px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.42rem',
    padding: '0.82rem',
    borderRadius: patientTheme.radius.sm,
    border: '1.5px solid #fecaca',
    background: '#fff1f2',
    color: '#b91c1c',
    fontWeight: 800,
    fontSize: '0.86rem',
    textDecoration: 'none',
    fontFamily: patientTheme.fonts.body,
    boxShadow: '0 14px 32px -22px rgba(185,28,28,0.4)',
    transition: 'all 0.15s ease',
  },
  emergencyBtnOther: {
    flex: 1,
    minWidth: '140px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.42rem',
    padding: '0.82rem',
    borderRadius: patientTheme.radius.sm,
    border: panelBorder,
    background: '#fff',
    color: patientTheme.colors.ink,
    fontWeight: 700,
    fontSize: '0.82rem',
    textDecoration: 'none',
    fontFamily: patientTheme.fonts.body,
    transition: 'all 0.15s ease',
  },

  // How it works
  howCard: {
    ...card,
    background: 'linear-gradient(135deg, #f0f4ff 0%, #faf8f3 100%)',
  },
  howSteps: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '0.52rem',
  },
  howStep: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    textAlign: 'center' as const,
    gap: '0.22rem',
  },
  howNum: {
    fontSize: '1.45rem',
    lineHeight: 1,
  },
  howTitle: {
    fontSize: '0.78rem',
    color: patientTheme.colors.ink,
  },
  howDesc: {
    fontSize: '0.66rem',
    color: patientTheme.colors.inkMuted,
    lineHeight: 1.3,
  },

  // Health tip
  tipCard: {
    ...card,
    background: '#fffef5',
    borderColor: '#fde68a',
  },
  tipHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.42rem',
    marginBottom: '0.42rem',
  },
  tipIcon: { fontSize: '1.1rem' },
  tipBody: {
    margin: '0 0 0.52rem',
    fontSize: '0.86rem',
    color: patientTheme.colors.ink,
    lineHeight: 1.5,
  },
  tipNext: {
    border: 'none',
    background: 'none',
    color: patientTheme.colors.accent,
    fontWeight: 700,
    fontSize: '0.76rem',
    cursor: 'pointer',
    fontFamily: patientTheme.fonts.body,
    padding: 0,
  },

  // Family profiles teaser
  familyCard: {
    ...card,
    display: 'flex',
    alignItems: 'center',
    gap: '0.82rem',
    background: '#f8f9fb',
    opacity: 0.8,
  },
  familyIcon: {
    fontSize: '1.8rem',
    flexShrink: 0,
  },
  familyTitle: {
    fontSize: '0.92rem',
    color: patientTheme.colors.ink,
  },
  familyDesc: {
    margin: '0.18rem 0 0',
    fontSize: '0.78rem',
    color: patientTheme.colors.inkMuted,
    lineHeight: 1.4,
  },
  comingSoon: {
    flexShrink: 0,
    fontSize: '0.66rem',
    fontWeight: 700,
    color: patientTheme.colors.accent,
    background: '#e9f1ff',
    border: panelBorder,
    borderRadius: '999px',
    padding: '0.26rem 0.62rem',
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
  },

  // Footer
  footer: {
    maxWidth: '760px',
    margin: '2rem auto 0',
    textAlign: 'center' as const,
    padding: '1.2rem 0 0',
    borderTop: panelBorder,
  },
  footerText: {
    margin: 0,
    fontSize: '0.78rem',
    color: patientTheme.colors.inkMuted,
    fontWeight: 600,
  },
  footerDisclaimer: {
    margin: '0.52rem 0 0',
    fontSize: '0.68rem',
    color: patientTheme.colors.inkMuted,
    lineHeight: 1.5,
    opacity: 0.7,
  },
};
