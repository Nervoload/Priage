-- AlterTable
ALTER TABLE "PatientProfile" ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "TriageAssessment" ADD COLUMN     "chiefComplaint" TEXT,
ADD COLUMN     "painLevel" INTEGER,
ADD COLUMN     "vitalSigns" JSONB;
