# Priage

Priage carries a patient's complaint from intake through reception and care, so the care team understands it before the visit and the patient stays informed.

## Language

### Sites and visits

**Site**:
A hospital or clinic that uses Priage; each site's records are kept apart. The code still calls every site a "hospital"; a neutral name (possibly "Clinic") will replace it later.
_Avoid_: hospital (when any site is meant), tenant (in product copy)

**Workflow profile**:
The pipeline a site runs: Emergency department (ED) or Clinic appointment.

**Encounter**:
One patient visit to a site, from intake to its end; the shared record patients and staff work from. Patient-facing copy calls it a visit.
_Avoid_: case, admission

**Active encounter**:
An encounter whose status is not terminal.
_Avoid_: open visit, in-progress visit

**Terminal status**:
Complete, Unresolved (the patient left or did not show) or Cancelled; the encounter is over.

### Stages

**Triage**:
The ED stage in which a nurse assesses the patient and sets their priority.

**Waiting**:
The ED stage after Triage, while a triaged patient waits to be seen; it exists for large waiting rooms with long waits. Clinics do not use it.

**Care**:
The clinic stage in which a physician sees the patient. It plays the role Triage plays in the ED but is a separate stage, so hospital and clinic pipelines can diverge.
_Avoid_: treating Care and Triage as one stage
