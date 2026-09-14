import { AlertSeverity } from '@prisma/client';
import { createHmac } from 'crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WebhookOutboxService } from '../src/modules/webhooks/webhook-outbox.service';
import {
  computeWebhookBackoffMs,
  createWebhookSignature,
  WebhookDeliveryService,
} from '../src/modules/webhooks/webhook-delivery.service';
import { SafetyMetricsService } from '../src/common/metrics/safety-metrics.service';
import { WebhookSecretService } from '../src/modules/webhooks/webhook-secret.service';
import { WebhookUrlPolicyService } from '../src/modules/webhooks/webhook-url-policy.service';
import { AlertWebhooksService } from '../src/modules/webhooks/alert-webhooks.service';

describe('webhook security primitives', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('signs the exact timestamp and raw body bytes', () => {
    const body = '{"type":"alert.triggered","data":{"severity":"HIGH"}}';
    const expected = createHmac('sha256', 'secret').update(`1700000000.${body}`).digest('hex');
    expect(createWebhookSignature('secret', '1700000000', body)).toBe(`v1=${expected}`);
  });

  it('caps jittered exponential retry delay at fifteen minutes', () => {
    expect(computeWebhookBackoffMs(1, () => 1)).toBe(5_000);
    expect(computeWebhookBackoffMs(2, () => 0.5)).toBe(5_000);
    expect(computeWebhookBackoffMs(20, () => 1)).toBe(15 * 60_000);
    expect(computeWebhookBackoffMs(1, () => 0)).toBe(1_000);
  });

  it('encrypts signing secrets and exposes only a fingerprint', () => {
    vi.stubEnv('WEBHOOK_SECRET_ENCRYPTION_KEY', Buffer.alloc(32, 7).toString('base64'));
    const service = new WebhookSecretService();
    const encrypted = service.encrypt('signing-secret');
    expect(encrypted).not.toContain('signing-secret');
    expect(service.decrypt(encrypted)).toBe('signing-secret');
    expect(service.fingerprint('signing-secret')).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('webhook URL policy', () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    'http://127.0.0.1/hook',
    'http://10.2.3.4/hook',
    'http://169.254.169.254/latest/meta-data',
    'http://[::1]/hook',
  ])('rejects private or local target %s', async (target) => {
    await expect(new WebhookUrlPolicyService().assertAllowed(target)).rejects.toThrow(/private|local/);
  });

  it('requires production HTTPS and an exact allowlisted hostname', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('WEBHOOK_ALLOWED_HOSTS', 'hooks.example.ca');
    await expect(new WebhookUrlPolicyService().assertAllowed('http://hooks.example.ca/hook'))
      .rejects.toThrow(/HTTPS/);
    await expect(new WebhookUrlPolicyService().assertAllowed('https://other.example.ca/hook'))
      .rejects.toThrow(/allowlisted/);
  });

  it('rejects embedded URL credentials before resolving DNS', async () => {
    await expect(new WebhookUrlPolicyService().assertAllowed('https://user:pass@example.ca/hook'))
      .rejects.toThrow(/credentials/);
  });
});

