ALTER TYPE "AssetStatus" ADD VALUE IF NOT EXISTS 'QUARANTINED' BEFORE 'READY';
ALTER TYPE "AssetStatus" ADD VALUE IF NOT EXISTS 'DELETE_PENDING' AFTER 'READY';
ALTER TYPE "AssetStatus" ADD VALUE IF NOT EXISTS 'REJECTED' AFTER 'DELETE_PENDING';

ALTER TYPE "SensitiveReadResource" ADD VALUE IF NOT EXISTS 'ENCOUNTER_LIST' BEFORE 'ENCOUNTER_DETAIL';
ALTER TYPE "SensitiveReadResource" ADD VALUE IF NOT EXISTS 'HOSPITAL_QUEUE' AFTER 'ENCOUNTER_DETAIL';
ALTER TYPE "SensitiveReadResource" ADD VALUE IF NOT EXISTS 'BREAK_GLASS' AFTER 'ASSET_CONTENT';
ALTER TYPE "SensitiveReadResource" ADD VALUE IF NOT EXISTS 'ALERT' AFTER 'ASSET_CONTENT';

CREATE EXTENSION IF NOT EXISTS pgcrypto;
UPDATE "PatientSession"
SET "token" = encode(digest("token", 'sha256'), 'hex')
WHERE "token" !~ '^[a-f0-9]{64}$';

ALTER TABLE "EncounterEvent"
  ADD COLUMN "claimedAt" TIMESTAMP(3),
  ADD COLUMN "claimToken" TEXT,
  ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastError" TEXT,
  ADD COLUMN "deadLetteredAt" TIMESTAMP(3);

CREATE INDEX "EncounterEvent_deadLetteredAt_processedAt_createdAt_idx"
  ON "EncounterEvent"("deadLetteredAt", "processedAt", "createdAt");
CREATE INDEX "EncounterEvent_claimedAt_idx" ON "EncounterEvent"("claimedAt");

ALTER TABLE "User"
  ADD COLUMN "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "mfaSecretEncrypted" TEXT,
  ADD COLUMN "ssoIssuer" TEXT,
  ADD COLUMN "ssoSubject" TEXT;

CREATE UNIQUE INDEX "User_ssoIssuer_ssoSubject_key" ON "User"("ssoIssuer", "ssoSubject");

ALTER TABLE "StaffSession"
  ADD COLUMN "deviceIdHash" TEXT,
  ADD COLUMN "deviceFingerprintHash" TEXT,
  ADD COLUMN "authMethod" TEXT NOT NULL DEFAULT 'password',
  ADD COLUMN "mfaVerifiedAt" TIMESTAMP(3);

CREATE INDEX "StaffSession_deviceIdHash_idx" ON "StaffSession"("deviceIdHash");

CREATE TABLE "StaffEncounterAccess" (
  "id" SERIAL NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "reason" TEXT,
  "encounterId" INTEGER NOT NULL,
  "hospitalId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  "grantedByUserId" INTEGER NOT NULL,
  CONSTRAINT "StaffEncounterAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StaffEncounterAccess_encounterId_userId_key"
  ON "StaffEncounterAccess"("encounterId", "userId");
CREATE INDEX "StaffEncounterAccess_hospitalId_userId_expiresAt_idx"
  ON "StaffEncounterAccess"("hospitalId", "userId", "expiresAt");
ALTER TABLE "StaffEncounterAccess"
  ADD CONSTRAINT "StaffEncounterAccess_encounterId_hospitalId_fkey"
  FOREIGN KEY ("encounterId", "hospitalId") REFERENCES "Encounter"("id", "hospitalId")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffEncounterAccess"
  ADD CONSTRAINT "StaffEncounterAccess_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffEncounterAccess"
  ADD CONSTRAINT "StaffEncounterAccess_grantedByUserId_fkey"
  FOREIGN KEY ("grantedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "BreakGlassAccess" (
  "id" SERIAL NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "reason" TEXT NOT NULL,
  "correlationId" TEXT,
  "encounterId" INTEGER NOT NULL,
  "hospitalId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  CONSTRAINT "BreakGlassAccess_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BreakGlassAccess_encounterId_userId_expiresAt_idx"
  ON "BreakGlassAccess"("encounterId", "userId", "expiresAt");
CREATE INDEX "BreakGlassAccess_hospitalId_createdAt_idx"
  ON "BreakGlassAccess"("hospitalId", "createdAt");
ALTER TABLE "BreakGlassAccess"
  ADD CONSTRAINT "BreakGlassAccess_encounterId_hospitalId_fkey"
  FOREIGN KEY ("encounterId", "hospitalId") REFERENCES "Encounter"("id", "hospitalId")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BreakGlassAccess"
  ADD CONSTRAINT "BreakGlassAccess_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
