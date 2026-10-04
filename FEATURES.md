# Priage feature inventory

Reviewed against the code on 2026-09-26. This lists implemented capabilities and points to the [clinic pilot plan](docs/CLINIC_PILOT_PLAN.md) for proposed work. The former content in this file described old client-only wiring and an unsafe browser-side API key proposal; it is retained in Git history, not as implementation guidance.

| Area | Current implementation | Key files |
| --- | --- | --- |
| Patient intake | Guest and account visit starts, AI interview, hospital routing, encounter confirmation, status and message views | `Apps/PatientApp/src/app/PatientApp.tsx`, `Apps/PatientApp/src/features/pre-triage/`, `backend/src/modules/intake/` |
| Assessment | Interview questions/answers and AI summary are persisted as context/projections and displayed in patient encounter and staff intake/Care precursor views | `backend/src/modules/intake/interview/`, `backend/src/modules/encounters/encounters.service.ts`, `Apps/HospitalApp/src/features/triage/TriageWorkspace.tsx` |
| Encounter operations | Server-backed Expected, Admitted, Triage, Waiting, and terminal transitions; clinic staff list/detail; walk-in creation | `backend/src/modules/encounters/`, `Apps/HospitalApp/src/app/HospitalApp.tsx`, `Apps/HospitalApp/src/features/admit/` |
| Messaging and alerts | Encounter-linked messages, realtime updates, waiting-room alerts, and staff acknowledgement paths | `backend/src/modules/messaging/`, `backend/src/modules/realtime/`, `backend/src/modules/alerts/`, `Apps/HospitalApp/src/features/waitingroom/` |
| Tenant settings | Clinic-scoped role page access, custom intake questions, feedback survey, clinic details, and a read-only workflow profile defaulting to ED | `backend/src/modules/hospitals/`, `Apps/HospitalApp/src/features/settings/SettingsPage.tsx` |
| Identity and audit | Guest sessions, patient email/password accounts, staff sessions, optional TOTP MFA, device binding, and sensitive-read audit mechanisms | `backend/src/modules/patient-auth/`, `backend/src/modules/auth/`, `backend/src/modules/audit/` |

**Not implemented for the clinic pilot:** appointment availability/booking/confirmation, email confirmations and reminders, pilot-only clinic routing, the physician-oriented Care workspace with persisted notes and anchored comments, final-step terms acceptance UI, and patient social sign-in. Legal document and acceptance storage is present but no copy is published. Existing custom questions are asked after encounter creation and do not meet the requested questionnaire design. **Deployment gate:** existing staff-created profiles must be backfilled before clinic use; see [the foundation rollout](backend/docs/CLINIC_FOUNDATION_ROLLOUT.md). See [priorities and acceptance tests](docs/CLINIC_PILOT_PLAN.md#priorities-and-sequence).

The ED waiting-room queue design in [Algorithm.md](Algorithm.md) is outside the proposed clinic pilot path.
