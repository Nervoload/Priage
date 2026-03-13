# Priage — Feature Documentation

## Alert Dashboard (Waiting Room)

### Overview

The **Alert Dashboard** is a full-width panel that sits above the patient-list / chat layout in the Waiting Room view (`WaitingRoomView.tsx`). It gives staff an at-a-glance view of:

| Signal | Source | Colour |
|--------|--------|--------|
| Patient wait time (< 15 min) | Derived from encounter timestamps | 🟢 Green |
| Patient wait time (15–45 min) | Derived from encounter timestamps | 🟡 Amber |
| Patient wait time (> 45 min) | Derived from encounter timestamps | 🔴 Red / pulsing |
| New patient message | Local `chatMessages` state | 🔵 Blue badge |

The dashboard is **always visible** — when there are no alerts it shows an "All clear" state. It is collapsible, dismissible per-row, and auto-refreshes wait times every 30 seconds.

> The existing `AlertsBanner` (floating badge, top-right) is **not** affected and continues to work independently.

### Key Files

| File | Role |
|------|------|
| `src/features/waitingroom/AlertDashboard.tsx` | Dashboard component |
| `src/features/waitingroom/WaitingRoomView.tsx` | Renders `<AlertDashboard>` above the two-panel layout |
| `src/shared/api/useAlerts.ts` | Existing alert hook (server + derived alerts) |
| `src/shared/api/alertDerivation.ts` | Client-side alert derivation rules |
| `src/shared/api/alerts.ts` | REST client for alert CRUD |
| `src/shared/api/messaging.ts` | REST client for messaging API |
| `src/shared/realtime/socket.ts` | Socket.IO singleton |

---

### How to Connect the Alert Dashboard to the Backend

The dashboard currently works entirely client-side. All backend integration points are marked with `TODO (Phase 6.3)` comments inside `AlertDashboard.tsx`. Follow the steps below to wire it up.

#### Step 1 — Real-Time Message Alerts

Subscribe to Socket.IO `message.created` events so the dashboard updates instantly when a patient sends a message.

```tsx
// Inside AlertDashboard component body:
import { getSocket } from '../../shared/realtime/socket';
import { RealtimeEvents } from '../../shared/types/domain';

useEffect(() => {
  const socket = getSocket();
  const handleNewMessage = (payload: { encounterId: number; senderType: string }) => {
    if (payload.senderType === 'PATIENT') {
      // Force re-render → the "💬 new" badge will appear
      forceUpdate(n => n + 1);
    }
  };
  socket.on(RealtimeEvents.MessageCreated, handleNewMessage);
  return () => { socket.off(RealtimeEvents.MessageCreated, handleNewMessage); };
}, []);
```

#### Step 2 — Fetch Message History (Unread Counts)

On mount, fetch historical messages so the baseline unread count is accurate.

```tsx
import { listMessages } from '../../shared/api/messaging';

useEffect(() => {
  // For each encounter, fetch messages and set baseline count:
  for (const enc of encounters) {
    listMessages(enc.id).then(msgs => {
      const patientCount = msgs.filter(m => m.senderType === 'PATIENT').length;
      seenPatientMsgCounts.current[enc.id] = patientCount;
    });
  }
}, [encounters]);
```

> **Tip:** For better UX, store a `lastReadAt` timestamp per encounter on the backend and only count messages after that timestamp as "unread."

#### Step 3 — Merge Server-Side Alerts

Pass the unified alert list from `useAlerts()` into the dashboard and render them alongside the derived wait-time rows.

1. Add a `serverAlerts` prop to `AlertDashboardProps`:
   ```tsx
   serverAlerts?: UnifiedAlert[];
   ```
2. In `HospitalApp.tsx`, pass the alerts from `useAlerts`:
   ```tsx
   <WaitingRoomView
     ...
     serverAlerts={alerts}   // ← from useAlerts()
   />
   ```
3. Forward to `<AlertDashboard>` and merge into the `items` array.

#### Step 4 — Acknowledge / Resolve via API

Replace the local `dismissed` Set with real API calls:

