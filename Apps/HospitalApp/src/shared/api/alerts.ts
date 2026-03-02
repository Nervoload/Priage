// HospitalApp/src/shared/api/alerts.ts
// API calls for alerts — mirrors backend AlertsController.

import { client } from './client';
import type { Alert, AlertSeverity } from '../types/domain';

// ─── Create an alert ────────────────────────────────────────────────────────

export interface CreateAlertPayload {
  encounterId: number;
  type: string;
  severity?: AlertSeverity;
  metadata?: Record<string, unknown>;
}

export async function createAlert(payload: CreateAlertPayload): Promise<Alert> {
  return client<Alert>('/alerts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ─── Acknowledge an alert ───────────────────────────────────────────────────

export async function acknowledgeAlert(alertId: number): Promise<Alert> {
  return client<Alert>(`/alerts/${alertId}/acknowledge`, { method: 'POST' });
}

// ─── Resolve an alert ───────────────────────────────────────────────────────

export async function resolveAlert(alertId: number): Promise<Alert> {
  return client<Alert>(`/alerts/${alertId}/resolve`, { method: 'POST' });
}

// ─── List unacknowledged alerts for a hospital ──────────────────────────────
// Used for initial hydration and reconnect recovery. Live alert lifecycle
// updates arrive through the Socket.IO realtime channel.

export async function listUnacknowledgedAlerts(hospitalId: number): Promise<Alert[]> {
  return client<Alert[]>(`/alerts/hospitals/${hospitalId}/unacknowledged`);
}

// ─── List alerts for an encounter ───────────────────────────────────────────

export async function listAlertsForEncounter(encounterId: number): Promise<Alert[]> {
  return client<Alert[]>(`/alerts/encounters/${encounterId}`);
}
