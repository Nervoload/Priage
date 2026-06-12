ALTER TABLE "Asset"
  ALTER COLUMN "status" SET DEFAULT 'QUARANTINED',
  ADD COLUMN "scanDetail" TEXT,
  ADD COLUMN "deletionAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "deletionLastError" TEXT;

ALTER TABLE "ErrorReportSnapshot" ADD COLUMN "hospitalId" INTEGER;
CREATE INDEX "ErrorReportSnapshot_hospitalId_generatedAt_idx"
  ON "ErrorReportSnapshot"("hospitalId", "generatedAt");