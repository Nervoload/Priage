// HospitalApp/src/shared/queue/queuePriority.ts
// Dynamic queue priority algorithm for emergency department triage.
//
// Scores each patient based on CTAS level + wait-time escalation.
// Ensures high-acuity patients are seen first while preventing
// low-acuity patients from waiting indefinitely.

import type { Encounter } from '../types/domain';

// ─── CTAS Configuration (Canadian Triage and Acuity Scale) ──────────────────

interface CtasConfig {
    /** Base priority weight — higher = more urgent */
    baseWeight: number;
    /** Target wait time in minutes (from CTAS guidelines) */
    targetMinutes: number;
    /** Human-readable label */
    label: string;
}

const CTAS_CONFIG: Record<number, CtasConfig> = {
    1: { baseWeight: 100, targetMinutes: 0, label: 'Resuscitation' },
    2: { baseWeight: 80, targetMinutes: 15, label: 'Emergent' },
    3: { baseWeight: 60, targetMinutes: 30, label: 'Urgent' },
    4: { baseWeight: 40, targetMinutes: 60, label: 'Less Urgent' },
    5: { baseWeight: 20, targetMinutes: 120, label: 'Non-Urgent' },
};

/** Fallback for patients with no CTAS level assigned */
const NO_CTAS_CONFIG: CtasConfig = {
    baseWeight: 10,
    targetMinutes: 120,
    label: 'Unassigned',
};

/**
 * Escalation rate: how many priority points to add per full target-time
 * past due. At 15, a CTAS-5 patient at 2× their target (4 hours) gains
 * 15 points, bringing them from 20 to 35 — still below a fresh CTAS-3 (60)
 * but above a fresh CTAS-5 (20). At 4× target (8 hours), they reach 65,
 * finally surpassing a fresh CTAS-3.
 */
const ESCALATION_RATE = 15;

// ─── Types ──────────────────────────────────────────────────────────────────

export type WaitStatus = 'on-time' | 'approaching' | 'overdue';

