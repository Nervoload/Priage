type DemoRole = 'ADMIN' | 'NURSE' | 'STAFF' | 'DOCTOR';
type DemoEncounterStatus = 'EXPECTED' | 'ADMITTED' | 'TRIAGE' | 'WAITING' | 'COMPLETE' | 'UNRESOLVED' | 'CANCELLED';
type DemoSenderType = 'PATIENT' | 'USER' | 'SYSTEM';
type DemoInterviewPhase = 'urgent' | 'emergent' | 'history';

export type DemoAction =
  | { type: 'reset' }
  | { type: 'track_event'; eventType: string; metadata?: Record<string, unknown> }
  | { type: 'submit_feedback'; rating?: string; message?: string; email?: string }
  | { type: 'showcase_action'; actionId: DemoShowcaseActionId };

export type DemoShowcaseActionId =
  | 'hospital.ensure_showcase_patient'
  | 'hospital.admit_showcase_patient'
  | 'hospital.triage_showcase_patient'
  | 'hospital.waiting_showcase_patient'
  | 'hospital.patient_worsening_update';

export interface DemoPatient {
  id: number;
  email: string;
  createdAt: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  age: number | null;
  gender: string | null;
  heightCm: number | null;
  weightKg: number | null;
  allergies: string | null;
  conditions: string | null;
  preferredLanguage: string;
  optionalHealthInfo: Record<string, unknown> | null;
}

export interface DemoEncounter {
  id: number;
  publicId: string;
  createdAt: string;
  updatedAt: string;
  status: DemoEncounterStatus;
  chiefComplaint: string | null;
  details: string | null;
  hospitalId: number;
  patientId: number;
  currentCtasLevel: number | null;
  currentPriorityScore: number | null;
  expectedAt: string | null;
  arrivedAt: string | null;
  triagedAt: string | null;
  waitingAt: string | null;
  seenAt: string | null;
  departedAt: string | null;
  cancelledAt: string | null;
  priagePreview: DemoPriagePreview | null;
  priageSummary: DemoPriageSummary | null;
}

export interface DemoPriagePreview {
  briefing: string;
  recommendedCtasLevel: number | null;
  progressionRiskCount: number;
}

export interface DemoPriageSummary {
  briefing: string;
  recommendedCtasLevel: number | null;
  caseSummary: string;
  questionAnswers: Array<{
    question: string;
    answer: string;
    phase: string;
    answeredAt: string;
  }>;
  progressionRisks: string[];
  redFlags: string[];
  recommendedAction: string;
  generatedAt: string;
  generationMode: 'ai' | 'fallback';
}

export interface DemoMessage {
  id: number;
  createdAt: string;
  senderType: DemoSenderType;
  content: string;
  isInternal: boolean;
  createdByUserId: number | null;
  createdByPatientId: number | null;
  encounterId: number;
  hospitalId: number;
  attachments: [];
}

export interface DemoTriageAssessment {
  id: number;
  createdAt: string;
  ctasLevel: number;
  priorityScore: number;
  chiefComplaint: string | null;
  painLevel: number | null;
  vitalSigns: Record<string, unknown> | null;
  note: string | null;
  createdByUserId: number;
  encounterId: number;
  hospitalId: number;
}

export interface DemoHospitalConfig {
  version: 1;
  pageAccess: Record<DemoRole, Array<'admit' | 'triage' | 'waiting' | 'analytics' | 'settings'>>;
  customIntakeQuestions: Array<{
    id: string;
    fieldKey: string;
    label: string;
    helpText: string;
    required: boolean;
    responseType: 'text' | 'textarea' | 'boolean' | 'number' | 'select';
    appliesTo: 'admit' | 'triage' | 'both';
  }>;
  admittanceFeedbackSurvey: Array<{
    id: string;
    prompt: string;
    description: string;
    required: boolean;
    responseType: 'scale' | 'text' | 'boolean';
  }>;
}

export interface DemoHospital {
  id: number;
  name: string;
  slug: string;
  address: string | null;
  phone: string | null;
  checkInInstructions: string | null;
  parkingNotes: string | null;
  coordinates: { latitude: number; longitude: number } | null;
  config: DemoHospitalConfig;
  configUpdatedAt: string | null;
}

interface DemoEvent {
  id: string;
  type: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

interface DemoFeedbackSubmission {
  id: string;
  createdAt: string;
  rating?: string;
  message?: string;
  email?: string;
}

interface DemoInterviewState {
  interviewPublicId: string;
  status: 'in_progress' | 'emergency_ack_required' | 'complete';
  phase: DemoInterviewPhase;
  askedCount: number;
  maxQuestions: number;
  currentIndex: number;
  summaryPreview: string;
}

export interface DemoState {
  version: 1;
  updatedAt: string;
  hospital: DemoHospital;
  staffUser: {
    id: number;
    email: string;
    role: DemoRole;
    hospitalId: number;
  };
  patients: DemoPatient[];
  encounters: DemoEncounter[];
  messages: DemoMessage[];
  triageAssessments: DemoTriageAssessment[];
  activePatientId: number;
  activeEncounterId: number;
  draftPatientId: number | null;
  interview: DemoInterviewState;
  nextIds: {
    patient: number;
    encounter: number;
    message: number;
    triageAssessment: number;
    event: number;
    feedback: number;
  };
  events: DemoEvent[];
  feedback: DemoFeedbackSubmission[];
}

type DemoStoreListener = (state: DemoState) => void;

const STORAGE_KEY = 'priage:static-demo:v1';
const CHANNEL_NAME = 'priage:static-demo:state';
const MAX_EVENT_COUNT = 200;
const CLIENT_ID = `demo-client:${Math.random().toString(36).slice(2)}`;
const BASE_TIME = Date.UTC(2026, 5, 25, 13, 30, 0);
const listeners = new Set<DemoStoreListener>();
const VITE_DEMO_MODE = import.meta.env.VITE_DEMO_MODE;
const VITE_DEMO_EVENT_ENDPOINT = import.meta.env.VITE_DEMO_EVENT_ENDPOINT;
const DEMO_AUX_STORAGE_KEYS = [
  'patientAuthSession',
  'patientGuestSession',
  'priage.patient.messageOutbox.v1',
  'priage:hospital-session',
  'priage_seen_encounters',
];
const DEMO_AUX_STORAGE_PREFIXES = [
  'priage_triage_draft_',
  'priage:hospital:landing-page:',
];

let channel: BroadcastChannel | null = null;

export function isStaticDemoMode(): boolean {
  if (VITE_DEMO_MODE?.trim().toLowerCase() === 'static') return true;
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('demo')?.toLowerCase() === 'static';
}

export function loadDemoState(): DemoState {
  if (typeof window === 'undefined') return createSeedState();
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = createSeedState();
    saveDemoState(seeded);
    return seeded;
  }

