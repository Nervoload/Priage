
createFromPatient(dto):
// Create links Patient + Encounter with PRE_TRIAGE.

// emit WebSocket event encounter.created to admittance view.

updateStatus(id, status, user):

// checks role: SUPPORT_STAFF can set ARRIVED, CANCELLED, NO_SHOW, etc.
// MEDICAL-STAFF can set TRIAGE, WAITING, TREATING, OUTBOUND, etc
// emit WebSocket event encounter.updated 