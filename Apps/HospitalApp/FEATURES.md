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
