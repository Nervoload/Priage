-- CreateEnum
CREATE TYPE "EncounterStatus" AS ENUM ('EXPECTED', 'ADMITTED', 'TRIAGE', 'WAITING', 'COMPLETE', 'UNRESOLVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'NURSE', 'STAFF', 'DOCTOR');

-- CreateEnum
CREATE TYPE "SenderType" AS ENUM ('PATIENT', 'USER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('ENCOUNTER_CREATED', 'ARRIVAL_TIMEOUT', 'STATUS_CHANGE', 'MESSAGE_CREATED', 'MESSAGE_READ', 'MESSAGE_TRANSLATED', 'TRIAGE_CREATED', 'TRIAGE_NOTE_ADDED', 'TRIAGE_NOTE_UPDATED', 'TRIAGE_COMPLETED', 'ALERT_CREATED', 'ALERT_ACKNOWLEDGED', 'ALERT_RESOLVED');

-- CreateTable
CREATE TABLE "Encounter" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "EncounterStatus" NOT NULL DEFAULT 'EXPECTED',
    "chiefComplaint" TEXT,
    "details" TEXT,
    "hospitalId" INTEGER NOT NULL,
    "patientId" INTEGER NOT NULL,
    "currentTriageId" INTEGER,
    "currentCtasLevel" INTEGER,
    "currentPriorityScore" INTEGER,
    "expectedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "arrivedAt" TIMESTAMP(3),
    "triagedAt" TIMESTAMP(3),
    "waitingAt" TIMESTAMP(3),
    "seenAt" TIMESTAMP(3),
    "departedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "Encounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EncounterEvent" (
    "id" SERIAL NOT NULL,
    "type" "EventType" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUserId" INTEGER,
    "actorPatientId" INTEGER,
    "processedAt" TIMESTAMP(3),
    "encounterId" INTEGER NOT NULL,
    "hospitalId" INTEGER NOT NULL,

    CONSTRAINT "EncounterEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'STAFF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hospitalId" INTEGER NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hospital" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "Hospital_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HospitalConfig" (
    "hospitalId" INTEGER NOT NULL,
    "config" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HospitalConfig_pkey" PRIMARY KEY ("hospitalId")
);

-- CreateTable
CREATE TABLE "TriageAssessment" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ctasLevel" INTEGER NOT NULL,
    "priorityScore" INTEGER NOT NULL,
    "note" TEXT,
    "createdByUserId" INTEGER NOT NULL,
    "encounterId" INTEGER NOT NULL,
    "hospitalId" INTEGER NOT NULL,

    CONSTRAINT "TriageAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL DEFAULT 'MEDIUM',
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedByUserId" INTEGER,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" INTEGER,
    "metadata" JSONB,
    "encounterId" INTEGER NOT NULL,
    "hospitalId" INTEGER NOT NULL,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientProfile" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstName" TEXT,
    "lastName" TEXT,
    "age" INTEGER,
    "gender" TEXT,
    "heightCm" INTEGER,
    "weightKg" INTEGER,
    "allergies" TEXT,
    "conditions" TEXT,
    "preferredLanguage" TEXT NOT NULL DEFAULT 'en',
    "optionalHealthInfo" JSONB,

    CONSTRAINT "PatientProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientSession" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "pendingChiefComplaint" TEXT,
    "pendingDetails" TEXT,
    "patientId" INTEGER NOT NULL,
    "encounterId" INTEGER,

    CONSTRAINT "PatientSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "senderType" "SenderType" NOT NULL,
    "createdByUserId" INTEGER,
    "createdByPatientId" INTEGER,
    "content" TEXT NOT NULL,
    "original" TEXT,
    "language" TEXT,
    "encounterId" INTEGER NOT NULL,
    "hospitalId" INTEGER NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "sha256" TEXT,
    "encounterId" INTEGER NOT NULL,
    "hospitalId" INTEGER NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Encounter_currentTriageId_key" ON "Encounter"("currentTriageId");

-- CreateIndex
CREATE INDEX "Encounter_hospitalId_status_idx" ON "Encounter"("hospitalId", "status");

-- CreateIndex
CREATE INDEX "Encounter_hospitalId_updatedAt_idx" ON "Encounter"("hospitalId", "updatedAt");

-- CreateIndex
CREATE INDEX "Encounter_hospitalId_currentPriorityScore_updatedAt_idx" ON "Encounter"("hospitalId", "currentPriorityScore", "updatedAt");

-- CreateIndex
CREATE INDEX "Encounter_patientId_createdAt_idx" ON "Encounter"("patientId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Encounter_id_hospitalId_key" ON "Encounter"("id", "hospitalId");

-- CreateIndex
CREATE INDEX "EncounterEvent_encounterId_createdAt_idx" ON "EncounterEvent"("encounterId", "createdAt");

-- CreateIndex
CREATE INDEX "EncounterEvent_hospitalId_createdAt_idx" ON "EncounterEvent"("hospitalId", "createdAt");

-- CreateIndex
CREATE INDEX "EncounterEvent_processedAt_idx" ON "EncounterEvent"("processedAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_hospitalId_role_idx" ON "User"("hospitalId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "User_hospitalId_email_key" ON "User"("hospitalId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Hospital_slug_key" ON "Hospital"("slug");

-- CreateIndex
CREATE INDEX "Hospital_slug_idx" ON "Hospital"("slug");

-- CreateIndex
CREATE INDEX "TriageAssessment_encounterId_createdAt_idx" ON "TriageAssessment"("encounterId", "createdAt");

-- CreateIndex
CREATE INDEX "TriageAssessment_hospitalId_createdAt_idx" ON "TriageAssessment"("hospitalId", "createdAt");

-- CreateIndex
CREATE INDEX "Alert_hospitalId_createdAt_idx" ON "Alert"("hospitalId", "createdAt");

-- CreateIndex
CREATE INDEX "Alert_encounterId_createdAt_idx" ON "Alert"("encounterId", "createdAt");

-- CreateIndex
CREATE INDEX "Alert_hospitalId_acknowledgedAt_idx" ON "Alert"("hospitalId", "acknowledgedAt");

-- CreateIndex
CREATE INDEX "Alert_hospitalId_resolvedAt_idx" ON "Alert"("hospitalId", "resolvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PatientProfile_email_key" ON "PatientProfile"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PatientSession_token_key" ON "PatientSession"("token");

-- CreateIndex
CREATE INDEX "PatientSession_patientId_createdAt_idx" ON "PatientSession"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "PatientSession_encounterId_createdAt_idx" ON "PatientSession"("encounterId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_encounterId_createdAt_idx" ON "Message"("encounterId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_hospitalId_createdAt_idx" ON "Message"("hospitalId", "createdAt");

-- CreateIndex
CREATE INDEX "Asset_encounterId_createdAt_idx" ON "Asset"("encounterId", "createdAt");

-- CreateIndex
CREATE INDEX "Asset_hospitalId_createdAt_idx" ON "Asset"("hospitalId", "createdAt");

-- AddForeignKey
ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_currentTriageId_fkey" FOREIGN KEY ("currentTriageId") REFERENCES "TriageAssessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EncounterEvent" ADD CONSTRAINT "EncounterEvent_encounterId_hospitalId_fkey" FOREIGN KEY ("encounterId", "hospitalId") REFERENCES "Encounter"("id", "hospitalId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalConfig" ADD CONSTRAINT "HospitalConfig_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriageAssessment" ADD CONSTRAINT "TriageAssessment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriageAssessment" ADD CONSTRAINT "TriageAssessment_encounterId_hospitalId_fkey" FOREIGN KEY ("encounterId", "hospitalId") REFERENCES "Encounter"("id", "hospitalId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_acknowledgedByUserId_fkey" FOREIGN KEY ("acknowledgedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_encounterId_hospitalId_fkey" FOREIGN KEY ("encounterId", "hospitalId") REFERENCES "Encounter"("id", "hospitalId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientSession" ADD CONSTRAINT "PatientSession_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientSession" ADD CONSTRAINT "PatientSession_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_createdByPatientId_fkey" FOREIGN KEY ("createdByPatientId") REFERENCES "PatientProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_encounterId_hospitalId_fkey" FOREIGN KEY ("encounterId", "hospitalId") REFERENCES "Encounter"("id", "hospitalId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_encounterId_hospitalId_fkey" FOREIGN KEY ("encounterId", "hospitalId") REFERENCES "Encounter"("id", "hospitalId") ON DELETE CASCADE ON UPDATE CASCADE;
