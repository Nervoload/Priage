// HospitalApp/src/features/waitingroom/AlertDashboard.tsx
// Alert dashboard for the Waiting Room — shows patient wait times + new-message indicators.
//
// ────────────────────────────────────────────────────────────────────────────
// BACKEND CONNECTION PLACEHOLDERS (Phase 6.3)
// ────────────────────────────────────────────────────────────────────────────
//
// Currently this component derives all data client-side from encounter
// timestamps and local chatMessages state.  To connect to the backend:
//
// 1. REAL-TIME MESSAGE ALERTS
//    - Subscribe to 'message.created' Socket.IO events via getSocket() from
//      '../../shared/realtime/socket'.
//    - When a message arrives with senderType === 'PATIENT', increment the
//      new-message count for that encounterId.
//    - The seenPatientMsgCounts ref below is the baseline — real-time events
//      would push counts above the baseline, triggering the "💬 new" badge.
//
// 2. SERVER-SIDE ALERTS
//    - Accept an optional `serverAlerts: UnifiedAlert[]` prop (from useAlerts)
//      and merge them into the dashboard items alongside the derived wait-time rows.
//    - Render server alerts with their own severity/type and a "View" action
//      instead of dismiss.
//
// 3. ACKNOWLEDGE / RESOLVE
//    - Replace the local `dismissed` Set with calls to:
//        acknowledgeAlert(alertId) from '../../shared/api/alerts'
//        resolveAlert(alertId)     from '../../shared/api/alerts'
//    - Optimistically remove the row and roll back on error.
//
// 4. FETCH MESSAGE HISTORY
//    - On mount, call listMessages(encounterId) from '../../shared/api/messaging'
//      to get historical patient messages and set the baseline unread count
//      relative to the last read timestamp (stored per-encounter on the backend).
//
// See FEATURES.md § "Alert Dashboard" for the full integration guide.
// ────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Encounter, ChatMessage } from '../../app/HospitalApp';
import { patientName } from '../../app/HospitalApp';
// TODO (Phase 6.3): import { getSocket } from '../../shared/realtime/socket';
// TODO (Phase 6.3): import { RealtimeEvents } from '../../shared/types/domain';
// TODO (Phase 6.3): import type { UnifiedAlert } from '../../shared/api/useAlerts';
// TODO (Phase 6.3): import { acknowledgeAlert, resolveAlert } from '../../shared/api/alerts';
// TODO (Phase 6.3): import { listMessages } from '../../shared/api/messaging';

interface AlertDashboardProps {
    encounters: Encounter[];
    chatMessages: Record<number, ChatMessage[]>;
    onSelectPatient?: (encounterId: number) => void;
    // TODO (Phase 6.3): Add these props when wiring to backend:
    // serverAlerts?: UnifiedAlert[];
    // onAcknowledgeAlert?: (alert: UnifiedAlert) => void;
    // onResolveAlert?: (alert: UnifiedAlert) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function minutesSince(isoDate: string | null | undefined): number {
    if (!isoDate) return 0;
    return (Date.now() - new Date(isoDate).getTime()) / 60_000;
}

/** Pick the best "started waiting" timestamp for display */
function waitingSince(enc: Encounter): string | null {
    if (enc.status === 'WAITING' && enc.waitingAt) return enc.waitingAt;
    if (enc.status === 'TRIAGE' && enc.triagedAt) return enc.triagedAt;
    return enc.arrivedAt ?? enc.createdAt;
}

type Severity = 'ok' | 'warn' | 'critical';

function waitSeverity(mins: number): Severity {
    if (mins >= 45) return 'critical';
    if (mins >= 15) return 'warn';
    return 'ok';
}

const SEVERITY_STYLES: Record<Severity, { bg: string; border: string; dot: string; text: string }> = {
    ok: { bg: '#f0fdf4', border: '#bbf7d0', dot: '#22c55e', text: '#166534' },
    warn: { bg: '#fffbeb', border: '#fde68a', dot: '#f59e0b', text: '#92400e' },
    critical: { bg: '#fef2f2', border: '#fecaca', dot: '#ef4444', text: '#991b1b' },
};

