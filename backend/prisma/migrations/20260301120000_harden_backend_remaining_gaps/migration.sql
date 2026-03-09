CREATE INDEX "PatientSession_expiresAt_idx" ON "PatientSession"("expiresAt");

CREATE TABLE "EncounterReadCursor" (
    "id" SERIAL NOT NULL,
    "encounterId" INTEGER NOT NULL,
    "hospitalId" INTEGER NOT NULL,
    "userId" INTEGER,
    "patientId" INTEGER,
    "lastReadMessageId" INTEGER,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EncounterReadCursor_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EncounterReadCursor_encounterId_hospitalId_idx" ON "EncounterReadCursor"("encounterId", "hospitalId");
CREATE UNIQUE INDEX "EncounterReadCursor_encounterId_userId_key" ON "EncounterReadCursor"("encounterId", "userId");
CREATE UNIQUE INDEX "EncounterReadCursor_encounterId_patientId_key" ON "EncounterReadCursor"("encounterId", "patientId");

ALTER TABLE "EncounterReadCursor"
    ADD CONSTRAINT "EncounterReadCursor_encounterId_hospitalId_fkey"
    FOREIGN KEY ("encounterId", "hospitalId") REFERENCES "Encounter"("id", "hospitalId")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EncounterReadCursor"
    ADD CONSTRAINT "EncounterReadCursor_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EncounterReadCursor"
    ADD CONSTRAINT "EncounterReadCursor_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
