import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type {
  CareTeamDisplayMember,
  DemoQuickReply,
  DemoScenarioDefinition,
  DemoScenarioId,
  DemoVisitChecklistItem,
  EncounterDraftState,
} from './types/domain';

export const DEMO_SCENARIO_KEY = 'patientDemoScenario';
export const DEMO_DRAFTS_KEY = 'patientDemoDrafts';
export const DEMO_UI_KEY = 'patientDemoUiState';

const SCENARIOS: DemoScenarioDefinition[] = [
  {
    id: 'guest-urgent',
    label: 'Guest urgent arrival',
    persona: 'guest',
    headline: 'Fast-track a guest patient on the way to the ER.',
    description: 'Best for demonstrating quick intake, prefilled forms, and automatic arrival handoff into the live encounter workspace.',
    hospitalName: 'Priage General Hospital',
    hospitalSlug: 'priage-general',
    encounterStatusPreview: 'EXPECTED',
    guestStartDefaults: {
      firstName: 'Maya',
      lastName: 'Coleman',
      chiefComplaint: 'Persistent chest pain spreading into the left shoulder with shortness of breath.',
    },
    preTriageDefaults: {
      age: '39',
      allergies: 'Penicillin',
      conditions: 'Postpartum hypertension',
      details: 'Pain started 90 minutes ago while walking upstairs. No trauma. Took aspirin at home.',
    },
    signupDefaults: {
      firstName: 'Maya',
      lastName: 'Coleman',
      email: 'maya.demo@patient.dev',
      phone: '555-0200',
      password: 'password123',
    },
    priageStarterPrompt: 'I have chest pain that has been getting worse over the last hour and I feel short of breath.',
  },
  {
    id: 'returning-waiting',
    label: 'Returning patient waiting',
    persona: 'authenticated',
    headline: 'Show the full waiting-room dashboard with real seeded messages.',
    description: 'Uses the seeded waiting-room patient so the demo opens directly into the in-hospital workspace.',
    hospitalName: 'Priage General Hospital',
    hospitalSlug: 'priage-general',
    encounterStatusPreview: 'WAITING',
    authEmail: 'diana@patient.dev',
    authPassword: 'password123',
    signupDefaults: {
      firstName: 'Diana',
      lastName: 'Patel',
      email: 'diana@patient.dev',
      phone: '555-0104',
      password: 'password123',
    },
    priageStarterPrompt: 'My forearm cut is bleeding through the dressing and my fingers feel numb.',
  },
  {
    id: 'triage-active',
    label: 'Active triage visit',
    persona: 'authenticated',
    headline: 'Highlight assessment, care-team updates, and changing symptoms.',
    description: 'Opens the seeded triage patient to show a more active encounter and more frequent staff coordination.',
    hospitalName: 'Priage General Hospital',
    hospitalSlug: 'priage-general',
    encounterStatusPreview: 'TRIAGE',
    authEmail: 'carol@patient.dev',
    authPassword: 'password123',
    signupDefaults: {
      firstName: 'Carol',
      lastName: 'Chen',
      email: 'carol@patient.dev',
      phone: '555-0103',
      password: 'password123',
    },
    priageStarterPrompt: 'I have a severe migraine with nausea and flashing lights in my vision.',
  },
  {
    id: 'existing-user-new-visit',
    label: 'Existing user starts visit',
    persona: 'authenticated',
    headline: 'Use a signed-in patient with no active encounter, then launch a new visit with presets.',
    description: 'Intended for demonstrating account login, preserved profile details, and a fresh encounter created from Priage.',
    hospitalName: 'Priage General Hospital',
    hospitalSlug: 'priage-general',
    authEmail: 'evan@patient.dev',
    authPassword: 'password123',
    signupDefaults: {
      firstName: 'Evan',
      lastName: 'Ross',
      email: 'evan@patient.dev',
      phone: '555-0105',
      password: 'password123',
    },
    priageStarterPrompt: 'I have a worsening fever, chills, and a deep cough that has lasted three days.',
  },
];

