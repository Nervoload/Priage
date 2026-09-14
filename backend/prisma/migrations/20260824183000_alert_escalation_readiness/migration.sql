CREATE TABLE "AlertEscalationException" (
  "id" SERIAL NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "reason" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdByUserId" INTEGER NOT NULL,
  "hospitalId" INTEGER NOT NULL,
  CONSTRAINT "AlertEscalationException_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AlertEscalationException_hospitalId_key"
  ON "AlertEscalationException"("hospitalId");
CREATE INDEX "AlertEscalationException_expiresAt_idx"
  ON "AlertEscalationException"("expiresAt");
ALTER TABLE "AlertEscalationException"
  ADD CONSTRAINT "AlertEscalationException_hospitalId_fkey"
  FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlertEscalationException"
  ADD CONSTRAINT "AlertEscalationException_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
