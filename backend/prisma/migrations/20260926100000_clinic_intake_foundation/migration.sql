ALTER TYPE "EncounterStatus" ADD VALUE IF NOT EXISTS 'INTAKE';
ALTER TYPE "EncounterStatus" ADD VALUE IF NOT EXISTS 'REQUESTED';
CREATE TYPE "InterviewAnswerEntryMode" AS ENUM ('PATIENT_SELF', 'WALKIN_SELF', 'STAFF_ASSISTED');

ALTER TABLE "Encounter" ADD COLUMN "clinicStartKey" TEXT;
ALTER TABLE "Encounter" ADD COLUMN "clinicStartFingerprint" TEXT;
CREATE UNIQUE INDEX "Encounter_clinicStartKey_key" ON "Encounter"("clinicStartKey");

ALTER TABLE "EncounterContact" ADD COLUMN "verifiedAt" TIMESTAMP(3);

ALTER TABLE "ContextItem" ADD COLUMN "answerEntryMode" "InterviewAnswerEntryMode";
ALTER TABLE "ContextItem" ADD COLUMN "enteredByUserId" INTEGER;
CREATE INDEX "ContextItem_enteredByUserId_createdAt_idx" ON "ContextItem"("enteredByUserId", "createdAt");
ALTER TABLE "ContextItem" ADD CONSTRAINT "ContextItem_enteredByUserId_fkey"
  FOREIGN KEY ("enteredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ClinicAssessmentGrant" (
  "id" SERIAL NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "encounterId" INTEGER NOT NULL,
  "hospitalId" INTEGER NOT NULL,
  "issuedByUserId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "ClinicAssessmentGrant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ClinicAssessmentGrant_tokenHash_key" ON "ClinicAssessmentGrant"("tokenHash");
CREATE INDEX "ClinicAssessmentGrant_encounterId_expiresAt_idx" ON "ClinicAssessmentGrant"("encounterId", "expiresAt");
CREATE INDEX "ClinicAssessmentGrant_hospitalId_createdAt_idx" ON "ClinicAssessmentGrant"("hospitalId", "createdAt");
ALTER TABLE "ClinicAssessmentGrant" ADD CONSTRAINT "ClinicAssessmentGrant_encounterId_hospitalId_fkey"
  FOREIGN KEY ("encounterId", "hospitalId") REFERENCES "Encounter"("id", "hospitalId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClinicAssessmentGrant" ADD CONSTRAINT "ClinicAssessmentGrant_issuedByUserId_fkey"
  FOREIGN KEY ("issuedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ClinicAssessmentSession" (
  "id" SERIAL NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "grantId" INTEGER NOT NULL,
  "encounterId" INTEGER NOT NULL,
  "hospitalId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "ClinicAssessmentSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ClinicAssessmentSession_tokenHash_key" ON "ClinicAssessmentSession"("tokenHash");
CREATE UNIQUE INDEX "ClinicAssessmentSession_grantId_key" ON "ClinicAssessmentSession"("grantId");
CREATE INDEX "ClinicAssessmentSession_encounterId_expiresAt_idx" ON "ClinicAssessmentSession"("encounterId", "expiresAt");
ALTER TABLE "ClinicAssessmentSession" ADD CONSTRAINT "ClinicAssessmentSession_grantId_fkey"
  FOREIGN KEY ("grantId") REFERENCES "ClinicAssessmentGrant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClinicAssessmentSession" ADD CONSTRAINT "ClinicAssessmentSession_encounterId_hospitalId_fkey"
  FOREIGN KEY ("encounterId", "hospitalId") REFERENCES "Encounter"("id", "hospitalId") ON DELETE CASCADE ON UPDATE CASCADE;
