// HospitalApp/src/features/analytics/analyticsData.ts
// Computes analytics metrics from lightweight analytics rows.

import type { AnalyticsEncounterRow } from '../../shared/types/analytics';

// ─── Helpers ────────────────────────────────────────────────────────────────

function minutesSince(isoDate: string | null | undefined): number {
  if (!isoDate) return 0;
  return (Date.now() - new Date(isoDate).getTime()) / 60_000;
}

function isToday(isoDate: string | null | undefined): boolean {
  if (!isoDate) return false;
  const d = new Date(isoDate);
  const now = new Date();
  return d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate();
}

function getHour(isoDate: string | null | undefined): number {
  if (!isoDate) return 0;
  return new Date(isoDate).getHours();
}

function dayLabel(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
}

function isSameDay(isoDate: string, daysAgo: number): boolean {
  const d = new Date(isoDate);
  const target = new Date();
  target.setDate(target.getDate() - daysAgo);
  return d.getFullYear() === target.getFullYear()
    && d.getMonth() === target.getMonth()
    && d.getDate() === target.getDate();
}

// ─── KPI Metrics ────────────────────────────────────────────────────────────

export interface KpiMetrics {
  patientsInQueue: number;
  avgWaitMinutes: number;
  ctas12Waiting: number;
  triagedToday: number;
  lwbsRate: number;
  chatbotCompletion: number;
}

export function computeKpis(allEncounters: AnalyticsEncounterRow[]): KpiMetrics {
  const waiting = allEncounters.filter((e) => e.status === 'WAITING');
  const triagedOrWaiting = allEncounters.filter(
    (e) => e.status === 'WAITING' || e.status === 'TRIAGE',
  );

  const inQueue = allEncounters.filter(
    (e) => e.status === 'WAITING' || e.status === 'TRIAGE' || e.status === 'ADMITTED',
  );

  const waitTimes = waiting
    .map((e) => minutesSince(e.waitingAt ?? e.triagedAt ?? e.arrivedAt))
    .filter((m) => m > 0);
  const avgWait = waitTimes.length > 0
    ? Math.round(waitTimes.reduce((s, m) => s + m, 0) / waitTimes.length)
    : 0;

  const ctas12 = triagedOrWaiting.filter(
    (e) => e.currentCtasLevel != null && e.currentCtasLevel <= 2,
  );

  const triagedToday = allEncounters.filter(
    (e) =>
      (e.status === 'WAITING' || e.status === 'COMPLETE' || e.status === 'TRIAGE')
      && isToday(e.triagedAt),
  );

  const todayEncounters = allEncounters.filter((e) => isToday(e.createdAt));
  const lwbs = todayEncounters.filter((e) => e.status === 'CANCELLED');
  const lwbsRate = todayEncounters.length > 0
    ? Math.round((lwbs.length / todayEncounters.length) * 1000) / 10
    : 0;

  const todayWithChat = todayEncounters.filter((e) => e.messageCount > 0);
  const chatbotCompletion = todayEncounters.length > 0
    ? Math.round((todayWithChat.length / todayEncounters.length) * 100)
    : 0;

  return {
    patientsInQueue: inQueue.length,
    avgWaitMinutes: avgWait,
    ctas12Waiting: ctas12.length,
    triagedToday: triagedToday.length,
    lwbsRate,
    chatbotCompletion,
  };
}

// ─── CTAS Distribution ──────────────────────────────────────────────────────

export interface CtasDistribution {
  level: number;
  label: string;
  count: number;
  color: string;
}

const CTAS_META: { level: number; label: string; color: string }[] = [
  { level: 1, label: 'Resuscitation', color: '#ef4444' },
  { level: 2, label: 'Emergent', color: '#f97316' },
  { level: 3, label: 'Urgent', color: '#eab308' },
  { level: 4, label: 'Less Urgent', color: '#22c55e' },
  { level: 5, label: 'Non-Urgent', color: '#3b82f6' },
];

export function computeCtasDistribution(encounters: AnalyticsEncounterRow[]): CtasDistribution[] {
  const active = encounters.filter(
    (e) => e.status === 'WAITING' || e.status === 'TRIAGE' || e.status === 'ADMITTED',
  );
  return CTAS_META.map((meta) => ({
    ...meta,
    count: active.filter((e) => e.currentCtasLevel === meta.level).length,
  }));
}

