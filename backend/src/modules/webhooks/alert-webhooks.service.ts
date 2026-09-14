import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AlertSeverity, Prisma, WebhookDeliveryStatus } from '@prisma/client';
import { randomUUID } from 'crypto';

import { PrismaService } from '../prisma/prisma.service';
import { CreateAlertWebhookDto, UpdateAlertWebhookDto } from './dto/alert-webhook.dto';
import { CreateEscalationExceptionDto } from './dto/alert-webhook.dto';
import { WebhookOutboxService } from './webhook-outbox.service';
import { WebhookSecretService } from './webhook-secret.service';
import { WebhookUrlPolicyService } from './webhook-url-policy.service';

@Injectable()
export class AlertWebhooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly secrets: WebhookSecretService,
    private readonly urlPolicy: WebhookUrlPolicyService,
    private readonly outbox: WebhookOutboxService,
  ) {}

  async create(hospitalId: number, dto: CreateAlertWebhookDto) {
    const target = await this.urlPolicy.assertAllowed(dto.targetUrl);
    const signingSecret = this.secrets.generate();
    const subscription = await this.prisma.webhookSubscription.create({
      data: {
        hospitalId,
        name: dto.name.trim(),
        targetUrl: target.toString(),
        minimumSeverity: dto.minimumSeverity ?? AlertSeverity.HIGH,
        eventTypes: [...this.outbox.eventTypes],
        secretHash: this.secrets.fingerprint(signingSecret),
        secretEncrypted: this.secrets.encrypt(signingSecret),
      },
    });
    return { subscription: this.toPublic(subscription), signingSecret };
  }

  async list(hospitalId: number) {
    const subscriptions = await this.prisma.webhookSubscription.findMany({
      where: { hospitalId, partnerCredentialId: null },
      orderBy: { createdAt: 'desc' },
    });
    return subscriptions.map((subscription) => this.toPublic(subscription));
  }

  async update(hospitalId: number, subscriptionId: number, dto: UpdateAlertWebhookDto) {
    const existing = await this.get(hospitalId, subscriptionId);
    const targetUrl = dto.targetUrl
      ? (await this.urlPolicy.assertAllowed(dto.targetUrl)).toString()
      : existing.targetUrl;
    const updated = await this.prisma.webhookSubscription.update({
      where: { id: existing.id },
      data: {
        name: dto.name?.trim(),
        targetUrl,
        minimumSeverity: dto.minimumSeverity,
        status: dto.status,
      },
    });
    return this.toPublic(updated);
  }

  async rotateSecret(hospitalId: number, subscriptionId: number) {
    const existing = await this.get(hospitalId, subscriptionId);
    const signingSecret = this.secrets.generate();
    const subscription = await this.prisma.webhookSubscription.update({
      where: { id: existing.id },
      data: {
        secretHash: this.secrets.fingerprint(signingSecret),
        secretEncrypted: this.secrets.encrypt(signingSecret),
        secretKeyVersion: { increment: 1 },
      },
    });
    return { subscription: this.toPublic(subscription), signingSecret };
  }

  async enqueueTest(hospitalId: number, subscriptionId: number) {
    const subscription = await this.get(hospitalId, subscriptionId);
    const eventId = randomUUID();
    const delivery = await this.prisma.webhookDelivery.create({
      data: {
        eventId,
        webhookSubscriptionId: subscription.id,
        eventType: 'webhook.test',
        payload: {
          id: eventId,
          type: 'webhook.test',
          occurredAt: new Date().toISOString(),
          hospitalId,
          data: { message: 'Priage alert escalation webhook test' },
        },
      },
    });
    return this.toPublicDelivery(delivery);
  }

  async listDeliveries(hospitalId: number, subscriptionId: number, limit = 50) {
    const subscription = await this.get(hospitalId, subscriptionId);
    const deliveries = await this.prisma.webhookDelivery.findMany({
      where: { webhookSubscriptionId: subscription.id },
      orderBy: { createdAt: 'desc' },
      take: Math.max(1, Math.min(limit, 100)),
    });
    return deliveries.map((delivery) => this.toPublicDelivery(delivery));
  }

  async retryDelivery(hospitalId: number, subscriptionId: number, deliveryId: number) {
    const subscription = await this.get(hospitalId, subscriptionId);
    const result = await this.prisma.webhookDelivery.updateMany({
      where: {
        id: deliveryId,
        webhookSubscriptionId: subscription.id,
        status: WebhookDeliveryStatus.FAILED,
      },
      data: {
        status: WebhookDeliveryStatus.PENDING,
        attempts: 0,
        nextAttemptAt: new Date(),
        claimedAt: null,
        claimToken: null,
        lastError: null,
        responseStatus: null,
      },
    });
    if (result.count !== 1) throw new NotFoundException('Failed webhook delivery not found');
    return { ok: true };
  }

  async getReadiness(hospitalId: number) {
    const now = new Date();
    const [testedTargets, exception] = await Promise.all([
      this.prisma.webhookSubscription.count({
        where: {
          hospitalId,
          partnerCredentialId: null,
          status: 'ACTIVE',
          lastTestedAt: { not: null },
        },
      }),
      this.prisma.alertEscalationException.findUnique({ where: { hospitalId } }),
    ]);
    const activeException = exception && exception.expiresAt > now ? exception : null;
    return {
      ready: testedTargets > 0 || activeException !== null,
      testedActiveTargets: testedTargets,
      temporaryException: activeException,
    };
  }

  async recordTemporaryException(
    hospitalId: number,
    actorUserId: number,
    dto: CreateEscalationExceptionDto,
  ) {
    const expiresAt = new Date(dto.expiresAt);
    if (expiresAt <= new Date()) throw new BadRequestException('Escalation exception expiry must be in the future');
    return this.prisma.alertEscalationException.upsert({
      where: { hospitalId },
      create: {
        hospitalId,
        createdByUserId: actorUserId,
        reason: dto.reason.trim(),
        expiresAt,
      },
      update: {
        createdByUserId: actorUserId,
        reason: dto.reason.trim(),
        expiresAt,
      },
    });
  }

  private async get(hospitalId: number, subscriptionId: number) {
    const subscription = await this.prisma.webhookSubscription.findFirst({
      where: { id: subscriptionId, hospitalId, partnerCredentialId: null },
    });
    if (!subscription) throw new NotFoundException('Alert webhook subscription not found');
    return subscription;
  }

  private toPublic(subscription: {
    id: number;
    createdAt: Date;
    updatedAt: Date;
    name: string;
    targetUrl: string;
    status: string;
    eventTypes: string[];
    secretHash: string;
    secretKeyVersion: number;
    minimumSeverity: AlertSeverity;
    lastTestedAt: Date | null;
    lastSuccessfulDeliveryAt: Date | null;
    hospitalId: number;
  }) {
    return {
      id: subscription.id,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
      name: subscription.name,
      targetUrl: subscription.targetUrl,
      status: subscription.status,
      eventTypes: subscription.eventTypes,
      secretFingerprint: subscription.secretHash.slice(0, 12),
      secretKeyVersion: subscription.secretKeyVersion,
      minimumSeverity: subscription.minimumSeverity,
      lastTestedAt: subscription.lastTestedAt,
      lastSuccessfulDeliveryAt: subscription.lastSuccessfulDeliveryAt,
      hospitalId: subscription.hospitalId,
    };
  }

  private toPublicDelivery(delivery: {
    id: number;
    eventId: string;
    eventType: string;
    status: WebhookDeliveryStatus;
    attempts: number;
    createdAt: Date;
    updatedAt: Date;
    nextAttemptAt: Date;
    deliveredAt: Date | null;
    lastAttemptAt: Date | null;
    lastError: string | null;
    responseStatus: number | null;
  }) {
    return {
      id: delivery.id,
      eventId: delivery.eventId,
      eventType: delivery.eventType,
      status: delivery.status,
      attempts: delivery.attempts,
      createdAt: delivery.createdAt,
      updatedAt: delivery.updatedAt,
      nextAttemptAt: delivery.nextAttemptAt,
      deliveredAt: delivery.deliveredAt,
      lastAttemptAt: delivery.lastAttemptAt,
      lastError: delivery.lastError,
      responseStatus: delivery.responseStatus,
    };
  }
}