// ─── Component ──────────────────────────────────────────────────────────────

export function AlertDashboard({ encounters, chatMessages, onSelectPatient }: AlertDashboardProps) {
    const [collapsed, setCollapsed] = useState(false);
    const [dismissed, setDismissed] = useState<Set<number>>(new Set());

    // Track "seen" patient message counts at mount-time to detect new ones.
    // TODO (Phase 6.3): Replace this with a backend-driven "last read" timestamp
    //   per encounter, fetched via listMessages() or a dedicated unread-count endpoint.
    const seenPatientMsgCounts = useRef<Record<number, number>>({});
    const [, forceUpdate] = useState(0);

    // Seed baseline message counts once on mount
    useEffect(() => {
        const baseline: Record<number, number> = {};
        for (const enc of encounters) {
            const msgs = chatMessages[enc.id] || [];
            baseline[enc.id] = msgs.filter(m => m.sender === 'patient').length;
        }
        seenPatientMsgCounts.current = baseline;
    }, []); // intentionally mount-only

    // Auto-refresh wait-time display every 30s
    useEffect(() => {
        const timer = setInterval(() => forceUpdate(n => n + 1), 30_000);
        return () => clearInterval(timer);
    }, []);

    // TODO (Phase 6.3): Subscribe to real-time message events here:
    //   useEffect(() => {
    //     const socket = getSocket();
    //     const handleNewMessage = (payload: { encounterId: number; senderType: string }) => {
    //       if (payload.senderType === 'PATIENT') {
    //         // Trigger a re-render so the "new message" badge appears
    //         forceUpdate(n => n + 1);
    //       }
    //     };
    //     socket.on(RealtimeEvents.MessageCreated, handleNewMessage);
    //     return () => { socket.off(RealtimeEvents.MessageCreated, handleNewMessage); };
    //   }, []);

    const dismiss = useCallback((encId: number) => {
        // TODO (Phase 6.3): Call acknowledgeAlert(alertId) here instead of local dismiss.
        setDismissed(prev => new Set(prev).add(encId));
    }, []);

    // Build alert items — one row per encounter
    const items = encounters
        .filter(enc => !dismissed.has(enc.id))
        .map(enc => {
            const since = waitingSince(enc);
            const mins = minutesSince(since);
            const severity = waitSeverity(mins);
            const name = patientName(enc.patient);

            // Detect new patient messages since mount
            // TODO (Phase 6.3): Replace with backend-driven unread count
            const currentPatientMsgs = (chatMessages[enc.id] || []).filter(m => m.sender === 'patient').length;
            const baselineCount = seenPatientMsgCounts.current[enc.id] ?? 0;
            const newMsgCount = Math.max(0, currentPatientMsgs - baselineCount);

            return { enc, mins, severity, name, newMsgCount };
        });

    // Sort: critical first, then warn, then ok
    const order: Record<Severity, number> = { critical: 0, warn: 1, ok: 2 };
    items.sort((a, b) => order[a.severity] - order[b.severity]);

    const critCount = items.filter(i => i.severity === 'critical').length;
    const warnCount = items.filter(i => i.severity === 'warn').length;
    const msgCount = items.reduce((s, i) => s + i.newMsgCount, 0);

    // Always render the dashboard (even with zero alerts) so staff always see it.

    return (
        <div
            style={{
                marginBottom: '1rem',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                border: '1px solid #e5e7eb',
                backgroundColor: 'white',
            }}
        >
            {/* Header bar */}
            <div
                onClick={() => setCollapsed(!collapsed)}
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.65rem 1.25rem',
                    cursor: 'pointer',
                    background: 'linear-gradient(90deg, #7c3aed 0%, #6d28d9 100%)',
                    color: 'white',
                    userSelect: 'none',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '1rem' }}>📋</span>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                        Alert Dashboard
                    </span>
                    {/* Summary badges */}
                    <div style={{ display: 'flex', gap: '0.4rem', marginLeft: '0.25rem' }}>
                        {critCount > 0 && (
                            <span style={{
                                backgroundColor: '#ef4444',
                                color: 'white',
                                borderRadius: '10px',
                                padding: '0.1rem 0.55rem',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                            }}>
                                {critCount} critical
                            </span>
                        )}
                        {warnCount > 0 && (
                            <span style={{
                                backgroundColor: '#f59e0b',
                                color: 'white',
                                borderRadius: '10px',
                                padding: '0.1rem 0.55rem',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                            }}>
                                {warnCount} warning
                            </span>
                        )}
                        {msgCount > 0 && (
                            <span style={{
                                backgroundColor: '#3b82f6',
                                color: 'white',
                                borderRadius: '10px',
                                padding: '0.1rem 0.55rem',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                            }}>
                                💬 {msgCount} new
                            </span>
                        )}
                        {items.length === 0 && (
                            <span style={{
                                backgroundColor: 'rgba(255,255,255,0.25)',
                                borderRadius: '10px',
                                padding: '0.1rem 0.55rem',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                            }}>
                                All clear
                            </span>
                        )}
                    </div>
                </div>
                <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                    {collapsed ? '▼' : '▲'}
                </span>
            </div>

            {/* Alert rows */}
            {!collapsed && (
                <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                    {items.length === 0 ? (
                        <div style={{
                            padding: '1.25rem',
                            textAlign: 'center',
                            color: '#6b7280',
                            fontSize: '0.85rem',
                        }}>
                            ✅ No active alerts — all patients are within normal wait times.
                        </div>
                    ) : (
                        items.map(({ enc, mins, severity, name, newMsgCount }) => {
                            const colors = SEVERITY_STYLES[severity];
                            return (
                                <div
                                    key={enc.id}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.75rem',
                                        padding: '0.6rem 1.25rem',
                                        backgroundColor: colors.bg,
                                        borderBottom: `1px solid ${colors.border}`,
                                        cursor: onSelectPatient ? 'pointer' : 'default',
                                        transition: 'background-color 0.15s',
                                    }}
                                    onClick={() => onSelectPatient?.(enc.id)}
                                    onMouseOver={e => { e.currentTarget.style.opacity = '0.85'; }}
                                    onMouseOut={e => { e.currentTarget.style.opacity = '1'; }}
                                >
                                    {/* Severity dot */}
                                    <div
                                        style={{
                                            width: '10px',
                                            height: '10px',
                                            borderRadius: '50%',
                                            backgroundColor: colors.dot,
                                            flexShrink: 0,
                                            boxShadow: severity === 'critical' ? `0 0 6px ${colors.dot}` : 'none',
                                            animation: severity === 'critical' ? 'pulse 2s infinite' : 'none',
                                        }}
                                    />

                                    {/* Info */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span style={{ fontWeight: 600, fontSize: '0.85rem', color: colors.text }}>
                                                {name}
                                            </span>
                                            {newMsgCount > 0 && (
                                                <span style={{
                                                    backgroundColor: '#3b82f6',
                                                    color: 'white',
                                                    borderRadius: '10px',
                                                    padding: '0.05rem 0.45rem',
                                                    fontSize: '0.65rem',
                                                    fontWeight: 700,
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '0.2rem',
                                                }}>
                                                    💬 {newMsgCount} new message{newMsgCount > 1 ? 's' : ''}
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.1rem' }}>
                                            <span style={{ textTransform: 'capitalize' }}>{enc.status.toLowerCase()}</span>
                                            {' · '}
                                            has been waiting for <strong style={{ color: colors.text }}>{Math.round(mins)} min</strong>
                                            {enc.chiefComplaint && (
                                                <> · {enc.chiefComplaint}</>
                                            )}
                                        </div>
                                    </div>

                                    {/* Dismiss */}
                                    <button
                                        onClick={e => { e.stopPropagation(); dismiss(enc.id); }}
                                        title="Dismiss"
                                        style={{
                                            padding: '0.2rem 0.5rem',
                                            fontSize: '0.7rem',
                                            fontWeight: 500,
                                            backgroundColor: 'rgba(0,0,0,0.05)',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            color: '#6b7280',
                                            flexShrink: 0,
                                        }}
                                    >
                                        ✕
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* Pulse keyframe (injected once) */}
            <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
        </div>
    );
}
