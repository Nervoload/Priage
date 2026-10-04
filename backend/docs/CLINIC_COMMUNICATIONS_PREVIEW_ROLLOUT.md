# Clinic appointment communications and verified recovery

Implemented for the gated clinic preview inside the Azure NestJS monolith. Apply migration `20260930100000_clinic_notifications` and regenerate Prisma. Application records and workers stay in the existing PostgreSQL/Redis deployment. This document does not constitute Azure staging or clinic launch approval.

## Scheduling and delivery

- Tenant Admin Settings enables emails, sets clinic Reply-To and optional phone, and selects zero, one or two distinct reminder offsets (1–10,080 minutes). Defaults are 1,440 and 120 minutes. Workflow-profile and public-entry gates are unchanged.
- Reception confirmation and its confirmation/reminder outbox rows commit in the **same transaction**. Initial requests send no scheduling email. Reminders whose due times have passed at confirmation are omitted.
- Rescheduling returns the booking to `REQUESTED`; a previously confirmed booking gets a change-pending notice. Reception must confirm the new time. Previously confirmed cancellation, decline and expired reschedule requests get cancellation notices. Arrival, No-show and completion invalidate unsent reminders. Accepted emails remain in history.
- Each outbox record has tenant/appointment/contact versions, purpose, due/expiry times, template version, stable deduplication key, claims, attempts and receipts. The exact payload freezes on first attempt; retries reuse it and `clinic-email/<outbox UUID>`. Known failures may be retried while still current. Unknown outcomes require review after bounded retries; nothing is automatically retried beyond 23 hours from first attempt, leaving margin before [Resend's 24-hour idempotency expiry](https://resend.com/docs/dashboard/emails/idempotency-keys).
- BullMQ `notifications` wakes a database sweep every 15 seconds. PostgreSQL determines eligible work; stale processing claims can be recovered after two minutes. Retrying a worker or restarting it does not rely on an in-memory schedule. Monitor the repeat job, oldest due row, expired claims, `NEEDS_REVIEW`, failures, suppression counts and Redis connectivity.
- Switching delivery adapter with unresolved frozen work sends that work to review, so a deployment mode change cannot hide an ambiguous provider outcome.
- Before provider handoff, the worker rechecks clinic delivery, appointment revision/status, contact version/email and suppression. Reminders expire 30 minutes after their due time or at appointment start, whichever is first. Scheduling messages use a 24-hour expiry. Once a provider has accepted an email, it cannot be recalled; the linked scheduling page always displays current state.
- `POST /notifications/resend/webhook` verifies Svix signatures against exact raw bytes. Minimal webhook receipts are deduplicated; delivery events are ordered, and bounce/complaint failures cannot be replaced by a delayed delivery callback. Bounces/complaints suppress subsequent tenant sends to that address until a clinic admin resolves the cause. Missed receipts are reconciled against Resend for accepted messages.
- `ACCEPTED` means provider submission, **not delivered or read**. `DELIVERED` is a delivery receipt, **not read**. Local capture is labelled “Captured (not sent).” Reception's scheduling status remains independent of email status.

## Minimal, versioned email content

Application template `clinic-email-v1` has plain-text and HTML variants. It contains clinic name, requested/confirmed appointment time in the clinic IANA timezone, contact details and a clickable management link. It contains no patient name, complaint, transcript, assessment, notes, OHIP/health identifiers or account token. Recovery emails add a short-lived verification code. Clinic display names use the verified Priage sending address. Arbitrary templates and post-visit follow-ups remain separate slices.

Resend states that its data is stored in the United States. Recipient addresses, clinic association, scheduling times, temporary access codes, message content and delivery events therefore leave the Canadian Azure deployment. This is an explicit external data flow, even with minimal content; record it in the clinic processing inventory and agreement. Obtain clinic approval of the templates and external processing before real delivery. See [Resend security and storage](https://resend.com/security).

## Separate verified appointment access

- Email links use `/{alias}/appointment#ref=<opaque booking reference>`. A reference grants no access. Old aliases resolve through the existing alias history. No email address or health detail is placed in the URL.
- Public alias-bound request and verification routes are `POST /clinic-intake/entry/:alias/recovery/{request,verify}`. A matching **visit email**, not account email, receives a code. Requests return a generic response for nonexistent, mismatched, disabled and rate-limited cases.
- Six-digit codes expire in ten minutes, permit five attempts, are one-use, and are replaced by a new challenge. Requests have a 60-second reference/email cooldown, five requests per email per hour, ten per IP per 15 minutes and route throttling. Keyed code hashes are persisted; temporary code/payload material is AES-GCM encrypted, then removed on use, replacement, correction or expiry.
- A separate namespaced HttpOnly appointment-recovery cookie expires in 24 hours. Scheduling changes require verification within ten minutes, checked again under the appointment lock. Contact corrections increment contact version and revoke old challenges and recovery sessions. Patient login and guest assessment sessions remain independent.
- Guarded routes are `/clinic-intake/recovery/{state,availability,reschedule,cancel,logout}`. Responses expose only appointment scheduling, clinic contact and permitted actions. They do not authorize account, clinical, assessment, assets or messaging APIs. Changes call the same appointment service with expected revision, command UUID and conflict state. Recovery actions are marked in encounter audit events.
- The patient page refreshes on focus/reconnect and polls every 15 seconds. Commands apply returned state; revision and timestamp comparisons prevent older responses from overwriting newer scheduling data. Rescheduling reuses the existing appointment slot picker. Clinic contact remains available for help.

## Local capture rehearsal

`CLINIC_EMAIL_MODE=capture` is the nonproduction default; the launcher supplies the matching `PATIENT_APP_URL` for each instance. No Resend credentials or network send are needed. Enable appointment emails in clinic Admin Settings, save a mock Reply-To, and confirm a mock appointment in Reception. Open the captured inbox or Reception delivery history, then follow its management link in the patient app.

Local captured recovery codes remain **encrypted** in the outbox until use/expiry and are rendered only by the nonproduction capture inbox for the mock rehearsal. Provider delivery never exposes recovery codes through staff history. IT administrators can inspect test emails only; clinical supervisors review patient delivery and address suppression. Do not use capture mode with real patient records. Test messages are queued independently of appointment confirmation, but require saved Reply-To.

Run `npm run build`, `npm run test:unit`, and `npm run test:clinic-communications-smoke` with a loopback `DATABASE_URL`. The service-level smoke creates isolated mock records without usable staff credentials, exercises transaction rollback, duplicates, concurrent workers/actions, reminder thresholds, pending changes, recovery attempts/replay/expiry, and contact revocation. By default it removes its fixtures. `CLINIC_COMMUNICATIONS_KEEP_FIXTURES=true` retains mock records and writes browser fixture references to `/tmp/priage-communications-fixture.json`. The optional `npm run test:clinic-recovery-http-smoke` runs cookie/endpoint isolation and old-alias checks against the retained fixture and a matching loopback API. Also run both web apps' `npm run check` and the established ED/booking regressions. Never target real records with these scripts.

## Restricted Resend staging

Configure these **server-only** values through the deployment secret store:

| Variable | Requirement |
| --- | --- |
| `CLINIC_EMAIL_MODE` | `disabled`, `capture`, `test`, or `live`; production defaults to disabled. Use `test` in restricted staging. |
| `RESEND_API_KEY` | Key permitted to send and read the configured sender domain for readiness checks. |
| `RESEND_SENDER_DOMAIN_ID` | Verified Priage sending domain ID. The adapter checks domain name/verification and rejects enabled open or click tracking. |
| `RESEND_WEBHOOK_SECRET` | Signing secret for the configured HTTPS callback. |
| `CLINIC_EMAIL_FROM` | Bare verified address, e.g. `appointments@priage.ca`; clinic display name is generated by the template. |
| `PATIENT_APP_URL` | Matching HTTPS patient application origin in provider modes. |
| `NOTIFICATION_SECRET_ENCRYPTION_KEY` | 32 random bytes, hex or base64; required for provider modes/production. Persist consistently across replicas. |
| `CLINIC_EMAIL_RECIPIENT_ALLOWLIST` | Comma-separated exact mock recipient addresses; mandatory in test mode. Nonallowlisted sends fail locally before provider submission. |
| `CLINIC_EMAIL_EXTERNAL_PROCESSING_APPROVED` | Must be `true` for live mode after documented clinic approval. This flag does not replace approval evidence. |

Verify DNS sender ownership/SPF/DKIM and clinic-approved DMARC policy. Disable domain open/click tracking in Resend. Configure signed `email.delivered`, `email.failed`, `email.bounced`, `email.complained` and suppression callbacks to `https://<api>/notifications/resend/webhook`. Domain readiness is checked before sending and cached for at most one minute. Do not put these credentials in Vite environment variables.

Apply the migration before starting API/worker replicas; retain one shared encryption key and provider configuration. Key rotation must revoke existing recovery sessions/challenges and explicitly resolve or cancel queued encrypted payloads before changing the key. Retain delivery metadata under approved clinic retention policy, not an invented 90-day purge.

Rehearse provider timeout/restart, signed callback replay/out-of-order events, bounce/complaint suppression, quota failure, safe known-failure retry and ambiguous-send review. Check DST appointment display and remind schedules with clinic timezone. Review accepted versus delivered wording with staff. For `NEEDS_REVIEW`, inspect provider history using the stable idempotency key/receipt before any operator decision; the UI deliberately offers no blind retry.

## Remaining launch gates and next slice

Restricted Azure Canada staging evidence, clinic approval of email content/external processing, sender/callback setup, approved Terms/Privacy copy, identity backfill, MFA/access/audit/retention/backup controls and clinic UAT remain. Public clinic entry stays gated. The configurable clinic questionnaire is the next product slice; approved model-backed assessment remains a separate design and implementation task. Post-visit follow-ups, arbitrary template editing and richer operational review tooling remain later work.

## Recorded local verification (2026-09-30)

The notification migration was applied to the local mock clinic database. Backend lint/unit/build and both web-app checks passed. Service-level PostgreSQL rehearsal passed transaction rollback, no initial email, confirmation deduplication, concurrent workers/actions, stale-claim recovery, reminder-policy/confirmation races, reminder thresholds, pending reschedule notices, arrival/cancellation and recovery guessing/replay/expiry/contact revocation. HTTP rehearsal passed separate HttpOnly cookie, old alias resolution, pinned-tenant rejection, scheduling-only output, denied account/assessment/Care/staff endpoints and logout. The patient browser journey passed verification, rescheduling back to pending and cancellation. Real Resend delivery, Azure staging and staff browser verification remain rollout checks.
