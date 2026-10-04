# Clinic foundation rollout

This release changes patient login eligibility and staff-created visit contacts. It does **not** activate clinic appointment booking or publish Terms/Privacy copy. The workflow profile defaults to `ED`; do not set a production tenant to `CLINIC_APPOINTMENT` yet.

## Deployment order

1. Take a database backup and put patient sign-in and staff-created encounter writes in maintenance mode for the cutover window.
2. Apply `20260926090000_clinic_foundation` to PostgreSQL with the normal deployment migration process.
3. From the backend directory, run `npm run patients:backfill-staff-profiles` to inspect affected profile IDs. Output contains IDs, not patient contact details.
4. Run `npm run patients:backfill-staff-profiles -- --apply`. The script copies the original staff-entered email/phone to `EncounterContact`, revokes patient sessions, gives the profile a non-login placeholder email and random password, and sets `accountEnabled=false`. Re-running it is safe. Review every `manualReview` ID: it may have a changed password, a missing visit contact on a disabled profile, or an unexpected second staff-created encounter on one profile. The script intentionally leaves changed credentials alone.
5. Run the dry-run command again and verify `affected` is empty. Resolve or document `manualReview` records with the clinic privacy/security owner. Deploy the backend and both web builds from the same release, then reopen patient sign-in and staff-created encounters after smoke checks.

The new `LegalDocumentVersion` and `VisitAcceptance` tables have no published documents or active UI. A later clinic booking release must publish approved, non-empty Terms and Privacy versions, present both to the patient, and call `LegalDocumentsService.recordAcceptanceTx` inside the visit-submission transaction. The database prevents changes to published versions and recorded acceptances.

## Local verification

Run `npx prisma validate`, `npm run check` in `backend/`, and `npm run check` in each web app. Test a staff-created encounter: the visit contact email appears in encounter detail, while `/patient-auth/login` rejects that email as a patient account. Confirm existing registered accounts, guest upgrades, ED navigation, and encounter transitions still work.

Azure deployment controls and storage-provider work in the [clinic implementation blueprint](../../docs/CLINIC_PILOT_IMPLEMENTATION_BLUEPRINT.md) remain later work; this release adds no external service dependency.