```tsx
import { acknowledgeAlert, resolveAlert } from '../../shared/api/alerts';

const dismiss = useCallback(async (alert: UnifiedAlert) => {
  if (alert.source === 'server' && alert.serverAlertId) {
    await acknowledgeAlert(alert.serverAlertId);
  }
  // Optimistically hide the row
  setDismissed(prev => new Set(prev).add(alert.encounterId));
}, []);
```

---

### Configuration

Wait-time thresholds are currently hard-coded in `AlertDashboard.tsx`:

| Threshold | Minutes | Severity |
|-----------|---------|----------|
| Normal | < 15 | `ok` (green) |
| Warning | 15–44 | `warn` (amber) |
| Critical | ≥ 45 | `critical` (red) |

To make these configurable, move them to a shared config file or fetch from a hospital-settings endpoint on the backend.

---

## Patient Search (Waiting Room)

### Overview

The patient list in the left panel of the Waiting Room includes a **search bar** that filters patients in real time. Staff can search by:

| Field | Example |
|-------|---------|
| Patient name (first or last) | `John`, `Doe` |
| Encounter ID | `42` |
| Chief complaint | `chest pain` |

The search is **case-insensitive** and matches partial strings. A clear button (`✕`) resets the search. When no patients match, a "No patients match" message is shown.

### Key File

| File | Role |
|------|------|
| `src/features/waitingroom/WaitingRoomView.tsx` | Contains the `searchQuery` state, `filteredEncounters` logic, and the search input UI |

### Current Behaviour (Client-Side)

All filtering happens in the browser against the already-fetched `encounters` array:

```tsx
const filteredEncounters = encounters.filter(enc => {
  if (!searchQuery.trim()) return true;
  const q = searchQuery.toLowerCase();
  const name = patientName(enc.patient).toLowerCase();
  const id = String(enc.id);
  const complaint = (enc.chiefComplaint ?? '').toLowerCase();
  return name.includes(q) || id.includes(q) || complaint.includes(q);
});
```

This is marked with a `TODO (Phase 6.3)` comment.

---

### How to Connect Patient Search to the Backend

#### Step 1 — Add a search query param to the backend

In the NestJS encounters controller, accept an optional `search` query parameter on `GET /encounters`:

```ts
@Get()
findAll(
  @Query('status') status?: string,
  @Query('search') search?: string,  // ← NEW
) { ... }
```

In the service, add a Prisma `where` clause:

```ts
where: {
  ...statusFilter,
  ...(search && {
    OR: [
      { patient: { firstName: { contains: search, mode: 'insensitive' } } },
      { patient: { lastName:  { contains: search, mode: 'insensitive' } } },
      { chiefComplaint:       { contains: search, mode: 'insensitive' } },
    ],
  }),
}
```

#### Step 2 — Update the frontend API client

In `src/shared/api/encounters.ts`, add a `search` param to `listEncounters`:

```tsx
export async function listEncounters(params?: {
  status?: EncounterStatus[];
  search?: string;  // ← NEW
}) { ... }
```

#### Step 3 — Wire the search bar to the API

In `WaitingRoomView.tsx`, replace the local `filteredEncounters` filter with a debounced API call:

```tsx
// Debounce search query (300ms)
const debouncedQuery = useDebounce(searchQuery, 300);

useEffect(() => {
  listEncounters({ status: ACTIVE_STATUSES, search: debouncedQuery })
    .then(res => setEncounters(res.data));
}, [debouncedQuery]);
```

> **Tip:** Keep the client-side filter as a fallback for instant feedback while the API request is in flight.

---

## Triage Dropdown (Waiting Room Patient List)

### Overview

Each patient in the Waiting Room left-panel list has a **▼ toggle** next to their name. Clicking it expands a dropdown showing:

| Field | Source |
|-------|--------|
| **CTAS Level** (colour-coded 1–5 badge) | `TriageAssessment.ctasLevel` |
| **Pain Level** (X/10) | `TriageAssessment.painLevel` |
| **Priority Score** | `TriageAssessment.priorityScore` |
| **Chief Complaint** | `TriageAssessment.chiefComplaint` |
| **Vital Signs** (BP, HR, Temp, RR, SpO₂) | `TriageAssessment.vitalSigns` |
| **Clinical Note** | `TriageAssessment.note` |
| **Assessment timestamp** | `TriageAssessment.createdAt` |

