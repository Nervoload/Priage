-- CreateEnum
CREATE TYPE "IntakeSessionStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ContextSourceType" AS ENUM ('PATIENT', 'PARTNER', 'INSTITUTION', 'AI');

-- CreateEnum
CREATE TYPE "TrustTier" AS ENUM ('UNTRUSTED', 'PARTNER_SUBMITTED', 'INSTITUTION_TRUSTED');

-- CreateEnum
CREATE TYPE "ReviewState" AS ENUM ('UNREVIEWED', 'PATIENT_CONFIRMED', 'STAFF_REVIEWED', 'REJECTED');

-- CreateEnum
CREATE TYPE "VisibilityScope" AS ENUM ('STORED_ONLY', 'ADMISSIONS', 'TRIAGE', 'CLINICAL');

-- CreateEnum
CREATE TYPE "SummaryProjectionKind" AS ENUM ('OPERATIONAL', 'AI_DERIVED', 'HUMAN_REVIEWED');

-- CreateEnum
CREATE TYPE "PartnerCredentialStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "WebhookSubscriptionStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED');

-- AlterTable
ALTER TABLE "Encounter" ADD COLUMN "publicId" TEXT;

UPDATE "Encounter"
SET "publicId" = 'enc_' || "id"::text
WHERE "publicId" IS NULL;

ALTER TABLE "Encounter" ALTER COLUMN "publicId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN "intakeSessionId" INTEGER;

