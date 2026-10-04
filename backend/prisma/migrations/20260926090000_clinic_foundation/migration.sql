CREATE TYPE "LegalDocumentKind" AS ENUM ('TERMS', 'PRIVACY');

ALTER TABLE "PatientProfile" ADD COLUMN "accountEnabled" BOOLEAN NOT NULL DEFAULT true;
UPDATE "PatientProfile"
SET "accountEnabled" = false
WHERE "email" LIKE '%@intake.local' OR "email" LIKE '%@deleted.local';

CREATE TABLE "EncounterContact" (
  "id" SERIAL NOT NULL,
  "encounterId" INTEGER NOT NULL,
  "hospitalId" INTEGER NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "source" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EncounterContact_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EncounterContact_encounterId_key" ON "EncounterContact"("encounterId");
CREATE UNIQUE INDEX "EncounterContact_encounterId_hospitalId_key" ON "EncounterContact"("encounterId", "hospitalId");
CREATE INDEX "EncounterContact_hospitalId_createdAt_idx" ON "EncounterContact"("hospitalId", "createdAt");
ALTER TABLE "EncounterContact" ADD CONSTRAINT "EncounterContact_encounterId_hospitalId_fkey"
  FOREIGN KEY ("encounterId", "hospitalId") REFERENCES "Encounter"("id", "hospitalId") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "LegalDocumentVersion" (
  "id" SERIAL NOT NULL,
  "kind" "LegalDocumentKind" NOT NULL,
  "version" TEXT NOT NULL,
  "bodyMarkdown" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMP(3),
  CONSTRAINT "LegalDocumentVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LegalDocumentVersion_published_body_check" CHECK ("publishedAt" IS NULL OR length(trim("bodyMarkdown")) > 0)
);
CREATE UNIQUE INDEX "LegalDocumentVersion_kind_version_key" ON "LegalDocumentVersion"("kind", "version");
CREATE INDEX "LegalDocumentVersion_kind_publishedAt_idx" ON "LegalDocumentVersion"("kind", "publishedAt");

CREATE TABLE "VisitAcceptance" (
  "id" SERIAL NOT NULL,
  "intakeSessionId" INTEGER NOT NULL,
  "patientId" INTEGER NOT NULL,
  "encounterId" INTEGER,
  "termsDocumentId" INTEGER NOT NULL,
  "privacyDocumentId" INTEGER NOT NULL,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VisitAcceptance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VisitAcceptance_intakeSessionId_key" ON "VisitAcceptance"("intakeSessionId");
CREATE UNIQUE INDEX "VisitAcceptance_encounterId_key" ON "VisitAcceptance"("encounterId");
CREATE INDEX "VisitAcceptance_patientId_acceptedAt_idx" ON "VisitAcceptance"("patientId", "acceptedAt");
ALTER TABLE "VisitAcceptance" ADD CONSTRAINT "VisitAcceptance_intakeSessionId_fkey"
  FOREIGN KEY ("intakeSessionId") REFERENCES "IntakeSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VisitAcceptance" ADD CONSTRAINT "VisitAcceptance_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VisitAcceptance" ADD CONSTRAINT "VisitAcceptance_encounterId_fkey"
  FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VisitAcceptance" ADD CONSTRAINT "VisitAcceptance_termsDocumentId_fkey"
  FOREIGN KEY ("termsDocumentId") REFERENCES "LegalDocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VisitAcceptance" ADD CONSTRAINT "VisitAcceptance_privacyDocumentId_fkey"
  FOREIGN KEY ("privacyDocumentId") REFERENCES "LegalDocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION prevent_published_legal_document_change() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' OR OLD."publishedAt" IS NOT NULL THEN
    RAISE EXCEPTION 'Published legal document versions are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER legal_document_immutable
  BEFORE UPDATE OR DELETE ON "LegalDocumentVersion"
  FOR EACH ROW EXECUTE FUNCTION prevent_published_legal_document_change();

CREATE FUNCTION prevent_visit_acceptance_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Visit acceptances are immutable';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER visit_acceptance_immutable
  BEFORE UPDATE OR DELETE ON "VisitAcceptance"
  FOR EACH ROW EXECUTE FUNCTION prevent_visit_acceptance_change();
