import { Injectable } from '@nestjs/common';
import { WebhookDeliveryStatus } from '@prisma/client';
import { createHmac, randomUUID } from 'crypto';

import { LoggingService } from '../logging/logging.service';
import { PrismaService } from '../prisma/prisma.service';
import { WebhookSecretService } from './webhook-secret.service';
import { WebhookUrlPolicyService } from './webhook-url-policy.service';
import { SafetyMetricsService } from '../../common/metrics/safety-metrics.service';

const CLAIM_TTL_MS = 60_000;

export function computeWebhookBackoffMs(attempts: number, random = Math.random): number {
  const cap = 15 * 60_000;
  const exponential = Math.min(cap, 5000 * 2 ** Math.max(0, attempts - 1));
  return Math.max(1000, Math.floor(random() * exponential));
}

export function createWebhookSignature(secret: string, timestamp: string, rawBody: string): string {
  return `v1=${createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')}`;
}

@Injectable()
export class WebhookDeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly secrets: WebhookSecretService,
    private readonly urlPolicy: WebhookUrlPolicyService,
    private readonly logging: LoggingService,
    private readonly safetyMetrics: SafetyMetricsService,
  ) {}

  async deliverPending(batchSize = 25): Promise<{ claimed: number; delivered: number; failed: number }> {
    const claimToken = randomUUID();
    const deliveries = await this.claim(claimToken, Math.max(1, Math.min(batchSize, 100)));
    let delivered = 0;
    let failed = 0;
    for (const delivery of deliveries) {
      try {
        await this.deliver(delivery);
        delivered += 1;
      } catch (error) {
        failed += 1;
        await this.recordFailure(delivery.id, claimToken, delivery.attempts, error);
      }
    }
    return { claimed: deliveries.length, delivered, failed };
  }

  private async claim(claimToken: string, take: number) {
    const now = new Date();
    const staleBefore = new Date(now.getTime() - CLAIM_TTL_MS);
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: number }>>`
        SELECT candidate."id"
        FROM "WebhookDelivery" candidate
        WHERE candidate."status" = 'PENDING'
          AND candidate."nextAttemptAt" <= ${now}
          AND (candidate."claimedAt" IS NULL OR candidate."claimedAt" < ${staleBefore})
          AND NOT EXISTS (
            SELECT 1 FROM "WebhookDelivery" earlier
            WHERE earlier."webhookSubscriptionId" = candidate."webhookSubscriptionId"
              AND earlier."status" IN ('PENDING', 'FAILED')
              AND earlier."createdAt" < candidate."createdAt"
          )
        ORDER BY candidate."createdAt" ASC
        LIMIT ${take}
        FOR UPDATE SKIP LOCKED
      `;
      const ids = rows.map((row) => row.id);
      if (ids.length === 0) return [];
      await tx.webhookDelivery.updateMany({
        where: { id: { in: ids }, status: WebhookDeliveryStatus.PENDING },
        data: {
          claimToken,
          claimedAt: now,
          lastAttemptAt: now,
          attempts: { increment: 1 },
        },
      });
      return tx.webhookDelivery.findMany({
        where: { id: { in: ids }, claimToken },
        include: { webhookSubscription: true },
        orderBy: { createdAt: 'asc' },
      });
    });
  }

  private async deliver(delivery: Awaited<ReturnType<WebhookDeliveryService['claim']>>[number]): Promise<void> {
    const subscription = delivery.webhookSubscription;
    if (!subscription.secretEncrypted) throw new Error('Webhook signing secret is not configured');
    const target = await this.urlPolicy.assertAllowed(subscription.targetUrl);
    const rawBody = JSON.stringify(delivery.payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createWebhookSignature(
      this.secrets.decrypt(subscription.secretEncrypted),
      timestamp,
      rawBody,
    );
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    let response: Response;
    try {
      response = await fetch(target, {
        method: 'POST',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-Priage-Webhook-Id': delivery.eventId,
          'X-Priage-Webhook-Timestamp': timestamp,
          'X-Priage-Signature': signature,
        },
        body: rawBody,
      });
    } finally {
      clearTimeout(timeout);
    }
    if (response.status < 200 || response.status >= 300) {
      const error = new Error(`Webhook endpoint returned HTTP ${response.status}`);
      Object.assign(error, { responseStatus: response.status });
      throw error;
    }
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: WebhookDeliveryStatus.DELIVERED,
          deliveredAt: now,
          responseStatus: response.status,
          claimToken: null,
          claimedAt: null,
          lastError: null,
        },
      }),
      this.prisma.webhookSubscription.update({
        where: { id: subscription.id },
        data: {
          lastSuccessfulDeliveryAt: now,
          ...(delivery.eventType === 'webhook.test' ? { lastTestedAt: now } : {}),
        },
      }),
    ]);
    this.safetyMetrics.recordWebhookDelivered();
  }

  private async recordFailure(id: number, claimToken: string, attempts: number, error: unknown): Promise<void> {
    const maxAttempts = this.positiveInt('WEBHOOK_MAX_ATTEMPTS', 8);
    const terminal = attempts >= maxAttempts;
    const responseStatus = typeof error === 'object' && error && 'responseStatus' in error
      ? Number((error as { responseStatus: unknown }).responseStatus)
      : null;
    const message = error instanceof Error ? error.message.slice(0, 1000) : String(error).slice(0, 1000);
    await this.prisma.webhookDelivery.updateMany({
      where: { id, claimToken, status: WebhookDeliveryStatus.PENDING },
      data: {
        status: terminal ? WebhookDeliveryStatus.FAILED : WebhookDeliveryStatus.PENDING,
        nextAttemptAt: terminal ? new Date() : new Date(Date.now() + computeWebhookBackoffMs(attempts)),
        responseStatus: Number.isFinite(responseStatus) ? responseStatus : null,
        lastError: message,
        claimToken: null,
        claimedAt: null,
      },
    });
    this.safetyMetrics.recordWebhookFailure(terminal);
    await this.logging.warn('Webhook delivery failed', {
      service: 'WebhookDeliveryService',
      operation: 'recordFailure',
    }, { deliveryId: id, attempts, terminal, responseStatus, error: message });
  }

  private positiveInt(name: string, fallback: number): number {
    const parsed = Number.parseInt(process.env[name] || '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
