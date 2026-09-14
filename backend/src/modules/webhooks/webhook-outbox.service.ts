import { Injectable } from '@nestjs/common';
import { Alert, AlertSeverity, EncounterEvent, Prisma, WebhookSubscriptionStatus } from '@prisma/client';
import { randomUUID } from 'crypto';

const ALERT_WEBHOOK_EVENTS = [
  'alert.triggered',
  'alert.escalated',
  'alert.acknowledged',
  'alert.resolved',
] as const;

export type AlertWebhookEventType = typeof ALERT_WEBHOOK_EVENTS[number];

@Injectable()
export class WebhookOutboxService {
  async enqueueAlertLifecycleTx(
    tx: Prisma.TransactionClient,
    alert: Alert,
    sourceEvent: EncounterEvent,
    eventType: AlertWebhookEventType,
  ): Promise<void> {
    const subscriptions = await tx.webhookSubscription.findMany({
      where: {
        hospitalId: alert.hospitalId,
        status: WebhookSubscriptionStatus.ACTIVE,
        eventTypes: { has: eventType },
        secretEncrypted: { not: null },
      },
      select: { id: true, minimumSeverity: true },
    });
    const eligible = subscriptions.filter(
      (subscription) => this.rank(alert.severity) >= this.rank(subscription.minimumSeverity),
    );
    if (eligible.length === 0) return;

    const occurredAt = sourceEvent.createdAt.toISOString();
    await tx.webhookDelivery.createMany({
      data: eligible.map((subscription) => {
        const eventId = randomUUID();
        return {
          eventId,
          webhookSubscriptionId: subscription.id,
          sourceEventId: sourceEvent.id,
          eventType,
          payload: {
            id: eventId,
            type: eventType,
            occurredAt,
            hospitalId: alert.hospitalId,
            data: {
              alertId: alert.id,
              alertType: alert.type,
              severity: alert.severity,
              dashboardUrl: process.env.HOSPITAL_DASHBOARD_URL?.trim() || null,
            },
          },
        };
      }),
      skipDuplicates: true,
    });
  }

  get eventTypes(): readonly string[] {
    return ALERT_WEBHOOK_EVENTS;
  }

  private rank(severity: AlertSeverity): number {
    return { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 }[severity];
  }
}
