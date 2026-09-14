# HospitalApp feature map

The HospitalApp is a role-aware staff client. It does not hold a separate
clinical data model: encounters, messages, triage state, alerts, analytics,
and hospital configuration are retrieved from the backend and refreshed by
authorized realtime events.

## Main surfaces

| Surface | Backend contract | Access expectation |
| --- | --- | --- |
| Admittance | Encounter detail and workflow transitions | Hospital staff; clinical data is redacted where appropriate. |
| Triage | Triage assessment and status workflow | Nurse, doctor, or administrator; clinical-access policy applies. |
| Waiting room and messages | Encounter-scoped messaging, read state, alerts | Care-team assignment or break-glass for clinical threads. |
| Analytics and settings | Hospital-scoped aggregates and configuration | Role and hospital scope enforced by the API. |
| Demo runtime | Verified demo session and synthetic showcase profile | Never a substitute for staff authorization. |

## Client conventions

- API helpers live under `src/shared/api`; browser credentials stay in HttpOnly
  cookies.
- A `401` clears the staff session; a real `403` blocks protected content;
  transient failures preserve already-loaded operational views.
- Socket events trigger targeted refreshes and never grant data access on their
  own.
- The app must not recreate local mock encounter, chat, alert, or triage state
  for production workflows.

For safety and test commands, use the repository [backend testing guide](../../backend/docs/TESTING.md).