-- CreateTable
CREATE TABLE "IntakeSession" (
    "id" SERIAL NOT NULL,
    "publicId" TEXT NOT NULL,
    "token" TEXT,
    "status" "IntakeSessionStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "patientId" INTEGER,
    "hospitalId" INTEGER,
    "encounterId" INTEGER,
    "authSessionId" INTEGER,

    CONSTRAINT "IntakeSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContextItem" (
    "id" SERIAL NOT NULL,
    "publicId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "itemType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "sourceType" "ContextSourceType" NOT NULL,
    "trustTier" "TrustTier" NOT NULL,
    "reviewState" "ReviewState" NOT NULL,
    "visibilityScope" "VisibilityScope" NOT NULL,
    "hospitalId" INTEGER,
    "patientId" INTEGER,
    "intakeSessionId" INTEGER,
    "encounterId" INTEGER,
    "partnerId" INTEGER,
    "supersedesId" INTEGER,

    CONSTRAINT "ContextItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SummaryProjection" (
    "id" SERIAL NOT NULL,
    "publicId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "kind" "SummaryProjectionKind" NOT NULL,
    "content" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sourceType" "ContextSourceType" NOT NULL,
    "trustTier" "TrustTier" NOT NULL,
    "reviewState" "ReviewState" NOT NULL,
    "visibilityScope" "VisibilityScope" NOT NULL,
    "intakeSessionId" INTEGER,
    "encounterId" INTEGER,

    CONSTRAINT "SummaryProjection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerCredential" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "label" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "scopes" TEXT[] NOT NULL,
    "status" "PartnerCredentialStatus" NOT NULL DEFAULT 'ACTIVE',
    "partnerId" INTEGER NOT NULL,
    "hospitalId" INTEGER NOT NULL,

    CONSTRAINT "PartnerCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerTrustPolicy" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "partnerCredentialId" INTEGER NOT NULL,
    "defaultTrustTier" "TrustTier" NOT NULL DEFAULT 'PARTNER_SUBMITTED',
    "defaultVisibilityScope" "VisibilityScope" NOT NULL DEFAULT 'STORED_ONLY',
    "requirePatientConfirmation" BOOLEAN NOT NULL DEFAULT true,
    "allowPreConfirmOperationalUse" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PartnerTrustPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerReference" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referenceType" TEXT NOT NULL,
    "referenceValue" TEXT NOT NULL,
    "partnerId" INTEGER NOT NULL,
    "intakeSessionId" INTEGER,
    "encounterId" INTEGER,

    CONSTRAINT "PartnerReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommandResult" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "command" TEXT NOT NULL,
    "requestFingerprint" TEXT NOT NULL,
    "responseStatus" INTEGER NOT NULL,
    "responseBody" JSONB NOT NULL,
    "partnerCredentialId" INTEGER NOT NULL,
    "intakeSessionId" INTEGER,
    "encounterId" INTEGER,

    CONSTRAINT "CommandResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "command" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestFingerprint" TEXT NOT NULL,
    "partnerCredentialId" INTEGER NOT NULL,
    "commandResultId" INTEGER NOT NULL,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookSubscription" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "status" "WebhookSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "eventTypes" TEXT[] NOT NULL,
    "secretHash" TEXT NOT NULL,
    "hospitalId" INTEGER NOT NULL,
    "partnerCredentialId" INTEGER,

    CONSTRAINT "WebhookSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "deliveredAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "lastError" TEXT,
    "webhookSubscriptionId" INTEGER NOT NULL,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Encounter_publicId_key" ON "Encounter"("publicId");

-- CreateIndex
CREATE INDEX "Asset_intakeSessionId_createdAt_idx" ON "Asset"("intakeSessionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "IntakeSession_publicId_key" ON "IntakeSession"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "IntakeSession_token_key" ON "IntakeSession"("token");

-- CreateIndex
CREATE UNIQUE INDEX "IntakeSession_authSessionId_key" ON "IntakeSession"("authSessionId");

-- CreateIndex
CREATE INDEX "IntakeSession_patientId_createdAt_idx" ON "IntakeSession"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "IntakeSession_hospitalId_createdAt_idx" ON "IntakeSession"("hospitalId", "createdAt");

-- CreateIndex
CREATE INDEX "IntakeSession_encounterId_createdAt_idx" ON "IntakeSession"("encounterId", "createdAt");

-- CreateIndex
CREATE INDEX "IntakeSession_status_createdAt_idx" ON "IntakeSession"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContextItem_publicId_key" ON "ContextItem"("publicId");

-- CreateIndex
CREATE INDEX "ContextItem_intakeSessionId_createdAt_idx" ON "ContextItem"("intakeSessionId", "createdAt");

-- CreateIndex
CREATE INDEX "ContextItem_encounterId_createdAt_idx" ON "ContextItem"("encounterId", "createdAt");

-- CreateIndex
CREATE INDEX "ContextItem_hospitalId_createdAt_idx" ON "ContextItem"("hospitalId", "createdAt");

-- CreateIndex
CREATE INDEX "ContextItem_patientId_createdAt_idx" ON "ContextItem"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "ContextItem_partnerId_createdAt_idx" ON "ContextItem"("partnerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SummaryProjection_publicId_key" ON "SummaryProjection"("publicId");

-- CreateIndex
CREATE INDEX "SummaryProjection_intakeSessionId_createdAt_idx" ON "SummaryProjection"("intakeSessionId", "createdAt");

-- CreateIndex
CREATE INDEX "SummaryProjection_encounterId_createdAt_idx" ON "SummaryProjection"("encounterId", "createdAt");

-- CreateIndex
CREATE INDEX "SummaryProjection_kind_createdAt_idx" ON "SummaryProjection"("kind", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Partner_slug_key" ON "Partner"("slug");

-- CreateIndex
CREATE INDEX "Partner_slug_idx" ON "Partner"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerCredential_keyHash_key" ON "PartnerCredential"("keyHash");

-- CreateIndex
CREATE INDEX "PartnerCredential_partnerId_createdAt_idx" ON "PartnerCredential"("partnerId", "createdAt");

-- CreateIndex
CREATE INDEX "PartnerCredential_hospitalId_createdAt_idx" ON "PartnerCredential"("hospitalId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerTrustPolicy_partnerCredentialId_key" ON "PartnerTrustPolicy"("partnerCredentialId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerReference_partnerId_referenceType_referenceValue_key" ON "PartnerReference"("partnerId", "referenceType", "referenceValue");

-- CreateIndex
CREATE INDEX "PartnerReference_intakeSessionId_createdAt_idx" ON "PartnerReference"("intakeSessionId", "createdAt");

-- CreateIndex
CREATE INDEX "PartnerReference_encounterId_createdAt_idx" ON "PartnerReference"("encounterId", "createdAt");

-- CreateIndex
CREATE INDEX "CommandResult_partnerCredentialId_createdAt_idx" ON "CommandResult"("partnerCredentialId", "createdAt");

-- CreateIndex
CREATE INDEX "CommandResult_intakeSessionId_createdAt_idx" ON "CommandResult"("intakeSessionId", "createdAt");

-- CreateIndex
CREATE INDEX "CommandResult_encounterId_createdAt_idx" ON "CommandResult"("encounterId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_partnerCredentialId_command_idempotencyKey_key" ON "IdempotencyRecord"("partnerCredentialId", "command", "idempotencyKey");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_commandResultId_idx" ON "IdempotencyRecord"("commandResultId");

-- CreateIndex
CREATE INDEX "WebhookSubscription_hospitalId_createdAt_idx" ON "WebhookSubscription"("hospitalId", "createdAt");

-- CreateIndex
CREATE INDEX "WebhookSubscription_partnerCredentialId_createdAt_idx" ON "WebhookSubscription"("partnerCredentialId", "createdAt");

-- CreateIndex
CREATE INDEX "WebhookDelivery_webhookSubscriptionId_createdAt_idx" ON "WebhookDelivery"("webhookSubscriptionId", "createdAt");

-- CreateIndex
CREATE INDEX "WebhookDelivery_status_createdAt_idx" ON "WebhookDelivery"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "Asset"
    ADD CONSTRAINT "Asset_intakeSessionId_fkey"
    FOREIGN KEY ("intakeSessionId") REFERENCES "IntakeSession"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeSession"
    ADD CONSTRAINT "IntakeSession_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeSession"
    ADD CONSTRAINT "IntakeSession_hospitalId_fkey"
    FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeSession"
    ADD CONSTRAINT "IntakeSession_encounterId_fkey"
    FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeSession"
    ADD CONSTRAINT "IntakeSession_authSessionId_fkey"
    FOREIGN KEY ("authSessionId") REFERENCES "PatientSession"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextItem"
    ADD CONSTRAINT "ContextItem_hospitalId_fkey"
    FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextItem"
    ADD CONSTRAINT "ContextItem_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextItem"
    ADD CONSTRAINT "ContextItem_intakeSessionId_fkey"
    FOREIGN KEY ("intakeSessionId") REFERENCES "IntakeSession"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextItem"
    ADD CONSTRAINT "ContextItem_encounterId_fkey"
    FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextItem"
    ADD CONSTRAINT "ContextItem_partnerId_fkey"
    FOREIGN KEY ("partnerId") REFERENCES "Partner"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextItem"
    ADD CONSTRAINT "ContextItem_supersedesId_fkey"
    FOREIGN KEY ("supersedesId") REFERENCES "ContextItem"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SummaryProjection"
    ADD CONSTRAINT "SummaryProjection_intakeSessionId_fkey"
    FOREIGN KEY ("intakeSessionId") REFERENCES "IntakeSession"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SummaryProjection"
    ADD CONSTRAINT "SummaryProjection_encounterId_fkey"
    FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerCredential"
    ADD CONSTRAINT "PartnerCredential_partnerId_fkey"
    FOREIGN KEY ("partnerId") REFERENCES "Partner"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerCredential"
    ADD CONSTRAINT "PartnerCredential_hospitalId_fkey"
    FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerTrustPolicy"
    ADD CONSTRAINT "PartnerTrustPolicy_partnerCredentialId_fkey"
    FOREIGN KEY ("partnerCredentialId") REFERENCES "PartnerCredential"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerReference"
    ADD CONSTRAINT "PartnerReference_partnerId_fkey"
    FOREIGN KEY ("partnerId") REFERENCES "Partner"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerReference"
    ADD CONSTRAINT "PartnerReference_intakeSessionId_fkey"
    FOREIGN KEY ("intakeSessionId") REFERENCES "IntakeSession"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerReference"
    ADD CONSTRAINT "PartnerReference_encounterId_fkey"
    FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommandResult"
    ADD CONSTRAINT "CommandResult_partnerCredentialId_fkey"
    FOREIGN KEY ("partnerCredentialId") REFERENCES "PartnerCredential"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommandResult"
    ADD CONSTRAINT "CommandResult_intakeSessionId_fkey"
    FOREIGN KEY ("intakeSessionId") REFERENCES "IntakeSession"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommandResult"
    ADD CONSTRAINT "CommandResult_encounterId_fkey"
    FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyRecord"
    ADD CONSTRAINT "IdempotencyRecord_partnerCredentialId_fkey"
    FOREIGN KEY ("partnerCredentialId") REFERENCES "PartnerCredential"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyRecord"
    ADD CONSTRAINT "IdempotencyRecord_commandResultId_fkey"
    FOREIGN KEY ("commandResultId") REFERENCES "CommandResult"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookSubscription"
    ADD CONSTRAINT "WebhookSubscription_hospitalId_fkey"
    FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookSubscription"
    ADD CONSTRAINT "WebhookSubscription_partnerCredentialId_fkey"
    FOREIGN KEY ("partnerCredentialId") REFERENCES "PartnerCredential"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDelivery"
    ADD CONSTRAINT "WebhookDelivery_webhookSubscriptionId_fkey"
    FOREIGN KEY ("webhookSubscriptionId") REFERENCES "WebhookSubscription"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
