CREATE TYPE "AssetKind" AS ENUM ('IMAGE');
CREATE TYPE "AssetContext" AS ENUM ('INTAKE_IMAGE', 'MESSAGE_ATTACHMENT');
CREATE TYPE "AssetStatus" AS ENUM ('READY', 'DELETED');

ALTER TABLE "Asset"
    ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN "kind" "AssetKind" NOT NULL DEFAULT 'IMAGE',
    ADD COLUMN "context" "AssetContext",
    ADD COLUMN "status" "AssetStatus" NOT NULL DEFAULT 'READY',
    ADD COLUMN "originalFilename" TEXT,
    ADD COLUMN "width" INTEGER,
    ADD COLUMN "height" INTEGER,
    ADD COLUMN "patientSessionId" INTEGER,
    ADD COLUMN "messageId" INTEGER,
    ADD COLUMN "createdByUserId" INTEGER,
    ADD COLUMN "createdByPatientId" INTEGER;

UPDATE "Asset"
SET
    "context" = 'MESSAGE_ATTACHMENT',
    "originalFilename" = split_part("storageKey", '/', array_length(string_to_array("storageKey", '/'), 1))
WHERE "context" IS NULL;

ALTER TABLE "Asset"
    ALTER COLUMN "context" SET NOT NULL,
    ALTER COLUMN "originalFilename" SET NOT NULL,
    ALTER COLUMN "mimeType" SET NOT NULL,
    ALTER COLUMN "sizeBytes" SET NOT NULL,
    ALTER COLUMN "encounterId" DROP NOT NULL,
    ALTER COLUMN "hospitalId" DROP NOT NULL;

CREATE INDEX "Asset_patientSessionId_createdAt_idx" ON "Asset"("patientSessionId", "createdAt");
CREATE INDEX "Asset_messageId_createdAt_idx" ON "Asset"("messageId", "createdAt");
CREATE INDEX "Asset_status_idx" ON "Asset"("status");
CREATE INDEX "Asset_context_idx" ON "Asset"("context");

ALTER TABLE "Asset"
    ADD CONSTRAINT "Asset_patientSessionId_fkey"
    FOREIGN KEY ("patientSessionId") REFERENCES "PatientSession"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Asset"
    ADD CONSTRAINT "Asset_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "Message"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Asset"
    ADD CONSTRAINT "Asset_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Asset"
    ADD CONSTRAINT "Asset_createdByPatientId_fkey"
    FOREIGN KEY ("createdByPatientId") REFERENCES "PatientProfile"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
