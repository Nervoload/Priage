CREATE TYPE "ClinicAppointmentStatus" AS ENUM ('REQUESTED', 'CONFIRMED', 'DECLINED', 'CANCELLED', 'EXPIRED', 'NO_SHOW', 'COMPLETED');

CREATE TABLE "ClinicSchedule" (
  "hospitalId" INTEGER NOT NULL,
  "timezone" TEXT NOT NULL,
  "slotMinutes" INTEGER NOT NULL,
  "capacity" INTEGER NOT NULL,
  "holdMinutes" INTEGER NOT NULL,
  "weeklyWindows" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClinicSchedule_pkey" PRIMARY KEY ("hospitalId"),
  CONSTRAINT "ClinicSchedule_slotMinutes_check" CHECK ("slotMinutes" IN (15, 30, 60)),
  CONSTRAINT "ClinicSchedule_capacity_check" CHECK ("capacity" BETWEEN 1 AND 50),
  CONSTRAINT "ClinicSchedule_holdMinutes_check" CHECK ("holdMinutes" BETWEEN 15 AND 10080)
);
ALTER TABLE "ClinicSchedule" ADD CONSTRAINT "ClinicSchedule_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ClinicScheduleOverride" (
  "id" SERIAL NOT NULL,
  "hospitalId" INTEGER NOT NULL,
  "localDate" TEXT NOT NULL,
  "windows" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClinicScheduleOverride_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ClinicScheduleOverride_hospitalId_localDate_key" ON "ClinicScheduleOverride"("hospitalId", "localDate");
ALTER TABLE "ClinicScheduleOverride" ADD CONSTRAINT "ClinicScheduleOverride_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ClinicScheduleBlock" (
  "id" SERIAL NOT NULL,
  "hospitalId" INTEGER NOT NULL,
  "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3) NOT NULL,
  "reason" TEXT NOT NULL,
  "createdByUserId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClinicScheduleBlock_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ClinicScheduleBlock_range_check" CHECK ("endAt" > "startAt")
);
CREATE INDEX "ClinicScheduleBlock_hospitalId_startAt_endAt_idx" ON "ClinicScheduleBlock"("hospitalId", "startAt", "endAt");
ALTER TABLE "ClinicScheduleBlock" ADD CONSTRAINT "ClinicScheduleBlock_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClinicScheduleBlock" ADD CONSTRAINT "ClinicScheduleBlock_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ClinicAppointment" (
  "id" SERIAL NOT NULL,
  "publicId" TEXT NOT NULL,
  "hospitalId" INTEGER NOT NULL,
  "encounterId" INTEGER NOT NULL,
  "status" "ClinicAppointmentStatus" NOT NULL DEFAULT 'REQUESTED',
  "requestedStartAt" TIMESTAMP(3) NOT NULL,
  "confirmedStartAt" TIMESTAMP(3),
  "endAt" TIMESTAMP(3) NOT NULL,
  "timezone" TEXT NOT NULL,
  "slotMinutes" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "revision" INTEGER NOT NULL DEFAULT 1,
  "requestKey" TEXT NOT NULL,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmedAt" TIMESTAMP(3),
  "confirmedByUserId" INTEGER,
  "resolvedAt" TIMESTAMP(3),
  "resolvedByUserId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClinicAppointment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ClinicAppointment_revision_check" CHECK ("revision" > 0),
  CONSTRAINT "ClinicAppointment_end_check" CHECK ("endAt" > "requestedStartAt")
);
CREATE UNIQUE INDEX "ClinicAppointment_publicId_key" ON "ClinicAppointment"("publicId");
CREATE UNIQUE INDEX "ClinicAppointment_encounterId_key" ON "ClinicAppointment"("encounterId");
CREATE UNIQUE INDEX "ClinicAppointment_encounterId_hospitalId_key" ON "ClinicAppointment"("encounterId", "hospitalId");
CREATE UNIQUE INDEX "ClinicAppointment_requestKey_key" ON "ClinicAppointment"("requestKey");
CREATE UNIQUE INDEX "ClinicAppointment_id_hospitalId_key" ON "ClinicAppointment"("id", "hospitalId");
CREATE INDEX "ClinicAppointment_hospitalId_status_requestedStartAt_idx" ON "ClinicAppointment"("hospitalId", "status", "requestedStartAt");
CREATE INDEX "ClinicAppointment_hospitalId_expiresAt_idx" ON "ClinicAppointment"("hospitalId", "expiresAt");
ALTER TABLE "ClinicAppointment" ADD CONSTRAINT "ClinicAppointment_encounterId_hospitalId_fkey" FOREIGN KEY ("encounterId", "hospitalId") REFERENCES "Encounter"("id", "hospitalId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClinicAppointment" ADD CONSTRAINT "ClinicAppointment_confirmedByUserId_fkey" FOREIGN KEY ("confirmedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClinicAppointment" ADD CONSTRAINT "ClinicAppointment_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ClinicAppointmentAction" (
  "id" SERIAL NOT NULL,
  "appointmentId" INTEGER NOT NULL,
  "hospitalId" INTEGER NOT NULL,
  "commandKey" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "requestedStartAt" TIMESTAMP(3),
  "actorPatientId" INTEGER,
  "actorUserId" INTEGER,
  "revision" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClinicAppointmentAction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ClinicAppointmentAction_commandKey_key" ON "ClinicAppointmentAction"("commandKey");
CREATE INDEX "ClinicAppointmentAction_hospitalId_appointmentId_createdAt_idx" ON "ClinicAppointmentAction"("hospitalId", "appointmentId", "createdAt");
ALTER TABLE "ClinicAppointmentAction" ADD CONSTRAINT "ClinicAppointmentAction_appointmentId_hospitalId_fkey" FOREIGN KEY ("appointmentId", "hospitalId") REFERENCES "ClinicAppointment"("id", "hospitalId") ON DELETE CASCADE ON UPDATE CASCADE;
