# Gated clinic intake preview rollout

This slice is for an **internal, network-restricted Azure staging deployment** and local mock data. It does not activate public clinic booking. The deterministic interview is explicitly labelled a preview. The later [booking preview](CLINIC_BOOKING_PREVIEW_ROLLOUT.md) now implements slot requests and Terms acceptance, but approved/published copy, Canadian model deployment controls and other launch gates remain.

## Deployment boundary

1. Use a dedicated API deployment and patient/staff web builds against the existing shared, hospital-scoped PostgreSQL database. Restrict the Azure staging site at the network or identity edge to the internal pilot team. A frontend flag or demo cookie is not a substitute for that restriction.
2. Apply `20260926090000_clinic_foundation` and `20260926100000_clinic_intake_foundation` with the migration job. Run the earlier staff-profile backfill and resolve its manual-review report before any real clinic data.
3. Provision a distinct hospital record for the pilot. Run `npm run clinic:set-workflow-profile -- --hospital-id <id> --profile CLINIC_APPOINTMENT` to review, then repeat with `--apply`. The command refuses to switch a tenant with active encounters and preserves unrelated configuration fields. Staff settings cannot set this profile.
4. Set `PILOT_CLINIC_ID=<id>` on the dedicated API. Startup fails unless the ID exists and has the clinic profile. Leave `CLINIC_PREVIEW_ENABLED=false` in public deployments. Enable it only on restricted staging. A production-built restricted staging API also requires `PILOT_INTERNAL_STAGING=true`.
5. Build both web apps with `VITE_CLINIC_PILOT_MODE=true`; set `VITE_HOSPITAL_SLUG` in the staff build to the pinned clinic slug, and `VITE_PATIENT_APP_URL` to the full patient staging origin for one-use desk links. The staff login displays the pinned slug without a tenant selector; the API still validates the ID independently. Configure CORS origins and secure cookie domain/SameSite for the actual staging hostnames. Keep `TRIAGE_INTERVIEW_MODE=deterministic` for this preview.

The pilot API returns only the pinned clinic in patient metadata. It rejects unknown tenant fields on clinic start, refuses staff login or sessions for other tenants, and blocks legacy ED patient and partner intake plus direct ED encounter and triage writes. Clinic-profile tenants are omitted from ED patient directories and cannot be confirmed through legacy ED intake. Reception uses staff membership scope; patient visits use ownership checks; desk grants provide assessment-only access.

## Rehearsal

Against a **local** mock clinic API on loopback, set `PILOT_CLINIC_ID` and run `npm run test:clinic-intake-smoke`. It tests tenant pinning, guest/account creation and retry, required/correctable unverified contact email, complete assessment visibility, walk-ins without email, cross-tenant staff denial, staff answer attribution, desk-grant revoke/expiry/replay, and conflicting concurrent answers. It creates mock records. Run `npm run check` in the backend and both web apps for static and unit checks. Repeat the browser journey in Azure restricted staging with mock records before any real data.

`npm run jobs:remove-obsolete-triage-repeat` lists only the obsolete `triage-reassessment` repeat-job keys in the `alerts` queue. Add `-- --apply` to remove those exact keys if present. Do not clear the queue or other repeat jobs.

## Next boundary

The booking preview has added clinic availability, a mandatory slot request that moves `INTAKE` to `REQUESTED`, Reception confirmation to `EXPECTED`, and a Terms acceptance gate in the request transaction. A pre-visit without a slot request cannot enter New appointments. Walk-ins remain appointment-free. Routine Care handoff later requires assessment completion; an urgent clinician override must record actor and reason. This preview does not yet implement that Care transition.
