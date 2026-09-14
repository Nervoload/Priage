import { Injectable } from '@nestjs/common';

@Injectable()
export class SafetyMetricsService {
  private alertEvaluations = 0;
  private alertEvaluationDurationMs = 0;
  private alertDedupeConflicts = 0;
  private missingLifecycleTimestamps = 0;
  private webhookDelivered = 0;
  private webhookRetried = 0;
  private webhookPermanentlyFailed = 0;
  private lastSweep: { completedAt: string; durationMs: number; evaluated: number; pages: number } | null = null;

  recordAlertEvaluation(durationMs: number): void {
    this.alertEvaluations += 1;
    this.alertEvaluationDurationMs += Math.max(0, durationMs);
  }

  recordSweep(durationMs: number, evaluated: number, pages: number): void {
    this.lastSweep = { completedAt: new Date().toISOString(), durationMs, evaluated, pages };
  }

  recordDedupeConflict(): void {
    this.alertDedupeConflicts += 1;
  }

  recordMissingLifecycleTimestamp(count: number): void {
    this.missingLifecycleTimestamps += Math.max(0, count);
  }

  recordWebhookDelivered(): void {
    this.webhookDelivered += 1;
  }

  recordWebhookFailure(terminal: boolean): void {
    if (terminal) this.webhookPermanentlyFailed += 1;
    else this.webhookRetried += 1;
  }

  snapshot() {
    return {
      alertEvaluations: this.alertEvaluations,
      alertEvaluationDurationMs: this.alertEvaluationDurationMs,
      alertEvaluationAverageMs: this.alertEvaluations === 0
        ? 0
        : this.alertEvaluationDurationMs / this.alertEvaluations,
      alertDedupeConflicts: this.alertDedupeConflicts,
      missingLifecycleTimestamps: this.missingLifecycleTimestamps,
      webhookDelivered: this.webhookDelivered,
      webhookRetried: this.webhookRetried,
      webhookPermanentlyFailed: this.webhookPermanentlyFailed,
      lastSweep: this.lastSweep,
    };
  }
}
