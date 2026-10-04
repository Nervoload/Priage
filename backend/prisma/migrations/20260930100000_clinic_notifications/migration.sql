-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED', 'PROCESSING', 'ACCEPTED', 'DELIVERED', 'FAILED', 'CANCELLED', 'NEEDS_REVIEW');

-- AlterTable
ALTER TABLE "EncounterContact" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "ClinicNotificationSettings" (
    "hospitalId" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "replyTo" TEXT,
    "contactPhone" TEXT,
    "reminderMinutes" JSONB NOT NULL DEFAULT '[1440,120]',
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedByUserId" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicNotificationSettings_pkey" PRIMARY KEY ("hospitalId")
);

-- CreateTable
CREATE TABLE "NotificationOutbox" (
    "id" TEXT NOT NULL,
    "hospitalId" INTEGER NOT NULL,
    "encounterId" INTEGER,
    "appointmentId" INTEGER,
    "challengeId" TEXT,
    "appointmentRevision" INTEGER,
    "contactVersion" INTEGER,
    "purpose" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "templateVersion" TEXT NOT NULL DEFAULT 'clinic-email-v1',
    "status" "NotificationStatus" NOT NULL DEFAULT 'QUEUED',
    "payload" JSONB,
    "secretEncrypted" TEXT,
    "payloadEncrypted" TEXT,
    "firstAttemptAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "claimToken" TEXT,
    "claimedAt" TIMESTAMP(3),
    "provider" TEXT,
    "providerEmailId" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "lastEventAt" TIMESTAMP(3),
    "lastError" TEXT,
    "cancelledReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationAttempt" (
    "id" SERIAL NOT NULL,
    "notificationId" TEXT NOT NULL,
    "hospitalId" INTEGER NOT NULL,
    "outcome" TEXT NOT NULL,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationWebhookReceipt" (
    "id" TEXT NOT NULL,
    "providerEmailId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationWebhookReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationSuppression" (
    "id" SERIAL NOT NULL,
    "hospitalId" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationSuppression_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentRecoveryChallenge" (
    "id" TEXT NOT NULL,
    "hospitalId" INTEGER NOT NULL,
    "appointmentId" INTEGER NOT NULL,
    "contactVersion" INTEGER NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentRecoveryChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentRecoverySession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "hospitalId" INTEGER NOT NULL,
    "appointmentId" INTEGER NOT NULL,
    "contactVersion" INTEGER NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentRecoverySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryRateLimit" (
    "key" TEXT NOT NULL,
    "windowStartAt" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequestAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecoveryRateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationOutbox_challengeId_key" ON "NotificationOutbox"("challengeId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationOutbox_dedupeKey_key" ON "NotificationOutbox"("dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationOutbox_providerEmailId_key" ON "NotificationOutbox"("providerEmailId");

-- CreateIndex
CREATE INDEX "NotificationOutbox_status_dueAt_idx" ON "NotificationOutbox"("status", "dueAt");

-- CreateIndex
CREATE INDEX "NotificationOutbox_hospitalId_appointmentId_createdAt_idx" ON "NotificationOutbox"("hospitalId", "appointmentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationOutbox_id_hospitalId_key" ON "NotificationOutbox"("id", "hospitalId");

-- CreateIndex
CREATE INDEX "NotificationAttempt_notificationId_createdAt_idx" ON "NotificationAttempt"("notificationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationSuppression_hospitalId_email_key" ON "NotificationSuppression"("hospitalId", "email");

-- CreateIndex
CREATE INDEX "AppointmentRecoveryChallenge_hospitalId_appointmentId_idx" ON "AppointmentRecoveryChallenge"("hospitalId", "appointmentId");

-- CreateIndex
CREATE INDEX "AppointmentRecoveryChallenge_expiresAt_idx" ON "AppointmentRecoveryChallenge"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentRecoverySession_tokenHash_key" ON "AppointmentRecoverySession"("tokenHash");

-- CreateIndex
CREATE INDEX "AppointmentRecoverySession_hospitalId_appointmentId_idx" ON "AppointmentRecoverySession"("hospitalId", "appointmentId");

-- CreateIndex
CREATE INDEX "AppointmentRecoverySession_expiresAt_idx" ON "AppointmentRecoverySession"("expiresAt");

-- AddForeignKey
ALTER TABLE "ClinicNotificationSettings" ADD CONSTRAINT "ClinicNotificationSettings_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationOutbox" ADD CONSTRAINT "NotificationOutbox_encounterId_hospitalId_fkey" FOREIGN KEY ("encounterId", "hospitalId") REFERENCES "Encounter"("id", "hospitalId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationOutbox" ADD CONSTRAINT "NotificationOutbox_appointmentId_hospitalId_fkey" FOREIGN KEY ("appointmentId", "hospitalId") REFERENCES "ClinicAppointment"("id", "hospitalId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationOutbox" ADD CONSTRAINT "NotificationOutbox_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "AppointmentRecoveryChallenge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationAttempt" ADD CONSTRAINT "NotificationAttempt_notificationId_hospitalId_fkey" FOREIGN KEY ("notificationId", "hospitalId") REFERENCES "NotificationOutbox"("id", "hospitalId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationSuppression" ADD CONSTRAINT "NotificationSuppression_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentRecoveryChallenge" ADD CONSTRAINT "AppointmentRecoveryChallenge_appointmentId_hospitalId_fkey" FOREIGN KEY ("appointmentId", "hospitalId") REFERENCES "ClinicAppointment"("id", "hospitalId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentRecoverySession" ADD CONSTRAINT "AppointmentRecoverySession_appointmentId_hospitalId_fkey" FOREIGN KEY ("appointmentId", "hospitalId") REFERENCES "ClinicAppointment"("id", "hospitalId") ON DELETE CASCADE ON UPDATE CASCADE;
