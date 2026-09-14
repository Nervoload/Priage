import { client } from './client';

export type AlertWebhookSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AlertWebhookStatus = 'ACTIVE' | 'DISABLED';

export interface AlertWebhookSubscription {
  id: number;
  hospitalId: number;
  name: string;
  targetUrl: string;
  status: AlertWebhookStatus;
  eventTypes: string[];
  secretFingerprint: string;
  secretKeyVersion: number;
  minimumSeverity: AlertWebhookSeverity;
  lastTestedAt: string | null;
  lastSuccessfulDeliveryAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AlertWebhookDelivery {
  id: number;
  eventId: string;
  eventType: string;
  status: 'PENDING' | 'DELIVERED' | 'FAILED';
  attempts: number;
  nextAttemptAt: string;
  deliveredAt: string | null;
  lastAttemptAt: string | null;
  lastError: string | null;
  responseStatus: number | null;
  createdAt: string;
  updatedAt: string;
}

export function listAlertWebhooks(hospitalId: number): Promise<AlertWebhookSubscription[]> {
  return client(`/hospitals/${hospitalId}/alert-webhooks`);
}

export function createAlertWebhook(
  hospitalId: number,
  input: { name: string; targetUrl: string; minimumSeverity: AlertWebhookSeverity },
): Promise<{ subscription: AlertWebhookSubscription; signingSecret: string }> {
  return client(`/hospitals/${hospitalId}/alert-webhooks`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateAlertWebhook(
  hospitalId: number,
  subscriptionId: number,
  input: Partial<Pick<AlertWebhookSubscription, 'name' | 'targetUrl' | 'minimumSeverity' | 'status'>>,
): Promise<AlertWebhookSubscription> {
  return client(`/hospitals/${hospitalId}/alert-webhooks/${subscriptionId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function rotateAlertWebhookSecret(
  hospitalId: number,
  subscriptionId: number,
): Promise<{ subscription: AlertWebhookSubscription; signingSecret: string }> {
  return client(`/hospitals/${hospitalId}/alert-webhooks/${subscriptionId}/rotate-secret`, { method: 'POST' });
}

export function testAlertWebhook(hospitalId: number, subscriptionId: number): Promise<AlertWebhookDelivery> {
  return client(`/hospitals/${hospitalId}/alert-webhooks/${subscriptionId}/test`, { method: 'POST' });
}

export function listAlertWebhookDeliveries(
  hospitalId: number,
  subscriptionId: number,
): Promise<AlertWebhookDelivery[]> {
  return client(`/hospitals/${hospitalId}/alert-webhooks/${subscriptionId}/deliveries`);
}

export function retryAlertWebhookDelivery(
  hospitalId: number,
  subscriptionId: number,
  deliveryId: number,
): Promise<{ ok: true }> {
  return client(`/hospitals/${hospitalId}/alert-webhooks/${subscriptionId}/deliveries/${deliveryId}/retry`, {
    method: 'POST',
  });
}