describe('alert webhook outbox payloads', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('filters subscriptions by severity and never serializes alert PHI', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    const tx = {
      webhookSubscription: {
        findMany: vi.fn().mockResolvedValue([
          { id: 1, minimumSeverity: AlertSeverity.HIGH },
          { id: 2, minimumSeverity: AlertSeverity.CRITICAL },
        ]),
      },
      webhookDelivery: { createMany },
    };
    await new WebhookOutboxService().enqueueAlertLifecycleTx(
      tx as never,
      {
        id: 9,
        hospitalId: 3,
        encounterId: 12,
        type: 'WAIT_TIME_ESCALATION',
        severity: AlertSeverity.HIGH,
        metadata: { patientName: 'Must not leave database', complaint: 'secret' },
      } as never,
      { id: 44, createdAt: new Date('2026-08-24T12:00:00Z') } as never,
      'alert.triggered',
    );

    const rows = createMany.mock.calls[0]?.[0]?.data;
    expect(rows).toHaveLength(1);
    expect(rows[0].webhookSubscriptionId).toBe(1);
    expect(rows[0].sourceEventId).toBe(44);
    expect(createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));
    expect(JSON.stringify(rows[0].payload)).not.toMatch(/patient|complaint|secret/i);
    expect(rows[0].payload).toMatchObject({
      type: 'alert.triggered',
      hospitalId: 3,
      data: { alertId: 9, alertType: 'WAIT_TIME_ESCALATION', severity: 'HIGH' },
    });
  });

  it.each([
    [AlertSeverity.LOW, AlertSeverity.MEDIUM, false],
    [AlertSeverity.MEDIUM, AlertSeverity.MEDIUM, true],
    [AlertSeverity.CRITICAL, AlertSeverity.CRITICAL, true],
  ])('applies threshold %s against alert %s', async (alertSeverity, threshold, shouldCreate) => {
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    const tx = {
      webhookSubscription: {
        findMany: vi.fn().mockResolvedValue([{ id: 1, minimumSeverity: threshold }]),
      },
      webhookDelivery: { createMany },
    };
    await new WebhookOutboxService().enqueueAlertLifecycleTx(
      tx as never,
      { id: 1, hospitalId: 1, type: 'RULE', severity: alertSeverity } as never,
      { id: 1, createdAt: new Date() } as never,
      'alert.resolved',
    );
    expect(createMany).toHaveBeenCalledTimes(shouldCreate ? 1 : 0);
  });

  it('exposes the allowlisted lifecycle types and includes a configured generic dashboard URL', async () => {
    vi.stubEnv('HOSPITAL_DASHBOARD_URL', 'https://hospital.example.ca/alerts');
    const service = new WebhookOutboxService();
    expect(service.eventTypes).toEqual([
      'alert.triggered',
      'alert.escalated',
      'alert.acknowledged',
      'alert.resolved',
    ]);
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    await service.enqueueAlertLifecycleTx(
      {
        webhookSubscription: { findMany: vi.fn().mockResolvedValue([{ id: 1, minimumSeverity: AlertSeverity.LOW }]) },
        webhookDelivery: { createMany },
      } as never,
      { id: 1, hospitalId: 1, type: 'RULE', severity: AlertSeverity.LOW } as never,
      { id: 1, createdAt: new Date() } as never,
      'alert.acknowledged',
    );
    expect(createMany.mock.calls[0]?.[0]?.data[0].payload.data.dashboardUrl)
      .toBe('https://hospital.example.ca/alerts');
  });
});

