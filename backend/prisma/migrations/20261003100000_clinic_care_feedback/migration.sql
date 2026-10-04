-- Clinician feedback on generated Care items, and "Ask in the room" items
-- recorded as clinician questions.

-- AlterTable
ALTER TABLE "CareOpenQuestion" ADD COLUMN "snapshotId" INTEGER,
ADD COLUMN "sourceSegmentId" TEXT,
ADD COLUMN "answerText" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CareOpenQuestion_encounterId_snapshotId_sourceSegmentId_key" ON "CareOpenQuestion"("encounterId", "snapshotId", "sourceSegmentId");

-- CreateEnum
CREATE TYPE "CareAiFeedbackKind" AS ENUM ('USEFUL', 'NOT_RIGHT', 'MISSING');

-- CreateTable
CREATE TABLE "CareAiFeedback" (
    "id" SERIAL NOT NULL,
    "encounterId" INTEGER NOT NULL,
    "hospitalId" INTEGER NOT NULL,
    "snapshotId" INTEGER NOT NULL,
    "targetKey" TEXT NOT NULL,
    "segmentId" TEXT,
    "sectionKey" TEXT NOT NULL,
    "ruleId" TEXT,
    "generatorKind" TEXT NOT NULL,
    "generatorVersion" TEXT,
    "kind" "CareAiFeedbackKind" NOT NULL,
    "note" TEXT,
    "actorUserId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareAiFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CareAiFeedback_snapshotId_actorUserId_targetKey_key" ON "CareAiFeedback"("snapshotId", "actorUserId", "targetKey");

-- CreateIndex
CREATE INDEX "CareAiFeedback_hospitalId_createdAt_idx" ON "CareAiFeedback"("hospitalId", "createdAt");

-- AddForeignKey
ALTER TABLE "CareAiFeedback" ADD CONSTRAINT "CareAiFeedback_encounterId_hospitalId_fkey" FOREIGN KEY ("encounterId", "hospitalId") REFERENCES "Encounter"("id", "hospitalId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareAiFeedback" ADD CONSTRAINT "CareAiFeedback_snapshotId_encounterId_hospitalId_fkey" FOREIGN KEY ("snapshotId", "encounterId", "hospitalId") REFERENCES "CareAssessmentSnapshot"("id", "encounterId", "hospitalId") ON DELETE CASCADE ON UPDATE CASCADE;