// ─── Hourly Arrivals ────────────────────────────────────────────────────────

export interface HourlyArrival {
  hour: string;
  count: number;
}

export function computeHourlyArrivals(encounters: AnalyticsEncounterRow[]): HourlyArrival[] {
  const todayEnc = encounters.filter((e) => isToday(e.createdAt));
  const counts = new Array(24).fill(0);
  for (const e of todayEnc) {
    counts[getHour(e.createdAt)]++;
  }
  return counts.map((count, i) => ({
    hour: String(i).padStart(2, '0'),
    count,
  }));
}

// ─── Wait Time Trends (7-day) ───────────────────────────────────────────────

export interface WaitTimeTrend {
  day: string;
  avgMinutes: number;
  ctas12Minutes: number;
}

export function computeWaitTimeTrends(encounters: AnalyticsEncounterRow[]): WaitTimeTrend[] {
  const result: WaitTimeTrend[] = [];

  for (let daysAgo = 6; daysAgo >= 0; daysAgo--) {
    const label = dayLabel(daysAgo);
    const dayEnc = encounters.filter((e) => isSameDay(e.createdAt, daysAgo));

    const waits = dayEnc
      .filter((e) => e.arrivedAt && (e.triagedAt || e.waitingAt))
      .map((e) => {
        const start = new Date(e.arrivedAt!).getTime();
        const end = new Date((e.triagedAt ?? e.waitingAt)!).getTime();
        return Math.max(0, (end - start) / 60_000);
      });

    const ctas12Waits = dayEnc
      .filter(
        (e) =>
          e.currentCtasLevel != null
          && e.currentCtasLevel <= 2
          && e.arrivedAt
          && (e.triagedAt || e.waitingAt),
      )
      .map((e) => {
        const start = new Date(e.arrivedAt!).getTime();
        const end = new Date((e.triagedAt ?? e.waitingAt)!).getTime();
        return Math.max(0, (end - start) / 60_000);
      });

    result.push({
      day: label,
      avgMinutes: waits.length > 0
        ? Math.round(waits.reduce((s, m) => s + m, 0) / waits.length)
        : 0,
      ctas12Minutes: ctas12Waits.length > 0
        ? Math.round(ctas12Waits.reduce((s, m) => s + m, 0) / ctas12Waits.length)
        : 0,
    });
  }

  return result;
}

// ─── Top Chief Complaints ───────────────────────────────────────────────────

export interface ChiefComplaintStat {
  complaint: string;
  count: number;
}

