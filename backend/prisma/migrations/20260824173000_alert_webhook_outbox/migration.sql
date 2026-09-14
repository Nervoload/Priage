ALTER TABLE "WebhookSubscription"
  ADD COLUMN "name" TEXT NOT NULL DEFAULT 'Alert escalation',
  ADD COLUMN "secretEncrypted" TEXT,
  ADD COLUMN "secretKeyVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "minimumSeverity" "AlertSeverity" NOT NULL DEFAULT 'HIGH',
  ADD COLUMN "lastTestedAt" TIMESTAMP(3),
  ADD COLUMN "lastSuccessfulDeliveryAt" TIMESTAMP(3);

ALTER TABLE "WebhookDelivery"
  ADD COLUMN "eventId" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  ADD COLUMN "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "claimedAt" TIMESTAMP(3),
  ADD COLUMN "claimToken" TEXT,
  ADD COLUMN "responseStatus" INTEGER,
  ADD COLUMN "sourceEventId" INTEGER;

CREATE UNIQUE INDEX "WebhookDelivery_eventId_key" ON "WebhookDelivery"("eventId");
CREATE INDEX "WebhookDelivery_status_nextAttemptAt_idx" ON "WebhookDelivery"("status", "nextAttemptAt");
CREATE INDEX "WebhookDelivery_claimToken_idx" ON "WebhookDelivery"("claimToken");
CREATE UNIQUE INDEX "WebhookDelivery_webhookSubscriptionId_sourceEventId_key"
  ON "WebhookDelivery"("webhookSubscriptionId", "sourceEventId");

ALTER TABLE "WebhookDelivery"
  ADD CONSTRAINT "WebhookDelivery_sourceEventId_fkey"
  FOREIGN KEY ("sourceEventId") REFERENCES "EncounterEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
