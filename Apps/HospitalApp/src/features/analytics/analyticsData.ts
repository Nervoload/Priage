// HospitalApp/src/features/analytics/analyticsData.ts
// Computes analytics metrics from REAL encounter data.
// All functions accept Encounter[] and derive stats client-side.

import type { Encounter, ChatMessage } from '../../shared/types/domain';
import { deriveAlertsFromEncounters } from '../../shared/api/alertDerivation';

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

export function computeKpis(
    allEncounters: Encounter[],
    chatMessages: Record<number, ChatMessage[]>,
): KpiMetrics {
    const waiting = allEncounters.filter(e => e.status === 'WAITING');
    const triagedOrWaiting = allEncounters.filter(e =>
        e.status === 'WAITING' || e.status === 'TRIAGE'
    );

    // Patients currently in the queue (WAITING + TRIAGE + ADMITTED)
    const inQueue = allEncounters.filter(e =>
        e.status === 'WAITING' || e.status === 'TRIAGE' || e.status === 'ADMITTED'
    );

    // Average wait time for WAITING patients (from waitingAt or triagedAt)
    const waitTimes = waiting
        .map(e => minutesSince(e.waitingAt ?? e.triagedAt ?? e.arrivedAt))
        .filter(m => m > 0);
    const avgWait = waitTimes.length > 0
        ? Math.round(waitTimes.reduce((s, m) => s + m, 0) / waitTimes.length)
        : 0;

    // CTAS 1-2 waiting
    const ctas12 = triagedOrWaiting.filter(e =>
        e.currentCtasLevel != null && e.currentCtasLevel <= 2
    );

    // Triaged today (WAITING or COMPLETE with triagedAt today)
    const triagedToday = allEncounters.filter(e =>
        (e.status === 'WAITING' || e.status === 'COMPLETE' || e.status === 'TRIAGE')
        && isToday(e.triagedAt)
    );

    // LWBS rate: total encounters today that were CANCELLED vs all today
    const todayEncounters = allEncounters.filter(e => isToday(e.createdAt));
    const lwbs = todayEncounters.filter(e => e.status === 'CANCELLED');
    const lwbsRate = todayEncounters.length > 0
        ? Math.round((lwbs.length / todayEncounters.length) * 1000) / 10
        : 0;

    // Chatbot completion: encounters that have chat messages vs total today
    const todayWithChat = todayEncounters.filter(e => {
        const msgs = chatMessages[e.id] || [];
        return msgs.length > 0;
    });
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

export function computeCtasDistribution(encounters: Encounter[]): CtasDistribution[] {
    const active = encounters.filter(e =>
        e.status === 'WAITING' || e.status === 'TRIAGE' || e.status === 'ADMITTED'
    );
    return CTAS_META.map(meta => ({
        ...meta,
        count: active.filter(e => e.currentCtasLevel === meta.level).length,
    }));
}

// ─── Hourly Arrivals ────────────────────────────────────────────────────────

export interface HourlyArrival {
    hour: string;
    count: number;
}

export function computeHourlyArrivals(encounters: Encounter[]): HourlyArrival[] {
    const todayEnc = encounters.filter(e => isToday(e.createdAt));
    const counts = new Array(24).fill(0);
    for (const e of todayEnc) {
        const h = getHour(e.createdAt);
        counts[h]++;
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

export function computeWaitTimeTrends(encounters: Encounter[]): WaitTimeTrend[] {
    const result: WaitTimeTrend[] = [];

    for (let daysAgo = 6; daysAgo >= 0; daysAgo--) {
        const label = dayLabel(daysAgo);
        const dayEnc = encounters.filter(e => isSameDay(e.createdAt, daysAgo));

        // Compute wait time: time between arrivedAt and triagedAt (or waitingAt)
        const waits = dayEnc
            .filter(e => e.arrivedAt && (e.triagedAt || e.waitingAt))
            .map(e => {
                const start = new Date(e.arrivedAt!).getTime();
                const end = new Date((e.triagedAt ?? e.waitingAt)!).getTime();
                return Math.max(0, (end - start) / 60_000);
            });

        const ctas12Waits = dayEnc
            .filter(e => e.currentCtasLevel != null && e.currentCtasLevel <= 2 && e.arrivedAt && (e.triagedAt || e.waitingAt))
            .map(e => {
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

export function computeChiefComplaints(encounters: Encounter[]): ChiefComplaintStat[] {
    const counts = new Map<string, number>();
    for (const e of encounters) {
        const complaint = (e.chiefComplaint ?? '').trim();
        if (!complaint) continue;
        // Normalize to title case for grouping
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

export function computeTriageEfficiency(encounters: Encounter[]): TriageEfficiency {
    // Avg triage duration: time from TRIAGE start to WAITING
    const triaged = encounters.filter(e =>
        e.triagedAt && e.waitingAt
    );
    const durations = triaged.map(e => {
        const start = new Date(e.triagedAt!).getTime();
        const end = new Date(e.waitingAt!).getTime();
        return Math.max(0, (end - start) / 60_000);
    });
    const avgDuration = durations.length > 0
        ? Math.round(durations.reduce((s, m) => s + m, 0) / durations.length * 10) / 10
        : 0;

    // Completion rate: encounters that went through triage vs total today
    const todayEnc = encounters.filter(e => isToday(e.createdAt));
    const todayTriaged = todayEnc.filter(e => e.triagedAt);
    const completionRate = todayEnc.length > 0
        ? Math.round((todayTriaged.length / todayEnc.length) * 1000) / 10
        : 0;

    // Pre-triage to triage: time from createdAt to triagedAt
    const preTriage = triaged.map(e => {
        const start = new Date(e.createdAt).getTime();
        const end = new Date(e.triagedAt!).getTime();
        return Math.max(0, (end - start) / 60_000);
    });
    const avgPreTriage = preTriage.length > 0
        ? Math.round(preTriage.reduce((s, m) => s + m, 0) / preTriage.length * 10) / 10
        : 0;

    // Longest current wait: among WAITING patients
    const waitingPatients = encounters.filter(e => e.status === 'WAITING');
    const waits = waitingPatients.map(e =>
        minutesSince(e.waitingAt ?? e.triagedAt ?? e.arrivedAt)
    );
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
    encounters: Encounter[],
    chatMessages: Record<number, ChatMessage[]>,
): ChatbotAnalytics {
    const todayEnc = encounters.filter(e => isToday(e.createdAt));

    // Total sessions: encounters that had at least one patient chat message
    const sessionsWithChat = todayEnc.filter(e => {
        const msgs = chatMessages[e.id] || [];
        return msgs.some(m => m.sender === 'patient');
    });
    const totalSessions = sessionsWithChat.length;

    // Completion rate: sessions with 3+ patient messages (completed pre-triage)
    const completed = sessionsWithChat.filter(e => {
        const msgs = chatMessages[e.id] || [];
        return msgs.filter(m => m.sender === 'patient').length >= 3;
    });
    const completionRate = totalSessions > 0
        ? Math.round((completed.length / totalSessions) * 100)
        : 0;

    // Assessment accuracy: encounters with chatbot data that got triaged (proxy)
    const withTriageAfterChat = completed.filter(e => e.triagedAt != null);
    const accuracy = completed.length > 0
        ? Math.round((withTriageAfterChat.length / completed.length) * 100)
        : 0;

    // Average session duration: estimated from first to last patient message
    const durations: number[] = [];
    for (const e of sessionsWithChat) {
        const msgs = (chatMessages[e.id] || []).filter(m => m.sender === 'patient');
        if (msgs.length < 2) continue;
        const first = new Date(msgs[0].timestamp).getTime();
        const last = new Date(msgs[msgs.length - 1].timestamp).getTime();
        const dur = (last - first) / 60_000;
        if (dur > 0) durations.push(dur);
    }
    const avgDuration = durations.length > 0
        ? Math.round(durations.reduce((s, m) => s + m, 0) / durations.length * 10) / 10
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

export function computeAlertMetrics(encounters: Encounter[]): AlertMetrics {
    const derived = deriveAlertsFromEncounters(encounters);
    const critical = derived.filter(a => a.severity === 'CRITICAL');

    // Patients re-triaged: encounters with more than one triage assessment
    const reTriage = encounters.filter(e =>
        e.triageAssessments && e.triageAssessments.length > 1
    );

    // Average response time: for encounters with alerts that got resolved (triagedAt after alert)
    const withAlerts = encounters.filter(e => derived.some(a => a.encounterId === e.id));
    const responseTimes = withAlerts
        .filter(e => e.triagedAt)
        .map(e => {
            const alertTime = new Date(e.updatedAt).getTime();
            const resolved = new Date(e.triagedAt!).getTime();
            return Math.max(0, (resolved - alertTime) / 60_000);
        })
        .filter(m => m > 0 && m < 120); // exclude outliers

    const avgResponse = responseTimes.length > 0
        ? Math.round(responseTimes.reduce((s, m) => s + m, 0) / responseTimes.length * 10) / 10
        : 0;

    return {
        totalAlerts: derived.length,
        criticalAlerts: critical.length,
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

export function computeStaffing(encounters: Encounter[]): ShiftWorkload[] {
    // Group encounters triaged today by shift hour range
    const todayTriaged = encounters.filter(e => isToday(e.triagedAt));

    const shifts = [
        { shift: 'Morning (07–15)', start: 7, end: 15, defaultNurses: 4 },
        { shift: 'Afternoon (15–23)', start: 15, end: 23, defaultNurses: 3 },
        { shift: 'Night (23–07)', start: 23, end: 7, defaultNurses: 2 },
    ];

    return shifts.map(s => {
        let shiftEnc: Encounter[];
        if (s.start < s.end) {
            shiftEnc = todayTriaged.filter(e => {
                const h = getHour(e.triagedAt);
                return h >= s.start && h < s.end;
            });
        } else {
            // Night shift wraps around midnight
            shiftEnc = todayTriaged.filter(e => {
                const h = getHour(e.triagedAt);
                return h >= s.start || h < s.end;
            });
        }

        const patientsTriaged = shiftEnc.length;
        // Note: actual nurse counts would come from a staffing API — using defaults for now
        const nursesOnDuty = s.defaultNurses;
        const patientsPerNurse = nursesOnDuty > 0
            ? Math.round(patientsTriaged / nursesOnDuty * 10) / 10
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

export function computeDisposition(encounters: Encounter[]): DispositionStat[] {
    const todayEnc = encounters.filter(e => isToday(e.createdAt));

    const complete = todayEnc.filter(e => e.status === 'COMPLETE');
    const cancelled = todayEnc.filter(e => e.status === 'CANCELLED');
    const inProgress = todayEnc.filter(e =>
        e.status === 'ADMITTED' || e.status === 'TRIAGE' || e.status === 'WAITING'
    );
    const expected = todayEnc.filter(e => e.status === 'EXPECTED');

    return [
        { label: 'Discharged', count: complete.length, color: '#22c55e' },
        { label: 'In Progress', count: inProgress.length, color: '#3b82f6' },
        { label: 'LWBS / Cancel', count: cancelled.length, color: '#ef4444' },
        { label: 'Expected', count: expected.length, color: '#eab308' },
    ];
}