  try {
    const parsed = JSON.parse(raw) as DemoState;
    if (parsed.version === 1 && parsed.hospital?.slug === 'demo-hospital') {
      return parsed;
    }
  } catch {
    // Re-seed below.
  }

  const seeded = createSeedState();
  saveDemoState(seeded);
  return seeded;
}

export function resetDemoState(): DemoState {
  const next = createSeedState();
  clearDemoAuxiliaryBrowserState();
  saveDemoState(next);
  notifyDemoStateChanged();
  return next;
}

export function subscribeDemoState(listener: DemoStoreListener): () => void {
  listeners.add(listener);
  ensureChannel();
  return () => {
    listeners.delete(listener);
  };
}

export function dispatchDemoAction(action: DemoAction): DemoState {
  if (action.type === 'reset') return resetDemoState();
  if (action.type === 'track_event') {
    trackDemoEvent(action.eventType, action.metadata);
    return loadDemoState();
  }
  if (action.type === 'submit_feedback') {
    submitDemoFeedback(action);
    return loadDemoState();
  }
  if (action.type === 'showcase_action') {
    runDemoShowcaseAction(action.actionId);
    return loadDemoState();
  }
  return loadDemoState();
}

export function trackDemoEvent(type: string, metadata?: Record<string, unknown>): void {
  const state = loadDemoState();
  const event: DemoEvent = {
    id: `demo-event-${state.nextIds.event}`,
    type,
    metadata: sanitizeMetadata(metadata),
    createdAt: nowIso(),
  };
  state.nextIds.event += 1;
  state.events = [...state.events, event].slice(-MAX_EVENT_COUNT);
  state.updatedAt = event.createdAt;
  saveDemoState(state);
  notifyDemoStateChanged();
  sendEventToOptionalSink(event);
}

export function submitDemoFeedback(input: { rating?: string; message?: string; email?: string }): DemoFeedbackSubmission {
  const state = loadDemoState();
  const feedback: DemoFeedbackSubmission = {
    id: `demo-feedback-${state.nextIds.feedback}`,
    createdAt: nowIso(),
    rating: input.rating?.trim() || undefined,
    message: input.message?.trim() || undefined,
    email: input.email?.trim() || undefined,
  };
  state.nextIds.feedback += 1;
  state.feedback = [...state.feedback, feedback].slice(-50);
  state.updatedAt = feedback.createdAt;
  saveDemoState(state);
  trackDemoEvent('feedback_submitted', { ...feedback });
  return feedback;
}

export function getDemoStaffAuthUser() {
  const state = loadDemoState();
  return {
    userId: state.staffUser.id,
    email: state.staffUser.email,
    role: state.staffUser.role,
    hospitalId: state.staffUser.hospitalId,
    hospital: {
      id: state.hospital.id,
      name: state.hospital.name,
      slug: state.hospital.slug,
    },
  };
}

export function getDemoStaffLoginResponse() {
  const state = loadDemoState();
  return {
    session: {
      id: 1,
      createdAt: state.updatedAt,
      expiresAt: null,
    },
    user: {
      id: state.staffUser.id,
      email: state.staffUser.email,
      role: state.staffUser.role,
      hospitalId: state.staffUser.hospitalId,
      hospital: {
        id: state.hospital.id,
        name: state.hospital.name,
        slug: state.hospital.slug,
      },
    },
  };
}

export function getDemoRuntimeProfile() {
  return {
    isDemo: true as const,
    profileId: 'static-browser-demo',
    label: 'Static Browser Demo',
    expiresAt: new Date(BASE_TIME + 7 * 24 * 60 * 60 * 1000).toISOString(),
    apps: { hospital: true, patient: true },
    hospitalViews: ['admit', 'triage', 'waiting', 'analytics', 'settings'],
    defaultTourId: 'hospital-core-demo',
    scenarioPack: 'static-ed-shift',
    watermark: 'Static Demo Data - Not for clinical use',
    disabledCapabilities: [
      'realOutboundMessaging',
      'realIntegrations',
      'productionExports',
      'partnerApiCredentials',
      'unsafeUploads',
      'hospitalConfigMutation',
    ],
  };
}

export function listDemoHospitals() {
  const state = loadDemoState();
  return [{
    id: state.hospital.id,
    name: state.hospital.name,
    slug: state.hospital.slug,
    address: state.hospital.address,
    phone: state.hospital.phone,
    checkInInstructions: state.hospital.checkInInstructions,
    parkingNotes: state.hospital.parkingNotes,
    coordinates: state.hospital.coordinates,
    customIntakeQuestions: state.hospital.config.customIntakeQuestions,
  }];
}

export function getDemoHospitalSummary() {
  const state = loadDemoState();
  return {
    id: state.hospital.id,
    name: state.hospital.name,
    slug: state.hospital.slug,
    _count: {
      encounters: state.encounters.length,
      users: 1,
    },
  };
}

export function getDemoHospitalConfig() {
  const state = loadDemoState();
  return {
    hospitalId: state.hospital.id,
    updatedAt: state.hospital.configUpdatedAt,
    config: state.hospital.config,
  };
}

export function updateDemoHospitalConfig(config: DemoHospitalConfig) {
  return mutateDemoState((state) => {
    state.hospital.config = config;
    state.hospital.configUpdatedAt = nowIso();
    trackDemoEventInState(state, 'hospital_config_updated');
  }).then(getDemoHospitalConfig);
}

export function submitDemoHospitalFeedback(responses: unknown[], bugReport?: string) {
  trackDemoEvent('hospital_feedback_submitted', {
    responseCount: responses.length,
    hasBugReport: Boolean(bugReport?.trim()),
  });
  return {
    id: `hospital-feedback-${Date.now()}`,
    createdAt: nowIso(),
    submittedBy: {
      userId: loadDemoState().staffUser.id,
      email: loadDemoState().staffUser.email,
      role: loadDemoState().staffUser.role,
    },
    responses,
    bugReport: bugReport || null,
  };
}

export function listDemoHospitalFeedback() {
  return [];
}

