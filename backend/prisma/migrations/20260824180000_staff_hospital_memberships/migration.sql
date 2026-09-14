ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'IT_ADMIN';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'CLINICAL_ADMIN';

DROP INDEX IF EXISTS "User_hospitalId_email_key";

CREATE TABLE "HospitalMembership" (
  "id" SERIAL NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "disabledAt" TIMESTAMP(3),
  "role" "Role" NOT NULL,
  "userId" INTEGER NOT NULL,
  "hospitalId" INTEGER NOT NULL,
  CONSTRAINT "HospitalMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HospitalMembership_userId_hospitalId_key"
  ON "HospitalMembership"("userId", "hospitalId");
CREATE INDEX "HospitalMembership_hospitalId_role_isActive_idx"
  ON "HospitalMembership"("hospitalId", "role", "isActive");
CREATE INDEX "HospitalMembership_userId_isActive_idx"
  ON "HospitalMembership"("userId", "isActive");

ALTER TABLE "HospitalMembership"
  ADD CONSTRAINT "HospitalMembership_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HospitalMembership"
  ADD CONSTRAINT "HospitalMembership_hospitalId_fkey"
  FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "HospitalMembership" ("createdAt", "updatedAt", "role", "userId", "hospitalId")
SELECT "createdAt", CURRENT_TIMESTAMP, "role", "id", "hospitalId"
FROM "User"
ON CONFLICT ("userId", "hospitalId") DO NOTHING;

ALTER TABLE "StaffSession" ADD COLUMN "membershipId" INTEGER;

UPDATE "StaffSession" session
SET "membershipId" = membership."id"
FROM "HospitalMembership" membership
WHERE membership."userId" = session."userId"
  AND membership."hospitalId" = (SELECT "hospitalId" FROM "User" WHERE "id" = session."userId");

CREATE INDEX "StaffSession_membershipId_createdAt_idx"
  ON "StaffSession"("membershipId", "createdAt");
ALTER TABLE "StaffSession"
  ADD CONSTRAINT "StaffSession_membershipId_fkey"
  FOREIGN KEY ("membershipId") REFERENCES "HospitalMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
