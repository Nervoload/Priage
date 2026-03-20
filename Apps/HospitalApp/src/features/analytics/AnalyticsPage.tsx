// HospitalApp/src/features/analytics/AnalyticsPage.tsx
// Department Analytics dashboard — real-time overview for the triage team.
// Computes all metrics from real encounter data passed as props.

import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { NavBar, type View } from '../../shared/ui/NavBar';
import { DonutChart } from './charts/DonutChart';
import { BarChart } from './charts/BarChart';
import { LineChart } from './charts/LineChart';
import { MiniBar } from './charts/MiniBar';
import type { Encounter, ChatMessage } from '../../shared/types/domain';
import { DASHBOARD_PAGE_CLASS } from '../../shared/ui/dashboardTheme';
import {
  computeKpis,
  computeCtasDistribution,
  computeHourlyArrivals,
  computeWaitTimeTrends,
  computeChiefComplaints,
  computeTriageEfficiency,
  computeChatbotAnalytics,
  computeAlertMetrics,
  computeStaffing,
  computeDisposition,
} from './analyticsData';

interface AnalyticsPageProps {
  onNavigate: (view: View) => void;
  onLogout: () => void;
  user: { email: string; role: string } | null;
  encounters: Encounter[];
  chatMessages: Record<number, ChatMessage[]>;
}