const DEFAULT_CHECKLIST: DemoVisitChecklistItem[] = [
  {
    id: 'id-ready',
    label: 'Have photo ID ready',
    description: 'Useful if registration asks to confirm your identity or health card details.',
  },
  {
    id: 'meds-list',
    label: 'Review current medications',
    description: 'Keep a short list of regular medications or supplements within reach.',
  },
  {
    id: 'support-person',
    label: 'Share support contact',
    description: 'Add the person who should receive updates or help with pickup after discharge.',
  },
];

const DEFAULT_QUICK_REPLIES: DemoQuickReply[] = [
  {
    id: 'eta',
    label: 'Share arrival update',
    message: 'I am on the way now and should arrive in about 10 minutes.',
  },
  {
    id: 'symptoms',
    label: 'Symptoms worse',
    message: 'My pain is getting worse and I need someone to check on me as soon as possible.',
    isWorsening: true,
  },
  {
    id: 'question',
    label: 'Ask what happens next',
    message: 'Can you let me know what the next step is and if any forms still need my attention?',
  },
];

const CARE_TEAM_ROSTER = [
  { name: 'Morgan Lee', role: 'Charge Nurse', avatarInitials: 'ML', color: '#0f8c5f', badge: 'Charge' },
  { name: 'Ava Singh', role: 'Triage Nurse', avatarInitials: 'AS', color: '#c36b0c', badge: 'Triage' },
  { name: 'Daniel Ruiz', role: 'ED Physician', avatarInitials: 'DR', color: '#1949b8', badge: 'ED MD' },
  { name: 'Carmen Price', role: 'Registration Desk', avatarInitials: 'CP', color: '#7a3ef0', badge: 'Front Desk' },
] as const;

const DEFAULT_DRAFT: EncounterDraftState = {
  transportNote: '',
  symptomUpdate: '',
  symptomSeverity: 5,
  emergencyContact: 'Jordan Coleman • 555-0194',
  supportPerson: 'Will stay in the lobby until updates are needed.',
  medications: 'Aspirin 81mg daily',
  accessibilityNeeds: 'Quiet waiting area if available',
  selectedChecklistIds: [],
  attachments: [],
};

interface DemoUiState {
  dismissedCards: string[];
  lastAppliedSurface?: string;
}

interface DemoContextValue {
  scenarios: DemoScenarioDefinition[];
  selectedScenarioId: DemoScenarioId;
  selectedScenario: DemoScenarioDefinition;
  setSelectedScenarioId: (scenarioId: DemoScenarioId) => void;
  quickReplies: DemoQuickReply[];
  checklistItems: DemoVisitChecklistItem[];
  getEncounterDraft: (encounterId: number) => EncounterDraftState;
  updateEncounterDraft: (encounterId: number, patch: Partial<EncounterDraftState>) => void;
  addEncounterAttachment: (encounterId: number, name: string) => void;
  clearEncounterDraft: (encounterId: number) => void;
  getCareTeamMember: (userId?: number | null) => CareTeamDisplayMember | null;
  dismissedCards: string[];
  dismissCard: (cardId: string) => void;
  resetDismissedCards: () => void;
}

const DemoContext = createContext<DemoContextValue | null>(null);

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    localStorage.removeItem(key);
    return fallback;
  }
}

type DraftStateMap = Record<string, EncounterDraftState>;

