-- CreateEnum
CREATE TYPE "LogRecordLevel" AS ENUM ('DEBUG', 'INFO', 'WARN', 'ERROR');

-- CreateTable
CREATE TABLE "LogRecord" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "level" "LogRecordLevel" NOT NULL,
    "message" TEXT NOT NULL,
    "correlationId" TEXT,
    "service" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "userId" INTEGER,
    "patientId" INTEGER,
    "hospitalId" INTEGER,
    "encounterId" INTEGER,
    "data" JSONB,
    "errorMessage" TEXT,
    "errorStack" TEXT,
    "errorCode" TEXT,

    CONSTRAINT "LogRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErrorReportSnapshot" (
    "id" SERIAL NOT NULL,
    "reportId" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "summary" TEXT NOT NULL,
    "errorCount" INTEGER NOT NULL,
    "logCount" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "createdByUserId" INTEGER,

    CONSTRAINT "ErrorReportSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LogRecord_createdAt_idx" ON "LogRecord"("createdAt");

-- CreateIndex
CREATE INDEX "LogRecord_level_createdAt_idx" ON "LogRecord"("level", "createdAt");

-- CreateIndex
CREATE INDEX "LogRecord_correlationId_createdAt_idx" ON "LogRecord"("correlationId", "createdAt");

-- CreateIndex
CREATE INDEX "LogRecord_service_operation_createdAt_idx" ON "LogRecord"("service", "operation", "createdAt");

-- CreateIndex
CREATE INDEX "LogRecord_hospitalId_createdAt_idx" ON "LogRecord"("hospitalId", "createdAt");

-- CreateIndex
CREATE INDEX "LogRecord_encounterId_createdAt_idx" ON "LogRecord"("encounterId", "createdAt");

-- CreateIndex
CREATE INDEX "LogRecord_userId_createdAt_idx" ON "LogRecord"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "LogRecord_patientId_createdAt_idx" ON "LogRecord"("patientId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ErrorReportSnapshot_reportId_key" ON "ErrorReportSnapshot"("reportId");

-- CreateIndex
CREATE INDEX "ErrorReportSnapshot_correlationId_generatedAt_idx" ON "ErrorReportSnapshot"("correlationId", "generatedAt");

-- CreateIndex
CREATE INDEX "ErrorReportSnapshot_generatedAt_idx" ON "ErrorReportSnapshot"("generatedAt");
