import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AlertResolutionReason,
  AlertSeverity,
  AlertSource,
  EncounterStatus,
  EventType,
  Prisma,
} from '@prisma/client';

import { EventsService } from '../events/events.service';
import { LoggingService } from '../logging/logging.service';
import { PrismaService } from '../prisma/prisma.service';
import { WebhookOutboxService } from '../webhooks/webhook-outbox.service';
import { SafetyMetricsService } from '../../common/metrics/safety-metrics.service';
import { normalizeHospitalConfig } from '../hospitals/hospital-config';
import {
  type AlertRuleEncounter,
  type AlertRuleMatch,
  evaluateObjectiveAlertRules,
  getAlertRuleManifest,
} from './alert-rules';

const ACTIVE_STATUSES = [
  EncounterStatus.EXPECTED,
  EncounterStatus.ADMITTED,
  EncounterStatus.TRIAGE,
  EncounterStatus.WAITING,
];

type LifecycleResult = { event: Awaited<ReturnType<EventsService['emitEncounterEventTx']>> | null };

@Injectable()
export class AlertRulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly logging: LoggingService,
    private readonly webhookOutbox: WebhookOutboxService,
    private readonly safetyMetrics: SafetyMetricsService,
  ) {}

  getManifest() {
    return getAlertRuleManifest();
  }

  async evaluateEncounter(encounterId: number, hospitalId: number, now = new Date()) {
    const startedAt = Date.now();
    try {
      const encounter = await this.prisma.encounter.findUnique({
        where: { id_hospitalId: { id: encounterId, hospitalId } },
        select: {
          id: true,
          hospitalId: true,
          status: true,
          currentCtasLevel: true,
          arrivedAt: true,
          triagedAt: true,
          waitingAt: true,
          hospital: { select: { config: { select: { config: true } } } },
        },
      });
      if (!encounter) throw new NotFoundException('Encounter does not belong to hospital');

      // ED timing rules do not apply to clinic walk-ins or pending clinic intake.
      if (normalizeHospitalConfig(encounter.hospital?.config?.config).workflowProfile === 'CLINIC_APPOINTMENT') return [];

      const matches = evaluateObjectiveAlertRules(encounter, now);
      await this.recordMissingTimestampSignals(encounter, now);

      if (this.mode() !== 'active') {
        await this.logging.debug('Alert rules evaluated in shadow mode', {
          service: 'AlertRulesService',
          operation: 'evaluateEncounter',
          encounterId,
          hospitalId,
        }, { matchedRules: matches.map((match) => match.ruleKey) });
        return this.listActiveRuleAlerts(encounterId, hospitalId);
      }

      const matchedKeys = new Set(matches.map((match) => match.ruleKey));
      for (const match of matches) {
        const result = await this.applyMatch(encounter, match, now);
        if (result.event) void this.events.dispatchEncounterEventAndMarkProcessed(result.event);
      }

      const staleAlerts = await this.prisma.alert.findMany({
        where: {
          encounterId,
          hospitalId,
          source: AlertSource.RULE_ENGINE,
          conditionClearedAt: null,
          ruleKey: { notIn: [...matchedKeys] },
        },
        select: { id: true },
      });
      for (const stale of staleAlerts) {
        const result = await this.clearRuleAlert(stale.id, hospitalId, now);
        if (result.event) void this.events.dispatchEncounterEventAndMarkProcessed(result.event);
      }

      return this.listActiveRuleAlerts(encounterId, hospitalId);
    } finally {
      this.safetyMetrics.recordAlertEvaluation(Date.now() - startedAt);
    }
  }

  async sweepAll(now = new Date(), batchSize = 250): Promise<{ evaluated: number; pages: number }> {
    const startedAt = Date.now();
    let lastId = 0;
    let evaluated = 0;
    let pages = 0;
    const take = Math.max(1, Math.min(batchSize, 1000));

    while (true) {
      const encounters = await this.prisma.encounter.findMany({
        where: {
          id: { gt: lastId },
          OR: [
            { status: { in: ACTIVE_STATUSES } },
            { alerts: { some: { source: AlertSource.RULE_ENGINE, conditionClearedAt: null } } },
          ],
        },
        orderBy: { id: 'asc' },
        take,
        select: { id: true, hospitalId: true },
      });
      if (encounters.length === 0) break;
      pages += 1;
      for (const encounter of encounters) {
        await this.evaluateEncounter(encounter.id, encounter.hospitalId, now);
        evaluated += 1;
      }
      lastId = encounters[encounters.length - 1]!.id;
      if (encounters.length < take) break;
    }

    await this.logging.info('Alert rule sweep completed', {
      service: 'AlertRulesService',
      operation: 'sweepAll',
    }, { evaluated, pages, mode: this.mode() });
    this.safetyMetrics.recordSweep(Date.now() - startedAt, evaluated, pages);
    return { evaluated, pages };
  }

  private async applyMatch(
    encounter: AlertRuleEncounter,
    match: AlertRuleMatch,
    now: Date,
    retryOnConflict = true,
  ): Promise<LifecycleResult> {
    const dedupeKey = `${encounter.hospitalId}:${encounter.id}:${match.ruleKey}`;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.alert.findUnique({ where: { activeRuleDedupeKey: dedupeKey } });
        if (!existing) {
          const created = await tx.alert.create({
            data: {
              encounterId: encounter.id,
              hospitalId: encounter.hospitalId,
              type: match.type,
              severity: match.severity,
              source: AlertSource.RULE_ENGINE,
              ruleKey: match.ruleKey,
              ruleVersion: match.ruleVersion,
              activeRuleDedupeKey: dedupeKey,
              lastEvaluatedAt: now,
              metadata: match.metadata,
            },
          });
          const event = await this.events.emitEncounterEventTx(tx, {
            encounterId: encounter.id,
            hospitalId: encounter.hospitalId,
            type: EventType.ALERT_CREATED,
            metadata: {
              alertId: created.id,
              type: created.type,
              severity: created.severity,
              ruleKey: created.ruleKey,
              ruleVersion: created.ruleVersion,
            },
          });
          await this.webhookOutbox.enqueueAlertLifecycleTx(tx, created, event, 'alert.triggered');
          return { event };
        }

        if (this.severityRank(match.severity) > this.severityRank(existing.severity)) {
          const updated = await tx.alert.update({
            where: { id: existing.id },
            data: {
              severity: match.severity,
              ruleVersion: match.ruleVersion,
              lastEvaluatedAt: now,
              metadata: match.metadata,
              acknowledgedAt: null,
              acknowledgedByUserId: null,
            },
          });
          const event = await this.events.emitEncounterEventTx(tx, {
            encounterId: encounter.id,
            hospitalId: encounter.hospitalId,
            type: EventType.ALERT_ESCALATED,
            metadata: {
              alertId: updated.id,
              type: updated.type,
              severity: updated.severity,
              previousSeverity: existing.severity,
              ruleKey: updated.ruleKey,
              ruleVersion: updated.ruleVersion,
            },
          });
          await this.webhookOutbox.enqueueAlertLifecycleTx(tx, updated, event, 'alert.escalated');
          return { event };
        }

        await tx.alert.update({
          where: { id: existing.id },
          data: { lastEvaluatedAt: now, ruleVersion: match.ruleVersion, metadata: match.metadata },
        });
        return { event: null };
      });
    } catch (error) {
      if (
        retryOnConflict
        && error instanceof Prisma.PrismaClientKnownRequestError
        && error.code === 'P2002'
      ) {
        this.safetyMetrics.recordDedupeConflict();
        return this.applyMatch(encounter, match, now, false);
      }
      throw error;
    }
  }

  private clearRuleAlert(alertId: number, hospitalId: number, now: Date): Promise<LifecycleResult> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.alert.findFirst({
        where: { id: alertId, hospitalId, source: AlertSource.RULE_ENGINE, conditionClearedAt: null },
      });
      if (!existing) return { event: null };
      const updated = await tx.alert.update({
        where: { id: existing.id },
        data: {
          conditionClearedAt: now,
          lastEvaluatedAt: now,
          activeRuleDedupeKey: null,
          resolvedAt: existing.resolvedAt ?? now,
          resolutionReason: existing.resolutionReason ?? AlertResolutionReason.RULE_CLEARED,
        },
      });
      const event = await this.events.emitEncounterEventTx(tx, {
        encounterId: updated.encounterId,
        hospitalId: updated.hospitalId,
        type: EventType.ALERT_RESOLVED,
        metadata: {
          alertId: updated.id,
          resolvedAt: updated.resolvedAt?.toISOString(),
          ruleKey: updated.ruleKey,
          resolutionReason: AlertResolutionReason.RULE_CLEARED,
        },
      });
      await this.webhookOutbox.enqueueAlertLifecycleTx(tx, updated, event, 'alert.resolved');
      return { event };
    });
  }

  private listActiveRuleAlerts(encounterId: number, hospitalId: number) {
    return this.prisma.alert.findMany({
      where: { encounterId, hospitalId, source: AlertSource.RULE_ENGINE, resolvedAt: null },
      orderBy: [{ severity: 'desc' }, { createdAt: 'asc' }],
    });
  }

  private async recordMissingTimestampSignals(encounter: AlertRuleEncounter, now: Date): Promise<void> {
    const missing: string[] = [];
    if (encounter.status === EncounterStatus.ADMITTED && !encounter.arrivedAt) missing.push('arrivedAt');
    if (encounter.status === EncounterStatus.TRIAGE && !encounter.triagedAt) missing.push('triagedAt');
    if (encounter.status === EncounterStatus.WAITING) {
      if (!encounter.triagedAt) missing.push('triagedAt');
      if (!encounter.waitingAt) missing.push('waitingAt');
    }
    if (missing.length === 0) return;
    this.safetyMetrics.recordMissingLifecycleTimestamp(missing.length);
    await this.logging.warn('Alert rule skipped because a lifecycle timestamp is missing', {
      service: 'AlertRulesService',
      operation: 'recordMissingTimestampSignals',
      encounterId: encounter.id,
      hospitalId: encounter.hospitalId,
    }, { missing, evaluatedAt: now.toISOString() });
  }

  private severityRank(severity: AlertSeverity): number {
    return { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 }[severity];
  }

  private mode(): 'shadow' | 'active' {
    const mode = (process.env.ALERT_RULE_ENGINE_MODE || 'shadow').trim().toLowerCase();
    if (mode !== 'shadow' && mode !== 'active') {
      throw new BadRequestException('ALERT_RULE_ENGINE_MODE must be shadow or active');
    }
    return mode;
  }
}