export function listDemoEncounters(status?: DemoEncounterStatus[]) {
  const state = loadDemoState();
  const statusSet = status && status.length > 0 ? new Set(status) : null;
  const data = state.encounters
    .filter((encounter) => !statusSet || statusSet.has(encounter.status))
    .sort(sortEncounterForQueue)
    .map((encounter) => toHospitalEncounter(state, encounter));
  return {
    data,
    total: data.length,
    nextCursor: null,
  };
}

export function getDemoEncounter(id: number) {
  const state = loadDemoState();
  const encounter = findEncounter(state, id);
  return toHospitalEncounter(state, encounter);
}

export function createDemoAdmittanceEncounter(payload: {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  age?: number | null;
  gender?: string | null;
  chiefComplaint: string;
  details?: string | null;
}) {
  return mutateDemoState((state) => {
    const patient = createPatientFromInput(state, {
      email: payload.email,
      firstName: payload.firstName || 'Demo',
      lastName: payload.lastName || 'Patient',
      phone: payload.phone || null,
      age: payload.age ?? null,
      gender: payload.gender || null,
      chiefComplaint: payload.chiefComplaint,
      details: payload.details || undefined,
    });
    const encounter = createEncounterForPatient(state, patient, payload.chiefComplaint, payload.details || null, 'ADMITTED');
    encounter.arrivedAt = nowIso();
    trackDemoEventInState(state, 'encounter_created_by_staff', { encounterId: encounter.id });
  }).then((state) => toHospitalEncounter(state, state.encounters[state.encounters.length - 1]));
}

export function runDemoShowcaseAction(actionId: DemoShowcaseActionId): void {
  mutateDemoStateSync((state) => {
    const encounter = ensureHospitalShowcaseEncounter(state);
    const timestamp = nowIso();

    if (actionId === 'hospital.admit_showcase_patient') {
      encounter.status = 'ADMITTED';
      encounter.arrivedAt = encounter.arrivedAt || timestamp;
      encounter.updatedAt = timestamp;
    } else if (actionId === 'hospital.triage_showcase_patient') {
      encounter.status = 'TRIAGE';
      encounter.arrivedAt = encounter.arrivedAt || timestamp;
      encounter.updatedAt = timestamp;
      const existingAssessment = state.triageAssessments.find((assessment) => assessment.encounterId === encounter.id);
      if (!existingAssessment) {
        const assessment: DemoTriageAssessment = {
          id: state.nextIds.triageAssessment,
          createdAt: timestamp,
          ctasLevel: 3,
          priorityScore: priorityForCtas(3),
          chiefComplaint: encounter.chiefComplaint,
          painLevel: 5,
          vitalSigns: { bloodPressure: '132/84', heartRate: 104, temperature: 37.4 },
          note: 'Demo tour assessment: exertional chest tightness with worsening symptoms.',
          createdByUserId: state.staffUser.id,
          encounterId: encounter.id,
          hospitalId: state.hospital.id,
        };
        state.nextIds.triageAssessment += 1;
        state.triageAssessments.push(assessment);
        encounter.currentCtasLevel = assessment.ctasLevel;
        encounter.currentPriorityScore = assessment.priorityScore;
        encounter.triagedAt = timestamp;
      }
    } else if (actionId === 'hospital.waiting_showcase_patient') {
      encounter.status = 'WAITING';
      encounter.arrivedAt = encounter.arrivedAt || timestamp;
      encounter.triagedAt = encounter.triagedAt || timestamp;
      encounter.waitingAt = timestamp;
      encounter.updatedAt = timestamp;
    } else if (actionId === 'hospital.patient_worsening_update') {
      encounter.status = encounter.status === 'EXPECTED' ? 'WAITING' : encounter.status;
      encounter.arrivedAt = encounter.arrivedAt || timestamp;
      encounter.triagedAt = encounter.triagedAt || timestamp;
      encounter.waitingAt = encounter.waitingAt || timestamp;
      appendDemoMessageInState(
        state,
        encounter.id,
        'PATIENT',
        'My chest tightness is getting worse while I wait.',
        false,
      );
    }

    state.activeEncounterId = encounter.id;
    trackDemoEventInState(state, 'showcase_action_ran', { actionId, encounterId: encounter.id });
  });
}

export function transitionDemoEncounter(id: number, transition: 'confirm' | 'arrived' | 'start-exam' | 'waiting' | 'discharge' | 'cancel') {
  return mutateDemoState((state) => {
    const encounter = findEncounter(state, id);
    const timestamp = nowIso();
    if (transition === 'confirm') {
      encounter.status = 'ADMITTED';
      encounter.arrivedAt = encounter.arrivedAt || timestamp;
    } else if (transition === 'arrived') {
      encounter.status = 'ADMITTED';
      encounter.arrivedAt = timestamp;
    } else if (transition === 'start-exam') {
      encounter.status = 'TRIAGE';
      encounter.arrivedAt = encounter.arrivedAt || timestamp;
    } else if (transition === 'waiting') {
      encounter.status = 'WAITING';
      encounter.triagedAt = encounter.triagedAt || timestamp;
      encounter.waitingAt = timestamp;
    } else if (transition === 'discharge') {
      encounter.status = 'COMPLETE';
      encounter.seenAt = encounter.seenAt || timestamp;
      encounter.departedAt = timestamp;
    } else if (transition === 'cancel') {
      encounter.status = 'CANCELLED';
      encounter.cancelledAt = timestamp;
    }
    encounter.updatedAt = timestamp;
    state.activeEncounterId = encounter.id;
    trackDemoEventInState(state, 'encounter_transitioned', { encounterId: encounter.id, transition });
  }).then((state) => toHospitalEncounter(state, findEncounter(state, id)));
}