// ─── KPI Card sub-component ─────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  unit,
  accent,
  trend,
}: {
  icon?: ReactNode;
  label: string;
  value: string | number;
  unit?: string;
  accent?: string;
  trend?: 'up' | 'down' | 'neutral';
}) {
  const trendColor =
    trend === 'up' ? 'text-red-500' : trend === 'down' ? 'text-green-500' : 'text-gray-400';
  const trendIcon =
    trend === 'up' ? '↑' : trend === 'down' ? '↓' : '';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex min-h-[132px] flex-col gap-2.5 hover:shadow-md transition-shadow animate-fade-in-up">
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-bold uppercase tracking-[0.16em] text-slate-900">{label}</span>
        {trend && (
          <span className={`text-sm font-semibold ${trendColor}`}>{trendIcon}</span>
        )}
      </div>

      <div className="mt-auto flex items-end justify-between gap-3">
        {icon ? (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700">
            {icon}
          </div>
        ) : (
          <div />
        )}

        <div className="flex items-baseline justify-end gap-1 text-right">
          <span
            className="text-[2.25rem] font-bold text-slate-950"
            style={{ color: accent ?? '#020617' }}
          >
            {value}
          </span>
          {unit && <span className="text-sm text-gray-400 font-medium">{unit}</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Section wrapper ────────────────────────────────────────────────────────

function Section({
  title,
  subtitle,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-5 animate-fade-in-up ${className}`}>
      <h2 className="text-[1.05rem] font-bold text-gray-900 mb-0.5">{title}</h2>
      {subtitle && <p className="text-[13px] text-gray-400 mb-4">{subtitle}</p>}
      {!subtitle && <div className="mb-4" />}
      {children}
    </div>
  );
}

// ─── Metric card (smaller, used inside sections) ────────────────────────────

function MetricCard({
  label,
  value,
  unit,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  unit?: string;
  icon?: ReactNode;
  color?: string;
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[14px] font-semibold uppercase tracking-[0.14em] text-slate-900">{label}</span>
        {icon && (
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700">
            {icon}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-[1.5rem] font-bold text-slate-950" style={{ color: color ?? '#020617' }}>
          {value}
        </span>
        {unit && <span className="text-xs text-gray-400">{unit}</span>}
      </div>
    </div>
  );
}

// ─── Empty state component ──────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-6 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500">
        <AnalyticsIcon kind="empty" />
      </div>
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  );
}

function AnalyticsIcon({ kind }: { kind: string }) {
  const commonProps = {
    width: 18,
    height: 18,
    viewBox: '0 0 16 16',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
  } as const;

  switch (kind) {
    case 'queue':
      return (
        <svg {...commonProps}>
          <path d="M3 4.5h10M3 8h10M3 11.5h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    case 'wait':
      return (
        <svg {...commonProps}>
          <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" />
          <path d="M8 5v3l2 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'acuity':
      return (
        <svg {...commonProps}>
          <path d="M8 2.5 13 5.5v5L8 13.5 3 10.5v-5L8 2.5Z" stroke="currentColor" strokeWidth="1.4" />
          <path d="M8 5.5v5M5.5 8h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    case 'complete':
      return (
        <svg {...commonProps}>
          <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" />
          <path d="M5 8.2 7 10l4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'door':
      return (
        <svg {...commonProps}>
          <path d="M5 2.5h5.5v11H5z" stroke="currentColor" strokeWidth="1.4" />
          <path d="M10.5 8h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="8.2" cy="8" r=".6" fill="currentColor" />
        </svg>
      );
    case 'chat':
      return (
        <svg {...commonProps}>
          <path d="M3 4.5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H7l-3 2v-2H5a2 2 0 0 1-2-2v-4Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
      );
    case 'target':
      return (
        <svg {...commonProps}>
          <circle cx="8" cy="8" r="4.5" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="8" cy="8" r="1.8" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      );
    case 'alert':
      return (
        <svg {...commonProps}>
          <path d="M8 2.5 13 12H3L8 2.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M8 6v2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="8" cy="10.8" r=".6" fill="currentColor" />
        </svg>
      );
    case 'bolt':
      return (
        <svg {...commonProps}>
          <path d="M9 2.5 4.8 8H8l-1 5.5L11.2 8H8l1-5.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
      );
    case 'refresh':
      return (
        <svg {...commonProps}>
          <path d="M12 5.5A4.5 4.5 0 1 0 12.2 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M12.2 3.5v2.7H9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'empty':
      return (
        <svg {...commonProps}>
          <rect x="3" y="4" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
          <path d="m4 5 4 3 4-3" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
      );
    default:
      return (
        <svg {...commonProps}>
          <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      );
  }
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function AnalyticsPage({ onNavigate, onLogout, user, encounters, chatMessages }: AnalyticsPageProps) {
  // Auto-refresh: recompute every 30 seconds to keep metrics current
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  // Compute all analytics from real encounter data
  const kpis = useMemo(() => computeKpis(encounters, chatMessages), [encounters, chatMessages, tick]);
  const ctasDist = useMemo(() => computeCtasDistribution(encounters), [encounters, tick]);
  const hourly = useMemo(() => computeHourlyArrivals(encounters), [encounters, tick]);
  const waitTrends = useMemo(() => computeWaitTimeTrends(encounters), [encounters, tick]);
  const complaints = useMemo(() => computeChiefComplaints(encounters), [encounters, tick]);
  const efficiency = useMemo(() => computeTriageEfficiency(encounters), [encounters, tick]);
  const chatbot = useMemo(() => computeChatbotAnalytics(encounters, chatMessages), [encounters, chatMessages, tick]);
  const alerts = useMemo(() => computeAlertMetrics(encounters), [encounters, tick]);
  const staffing = useMemo(() => computeStaffing(encounters), [encounters, tick]);
  const disposition = useMemo(() => computeDisposition(encounters), [encounters, tick]);

  const hasEncounters = encounters.length > 0;
  const totalCtas = ctasDist.reduce((s, d) => s + d.count, 0);
  const totalDisposition = disposition.reduce((s, d) => s + d.count, 0);
  const hasComplaints = complaints.length > 0;
  const hasHourly = hourly.some(h => h.count > 0);

  return (
    <div className={DASHBOARD_PAGE_CLASS}>
      <NavBar currentView="analytics" onNavigate={onNavigate} onLogout={onLogout} user={user} />

      <div className="p-6 max-w-[1400px] mx-auto space-y-5">
        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Department Analytics</h1>
            <p className="mt-0.5 text-[1.05rem] text-gray-500">
              Emergency Department — Real-time overview
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse-dot" />
            <span className="text-sm text-gray-400">
              Live — {encounters.length} encounter{encounters.length !== 1 ? 's' : ''} loaded
            </span>
          </div>
        </div>

        {/* ── 1. KPI Cards ───────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <KpiCard
            icon={<AnalyticsIcon kind="queue" />}
            label="Patients in Queue"
            value={kpis.patientsInQueue}
            accent="#1e3a5f"
          />
          <KpiCard
            icon={<AnalyticsIcon kind="wait" />}
            label="Avg Wait Time"
            value={kpis.avgWaitMinutes}
            unit="min"
            accent="#f59e0b"
            trend={kpis.avgWaitMinutes > 30 ? 'up' : kpis.avgWaitMinutes > 0 ? 'down' : undefined}
          />
          <KpiCard
            icon={<AnalyticsIcon kind="acuity" />}
            label="CTAS 1–2 Waiting"
            value={kpis.ctas12Waiting}
            accent="#ef4444"
          />
          <KpiCard
            icon={<AnalyticsIcon kind="complete" />}
            label="Triaged Today"
            value={kpis.triagedToday}
            accent="#22c55e"
          />
          <KpiCard
            icon={<AnalyticsIcon kind="door" />}
            label="LWBS Rate"
            value={kpis.lwbsRate}
            unit="%"
            accent="#f97316"
          />
          <KpiCard
            icon={<AnalyticsIcon kind="chat" />}
            label="Chatbot Completion"
            value={kpis.chatbotCompletion}
            unit="%"
            accent="#3b82f6"
          />
        </div>

        {/* ── Row: CTAS Distribution + Wait Time Trends ──────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* 2. CTAS Distribution */}
          <Section title="CTAS Distribution" subtitle="Current patient acuity breakdown">
            {totalCtas > 0 ? (
              <DonutChart
                data={ctasDist.filter(d => d.count > 0).map((d) => ({ label: `CTAS ${d.level} — ${d.label}`, value: d.count, color: d.color }))}
                centerValue={String(totalCtas)}
                centerLabel="Total"
              />
            ) : (
              <EmptyState message="No active patients with CTAS levels" />
            )}
          </Section>

          {/* 3. Wait Time Trends */}
          <Section title="Wait Time Trends" subtitle="7-day average wait time (minutes)">
            {waitTrends.some(d => d.avgMinutes > 0) ? (
              <LineChart
                data={waitTrends.map((d) => ({
                  label: d.day,
                  value: d.avgMinutes,
                  value2: d.ctas12Minutes,
                }))}
                unit="m"
                line2Label="CTAS 1–2"
              />
            ) : (
              <EmptyState message="No wait time data in the last 7 days" />
            )}
          </Section>
        </div>

        {/* ── Row: Hourly Arrivals + Chief Complaints ────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* 4. Hourly Arrival Rate */}
          <Section title="Hourly Arrival Rate" subtitle="Patient arrivals over 24 hours (today)">
            {hasHourly ? (
              <BarChart
                data={hourly.map((h) => ({
                  label: h.hour,
                  value: h.count,
                  color: h.count >= 12 ? '#ef4444' : h.count >= 8 ? '#f97316' : '#1e3a5f',
                }))}
                orientation="vertical"
                height={210}
                showValues={false}
              />
            ) : (
              <EmptyState message="No arrivals recorded today" />
            )}
          </Section>

          {/* 5. Top Chief Complaints */}
          <Section title="Top Chief Complaints" subtitle="Most common presenting complaints">
            {hasComplaints ? (
              <BarChart
                data={complaints.map((c) => ({
                  label: c.complaint,
                  value: c.count,
                }))}
                orientation="horizontal"
                barColor="#1e3a5f"
              />
            ) : (
              <EmptyState message="No chief complaints recorded" />
            )}
          </Section>
        </div>

        {/* ── Row: Triage Efficiency + Chatbot Analytics ─────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* 6. Triage Efficiency */}
          <Section title="Triage Efficiency" subtitle="Assessment performance metrics">
            <div className="grid grid-cols-2 gap-3">
              <MetricCard icon={<AnalyticsIcon kind="wait" />} label="Avg Triage Duration" value={efficiency.avgTriageDurationMin} unit="min" color="#1e3a5f" />
              <MetricCard icon={<AnalyticsIcon kind="complete" />} label="Completion Rate" value={efficiency.completionRate} unit="%" color="#22c55e" />
              <MetricCard icon={<AnalyticsIcon kind="chat" />} label="Pre-triage → Triage" value={efficiency.preTriage2TriageMin} unit="min" color="#3b82f6" />
              <MetricCard icon={<AnalyticsIcon kind="alert" />} label="Longest Current Wait" value={efficiency.longestCurrentWaitMin} unit="min" color={efficiency.longestCurrentWaitMin > 30 ? '#ef4444' : '#f59e0b'} />
            </div>
          </Section>

          {/* 7. Pre-Triage / Chatbot Analytics */}
          <Section title="Pre-Triage Chatbot" subtitle="AI chatbot performance metrics">
            <div className="grid grid-cols-2 gap-3">
              <MetricCard icon={<AnalyticsIcon kind="chat" />} label="Completion Rate" value={chatbot.completionRate} unit="%" color="#22c55e" />
              <MetricCard icon={<AnalyticsIcon kind="target" />} label="Assessment Accuracy" value={chatbot.assessmentAccuracy} unit="%" color="#3b82f6" />
              <MetricCard icon={<AnalyticsIcon kind="wait" />} label="Avg Session Duration" value={chatbot.avgSessionDurationMin} unit="min" color="#1e3a5f" />
              <MetricCard icon={<AnalyticsIcon kind="chat" />} label="Total Sessions Today" value={chatbot.totalSessions} color="#f59e0b" />
            </div>
          </Section>
        </div>

        {/* ── Row: Alerts + Staffing + Disposition ───────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* 8. Alerts & Escalations */}
          <Section title="Alerts & Escalations" subtitle="Monitoring & response">
            <div className="grid grid-cols-2 gap-3">
              <MetricCard icon={<AnalyticsIcon kind="alert" />} label="Total Alerts" value={alerts.totalAlerts} color="#f59e0b" />
              <MetricCard icon={<AnalyticsIcon kind="alert" />} label="Critical Alerts" value={alerts.criticalAlerts} color="#ef4444" />
              <MetricCard icon={<AnalyticsIcon kind="bolt" />} label="Avg Response Time" value={alerts.avgResponseTimeMin} unit="min" color="#22c55e" />
              <MetricCard icon={<AnalyticsIcon kind="refresh" />} label="Patients Re-triaged" value={alerts.patientsRetriaged} color="#3b82f6" />
            </div>
          </Section>

          {/* 9. Staffing & Workload */}
          <Section title="Staffing & Workload" subtitle="Patients per triage nurse by shift">
            <div className="space-y-3">
              {staffing.map((s, i) => (
                <div key={i} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-semibold text-gray-700">{s.shift}</span>
                    <span className="text-xs text-gray-400">{s.nursesOnDuty} nurses</span>
                  </div>
                  <MiniBar
                    value={s.patientsPerNurse}
                    max={6}
                    color={s.patientsPerNurse >= 4 ? '#ef4444' : s.patientsPerNurse >= 3 ? '#f59e0b' : '#22c55e'}
                  />
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-xs text-gray-500">{s.patientsPerNurse} pts/nurse</span>
                    <span className="text-xs text-gray-400">{s.patientsTriaged} triaged</span>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* 10. Disposition Tracking */}
          <Section title="Disposition Tracking" subtitle="Patient outcomes today">
            {totalDisposition > 0 ? (
              <DonutChart
                data={disposition.filter(d => d.count > 0).map((d) => ({
                  label: d.label,
                  value: d.count,
                  color: d.color,
                }))}
                size={180}
                thickness={28}
                centerValue={String(totalDisposition)}
                centerLabel="Today"
              />
            ) : (
              <EmptyState message="No encounters recorded today" />
            )}
          </Section>
        </div>

        {/* Footer note */}
        <div className="pt-2 pb-4 text-center text-sm text-gray-400">
          {hasEncounters
            ? 'All metrics computed from live encounter data. Refreshes automatically.'
            : 'No encounter data available. Metrics will populate as patients are admitted.'}
        </div>
      </div>
    </div>
  );
}
