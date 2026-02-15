# HospitalApp — Feature Reference

> A living document that tracks every feature, where it lives, and how it works.
> Updated as new features are added.

---

<!-- New features will be appended below this line -->

## 1. Triage Popup (View Details)

**Files:**
- `src/features/admit/TriagePopup.tsx` — the popup modal component
- `src/features/admit/AdmitView.tsx` — wires the popup to the "View Details" button

**How it works:**
1. On the Admittance dashboard, each patient card has a **"View Details"** button.
2. Clicking it opens a centered modal (doesn't cover the full page) with a **placeholder triage form** containing:
   - Chief complaint banner
   - Pain level bar (1–10)
   - Vital signs grid (BP, heart rate, temp, O₂ sat)
   - Symptoms checklist
   - Notes section
3. An **"Admit"** button sits at the bottom (non-functional for now — reserved for future logic).
4. Close the popup by clicking the **✕** button or clicking the backdrop.

---

## 2. Admit → Triage Flow

**Files:**
- `src/app/HospitalApp.tsx` — holds shared encounter state, filters data for each view, contains `handleAdmit`
- `src/features/admit/AdmitView.tsx` — receives encounters + `onAdmit` as props
- `src/features/admit/TriagePopup.tsx` — fires `onAdmit` callback when Admit is clicked
- `src/features/triage/TriageView.tsx` — receives triage encounters as props

**How it works:**
1. All encounter data lives in `HospitalApp` state (single source of truth, no backend).
2. Admittance view shows patients with status `PRE_TRIAGE` or `ARRIVED`.
3. Triage view shows patients with status `TRIAGE`.
4. Clicking **"Admit"** in the triage popup changes the patient's status to `TRIAGE` → they disappear from admittance and appear in triage.
5. The shared `Encounter` type is exported from `HospitalApp.tsx` and imported everywhere.

---

## 3. Triage Page — Get Details Popup

**Files:**
- `src/features/triage/TriageView.tsx` — wires "Get Details" button to open the popup
- `src/features/admit/TriagePopup.tsx` — reused from admittance (same component)

**How it works:**
1. On the Triage page, each patient row has a **"Get Details"** button.
2. Clicking it opens the same **TriagePopup** modal used on the admittance page, showing that patient's triage data (placeholder for now).
3. Since the patient is already in triage, the **Admit** button still appears but no `onAdmit` is passed — so it does nothing. *(Will be replaced with backend logic later.)*
4. Close the popup via ✕ or clicking the backdrop.

---

## 4. Waiting Room — Private Chat

**Files:**
- `src/app/HospitalApp.tsx` — `ChatMessage` type, `chatMessages` state, `handleSendMessage`, `waitingEncounters` filter
- `src/features/waitingroom/WaitingRoomView.tsx` — two-panel layout (patient list + chat)
- `src/features/waitingroom/ChatPanel.tsx` — private chat UI for a single patient

**How it works:**
1. When a patient is admitted (status → `TRIAGE`), they appear in the Waiting Room sidebar.
2. Admin clicks a patient → the right panel shows their **private chat thread**.
3. Admin can type and send messages (stored in local React state).
4. Each patient has their own isolated chat — patients cannot see each other's messages.
5. A placeholder banner explains that patient messages will appear once the backend is connected.

---

## 🔌 Backend Integration Guide

> **When you're ready to connect the backend, follow these steps.**

### 1. Shared Types
- Move `Patient`, `Encounter`, `ChatMessage` from `HospitalApp.tsx` into a shared types file (e.g. `src/shared/types/domain.ts` or the existing `PatientApp/src/shared/types/domain.ts`).
- Both HospitalApp and PatientApp should import from that shared location.

### 2. WebSocket / Real-time Messaging

**HospitalApp side** (`src/app/HospitalApp.tsx`):
```ts
// Replace handleSendMessage with:
const handleSendMessage = async (encounterId: number, text: string) => {
  // 1. POST to backend
  await fetch('/api/encounters/{encounterId}/messages', {
    method: 'POST',
    body: JSON.stringify({ sender: 'admin', text }),
  });
  // 2. Or emit via WebSocket
  socket.emit('chat:message', { encounterId, sender: 'admin', text });
};

// Listen for incoming patient messages:
socket.on('chat:message', (msg: ChatMessage) => {
  setChatMessages(prev => ({
    ...prev,
    [msg.encounterId]: [...(prev[msg.encounterId] || []), msg],
  }));
});
```

**PatientApp side** (`PatientApp/src/shared/realtime/socket.ts`):
```ts
// Connect to the same WebSocket server
// Listen for admin messages on the patient's encounter channel
socket.on('chat:message', (msg: ChatMessage) => {
  // Only show messages for THIS patient's encounter
  if (msg.encounterId === myEncounterId) {
    addMessage(msg);
  }
});

// Send patient messages
socket.emit('chat:message', { encounterId: myEncounterId, sender: 'patient', text });
```

### 3. REST Endpoints (Backend)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/encounters/:id/messages` | Fetch message history for an encounter |
| `POST` | `/api/encounters/:id/messages` | Send a new message |
| `PATCH` | `/api/encounters/:id/messages/:msgId/read` | Mark a message as read |

### 4. Message Persistence
- Store messages in a `chat_messages` table:
  ```sql
  CREATE TABLE chat_messages (
    id          UUID PRIMARY KEY,
    encounter_id INT REFERENCES encounters(id),
    sender      VARCHAR(10) CHECK (sender IN ('admin', 'patient')),
    text        TEXT NOT NULL,
    timestamp   TIMESTAMPTZ DEFAULT NOW(),
    read        BOOLEAN DEFAULT FALSE
  );
  ```

### 5. PatientApp Waiting Room UI
- In `PatientApp`, create a matching `ChatPanel` component for the patient side.
- Show only messages for that patient's encounter (isolated by `encounterId`).
- The patient should NOT see other patients' chats — filter by their own encounter ID.

### 6. Removing Placeholders
When the backend is connected, remove these placeholders:
- **`ChatPanel.tsx`**: Remove the blue `💬 Patient messages will appear here...` banner.
- **`ChatPanel.tsx`**: Remove the `// TODO` comments.
- **`HospitalApp.tsx`**: Replace local `chatMessages` state with data fetched from the backend, and `handleSendMessage` with an API call / WebSocket emit.
- **`WaitingRoomView.tsx`**: Replace `getUnreadCount` with real unread logic from the backend.