export interface QueueEntry {
    encounter: Encounter;
    /** Dynamic priority score (higher = more urgent) */
    priorityScore: number;
    /** 1-based queue position */
    position: number;
    /** Minutes the patient has been waiting */
    waitMinutes: number;
    /** CTAS target wait time in minutes */
    targetMinutes: number;
    /** How close/past the target wait time */
    waitStatus: WaitStatus;
    /** What percentage of target time has elapsed (0–∞) */
    waitRatio: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function minutesSince(isoDate: string | null | undefined): number {
    if (!isoDate) return 0;
    return Math.max(0, (Date.now() - new Date(isoDate).getTime()) / 60_000);
}

/**
 * Determine the start of the patient's current wait period.
 * Priority: waitingAt (entered waiting room) > triagedAt > arrivedAt > createdAt
 */
function getWaitStart(enc: Encounter): string {
    return enc.waitingAt ?? enc.triagedAt ?? enc.arrivedAt ?? enc.createdAt;
}

// ─── Core Algorithm ─────────────────────────────────────────────────────────

/**
 * Compute the dynamic priority score for a single encounter.
 *
 * Formula:
 *   score = baseWeight + max(0, waitRatio - 1.0) × ESCALATION_RATE
 *
 * Where:
 *   waitRatio = actualWaitMinutes / targetMinutes
 *
 * CTAS-1 is always pinned at 100+ since their target is 0 minutes (immediate).
 * Patients with no CTAS get the lowest base (10) and escalate slowly.
 */
export function computePriorityScore(encounter: Encounter): {
    score: number;
    waitMinutes: number;
    targetMinutes: number;
    waitStatus: WaitStatus;
    waitRatio: number;
} {
    const ctasLevel = encounter.currentCtasLevel;
    const config = ctasLevel != null ? (CTAS_CONFIG[ctasLevel] ?? NO_CTAS_CONFIG) : NO_CTAS_CONFIG;

    const waitMinutes = minutesSince(getWaitStart(encounter));
    const targetMinutes = config.targetMinutes;

    // CTAS-1: immediate — always maximum priority, escalate further with time
    if (ctasLevel === 1) {
        // Score starts at 100, grows with every minute to stay above all others
        const score = config.baseWeight + waitMinutes * 0.5;
        return {
            score,
            waitMinutes,
            targetMinutes,
            waitStatus: waitMinutes > 0 ? 'overdue' : 'on-time',
            waitRatio: Infinity,
        };
    }

    // For CTAS 2-5 and unassigned:
    const waitRatio = targetMinutes > 0 ? waitMinutes / targetMinutes : 0;

    // Escalation: only kicks in after exceeding target time
    const escalation = Math.max(0, waitRatio - 1.0) * ESCALATION_RATE;
    const score = config.baseWeight + escalation;

    // Determine wait status
    let waitStatus: WaitStatus;
    if (waitRatio >= 1.0) {
        waitStatus = 'overdue';
    } else if (waitRatio >= 0.75) {
        waitStatus = 'approaching';
    } else {
        waitStatus = 'on-time';
    }

    return { score, waitMinutes, targetMinutes, waitStatus, waitRatio };
}

/**
 * Sort encounters by queue priority and return enriched QueueEntry objects.
 *
 * Sorting rules (in order):
 * 1. Higher priority score first
 * 2. If scores are equal (within 0.5 tolerance), earlier arrival first (FIFO)
 * 3. CTAS-1 patients always at the very top
 */
export function sortByQueuePriority(encounters: Encounter[]): QueueEntry[] {
    // Only sort encounters that are actively waiting (WAITING status)
    const entries = encounters.map((encounter) => {
        const { score, waitMinutes, targetMinutes, waitStatus, waitRatio } = computePriorityScore(encounter);
        return {
            encounter,
            priorityScore: score,
            position: 0, // assigned after sorting
            waitMinutes,
            targetMinutes,
            waitStatus,
            waitRatio,
        };
    });

    // Sort: highest score first, then earliest arrival (FIFO tiebreaker)
    entries.sort((a, b) => {
        // Score comparison (higher = more urgent = comes first)
        const scoreDiff = b.priorityScore - a.priorityScore;
        if (Math.abs(scoreDiff) > 0.5) return scoreDiff;

        // Tiebreaker: earlier wait start time comes first
        const aStart = new Date(getWaitStart(a.encounter)).getTime();
        const bStart = new Date(getWaitStart(b.encounter)).getTime();
        return aStart - bStart;
    });

    // Assign 1-based positions
    entries.forEach((entry, i) => {
        entry.position = i + 1;
    });

    return entries;
}

/**
 * Get just the queue position map (encounter ID → position) for quick lookups.
 * Useful for components that need positions without the full QueueEntry.
 */
export function getQueuePositions(encounters: Encounter[]): Map<number, QueueEntry> {
    const entries = sortByQueuePriority(encounters);
    const map = new Map<number, QueueEntry>();
    for (const entry of entries) {
        map.set(entry.encounter.id, entry);
    }
    return map;
}

/**
 * Format a wait status into a human-readable label with icon.
 */
export function formatWaitStatus(status: WaitStatus): { icon: string; label: string; color: string } {
    switch (status) {
        case 'on-time':
            return { icon: '✅', label: 'On Time', color: '#22c55e' };
        case 'approaching':
            return { icon: '⚠️', label: 'Approaching', color: '#f59e0b' };
        case 'overdue':
            return { icon: '🔴', label: 'Overdue', color: '#ef4444' };
    }
}

/**
 * Get the CTAS target wait time for display purposes.
 */
export function getCtasTarget(ctasLevel: number | null): { label: string; targetMin: number } {
    if (ctasLevel == null) return { label: 'Unassigned', targetMin: 120 };
    const config = CTAS_CONFIG[ctasLevel] ?? NO_CTAS_CONFIG;
    return { label: config.label, targetMin: config.targetMinutes };
}