export function DemoProvider({ children }: { children: ReactNode }) {
  const [selectedScenarioId, setSelectedScenarioIdState] = useState<DemoScenarioId>(() => {
    return loadJson<DemoScenarioId>(DEMO_SCENARIO_KEY, 'guest-urgent');
  });
  const [drafts, setDrafts] = useState<DraftStateMap>(() => loadJson<DraftStateMap>(DEMO_DRAFTS_KEY, {}));
  const [uiState, setUiState] = useState<DemoUiState>(() => loadJson<DemoUiState>(DEMO_UI_KEY, { dismissedCards: [] }));

  useEffect(() => {
    localStorage.setItem(DEMO_SCENARIO_KEY, JSON.stringify(selectedScenarioId));
  }, [selectedScenarioId]);

  useEffect(() => {
    localStorage.setItem(DEMO_DRAFTS_KEY, JSON.stringify(drafts));
  }, [drafts]);

  useEffect(() => {
    localStorage.setItem(DEMO_UI_KEY, JSON.stringify(uiState));
  }, [uiState]);

  const selectedScenario = useMemo(() => {
    return SCENARIOS.find((scenario) => scenario.id === selectedScenarioId) ?? SCENARIOS[0];
  }, [selectedScenarioId]);

  const setSelectedScenarioId = useCallback((scenarioId: DemoScenarioId) => {
    setSelectedScenarioIdState(scenarioId);
    setUiState((prev) => ({ ...prev, lastAppliedSurface: 'scenario-picker' }));
  }, []);

  const getEncounterDraft = useCallback((encounterId: number): EncounterDraftState => {
    return drafts[String(encounterId)] ?? DEFAULT_DRAFT;
  }, [drafts]);

  const updateEncounterDraft = useCallback((encounterId: number, patch: Partial<EncounterDraftState>) => {
    setDrafts((prev) => ({
      ...prev,
      [String(encounterId)]: {
        ...(prev[String(encounterId)] ?? DEFAULT_DRAFT),
        ...patch,
      },
    }));
  }, []);

  const addEncounterAttachment = useCallback((encounterId: number, name: string) => {
    setDrafts((prev) => {
      const current = prev[String(encounterId)] ?? DEFAULT_DRAFT;
      const nextAttachment = {
        id: `${Date.now()}`,
        name,
        note: 'Attached for demo review',
        tint: ['#dbeafe', '#fce7f3', '#dcfce7', '#fef3c7'][current.attachments.length % 4],
      };

      return {
        ...prev,
        [String(encounterId)]: {
          ...current,
          attachments: [...current.attachments, nextAttachment],
        },
      };
    });
  }, []);

  const clearEncounterDraft = useCallback((encounterId: number) => {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[String(encounterId)];
      return next;
    });
  }, []);

  const getCareTeamMember = useCallback((userId?: number | null): CareTeamDisplayMember | null => {
    if (userId == null) {
      return null;
    }

    const rosterEntry = CARE_TEAM_ROSTER[Math.abs(userId) % CARE_TEAM_ROSTER.length];
    return {
      userId,
      ...rosterEntry,
    };
  }, []);

  const dismissCard = useCallback((cardId: string) => {
    setUiState((prev) => ({
      ...prev,
      dismissedCards: Array.from(new Set([...prev.dismissedCards, cardId])),
    }));
  }, []);

  const resetDismissedCards = useCallback(() => {
    setUiState((prev) => ({ ...prev, dismissedCards: [] }));
  }, []);

  const value = useMemo<DemoContextValue>(() => ({
    scenarios: SCENARIOS,
    selectedScenarioId,
    selectedScenario,
    setSelectedScenarioId,
    quickReplies: DEFAULT_QUICK_REPLIES,
    checklistItems: DEFAULT_CHECKLIST,
    getEncounterDraft,
    updateEncounterDraft,
    addEncounterAttachment,
    clearEncounterDraft,
    getCareTeamMember,
    dismissedCards: uiState.dismissedCards,
    dismissCard,
    resetDismissedCards,
  }), [
    addEncounterAttachment,
    clearEncounterDraft,
    dismissCard,
    getCareTeamMember,
    getEncounterDraft,
    resetDismissedCards,
    selectedScenario,
    selectedScenarioId,
    setSelectedScenarioId,
    uiState.dismissedCards,
    updateEncounterDraft,
  ]);

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) {
    throw new Error('useDemo must be used within DemoProvider');
  }
  return context;
}