describe('durable webhook delivery', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function deliveryHarness(attempts = 1) {
    const delivery = {
      id: 4,
      eventId: 'stable-event-id',
      eventType: 'alert.triggered',
      payload: { id: 'stable-event-id', type: 'alert.triggered', hospitalId: 3 },
      attempts,
      webhookSubscription: {
        id: 8,
        targetUrl: 'https://hooks.example.ca/priage',
        secretEncrypted: 'encrypted',
      },
    };
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      webhookDelivery: {
        update: vi.fn().mockResolvedValue({}),
        updateMany,
      },
      webhookSubscription: { update: vi.fn().mockResolvedValue({}) },
      $transaction: vi.fn().mockResolvedValue([]),
    };
    const metrics = new SafetyMetricsService();
    const service = new WebhookDeliveryService(
      prisma as never,
      { decrypt: vi.fn().mockReturnValue('plain-secret') } as never,
      { assertAllowed: vi.fn().mockResolvedValue(new URL(delivery.webhookSubscription.targetUrl)) } as never,
      { warn: vi.fn() } as never,
      metrics,
    );
    vi.spyOn(service as any, 'claim').mockResolvedValue([delivery]);
    return { service, prisma, metrics, updateMany };
  }

  it('sends exact signed bytes without following redirects', async () => {
    const harness = deliveryHarness();
    const fetchMock = vi.fn().mockResolvedValue({ status: 204 });
    vi.stubGlobal('fetch', fetchMock);
    await expect(harness.service.deliverPending()).resolves.toEqual({ claimed: 1, delivered: 1, failed: 0 });
    const request = fetchMock.mock.calls[0]?.[1] as { redirect: string; body: string; headers: Record<string, string> };
    expect(request.redirect).toBe('manual');
    expect(request.headers['X-Priage-Webhook-Id']).toBe('stable-event-id');
    expect(request.headers['X-Priage-Signature']).toBe(
      createWebhookSignature('plain-secret', request.headers['X-Priage-Webhook-Timestamp'], request.body),
    );
    expect(harness.metrics.snapshot().webhookDelivered).toBe(1);
  });

  it('retries redirects and network failures with response diagnostics', async () => {
    const harness = deliveryHarness();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 302 }));
    await expect(harness.service.deliverPending()).resolves.toEqual({ claimed: 1, delivered: 0, failed: 1 });
    expect(harness.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'PENDING',
        responseStatus: 302,
        claimToken: null,
      }),
    }));
    expect(harness.metrics.snapshot().webhookRetried).toBe(1);
  });

  it('marks the eighth failed attempt permanently failed', async () => {
    const harness = deliveryHarness(8);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network unavailable')));
    await harness.service.deliverPending();
    expect(harness.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'FAILED', lastError: 'network unavailable' }),
    }));
    expect(harness.metrics.snapshot().webhookPermanentlyFailed).toBe(1);
  });

  it('aborts a request after five seconds and schedules a retry', async () => {
    vi.useFakeTimers();
    const harness = deliveryHarness();
    vi.stubGlobal('fetch', vi.fn((_target: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new Error('request aborted')));
    })));
    const pending = harness.service.deliverPending();
    await vi.advanceTimersByTimeAsync(5_000);
    await expect(pending).resolves.toEqual({ claimed: 1, delivered: 0, failed: 1 });
    expect(harness.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'PENDING', lastError: 'request aborted' }),
    }));
  });

  it('does not claim a later delivery while an earlier pending or failed event blocks ordering', async () => {
    const queryRaw = vi.fn((strings: TemplateStringsArray) => {
      expect(strings.join('?')).toContain('earlier."status" IN (\'PENDING\', \'FAILED\')');
      return Promise.resolve([]);
    });
    const prisma = {
      $transaction: vi.fn((callback: (tx: unknown) => unknown) => callback({ $queryRaw: queryRaw })),
    };
    const service = new WebhookDeliveryService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      new SafetyMetricsService(),
    );
    await expect(service.deliverPending()).resolves.toEqual({ claimed: 0, delivered: 0, failed: 0 });
    expect(queryRaw).toHaveBeenCalledOnce();
  });
});

describe('tenant-scoped webhook administration', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('rotates a secret once, increments its version, and never returns ciphertext', async () => {
    vi.stubEnv('WEBHOOK_SECRET_ENCRYPTION_KEY', Buffer.alloc(32, 5).toString('base64'));
    const existing = {
      id: 2,
      hospitalId: 9,
      name: 'On call',
      targetUrl: 'https://hooks.example.ca/priage',
      status: 'ACTIVE',
      eventTypes: ['alert.triggered'],
      secretHash: 'a'.repeat(64),
      secretEncrypted: 'old',
      secretKeyVersion: 1,
      minimumSeverity: AlertSeverity.HIGH,
      lastTestedAt: null,
      lastSuccessfulDeliveryAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      partnerCredentialId: null,
    };
    const update = vi.fn(async ({ data }: any) => ({
      ...existing,
      secretHash: data.secretHash,
      secretEncrypted: data.secretEncrypted,
      secretKeyVersion: 2,
    }));
    const prisma = {
      webhookSubscription: {
        findFirst: vi.fn().mockResolvedValue(existing),
        update,
      },
    };
    const service = new AlertWebhooksService(
      prisma as never,
      new WebhookSecretService(),
      {} as never,
      { eventTypes: [] } as never,
    );
    const result = await service.rotateSecret(9, 2);
    expect(result.signingSecret).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(result.subscription.secretKeyVersion).toBe(2);
    expect(result.subscription).not.toHaveProperty('secretEncrypted');
    expect(result.subscription).not.toHaveProperty('secretHash');
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ secretKeyVersion: { increment: 1 } }),
    }));
  });

  it('queries subscriptions only inside the authenticated hospital tenant', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const service = new AlertWebhooksService(
      { webhookSubscription: { findMany } } as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await service.list(17);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { hospitalId: 17, partnerCredentialId: null },
    }));
  });
});
