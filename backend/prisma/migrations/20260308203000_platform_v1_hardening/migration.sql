CREATE TYPE "IdempotencyRecordStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'FAILED');

ALTER TABLE "PatientSession"
  DROP COLUMN "pendingChiefComplaint",
  DROP COLUMN "pendingDetails";

DROP INDEX IF EXISTS "IntakeSession_token_key";
DROP INDEX IF EXISTS "IntakeSession_authSessionId_key";

ALTER TABLE "IntakeSession"
  DROP COLUMN "token";

CREATE INDEX "IntakeSession_authSessionId_status_createdAt_idx"
  ON "IntakeSession"("authSessionId", "status", "createdAt");

ALTER TABLE "ContextItem"
  ADD COLUMN "schemaVersion" TEXT NOT NULL DEFAULT 'v1';

ALTER TABLE "IdempotencyRecord"
  ADD COLUMN "status" "IdempotencyRecordStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ALTER COLUMN "commandResultId" DROP NOT NULL;

UPDATE "IdempotencyRecord"
SET "status" = 'COMPLETED',
    "completedAt" = COALESCE("createdAt", NOW())
WHERE "commandResultId" IS NOT NULL;