export function computeChiefComplaints(encounters: AnalyticsEncounterRow[]): ChiefComplaintStat[] {
  const counts = new Map<string, number>();
  for (const e of encounters) {
    const complaint = (e.chiefComplaint ?? '').trim();
    if (!complaint) continue;
    const key = complaint.charAt(0).toUpperCase() + complaint.slice(1).toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([complaint, count]) => ({ complaint, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

// ─── Triage Efficiency ──────────────────────────────────────────────────────

export interface TriageEfficiency {
  avgTriageDurationMin: number;
  completionRate: number;
  preTriage2TriageMin: number;
  longestCurrentWaitMin: number;
}

export function computeTriageEfficiency(encounters: AnalyticsEncounterRow[]): TriageEfficiency {
  const triaged = encounters.filter((e) => e.triagedAt && e.waitingAt);
  const durations = triaged.map((e) => {
    const start = new Date(e.triagedAt!).getTime();
    const end = new Date(e.waitingAt!).getTime();
    return Math.max(0, (end - start) / 60_000);
  });
  const avgDuration = durations.length > 0
    ? Math.round((durations.reduce((s, m) => s + m, 0) / durations.length) * 10) / 10
    : 0;

  const todayEnc = encounters.filter((e) => isToday(e.createdAt));
  const todayTriaged = todayEnc.filter((e) => e.triagedAt);
  const completionRate = todayEnc.length > 0
    ? Math.round((todayTriaged.length / todayEnc.length) * 1000) / 10
    : 0;

  const preTriage = triaged.map((e) => {
    const start = new Date(e.createdAt).getTime();
    const end = new Date(e.triagedAt!).getTime();
    return Math.max(0, (end - start) / 60_000);
  });
  const avgPreTriage = preTriage.length > 0
    ? Math.round((preTriage.reduce((s, m) => s + m, 0) / preTriage.length) * 10) / 10
    : 0;

  const waitingPatients = encounters.filter((e) => e.status === 'WAITING');
  const waits = waitingPatients.map((e) => minutesSince(e.waitingAt ?? e.triagedAt ?? e.arrivedAt));
  const longestWait = waits.length > 0 ? Math.round(Math.max(...waits)) : 0;

  return {
    avgTriageDurationMin: avgDuration,
    completionRate,
    preTriage2TriageMin: avgPreTriage,
    longestCurrentWaitMin: longestWait,
  };
}

// ─── Chatbot Analytics ──────────────────────────────────────────────────────

export interface ChatbotAnalytics {
  completionRate: number;
  assessmentAccuracy: number;
  avgSessionDurationMin: number;
  totalSessions: number;
}

export function computeChatbotAnalytics(
  encounters: AnalyticsEncounterRow[],
): ChatbotAnalytics {
  const todayEnc = encounters.filter((e) => isToday(e.createdAt));

  const sessionsWithChat = todayEnc.filter((e) => e.patientMessageCount > 0);
  const totalSessions = sessionsWithChat.length;

  const completed = sessionsWithChat.filter((e) => e.patientMessageCount >= 3);
  const completionRate = totalSessions > 0
    ? Math.round((completed.length / totalSessions) * 100)
    : 0;

  const withTriageAfterChat = completed.filter((e) => e.triagedAt != null);
  const accuracy = completed.length > 0
    ? Math.round((withTriageAfterChat.length / completed.length) * 100)
    : 0;

  const durations: number[] = [];
  for (const e of sessionsWithChat) {
    if (!e.firstPatientMessageAt || !e.lastPatientMessageAt) continue;
    const first = new Date(e.firstPatientMessageAt).getTime();
    const last = new Date(e.lastPatientMessageAt).getTime();
    const dur = (last - first) / 60_000;
    if (dur > 0) durations.push(dur);
  }
  const avgDuration = durations.length > 0
    ? Math.round((durations.reduce((s, m) => s + m, 0) / durations.length) * 10) / 10
    : 0;

  return {
    completionRate,
    assessmentAccuracy: accuracy,
    avgSessionDurationMin: avgDuration,
    totalSessions,
  };
}

// ─── Alerts & Escalations ───────────────────────────────────────────────────

export interface AlertMetrics {
  totalAlerts: number;
  criticalAlerts: number;
  avgResponseTimeMin: number;
  patientsRetriaged: number;
}

type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

function countAlertRules(encounters: AnalyticsEncounterRow[]): { total: number; critical: number } {
  let total = 0;
  let critical = 0;

  for (const encounter of encounters) {
    const alerts: AlertSeverity[] = [];

    if (
      encounter.currentCtasLevel === 1
      && (encounter.status === 'ADMITTED' || encounter.status === 'WAITING')
    ) {
      alerts.push('CRITICAL');
    }

    if (encounter.currentCtasLevel === 2 && encounter.status === 'ADMITTED') {
      const mins = minutesSince(encounter.arrivedAt);
      if (mins >= 30) {
        alerts.push(mins >= 60 ? 'CRITICAL' : 'HIGH');
      }
    }

    if (encounter.status === 'ADMITTED' && encounter.currentCtasLevel !== 1 && encounter.currentCtasLevel !== 2) {
      if (minutesSince(encounter.arrivedAt) >= 60) {
        alerts.push('MEDIUM');
      }
    }

    if (encounter.status === 'TRIAGE' && minutesSince(encounter.triagedAt ?? encounter.updatedAt) >= 20) {
      alerts.push('MEDIUM');
    }

    if (encounter.status === 'WAITING') {
      const mins = minutesSince(encounter.waitingAt ?? encounter.updatedAt);
      if (mins >= 8 * 60) {
        alerts.push(mins >= 10 * 60 ? 'CRITICAL' : 'HIGH');
      }
    }

    if (
      (encounter.status === 'EXPECTED' || encounter.status === 'ADMITTED')
      && encounter.chiefComplaint
    ) {
      const lc = encounter.chiefComplaint.toLowerCase();
      const criticalKeywords = [
        'chest pain',
        'difficulty breathing',
        'shortness of breath',
        'unconscious',
        'unresponsive',
        'cardiac arrest',
        'stroke',
        'seizure',
        'severe bleeding',
        'anaphylaxis',
      ];
      if (criticalKeywords.some((keyword) => lc.includes(keyword))) {
        alerts.push('HIGH');
      }
    }

    if (encounter.status === 'EXPECTED') {
      const mins = minutesSince(encounter.createdAt);
      if (mins >= 45) {
        alerts.push(mins >= 90 ? 'HIGH' : 'MEDIUM');
      }
    }

    total += alerts.length;
    critical += alerts.filter((severity) => severity === 'CRITICAL').length;
  }

  return { total, critical };
}

export function computeAlertMetrics(encounters: AnalyticsEncounterRow[]): AlertMetrics {
  const { total, critical } = countAlertRules(encounters);
  const reTriage = encounters.filter((e) => e.triageAssessmentCount > 1);

  const responseTimes = encounters
    .filter((e) => e.triagedAt && e.updatedAt)
    .map((e) => {
      const alertTime = new Date(e.updatedAt).getTime();
      const resolved = new Date(e.triagedAt!).getTime();
      return Math.max(0, (resolved - alertTime) / 60_000);
    })
    .filter((m) => m > 0 && m < 120);

  const avgResponse = responseTimes.length > 0
    ? Math.round((responseTimes.reduce((s, m) => s + m, 0) / responseTimes.length) * 10) / 10
    : 0;

  return {
    totalAlerts: total,
    criticalAlerts: critical,
    avgResponseTimeMin: avgResponse,
    patientsRetriaged: reTriage.length,
  };
}

// ─── Staffing & Workload ────────────────────────────────────────────────────

export interface ShiftWorkload {
  shift: string;
  nursesOnDuty: number;
  patientsPerNurse: number;
  patientsTriaged: number;
}

export function computeStaffing(encounters: AnalyticsEncounterRow[]): ShiftWorkload[] {
  const todayTriaged = encounters.filter((e) => isToday(e.triagedAt));

  const shifts = [
    { shift: 'Morning (07–15)', start: 7, end: 15, defaultNurses: 4 },
    { shift: 'Afternoon (15–23)', start: 15, end: 23, defaultNurses: 3 },
    { shift: 'Night (23–07)', start: 23, end: 7, defaultNurses: 2 },
  ];

  return shifts.map((s) => {
    let shiftEnc: AnalyticsEncounterRow[];
    if (s.start < s.end) {
      shiftEnc = todayTriaged.filter((e) => {
        const h = getHour(e.triagedAt);
        return h >= s.start && h < s.end;
      });
    } else {
      shiftEnc = todayTriaged.filter((e) => {
        const h = getHour(e.triagedAt);
        return h >= s.start || h < s.end;
      });
    }

    const patientsTriaged = shiftEnc.length;
    const nursesOnDuty = s.defaultNurses;
    const patientsPerNurse = nursesOnDuty > 0
      ? Math.round((patientsTriaged / nursesOnDuty) * 10) / 10
      : 0;

    return {
      shift: s.shift,
      nursesOnDuty,
      patientsPerNurse,
      patientsTriaged,
    };
  });
}

// ─── Disposition Tracking ───────────────────────────────────────────────────

export interface DispositionStat {
  label: string;
  count: number;
  color: string;
}

export function computeDisposition(encounters: AnalyticsEncounterRow[]): DispositionStat[] {
  const todayEnc = encounters.filter((e) => isToday(e.createdAt));

  const complete = todayEnc.filter((e) => e.status === 'COMPLETE');
  const cancelled = todayEnc.filter((e) => e.status === 'CANCELLED');
  const inProgress = todayEnc.filter(
    (e) => e.status === 'ADMITTED' || e.status === 'TRIAGE' || e.status === 'WAITING',
  );
  const expected = todayEnc.filter((e) => e.status === 'EXPECTED');

  return [
    { label: 'Discharged', count: complete.length, color: '#22c55e' },
    { label: 'In Progress', count: inProgress.length, color: '#3b82f6' },
    { label: 'LWBS / Cancel', count: cancelled.length, color: '#ef4444' },
    { label: 'Expected', count: expected.length, color: '#eab308' },
  ];
}
