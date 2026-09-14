CREATE TYPE "AlertSource" AS ENUM ('MANUAL', 'RULE_ENGINE');
CREATE TYPE "AlertResolutionReason" AS ENUM ('MANUAL', 'RULE_CLEARED');

ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'ALERT_ESCALATED';

ALTER TABLE "Alert"
  ADD COLUMN "source" "AlertSource" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "ruleKey" TEXT,
  ADD COLUMN "ruleVersion" TEXT,
  ADD COLUMN "activeRuleDedupeKey" TEXT,
  ADD COLUMN "lastEvaluatedAt" TIMESTAMP(3),
  ADD COLUMN "conditionClearedAt" TIMESTAMP(3),
  ADD COLUMN "resolutionReason" "AlertResolutionReason";

CREATE UNIQUE INDEX "Alert_activeRuleDedupeKey_key" ON "Alert"("activeRuleDedupeKey");
CREATE INDEX "Alert_hospitalId_source_conditionClearedAt_idx" ON "Alert"("hospitalId", "source", "conditionClearedAt");
CREATE INDEX "Alert_encounterId_ruleKey_createdAt_idx" ON "Alert"("encounterId", "ruleKey", "createdAt");