A **"View Triage"** button is shown below the summary. It currently logs to console as a placeholder.

When no triage assessment exists, the dropdown shows *"No triage assessment on file yet."*

### Key Files

| File | Role |
|------|------|
| `src/features/waitingroom/WaitingRoomView.tsx` | Dropdown UI, `expandedTriageId` state, `triageData` placeholder |
| `src/shared/api/triage.ts` | Ready-to-use API client (`listTriageAssessments`, `getTriageAssessment`) |
| `src/shared/types/domain.ts` | `TriageAssessment`, `VitalSigns`, `Encounter.triageAssessments` types |
| `src/features/admit/TriagePopup.tsx` | Existing triage popup (can be reused for "View Triage" action) |

---

### How to Connect the Triage Dropdown to the Backend

All backend integration points are marked with `TODO (Phase 6.3)` comments in `WaitingRoomView.tsx`.

#### Step 1 — Fetch Triage Assessments on Expand

When the user expands a patient's dropdown, fetch the real assessments:

```tsx
import { listTriageAssessments } from '../../shared/api/triage';

// Replace the current triageData useState with a live fetch:
const [triageData, setTriageData] = useState<Record<number, TriageAssessment[]>>({});

// When expandedTriageId changes, fetch if not cached:
useEffect(() => {
  if (expandedTriageId == null) return;
  if (triageData[expandedTriageId]) return; // already cached
  listTriageAssessments(expandedTriageId).then(assessments => {
    setTriageData(prev => ({ ...prev, [expandedTriageId]: assessments }));
  });
}, [expandedTriageId]);
```

#### Step 2 — Include Triage Assessments in the Encounter Payload

Alternatively, include triage assessments when fetching encounters so data is available immediately:

**Backend** — In `EncountersService.findAll()`, add an `include`:
```ts
include: {
  patient: true,
  triageAssessments: { orderBy: { createdAt: 'desc' }, take: 1 },
}
```

**Frontend** — The `Encounter` type already has an optional `triageAssessments?: TriageAssessment[]` field, so no type changes are needed. The dropdown already checks `encounter.triageAssessments` as a fallback.

#### Step 3 — Wire the "View Triage" Button

Replace the `console.log` placeholder with one of these approaches:

**Option A — Navigate to Triage view:**
```tsx
onClick={() => {
  // Store the encounter ID somewhere accessible (context, URL param, etc.)
  onNavigate?.('triage');
}
```

**Option B — Open the existing TriagePopup:**
```tsx
import { TriagePopup } from '../admit/TriagePopup';

const [triagePopupEncounter, setTriagePopupEncounter] = useState<Encounter | null>(null);

// In the button onClick:
onClick={() => setTriagePopupEncounter(encounter);

// Render the popup:
{triagePopupEncounter && (
  <TriagePopup
    encounter={triagePopupEncounter}
    onClose={() => setTriagePopupEncounter(null)}
  />
)}
```

#### Step 4 — Getting Triage Data Across the Full Pipeline

The patient goes through multiple stages. Here's how to retrieve triage data at each:

| Pipeline Stage | API Endpoint | What's Available |
|----------------|-------------|-----------------|
| **EXPECTED** | `GET /encounters/:id` | `chiefComplaint`, `patient` info only |
| **ADMITTED** | `GET /encounters/:id` | Same as above + `arrivedAt` timestamp |
| **TRIAGE** | `GET /triage/encounters/:id/assessments` | All `TriageAssessment` records (CTAS, vitals, notes) |
| **WAITING** | `GET /triage/encounters/:id/assessments` | Same as TRIAGE — assessments persist |
| **COMPLETE** | `GET /triage/encounters/:id/assessments` | Full history of all assessments made |

The API functions in `src/shared/api/triage.ts` are already implemented:

```ts
listTriageAssessments(encounterId)  // GET /triage/encounters/:id/assessments
getTriageAssessment(assessmentId)   // GET /triage/assessments/:id
createTriageAssessment(payload)     // POST /triage/assessments
```

To get a **complete picture** of a patient at any stage, combine:

