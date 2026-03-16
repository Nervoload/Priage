// HospitalApp/src/features/analytics/AnalyticsPage.tsx
// Department Analytics dashboard — real-time overview for the triage team.
// Computes all metrics from real encounter data passed as props.

import { useState, useEffect, useMemo } from 'react';
import { NavBar, type View } from '../../shared/ui/NavBar';
import { DonutChart } from './charts/DonutChart';
import { BarChart } from './charts/BarChart';
import { LineChart } from './charts/LineChart';
import { MiniBar } from './charts/MiniBar';
import type { Encounter, ChatMessage } from '../../shared/types/domain';
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
  icon: string;
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
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-2 hover:shadow-md transition-shadow animate-fade-in-up">
      <div className="flex items-center justify-between">
        <span className="text-lg">{icon}</span>
        {trend && (
          <span className={`text-xs font-semibold ${trendColor}`}>{trendIcon}</span>
        )}
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className="text-2xl font-bold"
          style={{ color: accent ?? '#1f2937' }}
        >
          {value}
        </span>
        {unit && <span className="text-xs text-gray-400 font-medium">{unit}</span>}
      </div>
      <span className="text-[11px] text-gray-500 font-medium leading-tight">{label}</span>
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
      <h2 className="text-sm font-bold text-gray-900 mb-0.5">{title}</h2>
      {subtitle && <p className="text-[11px] text-gray-400 mb-4">{subtitle}</p>}
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
  icon?: string;
  color?: string;
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 flex flex-col gap-1">
      {icon && <span className="text-sm">{icon}</span>}
      <div className="flex items-baseline gap-1">
        <span className="text-lg font-bold" style={{ color: color ?? '#1f2937' }}>
          {value}
        </span>
        {unit && <span className="text-[10px] text-gray-400">{unit}</span>}
      </div>
      <span className="text-[10px] text-gray-500 font-medium">{label}</span>
    </div>
  );
}

// ─── Empty state component ──────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-6 text-center">
      <div className="text-2xl mb-2">📭</div>
      <p className="text-xs text-gray-400">{message}</p>
    </div>
  );
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
    <div className="min-h-screen bg-gray-50">
      <NavBar currentView="analytics" onNavigate={onNavigate} onLogout={onLogout} user={user} />

      <div className="p-6 max-w-[1400px] mx-auto space-y-5">
        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Department Analytics</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Emergency Department — Real-time overview
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse-dot" />
            <span className="text-xs text-gray-400">
              Live — {encounters.length} encounter{encounters.length !== 1 ? 's' : ''} loaded
            </span>
          </div>
        </div>

        {/* ── 1. KPI Cards ───────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <KpiCard
            icon="🏥"
            label="Patients in Queue"
            value={kpis.patientsInQueue}
            accent="#1e3a5f"
          />
          <KpiCard
            icon="⏱️"
            label="Avg Wait Time"
            value={kpis.avgWaitMinutes}
            unit="min"
            accent="#f59e0b"
            trend={kpis.avgWaitMinutes > 30 ? 'up' : kpis.avgWaitMinutes > 0 ? 'down' : undefined}
          />
          <KpiCard
            icon="🔴"
            label="CTAS 1–2 Waiting"
            value={kpis.ctas12Waiting}
            accent="#ef4444"
          />
          <KpiCard
            icon="✅"
            label="Triaged Today"
            value={kpis.triagedToday}
            accent="#22c55e"
          />
          <KpiCard
            icon="🚪"
            label="LWBS Rate"
            value={kpis.lwbsRate}
            unit="%"
            accent="#f97316"
          />
          <KpiCard
            icon="📱"
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
              <MetricCard icon="⏱️" label="Avg Triage Duration" value={efficiency.avgTriageDurationMin} unit="min" color="#1e3a5f" />
              <MetricCard icon="✅" label="Completion Rate" value={efficiency.completionRate} unit="%" color="#22c55e" />
              <MetricCard icon="📱" label="Pre-triage → Triage" value={efficiency.preTriage2TriageMin} unit="min" color="#3b82f6" />
              <MetricCard icon="⚠️" label="Longest Current Wait" value={efficiency.longestCurrentWaitMin} unit="min" color={efficiency.longestCurrentWaitMin > 30 ? '#ef4444' : '#f59e0b'} />
            </div>
          </Section>

          {/* 7. Pre-Triage / Chatbot Analytics */}
          <Section title="Pre-Triage Chatbot" subtitle="AI chatbot performance metrics">
            <div className="grid grid-cols-2 gap-3">
              <MetricCard icon="📱" label="Completion Rate" value={chatbot.completionRate} unit="%" color="#22c55e" />
              <MetricCard icon="🎯" label="Assessment Accuracy" value={chatbot.assessmentAccuracy} unit="%" color="#3b82f6" />
              <MetricCard icon="⏱️" label="Avg Session Duration" value={chatbot.avgSessionDurationMin} unit="min" color="#1e3a5f" />
              <MetricCard icon="💬" label="Total Sessions Today" value={chatbot.totalSessions} color="#f59e0b" />
            </div>
          </Section>
        </div>

        {/* ── Row: Alerts + Staffing + Disposition ───────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* 8. Alerts & Escalations */}
          <Section title="Alerts & Escalations" subtitle="Monitoring & response">
            <div className="grid grid-cols-2 gap-3">
              <MetricCard icon="🔔" label="Total Alerts" value={alerts.totalAlerts} color="#f59e0b" />
              <MetricCard icon="🚨" label="Critical Alerts" value={alerts.criticalAlerts} color="#ef4444" />
              <MetricCard icon="⚡" label="Avg Response Time" value={alerts.avgResponseTimeMin} unit="min" color="#22c55e" />
              <MetricCard icon="🔄" label="Patients Re-triaged" value={alerts.patientsRetriaged} color="#3b82f6" />
            </div>
          </Section>

          {/* 9. Staffing & Workload */}
          <Section title="Staffing & Workload" subtitle="Patients per triage nurse by shift">
            <div className="space-y-3">
              {staffing.map((s, i) => (
                <div key={i} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-gray-700">{s.shift}</span>
                    <span className="text-[10px] text-gray-400">{s.nursesOnDuty} nurses</span>
                  </div>
                  <MiniBar
                    value={s.patientsPerNurse}
                    max={6}
                    color={s.patientsPerNurse >= 4 ? '#ef4444' : s.patientsPerNurse >= 3 ? '#f59e0b' : '#22c55e'}
                  />
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[10px] text-gray-500">{s.patientsPerNurse} pts/nurse</span>
                    <span className="text-[10px] text-gray-400">{s.patientsTriaged} triaged</span>
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
        <div className="text-center text-xs text-gray-400 pt-2 pb-4">
          {hasEncounters
            ? 'All metrics computed from live encounter data. Refreshes automatically.'
            : 'No encounter data available. Metrics will populate as patients are admitted.'}
        </div>
      </div>
    </div>
  );
}
