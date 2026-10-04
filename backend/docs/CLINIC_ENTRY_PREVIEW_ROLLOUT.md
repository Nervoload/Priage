# Tenant-aware clinic entry: restricted preview rollout

This slice runs in the existing NestJS monolith and shared PostgreSQL database. It is for mock-data rehearsal on loopback or network-restricted Azure Canada staging. Public clinic patient entry remains disabled until the clinic launch gates in `docs/CLINIC_PILOT_PLAN.md` are met.

## Deployment modes

- **Pinned clinic deployment:** set `PILOT_CLINIC_ID` to one clinic tenant, `CLINIC_PREVIEW_ENABLED=true`, and `TRIAGE_INTERVIEW_MODE=deterministic`. Startup rejects a missing tenant or a workflow profile other than `CLINIC_APPOINTMENT`. The patient directory returns only that clinic and legacy ED intake entry points are blocked. Build the patient and staff apps with `VITE_CLINIC_PILOT_MODE=true`; set the staff app's `VITE_PATIENT_APP_URL` to the patient app's Priage-owned origin.
- **Internal general preview:** omit `PILOT_CLINIC_ID`, set `CLINIC_PREVIEW_TENANT_IDS` to an explicit comma-separated list of clinic IDs, and set `CLINIC_PREVIEW_ENABLED=true`. The general directory includes only listed clinics in that allowlist plus the normal ED entries. Unlisted allowlisted clinics still resolve by direct link. Build the patient app without clinic pilot mode. Never use a frontend flag or a request-supplied clinic ID as the access boundary.
- **Normal ED deployment:** leave clinic preview disabled. Clinic links and clinic booking remain unavailable; ED intake and screens keep their existing path.

For Azure staging, keep the API and both web apps on approved Canadian infrastructure and restrict access at the network/identity layer. Configure the patient app and API with consistent hostnames under Priage-owned domains so browser cookies are sent on visit requests. Configure allowed CORS/CSRF origins for each web origin. Serve the patient SPA's `index.html` fallback for `/{alias}/start`, `/{alias}/walk-in`, and `/clinic/{alias}/visits/{id}`; the API remains the source of truth for alias resolution and tenant membership. A website button may link to `/{alias}/start`. Reception displays a locally rendered QR image and a copyable link for `/{alias}/walk-in#token=…`. The one-use token stays in the fragment so it is not sent in an HTTP URL request.

## Migration and admin configuration

Apply `20260928100000_clinic_entry` with the normal Prisma migration deployment process before deploying the new API. The migration creates `ClinicEntrySettings`, alias history, and draft visit email storage. Existing clinic tenants are backfilled as unlisted with walk-ins enabled to preserve the prior preview behavior. New clinic settings start unlisted and appointment-only. Verify the pilot tenant's actual settings after migration; clinic admins can edit listing, walk-in policy and canonical alias in General Settings. Workflow profile changes remain operator-only. Changing an alias keeps old aliases resolving to the new path.

Before enabling a direct link, configure the clinic schedule and publish approved Terms and Privacy versions. The server's booking-readiness value blocks patient start when these are missing. For internal mock rehearsals, use clearly marked local test documents only. Patient-initiated ED and clinic intake require a separate visit contact email; Reception walk-ins may omit it.

## Local and staging checks

On a **mock** pinned clinic API, run `npm run test:clinic-intake-smoke` and `npm run test:clinic-booking-smoke` from `backend` with the local `DATABASE_URL` and `PILOT_CLINIC_ID`. On a separate general-preview API backed by mock data, run `npm run test:clinic-entry-smoke` with `DATABASE_URL` and `CLINIC_PREVIEW_TENANT_IDS`. These scripts refuse non-loopback API hosts. Run `npm run check` in `backend`, and lint, test and build in both web apps. Run the existing full ED smoke against a non-pinned API to check arrival, triage, Waiting Room, messaging and discharge.

Browser rehearsal should cover both pinned and general builds: a direct alias start, old-alias redirect, first immediate-danger question, completion to booking, contact correction, Reception queue and settings, multiple schedule windows, and a walk-in desk link. Use the same hostname family for patient and API during local checks; mixing `127.0.0.1` with `localhost` prevents their host-only session cookie from being sent. Verify request/revision conflicts and automatic patient status updates after Reception actions. Do not enter real patient data or treat mock legal documents as approved copy.

Record Azure staging evidence for migration, access restrictions, backup restore, static route fallback, TLS/cookie/CORS configuration, tenant isolation, event and polling recovery, and smoke/browser results. No public entry is activated by applying this migration alone.