```ts
const encounter = await getEncounter(encounterId);      // patient info + timestamps
const assessments = await listTriageAssessments(encounterId); // triage history
const messages = await listMessages(encounterId);       // chat history
```


New Ai Feature Page

Add Chatbot Page Between Quick Check-In and Hospital Selection
After the "Fast emergency intake" form in the patient app, insert a new ChatGPT chatbot page. The current "Choose hospital" button becomes "Next" and navigates to the chatbot. The chatbot page includes a "Choose hospital" button below the chat area that continues to the existing hospital routing page.

Proposed Changes
Patient App — Intake Form
[MODIFY] 
Login.tsx
Change button text from 'Choose hospital' to 'Next'
Change navigation target from /guest/routing to /guest/chatbot
Update the footer hint text to mention the chatbot step
Patient App — New Chatbot Page
[NEW] 
GuestChatbotPage.tsx
A new page with:

Header — "AI Health Assistant" badge + title + subtitle
Chat area — scrollable message list with user/assistant bubbles
Input bar — text input + send button, calls OpenAI Chat Completions API (gpt-4o-mini) directly from the browser using the provided API key
"Choose hospital" primary button below the chat — navigates to /guest/routing
← Back button — goes back to /guest/start
Styled with the same patientTheme + heroBackdrop tokens as the rest of the guest flow

CAUTION

The OpenAI API key will be embedded client-side. This is fine for a demo/dev build but should be moved to a backend proxy before any production deployment.

Patient App — Routing
[MODIFY] 
PatientApp.tsx
Import GuestChatbotPage
Add a new <Route path="/guest/chatbot" …> between the /guest/start and /guest/routing routes
Create a GuestChatbotRoute wrapper (similar to 
GuestRoutingRoute
) that passes navigation callbacks
Verification Plan
Manual Verification (browser)
Open the patient app in the browser (the dev server should be running)
Navigate to /welcome → tap Quick Check-In
Fill in the form fields (first name, phone, chief complaint)
Confirm the button says "Next" (not "Choose hospital")
Tap Next — should navigate to the chatbot page
Send a message in the chatbot — should get an AI response
Tap Choose hospital — should navigate to the hospital selection page
Tap ← Back on the chatbot page — should return to the intake form




Remove Feature

Add "Remove" Feature to Waiting Room Patient Modal
Add a Remove tab next to "Patient Profile" in the patient detail modal. Clicking it opens a dedicated confirmation page for that patient. The page has a "Remove Patient" button that, when clicked, shows an "Are you sure?" confirmation. On second click, the patient is removed from the waiting room using the existing 
dischargeEncounter
 API.

Proposed Changes
Waiting Room Feature
[MODIFY] 
PatientDetailModal.tsx
Add 'remove' to the 
Tab
 type union: type Tab = 'messages' | 'profile' | 'remove'
Add a new Remove tab button next to the "Patient Profile" tab
Add an onRemovePatient prop callback
Add a new RemovePatientPanel sub-component that renders when the "remove" tab is active:
Shows patient name and info
Has a "Remove Patient" button (red/destructive styling)
First click changes the button to "Are you sure? Click to confirm"
Second click calls onRemovePatient(encounter.id) and closes the modal
[MODIFY] 
WaitingRoomView.tsx
Add onRemovePatient prop to 
WaitingRoomViewProps
Pass onRemovePatient through to 
PatientDetailModal
[MODIFY] 
HospitalApp.tsx
Import 
dischargeEncounter
 (already exported from 
encounters.ts
)
Add a handleRemovePatient handler that calls 
dischargeEncounter(id)
, then refreshes encounters via fetchEncounters()
Pass handleRemovePatient as onRemovePatient to 
WaitingRoomView
NOTE

The existing 
dischargeEncounter
 API endpoint will be used for removal. This transitions the encounter status to DEPARTED/COMPLETE, which will naturally filter it out of the waiting room list.

Verification Plan
Manual Verification
Run npm run dev in the HospitalApp directory
Navigate to the Waiting Room and click on a patient card
Verify the Remove tab appears next to "Patient Profile"
Click the Remove tab and verify the remove confirmation page renders
Click the "Remove Patient" button — it should change to "Are you sure? Click to confirm"
Click the confirmation button — patient should be removed and the modal should close