export function createDemoTriageAssessment(payload: {
  encounterId: number;
  ctasLevel: number;
  chiefComplaint?: string;
  painLevel?: number;
  vitalSigns?: object;
  note?: string;
}) {
  return mutateDemoState((state) => {
    const encounter = findEncounter(state, payload.encounterId);
    const createdAt = nowIso();
    const assessment: DemoTriageAssessment = {
      id: state.nextIds.triageAssessment,
      createdAt,
      ctasLevel: payload.ctasLevel,
      priorityScore: priorityForCtas(payload.ctasLevel),
      chiefComplaint: payload.chiefComplaint || encounter.chiefComplaint,
      painLevel: payload.painLevel ?? null,
      vitalSigns: payload.vitalSigns ? { ...payload.vitalSigns } : null,
      note: payload.note || null,
      createdByUserId: state.staffUser.id,
      encounterId: encounter.id,
      hospitalId: state.hospital.id,
    };
    state.nextIds.triageAssessment += 1;
    state.triageAssessments.push(assessment);
    encounter.status = 'WAITING';
    encounter.currentCtasLevel = assessment.ctasLevel;
    encounter.currentPriorityScore = assessment.priorityScore;
    encounter.triagedAt = createdAt;
    encounter.waitingAt = createdAt;
    encounter.updatedAt = createdAt;
    trackDemoEventInState(state, 'triage_assessment_created', { encounterId: encounter.id, ctasLevel: assessment.ctasLevel });
  }).then((state) => state.triageAssessments[state.triageAssessments.length - 1]);
}

