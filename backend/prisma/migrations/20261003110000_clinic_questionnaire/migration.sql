-- Each clinic's own questions, asked after the safety question in every
-- assessment. Published versions are immutable.

-- CreateTable
CREATE TABLE "ClinicQuestionnaireVersion" (
    "id" SERIAL NOT NULL,
    "hospitalId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "questions" JSONB NOT NULL,
    "publishedByUserId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClinicQuestionnaireVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClinicQuestionnaireVersion_hospitalId_version_key" ON "ClinicQuestionnaireVersion"("hospitalId", "version");

-- AddForeignKey
ALTER TABLE "ClinicQuestionnaireVersion" ADD CONSTRAINT "ClinicQuestionnaireVersion_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
