CREATE TYPE "AssetStorageProvider" AS ENUM ('LOCAL', 'S3');
CREATE TYPE "AssetAccessMode" AS ENUM ('PROXY', 'SIGNED_URL');
CREATE TYPE "SensitiveReadResource" AS ENUM (
  'ENCOUNTER_DETAIL',
  'PATIENT_PROFILE',
  'MESSAGE_THREAD',
  'TRIAGE_ASSESSMENT',
  'ASSET_CONTENT'
);

ALTER TABLE "Asset"
  ADD COLUMN "storageProvider" "AssetStorageProvider" NOT NULL DEFAULT 'LOCAL',
  ADD COLUMN "storageBucket" TEXT,
  ADD COLUMN "storageRegion" TEXT,
  ADD COLUMN "storageEndpoint" TEXT,
  ADD COLUMN "accessMode" "AssetAccessMode" NOT NULL DEFAULT 'PROXY',
  ADD COLUMN "retainedUntil" TIMESTAMP(3),
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "scanStatus" TEXT NOT NULL DEFAULT 'NOT_SCANNED',
  ADD COLUMN "encryption" TEXT;

CREATE TABLE "PatientIdempotencyRecord" (
  "id" SERIAL NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "command" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestFingerprint" TEXT NOT NULL,
  "status" "IdempotencyRecordStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "responseStatus" INTEGER,
  "responseBody" JSONB,
  "patientId" INTEGER NOT NULL,
  "patientSessionId" INTEGER,

  CONSTRAINT "PatientIdempotencyRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PatientIdempotencyRecord_patientId_command_idempotencyKey_key"
  ON "PatientIdempotencyRecord"("patientId", "command", "idempotencyKey");
CREATE INDEX "PatientIdempotencyRecord_patientId_createdAt_idx"
  ON "PatientIdempotencyRecord"("patientId", "createdAt");
CREATE INDEX "PatientIdempotencyRecord_patientSessionId_createdAt_idx"
  ON "PatientIdempotencyRecord"("patientSessionId", "createdAt");
CREATE INDEX "PatientIdempotencyRecord_status_createdAt_idx"
  ON "PatientIdempotencyRecord"("status", "createdAt");

ALTER TABLE "PatientIdempotencyRecord"
  ADD CONSTRAINT "PatientIdempotencyRecord_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PatientIdempotencyRecord"
  ADD CONSTRAINT "PatientIdempotencyRecord_patientSessionId_fkey"
  FOREIGN KEY ("patientSessionId") REFERENCES "PatientSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "SensitiveReadAuditLog" (
  "id" SERIAL NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resource" "SensitiveReadResource" NOT NULL,
  "action" TEXT NOT NULL DEFAULT 'READ',
  "correlationId" TEXT,
  "hospitalId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  "encounterId" INTEGER,
  "patientId" INTEGER,
  "assetId" INTEGER,
  "triageAssessmentId" INTEGER,
  "metadata" JSONB,

  CONSTRAINT "SensitiveReadAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SensitiveReadAuditLog_createdAt_idx"
  ON "SensitiveReadAuditLog"("createdAt");
CREATE INDEX "SensitiveReadAuditLog_hospitalId_createdAt_idx"
  ON "SensitiveReadAuditLog"("hospitalId", "createdAt");
CREATE INDEX "SensitiveReadAuditLog_userId_createdAt_idx"
  ON "SensitiveReadAuditLog"("userId", "createdAt");
CREATE INDEX "SensitiveReadAuditLog_encounterId_createdAt_idx"
  ON "SensitiveReadAuditLog"("encounterId", "createdAt");
CREATE INDEX "SensitiveReadAuditLog_patientId_createdAt_idx"
  ON "SensitiveReadAuditLog"("patientId", "createdAt");
CREATE INDEX "SensitiveReadAuditLog_resource_createdAt_idx"
  ON "SensitiveReadAuditLog"("resource", "createdAt");
