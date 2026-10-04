# Staff web app: current feature reference

Reviewed against the code on 2026-09-26. The former reference described a local-state prototype and placeholder messaging. The app now fetches encounters and messages from the backend and subscribes to realtime events. See the [clinic pilot plan](../../docs/CLINIC_PILOT_PLAN.md) for the Reception and Care changes.

| Current screen | Behavior | Main files |
| --- | --- | --- |
| Admittance (`admit`) | Lists Expected and Admitted encounters, opens details, marks arrival, and creates a staff-entered encounter. It does not show appointment requests or booking times. The create form requires email, now stored with the visit; no patient login account is created. Existing shared-password profiles require backfill before clinic use. | `src/features/admit/AdmitView.tsx`, `src/features/admit/AdmitDetailPanel.tsx` |
| Triage (`triage`) | Lists Triage encounters and opens a workspace with the AI summary/Q&A, CTAS, vitals, and triage notes. Drafts are currently stored in browser `localStorage` until submitted. | `src/features/triage/TriageView.tsx`, `src/features/triage/TriageWorkspace.tsx` |
| Waiting Room (`waiting`) | Shows waiting encounters, patient details, messages, and alerts. It is still a visible navigation page unless role page access removes it. | `src/features/waitingroom/`, `src/shared/api/useAlerts.ts` |
| Settings | Admins manage role page access and custom intake questions; staff manage their own account settings. Clinic appointment rules and AI context are absent. | `src/features/settings/SettingsPage.tsx` |

`src/app/HospitalApp.tsx` loads tenant configuration and encounter lists, processes realtime updates, and supplies each view. `src/shared/ui/NavBar.tsx` still labels the first two tabs **Admittance** and **Triage**. The pilot will display **Reception** and **Care**, hide Waiting Room for that clinic, and provide a physician-oriented assessment and note workflow.

The current `confirm` encounter API marks **arrival** (`EXPECTED` → `ADMITTED`). Appointment confirmation needs its own API and must not reuse that action. Patient and staff messaging already use backend APIs; the older client-only integration snippets in Git history should not be followed.
