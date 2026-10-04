ALTER TYPE "EncounterStatus" ADD VALUE 'CARE';
ALTER TYPE "EventType" ADD VALUE 'CARE_UPDATED';

CREATE TABLE "CareAssessmentSnapshot" (
  "id" SERIAL PRIMARY KEY,
  "encounterId" INTEGER NOT NULL,
  "hospitalId" INTEGER NOT NULL,
  "version" INTEGER NOT NULL,
  "partial" BOOLEAN NOT NULL DEFAULT false,
  "content" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CareAssessmentSnapshot_encounterId_hospitalId_fkey" FOREIGN KEY ("encounterId", "hospitalId") REFERENCES "Encounter"("id", "hospitalId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CareAssessmentSnapshot_encounterId_version_key" ON "CareAssessmentSnapshot"("encounterId", "version");
CREATE UNIQUE INDEX "CareAssessmentSnapshot_id_encounterId_hospitalId_key" ON "CareAssessmentSnapshot"("id", "encounterId", "hospitalId");
CREATE INDEX "CareAssessmentSnapshot_hospitalId_createdAt_idx" ON "CareAssessmentSnapshot"("hospitalId", "createdAt");

CREATE TABLE "CareNote" (
  "id" SERIAL PRIMARY KEY,
  "encounterId" INTEGER NOT NULL,
  "hospitalId" INTEGER NOT NULL,
  "text" TEXT NOT NULL DEFAULT '',
  "version" INTEGER NOT NULL DEFAULT 0,
  "updatedByUserId" INTEGER,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "finalizedAt" TIMESTAMP(3),
  CONSTRAINT "CareNote_encounterId_hospitalId_fkey" FOREIGN KEY ("encounterId", "hospitalId") REFERENCES "Encounter"("id", "hospitalId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CareNote_encounterId_key" ON "CareNote"("encounterId");
CREATE UNIQUE INDEX "CareNote_encounterId_hospitalId_key" ON "CareNote"("encounterId", "hospitalId");
CREATE INDEX "CareNote_hospitalId_updatedAt_idx" ON "CareNote"("hospitalId", "updatedAt");

CREATE TABLE "CareNoteRevision" (
  "id" SERIAL PRIMARY KEY,
  "careNoteId" INTEGER NOT NULL,
  "version" INTEGER NOT NULL,
  "text" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "reason" TEXT,
  "actorUserId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CareNoteRevision_careNoteId_fkey" FOREIGN KEY ("careNoteId") REFERENCES "CareNote"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CareNoteRevision_careNoteId_version_key" ON "CareNoteRevision"("careNoteId", "version");

CREATE TABLE "CareAssessmentComment" (
  "id" SERIAL PRIMARY KEY,
  "commandKey" TEXT,
  "encounterId" INTEGER NOT NULL,
  "hospitalId" INTEGER NOT NULL,
  "snapshotId" INTEGER NOT NULL,
  "segmentId" TEXT NOT NULL,
  "startOffset" INTEGER NOT NULL,
  "endOffset" INTEGER NOT NULL,
  "quote" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "resolvedAt" TIMESTAMP(3),
  "actorUserId" INTEGER NOT NULL,
  "updatedByUserId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CareAssessmentComment_encounterId_hospitalId_fkey" FOREIGN KEY ("encounterId", "hospitalId") REFERENCES "Encounter"("id", "hospitalId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CareAssessmentComment_snapshotId_encounterId_hospitalId_fkey" FOREIGN KEY ("snapshotId", "encounterId", "hospitalId") REFERENCES "CareAssessmentSnapshot"("id", "encounterId", "hospitalId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "CareAssessmentComment_encounterId_snapshotId_segmentId_idx" ON "CareAssessmentComment"("encounterId", "snapshotId", "segmentId");
CREATE UNIQUE INDEX "CareAssessmentComment_commandKey_key" ON "CareAssessmentComment"("commandKey");

CREATE TABLE "CareCommentRevision" (
  "id" SERIAL PRIMARY KEY,
  "commentId" INTEGER NOT NULL,
  "version" INTEGER NOT NULL,
  "text" TEXT NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  "actorUserId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CareCommentRevision_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "CareAssessmentComment"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CareCommentRevision_commentId_version_key" ON "CareCommentRevision"("commentId", "version");

CREATE TABLE "CareOpenQuestion" (
  "id" SERIAL PRIMARY KEY,
  "commandKey" TEXT,
  "encounterId" INTEGER NOT NULL,
  "hospitalId" INTEGER NOT NULL,
  "text" TEXT NOT NULL,
  "addressedAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "actorUserId" INTEGER NOT NULL,
  "updatedByUserId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CareOpenQuestion_encounterId_hospitalId_fkey" FOREIGN KEY ("encounterId", "hospitalId") REFERENCES "Encounter"("id", "hospitalId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "CareOpenQuestion_encounterId_createdAt_idx" ON "CareOpenQuestion"("encounterId", "createdAt");

CREATE TABLE "CareHandoffOverride" (
  "id" SERIAL PRIMARY KEY,
  "encounterId" INTEGER NOT NULL,
  "hospitalId" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "actorUserId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CareHandoffOverride_encounterId_hospitalId_fkey" FOREIGN KEY ("encounterId", "hospitalId") REFERENCES "Encounter"("id", "hospitalId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CareHandoffOverride_encounterId_key" ON "CareHandoffOverride"("encounterId");
CREATE UNIQUE INDEX "CareHandoffOverride_encounterId_hospitalId_key" ON "CareHandoffOverride"("encounterId", "hospitalId");
CREATE INDEX "CareHandoffOverride_hospitalId_createdAt_idx" ON "CareHandoffOverride"("hospitalId", "createdAt");
CREATE UNIQUE INDEX "CareOpenQuestion_commandKey_key" ON "CareOpenQuestion"("commandKey");