export function listDemoTriageAssessments(encounterId: number) {
  return loadDemoState().triageAssessments
    .filter((assessment) => assessment.encounterId === encounterId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export function getDemoTriageAssessment(id: number) {
  const assessment = loadDemoState().triageAssessments.find((candidate) => candidate.id === id);
  if (!assessment) throw new Error(`Demo triage assessment ${id} was not found`);
  return assessment;
}

export function listDemoMessages(encounterId: number, afterMessageId?: number) {
  const data = loadDemoState().messages
    .filter((message) => message.encounterId === encounterId)
    .filter((message) => afterMessageId == null || message.id > afterMessageId)
    .sort((left, right) => left.id - right.id);
  return {
    data,
    meta: {
      page: 1,
      limit: 100,
      total: data.length,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    },
  };
}

export function sendDemoStaffMessage(encounterId: number, content: string) {
  return appendDemoMessage(encounterId, 'USER', content, false);
}

export function sendDemoPatientMessage(encounterId: number, content: string, isWorsening = false) {
  const message = appendDemoMessage(encounterId, 'PATIENT', content, false);
  if (isWorsening) {
    trackDemoEvent('patient_worsening_message', { encounterId });
  }
  return message;
}

export function getDemoPatientProfile() {
  const state = loadDemoState();
  return findPatient(state, state.activePatientId);
}

export function updateDemoPatientProfile(payload: Partial<DemoPatient>) {
  return mutateDemoState((state) => {
    const patient = findPatient(state, state.activePatientId);
    Object.assign(patient, {
      firstName: payload.firstName ?? patient.firstName,
      lastName: payload.lastName ?? patient.lastName,
      phone: payload.phone ?? patient.phone,
      age: payload.age ?? patient.age,
      gender: payload.gender ?? patient.gender,
      heightCm: payload.heightCm ?? patient.heightCm,
      weightKg: payload.weightKg ?? patient.weightKg,
      allergies: payload.allergies ?? patient.allergies,
      conditions: payload.conditions ?? patient.conditions,
      preferredLanguage: payload.preferredLanguage ?? patient.preferredLanguage,
    });
    trackDemoEventInState(state, 'patient_profile_updated');
  }).then((state) => findPatient(state, state.activePatientId));
}

export function createDemoIntent(payload: {
  firstName: string;
  lastName?: string;
  phone: string;
  age?: number;
  gender?: string;
  chiefComplaint: string;
  details?: string;
  preferredLanguage?: string;
}) {
  return mutateDemoState((state) => {
    const patient = createPatientFromInput(state, {
      email: `guest.${state.nextIds.patient}@demo.local`,
      firstName: payload.firstName,
      lastName: payload.lastName || null,
      phone: payload.phone,
      age: payload.age ?? null,
      gender: payload.gender || null,
      chiefComplaint: payload.chiefComplaint,
      details: payload.details,
      preferredLanguage: payload.preferredLanguage,
    });
    state.draftPatientId = patient.id;
    state.activePatientId = patient.id;
    state.interview = createInterviewState(0);
    trackDemoEventInState(state, 'patient_intake_started', { patientId: patient.id });
  }).then((state) => ({
    patientId: state.activePatientId,
    encounterId: null,
  }));
}

export function updateDemoIntakeDetails(payload: {
  chiefComplaint?: string;
  details?: string;
  firstName?: string;
  lastName?: string;
  age?: number;
  allergies?: string;
  conditions?: string;
  customQuestionAnswers?: Record<string, unknown>;
}) {
  return mutateDemoState((state) => {
    const patient = findPatient(state, state.draftPatientId ?? state.activePatientId);
    patient.firstName = payload.firstName ?? patient.firstName;
    patient.lastName = payload.lastName ?? patient.lastName;
    patient.age = payload.age ?? patient.age;
    patient.allergies = payload.allergies ?? patient.allergies;
    patient.conditions = payload.conditions ?? patient.conditions;
    if (payload.customQuestionAnswers) {
      patient.optionalHealthInfo = {
        ...(patient.optionalHealthInfo || {}),
        ...payload.customQuestionAnswers,
      };
    }
    const encounter = state.encounters.find((candidate) => candidate.patientId === patient.id);
    if (encounter) {
      encounter.chiefComplaint = payload.chiefComplaint ?? encounter.chiefComplaint;
      encounter.details = payload.details ?? encounter.details;
      encounter.updatedAt = nowIso();
    }
    trackDemoEventInState(state, 'patient_intake_updated');
  }).then((state) => {
    const encounter = state.encounters.find((candidate) => candidate.patientId === state.activePatientId);
    return encounter ? toPatientEncounter(state, encounter) : { ok: true, pending: true };
  });
}

export function confirmDemoIntent(payload: { hospitalId?: number; hospitalSlug?: string }) {
  return mutateDemoState((state) => {
    const patient = findPatient(state, state.draftPatientId ?? state.activePatientId);
    const existing = state.encounters.find((encounter) => encounter.patientId === patient.id && encounter.status !== 'CANCELLED');
    if (existing) {
      state.activeEncounterId = existing.id;
      state.draftPatientId = null;
      return;
    }
    const complaint = String(patient.optionalHealthInfo?.chiefComplaint || 'Abdominal pain and nausea');
    const details = String(patient.optionalHealthInfo?.details || 'Symptoms began earlier today and have not improved.');
    const encounter = createEncounterForPatient(state, patient, complaint, details, 'EXPECTED');
    state.activeEncounterId = encounter.id;
    state.draftPatientId = null;
    trackDemoEventInState(state, 'patient_hospital_confirmed', {
      encounterId: encounter.id,
      hospitalSlug: payload.hospitalSlug || state.hospital.slug,
      hospitalId: payload.hospitalId || state.hospital.id,
    });
  }).then((state) => toPatientEncounter(state, findEncounter(state, state.activeEncounterId)));
}

export function listDemoPatientEncounters() {
  const state = loadDemoState();
  return state.encounters
    .filter((encounter) => encounter.patientId === state.activePatientId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map((encounter) => toPatientEncounterSummary(encounter));
}

export function getDemoPatientEncounter(id: number) {
  const state = loadDemoState();
  return toPatientEncounter(state, findEncounter(state, id));
}

export function getDemoQueueInfo(encounterId: number) {
  const state = loadDemoState();
  const waiting = state.encounters
    .filter((encounter) => encounter.status === 'WAITING')
    .sort(sortEncounterForQueue);
  const position = Math.max(1, waiting.findIndex((encounter) => encounter.id === encounterId) + 1);
  return {
    position,
    estimatedMinutes: 18 + (position - 1) * 12,
    totalInQueue: waiting.length,
  };
}

export function startDemoInterview() {
  return mutateDemoState((state) => {
    trackDemoEventInState(state, 'patient_interview_loaded', { status: state.interview.status });
  }).then((state) => toInterviewResponse(state.interview));
}

export function advanceDemoInterview(payload: {
  questionPublicId?: string;
  valueText?: string;
  valueNumber?: number;
  valueBoolean?: boolean;
  valueChoice?: string;
  action?: 'acknowledge_emergency';
}) {
  return mutateDemoState((state) => {
    const nextIndex = Math.min(state.interview.currentIndex + 1, DEMO_INTERVIEW_QUESTIONS.length);
    state.interview = createInterviewState(nextIndex);
    const patient = findPatient(state, state.activePatientId);
    patient.optionalHealthInfo = {
      ...(patient.optionalHealthInfo || {}),
      [payload.questionPublicId || `demo-question-${nextIndex}`]:
        payload.valueText ?? payload.valueNumber ?? payload.valueBoolean ?? payload.valueChoice ?? payload.action ?? 'acknowledged',
    };
    trackDemoEventInState(state, 'patient_interview_step_answered', { nextIndex });
  }).then((state) => toInterviewResponse(state.interview));
}

export function demoPriageChat(messages: Array<{ role: 'user' | 'assistant'; content: string }>) {
  const lastMessage = messages[messages.length - 1]?.content || '';
  trackDemoEvent('patient_priage_chat', { messageCount: messages.length });
  return {
    reply: lastMessage.toLowerCase().includes('chest')
      ? 'Because chest discomfort can be serious, this demo would recommend urgent in-person care and would keep the care team informed.'
      : 'I can help organize your symptoms and prepare a clear handoff for the care team.',
    stage: messages.length > 2 ? 'assessment' : 'intake',
    assessment: messages.length > 2
      ? {
          urgency: 'medium' as const,
          suggestedAction: 'Continue check-in and choose the demo hospital.',
          summary: 'Demo summary prepared for hospital admittance.',
        }
      : undefined,
    canAdmit: messages.length > 1,
  };
}

export function demoPriageAdmit(payload: { chiefComplaint: string; details?: string; hospitalSlug?: string; severity?: number }) {
  return mutateDemoState((state) => {
    const patient = findPatient(state, state.activePatientId);
    const encounter = createEncounterForPatient(state, patient, payload.chiefComplaint, payload.details || null, 'EXPECTED');
    encounter.currentCtasLevel = payload.severity || null;
    state.activeEncounterId = encounter.id;
    trackDemoEventInState(state, 'patient_priage_admitted', { encounterId: encounter.id, hospitalSlug: payload.hospitalSlug });
  }).then((state) => ({
    encounter: toPatientEncounter(state, findEncounter(state, state.activeEncounterId)),
    message: 'Demo encounter created and sent to the hospital queue.',
  }));
}

export function getDemoHospitalAnalytics(range: 'day' | 'week' | 'month' | 'year' | 'all' = 'week') {
  const state = loadDemoState();
  return {
    hospitalId: state.hospital.id,
    range,
    since: range === 'all' ? null : offsetIso(-7 * 24 * 60),
    generatedAt: nowIso(),
    total: state.encounters.length,
    data: state.encounters.map((encounter) => {
      const messages = state.messages.filter((message) => message.encounterId === encounter.id);
      const patientMessages = messages.filter((message) => message.senderType === 'PATIENT');
      return {
        id: encounter.id,
        createdAt: encounter.createdAt,
        updatedAt: encounter.updatedAt,
        status: encounter.status,
        chiefComplaint: encounter.chiefComplaint,
        currentCtasLevel: encounter.currentCtasLevel,
        currentPriorityScore: encounter.currentPriorityScore,
        arrivedAt: encounter.arrivedAt,
        triagedAt: encounter.triagedAt,
        waitingAt: encounter.waitingAt,
        seenAt: encounter.seenAt,
        departedAt: encounter.departedAt,
        cancelledAt: encounter.cancelledAt,
        triageAssessmentCount: state.triageAssessments.filter((assessment) => assessment.encounterId === encounter.id).length,
        messageCount: messages.length,
        patientMessageCount: patientMessages.length,
        firstPatientMessageAt: patientMessages[0]?.createdAt ?? null,
        lastPatientMessageAt: patientMessages[patientMessages.length - 1]?.createdAt ?? null,
      };
    }),
  };
}

function createSeedState(): DemoState {
  const hospitalConfig: DemoHospitalConfig = {
    version: 1,
    pageAccess: {
      ADMIN: ['admit', 'triage', 'waiting', 'analytics', 'settings'],
      NURSE: ['triage', 'waiting', 'analytics', 'settings'],
      STAFF: ['admit', 'settings'],
      DOCTOR: ['triage', 'waiting', 'analytics', 'settings'],
    },
    customIntakeQuestions: [
      {
        id: 'demo-meds',
        fieldKey: 'currentMedications',
        label: 'Current medications',
        helpText: 'Helps the care team prepare a cleaner handoff.',
        required: false,
        responseType: 'textarea',
        appliesTo: 'both',
      },
      {
        id: 'demo-arrival',
        fieldKey: 'arrivalMode',
        label: 'How are you arriving?',
        helpText: 'Supports admittance planning before the patient reaches the desk.',
        required: false,
        responseType: 'select',
        appliesTo: 'admit',
      },
    ],
    admittanceFeedbackSurvey: [
      {
        id: 'clarity',
        prompt: 'How clear was the intake handoff?',
        description: 'Used in the demo to show staff feedback collection.',
        required: false,
        responseType: 'scale',
      },
    ],
  };

  const patients: DemoPatient[] = [
    createSeedPatient(1, 'Avery', 'Chen', 42, 'Female', 'avery.chen@demo.local', 'Penicillin', 'Asthma'),
    createSeedPatient(2, 'Morgan', 'Patel', 58, 'Male', 'morgan.patel@demo.local', null, 'Hypertension'),
    createSeedPatient(3, 'Jordan', 'Williams', 31, 'Non-binary', 'jordan.williams@demo.local', 'Shellfish', null),
  ];

  const encounters: DemoEncounter[] = [
    createSeedEncounter(101, patients[0], 'Right lower abdominal pain', 'Pain started six hours ago with nausea and chills.', 'EXPECTED', -52, null),
    createSeedEncounter(102, patients[1], 'Shortness of breath', 'Increasing shortness of breath after a respiratory infection.', 'TRIAGE', -95, 2),
    createSeedEncounter(103, patients[2], 'Migraine with visual aura', 'Severe headache, light sensitivity, and vomiting.', 'WAITING', -140, 3),
  ];

  encounters[0].priagePreview = {
    briefing: 'Pre-arrival intake suggests worsening abdominal pain with nausea.',
    recommendedCtasLevel: 3,
    progressionRiskCount: 1,
  };
  encounters[1].arrivedAt = offsetIso(-80);
  encounters[2].arrivedAt = offsetIso(-132);
  encounters[2].triagedAt = offsetIso(-86);
  encounters[2].waitingAt = offsetIso(-84);

  const messages: DemoMessage[] = [
    createSeedMessage(501, 103, 3, 'PATIENT', 'My headache is getting worse and the lights in the room are painful.', -72),
    createSeedMessage(502, 103, 3, 'USER', 'Thanks for the update. We have flagged this for the waiting room nurse.', -70),
    createSeedMessage(503, 102, 2, 'SYSTEM', 'Patient reported worsening breathing during intake.', -61),
  ];

  const triageAssessments: DemoTriageAssessment[] = [
    {
      id: 301,
      createdAt: offsetIso(-86),
      ctasLevel: 3,
      priorityScore: priorityForCtas(3),
      chiefComplaint: encounters[2].chiefComplaint,
      painLevel: 8,
      vitalSigns: { bloodPressure: '128/82', heartRate: 96, temperature: 37.1 },
      note: 'Photophobia and nausea. No recent trauma reported.',
      createdByUserId: 9001,
      encounterId: 103,
      hospitalId: 1,
    },
  ];

  return {
    version: 1,
    updatedAt: offsetIso(0),
    hospital: {
      id: 1,
      name: 'Priage Demo Hospital',
      slug: 'demo-hospital',
      address: '100 Demo Health Way, Toronto, ON',
      phone: '555-0100',
      checkInInstructions: 'Use the emergency entrance and show your Priage check-in at the desk.',
      parkingNotes: 'Short-term parking is available beside the emergency department.',
      coordinates: { latitude: 43.6532, longitude: -79.3832 },
      config: hospitalConfig,
      configUpdatedAt: offsetIso(-15),
    },
    staffUser: {
      id: 9001,
      email: 'demo.admin@priage.local',
      role: 'ADMIN',
      hospitalId: 1,
    },
    patients,
    encounters,
    messages,
    triageAssessments,
    activePatientId: 1,
    activeEncounterId: 101,
    draftPatientId: null,
    interview: createInterviewState(0),
    nextIds: {
      patient: 4,
      encounter: 104,
      message: 504,
      triageAssessment: 302,
      event: 1,
      feedback: 1,
    },
    events: [],
    feedback: [],
  };
}

function createSeedPatient(
  id: number,
  firstName: string,
  lastName: string,
  age: number,
  gender: string,
  email: string,
  allergies: string | null,
  conditions: string | null,
): DemoPatient {
  return {
    id,
    email,
    createdAt: offsetIso(-180),
    firstName,
    lastName,
    phone: '555-01' + String(id).padStart(2, '0'),
    age,
    gender,
    heightCm: null,
    weightKg: null,
    allergies,
    conditions,
    preferredLanguage: 'English',
    optionalHealthInfo: {},
  };
}

function createSeedEncounter(
  id: number,
  patient: DemoPatient,
  chiefComplaint: string,
  details: string,
  status: DemoEncounterStatus,
  createdOffsetMinutes: number,
  ctasLevel: number | null,
): DemoEncounter {
  return {
    id,
    publicId: `demo-enc-${id}`,
    createdAt: offsetIso(createdOffsetMinutes),
    updatedAt: offsetIso(createdOffsetMinutes + 4),
    status,
    chiefComplaint,
    details,
    hospitalId: 1,
    patientId: patient.id,
    currentCtasLevel: ctasLevel,
    currentPriorityScore: ctasLevel ? priorityForCtas(ctasLevel) : null,
    expectedAt: offsetIso(createdOffsetMinutes + 20),
    arrivedAt: status === 'EXPECTED' ? null : offsetIso(createdOffsetMinutes + 10),
    triagedAt: null,
    waitingAt: null,
    seenAt: null,
    departedAt: null,
    cancelledAt: null,
    priagePreview: null,
    priageSummary: buildDemoPriageSummary(chiefComplaint, details, ctasLevel),
  };
}

function createSeedMessage(
  id: number,
  encounterId: number,
  patientId: number,
  senderType: DemoSenderType,
  content: string,
  offsetMinutes: number,
): DemoMessage {
  return {
    id,
    createdAt: offsetIso(offsetMinutes),
    senderType,
    content,
    isInternal: false,
    createdByUserId: senderType === 'USER' ? 9001 : null,
    createdByPatientId: senderType === 'PATIENT' ? patientId : null,
    encounterId,
    hospitalId: 1,
    attachments: [],
  };
}

function createPatientFromInput(
  state: DemoState,
  input: {
    email: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    age: number | null;
    gender: string | null;
    chiefComplaint: string;
    details?: string;
    preferredLanguage?: string;
  },
): DemoPatient {
  const patient: DemoPatient = {
    id: state.nextIds.patient,
    email: input.email,
    createdAt: nowIso(),
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    age: input.age,
    gender: input.gender,
    heightCm: null,
    weightKg: null,
    allergies: null,
    conditions: null,
    preferredLanguage: input.preferredLanguage || 'English',
    optionalHealthInfo: {
      chiefComplaint: input.chiefComplaint,
      details: input.details || null,
    },
  };
  state.nextIds.patient += 1;
  state.patients.push(patient);
  return patient;
}

function createEncounterForPatient(
  state: DemoState,
  patient: DemoPatient,
  chiefComplaint: string,
  details: string | null,
  status: DemoEncounterStatus,
): DemoEncounter {
  const createdAt = nowIso();
  const encounter: DemoEncounter = {
    id: state.nextIds.encounter,
    publicId: `demo-enc-${state.nextIds.encounter}`,
    createdAt,
    updatedAt: createdAt,
    status,
    chiefComplaint,
    details,
    hospitalId: state.hospital.id,
    patientId: patient.id,
    currentCtasLevel: null,
    currentPriorityScore: null,
    expectedAt: createdAt,
    arrivedAt: status === 'ADMITTED' || status === 'TRIAGE' || status === 'WAITING' ? createdAt : null,
    triagedAt: null,
    waitingAt: null,
    seenAt: null,
    departedAt: null,
    cancelledAt: null,
    priagePreview: {
      briefing: `${chiefComplaint}. Intake captured before arrival in the static demo.`,
      recommendedCtasLevel: null,
      progressionRiskCount: 0,
    },
    priageSummary: buildDemoPriageSummary(chiefComplaint, details || '', null),
  };
  state.nextIds.encounter += 1;
  state.encounters.push(encounter);
  state.activeEncounterId = encounter.id;
  return encounter;
}

function ensureHospitalShowcaseEncounter(state: DemoState): DemoEncounter {
  const existingPatient = state.patients.find((patient) => patient.email === 'showcase.patient@demo.local');
  const patient = existingPatient || createPatientFromInput(state, {
    email: 'showcase.patient@demo.local',
    firstName: 'Taylor',
    lastName: 'Demo',
    phone: '555-0199',
    age: 34,
    gender: 'Female',
    chiefComplaint: 'Chest tightness after climbing stairs',
    details: 'Started this morning and feels worse with exertion. Demo-only showcase patient.',
  });
  const existingEncounter = state.encounters.find((encounter) => (
    encounter.patientId === patient.id && encounter.status !== 'CANCELLED' && encounter.status !== 'COMPLETE'
  ));
  if (existingEncounter) {
    return existingEncounter;
  }
  return createEncounterForPatient(
    state,
    patient,
    'Chest tightness after climbing stairs',
    'Started this morning and feels worse with exertion. Demo-only showcase patient.',
    'EXPECTED',
  );
}

function appendDemoMessage(encounterId: number, senderType: DemoSenderType, content: string, isInternal: boolean): DemoMessage {
  let created: DemoMessage | null = null;
  mutateDemoStateSync((state) => {
    created = appendDemoMessageInState(state, encounterId, senderType, content, isInternal);
  });
  return created as unknown as DemoMessage;
}

function appendDemoMessageInState(
  state: DemoState,
  encounterId: number,
  senderType: DemoSenderType,
  content: string,
  isInternal: boolean,
): DemoMessage {
  const encounter = findEncounter(state, encounterId);
  const patient = findPatient(state, encounter.patientId);
  const created: DemoMessage = {
    id: state.nextIds.message,
    createdAt: nowIso(),
    senderType,
    content,
    isInternal,
    createdByUserId: senderType === 'USER' ? state.staffUser.id : null,
    createdByPatientId: senderType === 'PATIENT' ? patient.id : null,
    encounterId,
    hospitalId: state.hospital.id,
    attachments: [],
  };
  state.nextIds.message += 1;
  state.messages.push(created);
  encounter.updatedAt = created.createdAt;
  trackDemoEventInState(state, senderType === 'PATIENT' ? 'patient_message_sent' : 'staff_message_sent', { encounterId });
  return created;
}

async function mutateDemoState(mutator: (state: DemoState) => void): Promise<DemoState> {
  return mutateDemoStateSync(mutator);
}

function mutateDemoStateSync(mutator: (state: DemoState) => void): DemoState {
  const state = loadDemoState();
  mutator(state);
  state.updatedAt = nowIso();
  saveDemoState(state);
  notifyDemoStateChanged();
  return state;
}

function saveDemoState(state: DemoState): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function clearDemoAuxiliaryBrowserState(): void {
  if (typeof window === 'undefined') return;
  for (const key of DEMO_AUX_STORAGE_KEYS) {
    window.localStorage.removeItem(key);
  }
  const prefixMatchedKeys: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key && DEMO_AUX_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      prefixMatchedKeys.push(key);
    }
  }
  for (const key of prefixMatchedKeys) {
    window.localStorage.removeItem(key);
  }
  if ('indexedDB' in window) {
    window.indexedDB.deleteDatabase('priage-patient-outbox');
  }
}

function notifyDemoStateChanged(): void {
  const state = loadDemoState();
  listeners.forEach((listener) => listener(state));
  ensureChannel();
  channel?.postMessage({ type: 'state_changed', clientId: CLIENT_ID });
}

function ensureChannel(): void {
  if (channel || typeof BroadcastChannel === 'undefined') return;
  channel = new BroadcastChannel(CHANNEL_NAME);
  channel.onmessage = (event: MessageEvent<{ type?: string; clientId?: string }>) => {
    if (event.data?.type !== 'state_changed' || event.data.clientId === CLIENT_ID) return;
    const state = loadDemoState();
    listeners.forEach((listener) => listener(state));
  };
}

function findEncounter(state: DemoState, id: number): DemoEncounter {
  const encounter = state.encounters.find((candidate) => candidate.id === id);
  if (!encounter) throw new Error(`Demo encounter ${id} was not found`);
  return encounter;
}

function findPatient(state: DemoState, id: number): DemoPatient {
  const patient = state.patients.find((candidate) => candidate.id === id);
  if (!patient) throw new Error(`Demo patient ${id} was not found`);
  return patient;
}

function toHospitalEncounter(state: DemoState, encounter: DemoEncounter) {
  return {
    ...encounter,
    patient: findPatient(state, encounter.patientId),
    triageAssessments: state.triageAssessments.filter((assessment) => assessment.encounterId === encounter.id),
    activityLog: [],
    messages: state.messages.filter((message) => message.encounterId === encounter.id),
    alerts: [],
    intakeImages: [],
  };
}

function toPatientEncounter(state: DemoState, encounter: DemoEncounter) {
  return {
    id: encounter.id,
    createdAt: encounter.createdAt,
    status: encounter.status,
    chiefComplaint: encounter.chiefComplaint,
    details: encounter.details,
    hospitalId: encounter.hospitalId,
    expectedAt: encounter.expectedAt,
    arrivedAt: encounter.arrivedAt,
    messages: state.messages.filter((message) => message.encounterId === encounter.id),
    intakeImages: [],
    priageSummary: encounter.priageSummary,
  };
}

function toPatientEncounterSummary(encounter: DemoEncounter) {
  return {
    id: encounter.id,
    createdAt: encounter.createdAt,
    status: encounter.status,
    chiefComplaint: encounter.chiefComplaint,
    hospitalId: encounter.hospitalId,
    expectedAt: encounter.expectedAt,
    arrivedAt: encounter.arrivedAt,
  };
}

function sortEncounterForQueue(left: DemoEncounter, right: DemoEncounter): number {
  const leftPriority = left.currentPriorityScore ?? 0;
  const rightPriority = right.currentPriorityScore ?? 0;
  if (leftPriority !== rightPriority) return rightPriority - leftPriority;
  return right.createdAt.localeCompare(left.createdAt);
}

function buildDemoPriageSummary(chiefComplaint: string, details: string, ctasLevel: number | null): DemoPriageSummary {
  return {
    briefing: `${chiefComplaint}. ${details}`.trim(),
    recommendedCtasLevel: ctasLevel,
    caseSummary: details || `Patient reported ${chiefComplaint.toLowerCase()}.`,
    questionAnswers: [
      {
        question: 'What brings you in today?',
        answer: chiefComplaint,
        phase: 'history',
        answeredAt: offsetIso(-30),
      },
      {
        question: 'How has this changed since it started?',
        answer: details || 'Symptoms are being monitored in the static demo.',
        phase: 'emergent',
        answeredAt: offsetIso(-26),
      },
    ],
    progressionRisks: ctasLevel && ctasLevel <= 3 ? ['Symptoms may progress while waiting'] : [],
    redFlags: ctasLevel && ctasLevel <= 2 ? ['High acuity demo signal'] : [],
    recommendedAction: 'Continue intake handoff and monitor status changes.',
    generatedAt: offsetIso(-25),
    generationMode: 'fallback',
  };
}

function createInterviewState(currentIndex: number): DemoInterviewState {
  return {
    interviewPublicId: 'static-demo-interview',
    status: currentIndex >= DEMO_INTERVIEW_QUESTIONS.length ? 'complete' : 'in_progress',
    phase: DEMO_INTERVIEW_QUESTIONS[currentIndex]?.phase || 'history',
    askedCount: Math.min(currentIndex, DEMO_INTERVIEW_QUESTIONS.length),
    maxQuestions: DEMO_INTERVIEW_QUESTIONS.length,
    currentIndex,
    summaryPreview: currentIndex === 0
      ? 'The demo interview will collect a few focused answers for the hospital handoff.'
      : 'Demo answers are being added to the patient handoff summary.',
  };
}

const DEMO_INTERVIEW_QUESTIONS = [
  {
    publicId: 'demo-onset',
    phase: 'urgent' as DemoInterviewPhase,
    inputType: 'single_select',
    prompt: 'When did this start?',
    helpText: 'Timing helps the care team understand progression.',
    placeholder: '',
    required: true,
    choices: ['Less than 1 hour ago', 'Today', 'Several days ago'],
    clinicalReason: 'Establishes acuity timing.',
    askIfAmbiguous: false,
  },
  {
    publicId: 'demo-worse',
    phase: 'emergent' as DemoInterviewPhase,
    inputType: 'boolean',
    prompt: 'Are symptoms getting worse?',
    helpText: 'Worsening symptoms can affect queue monitoring.',
    placeholder: '',
    required: true,
    choices: [],
    clinicalReason: 'Detects progression risk.',
    askIfAmbiguous: false,
  },
  {
    publicId: 'demo-context',
    phase: 'history' as DemoInterviewPhase,
    inputType: 'textarea',
    prompt: 'Anything else the care team should know?',
    helpText: 'This appears in the demo handoff summary.',
    placeholder: 'Add allergies, medications, or recent changes',
    required: false,
    choices: [],
    clinicalReason: 'Collects useful handoff context.',
    askIfAmbiguous: true,
  },
];

function toInterviewResponse(interview: DemoInterviewState) {
  return {
    interviewPublicId: interview.interviewPublicId,
    status: interview.status,
    phase: interview.phase,
    askedCount: interview.askedCount,
    maxQuestions: interview.maxQuestions,
    currentQuestion: interview.status === 'complete' ? null : DEMO_INTERVIEW_QUESTIONS[interview.currentIndex],
    cachedQuestions: DEMO_INTERVIEW_QUESTIONS,
    emergencyAlert: null,
    summaryPreview: interview.summaryPreview,
  };
}

function priorityForCtas(ctasLevel: number): number {
  return Math.max(10, 110 - ctasLevel * 18);
}

function nowIso(): string {
  return new Date().toISOString();
}

function offsetIso(minutes: number): string {
  return new Date(BASE_TIME + minutes * 60_000).toISOString();
}

function sanitizeMetadata(metadata?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!metadata) return undefined;
  const serialized = JSON.stringify(metadata);
  if (serialized.length > 4000) return { truncated: true };
  return JSON.parse(serialized) as Record<string, unknown>;
}

function trackDemoEventInState(state: DemoState, type: string, metadata?: Record<string, unknown>): void {
  state.events = [
    ...state.events,
    {
      id: `demo-event-${state.nextIds.event}`,
      type,
      metadata: sanitizeMetadata(metadata),
      createdAt: nowIso(),
    },
  ].slice(-MAX_EVENT_COUNT);
  state.nextIds.event += 1;
}

function sendEventToOptionalSink(event: DemoEvent): void {
  const endpoint = VITE_DEMO_EVENT_ENDPOINT;
  if (!endpoint || typeof navigator === 'undefined') return;
  const body = JSON.stringify(event);
  if ('sendBeacon' in navigator) {
    navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }));
    return;
  }
  void fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => undefined);
}
