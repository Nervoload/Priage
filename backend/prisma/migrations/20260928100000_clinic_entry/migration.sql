CREATE TABLE "ClinicEntrySettings" (
  "hospitalId" INTEGER NOT NULL PRIMARY KEY,
  "canonicalAlias" TEXT NOT NULL,
  "directoryListed" BOOLEAN NOT NULL DEFAULT false,
  "acceptsWalkIns" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClinicEntrySettings_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ClinicEntrySettings_canonicalAlias_key" ON "ClinicEntrySettings"("canonicalAlias");

CREATE TABLE "ClinicEntryAlias" (
  "alias" TEXT NOT NULL PRIMARY KEY,
  "hospitalId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClinicEntryAlias_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ClinicEntryAlias_hospitalId_idx" ON "ClinicEntryAlias"("hospitalId");

ALTER TABLE "IntakeSession" ADD COLUMN "contactEmail" TEXT;

-- Existing clinic previews already offer Reception walk-ins. New clinic tenants
-- remain unlisted and appointment-only until their admin configures entry.
INSERT INTO "ClinicEntrySettings" ("hospitalId", "canonicalAlias", "directoryListed", "acceptsWalkIns")
SELECT h."id", 'clinic-' || h."id", false, true
FROM "Hospital" h
JOIN "HospitalConfig" hc ON hc."hospitalId" = h."id"
WHERE hc."config"->>'workflowProfile' = 'CLINIC_APPOINTMENT';

INSERT INTO "ClinicEntryAlias" ("alias", "hospitalId")
SELECT "canonicalAlias", "hospitalId" FROM "ClinicEntrySettings";
