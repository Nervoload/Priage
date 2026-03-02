// HospitalApp/src/shared/api/useAlerts.ts
// React hook that provides a unified alert list by:
//   1. Deriving alerts client-side from encounter data
//   2. Fetching server-side alerts via REST (unacknowledged)
//   3. Listening for real-time alert events via WebSocket
//
// Usage:
//   const { alerts, acknowledgeAlert, resolveAlert, unacknowledgedCount } = useAlerts(encounters, hospitalId);

import { useState, useEffect, useMemo, useCallback } from 'react';
import { deriveAlertsFromEncounters, SEVERITY_COLORS } from './alertDerivation';
import { listUnacknowledgedAlerts, acknowledgeAlert as ackAlertApi, resolveAlert as resolveAlertApi } from './alerts';
import { getSocket } from '../realtime/socket';
import type { Encounter, Alert, AlertSeverity } from '../types/domain';
import { patientName as getPatientName, RealtimeEvents } from '../types/domain';

// ─── Unified alert type ────────────────────────────────────────────────────

export interface UnifiedAlert {
  /** Unique id (prefixed with 'server-' or 'derived-') */
  id: string;
  source: 'server' | 'derived';
  encounterId: number;
  type: string;
  severity: AlertSeverity;
  message: string;
  patientName: string;
  timestamp: string;
  acknowledged: boolean;
  resolved: boolean;
  /** Original server alert id (if source === 'server') for API calls */
  serverAlertId?: number;
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useAlerts(encounters: Encounter[], hospitalId: number | null) {
  const [serverAlerts, setServerAlerts] = useState<Alert[]>([]);
  const [acknowledgedDerived, setAcknowledgedDerived] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  // 1. Fetch server-side unacknowledged alerts
  const fetchServerAlerts = useCallback(async () => {
    if (!hospitalId) {
      setServerAlerts([]);
      return;
    }
    try {
      setLoading(true);
      const alerts = await listUnacknowledgedAlerts(hospitalId);
      setServerAlerts(alerts);
    } catch (err) {
      console.error('[useAlerts] Failed to fetch server alerts:', err);
    } finally {
      setLoading(false);
    }
  }, [hospitalId]);

  // Fetch once for hydration or hospital changes. WebSocket reconnects trigger
  // a fresh fetch so the UI can reconcile any updates missed while disconnected.
  useEffect(() => {
    fetchServerAlerts();
  }, [fetchServerAlerts]);

  // 2. Subscribe to real-time alert events
  useEffect(() => {
    const socket = getSocket();
    const handleConnect = () => {
      if (hospitalId) {
        void fetchServerAlerts();
      }
    };

    const handleAlertCreated = () => {
      void fetchServerAlerts();
    };

    const handleAlertAcknowledged = (payload: { metadata?: { alertId?: number } }) => {
      const alertId = payload?.metadata?.alertId;
      if (alertId) {
        setServerAlerts(prev => prev.filter(a => a.id !== alertId));
      }
    };

    const handleAlertResolved = (payload: { metadata?: { alertId?: number } }) => {
      const alertId = payload?.metadata?.alertId;
      if (alertId) {
        setServerAlerts(prev => prev.filter(a => a.id !== alertId));
      }
    };

    socket.on('connect', handleConnect);
    socket.on(RealtimeEvents.AlertCreated, handleAlertCreated);
    socket.on(RealtimeEvents.AlertAcknowledged, handleAlertAcknowledged);
    socket.on(RealtimeEvents.AlertResolved, handleAlertResolved);

    return () => {
      socket.off('connect', handleConnect);
      socket.off(RealtimeEvents.AlertCreated, handleAlertCreated);
      socket.off(RealtimeEvents.AlertAcknowledged, handleAlertAcknowledged);
      socket.off(RealtimeEvents.AlertResolved, handleAlertResolved);
    };
  }, [fetchServerAlerts, hospitalId]);

  // 3. Derive alerts from encounters
  const derivedAlerts = useMemo(
    () => deriveAlertsFromEncounters(encounters),
    [encounters],
  );

  // 4. Merge server + derived into a unified list
  const alerts = useMemo<UnifiedAlert[]>(() => {
    const unified: UnifiedAlert[] = [];

    // Server alerts
    for (const sa of serverAlerts) {
      unified.push({
        id: `server-${sa.id}`,
        source: 'server',
        encounterId: sa.encounterId,
        type: sa.type,
        severity: sa.severity,
        message: `[${sa.type}] Alert on encounter #${sa.encounterId}`,
        patientName: '', // We could enrich from encounters
        timestamp: sa.createdAt,
        acknowledged: !!sa.acknowledgedAt,
        resolved: !!sa.resolvedAt,
        serverAlertId: sa.id,
      });
    }

    // Enrich server alert patient names from encounters
    const encMap = new Map(encounters.map(e => [e.id, e]));
    for (const ua of unified) {
      const enc = encMap.get(ua.encounterId);
      if (enc) {
        const name = getPatientName(enc.patient);
        ua.patientName = name;
        ua.message = `${name} — ${ua.type}`;
      }
    }

    // Derived alerts (skip if acknowledged locally)
    for (const da of derivedAlerts) {
      if (acknowledgedDerived.has(da.id)) continue;
      unified.push({
        id: da.id,
        source: 'derived',
        encounterId: da.encounterId,
        type: da.type,
        severity: da.severity,
        message: da.message,
        patientName: da.patientName,
        timestamp: da.timestamp,
        acknowledged: da.acknowledged,
        resolved: false,
      });
    }

    // Sort by severity
    const order: Record<AlertSeverity, number> = {
      CRITICAL: 0,
      HIGH: 1,
      MEDIUM: 2,
      LOW: 3,
    };
    return unified.sort((a, b) => order[a.severity] - order[b.severity]);
  }, [serverAlerts, derivedAlerts, acknowledgedDerived, encounters]);

  // ─── Actions ───────────────────────────────────────────────────────────────

  const acknowledge = useCallback(async (alert: UnifiedAlert) => {
    if (alert.source === 'server' && alert.serverAlertId) {
      try {
        await ackAlertApi(alert.serverAlertId);
        setServerAlerts(prev => prev.filter(a => a.id !== alert.serverAlertId));
      } catch (err) {
        console.error('[useAlerts] Failed to acknowledge alert:', err);
      }
    } else if (alert.source === 'derived') {
      setAcknowledgedDerived(prev => new Set(prev).add(alert.id));
    }
  }, []);

  const resolve = useCallback(async (alert: UnifiedAlert) => {
    if (alert.source === 'server' && alert.serverAlertId) {
      try {
        await resolveAlertApi(alert.serverAlertId);
        setServerAlerts(prev => prev.filter(a => a.id !== alert.serverAlertId));
      } catch (err) {
        console.error('[useAlerts] Failed to resolve alert:', err);
      }
    } else if (alert.source === 'derived') {
      // For derived alerts, acknowledge = dismiss
      setAcknowledgedDerived(prev => new Set(prev).add(alert.id));
    }
  }, []);

  const unacknowledgedCount = alerts.filter(a => !a.acknowledged).length;

  return {
    alerts,
    loading,
    unacknowledgedCount,
    acknowledge,
    resolve,
    refresh: fetchServerAlerts,
    severityColors: SEVERITY_COLORS,
  };
}
