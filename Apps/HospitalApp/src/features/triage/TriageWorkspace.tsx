// HospitalApp/src/features/triage/TriageWorkspace.tsx
// Full-page triage workspace that replaces the popup approach.
// Left panel: existing patient info. Right panel: triage assessment form.
// Drafts persist in localStorage until submitted.

import { useState, useEffect, useCallback, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import type { EncounterDetail, VitalSigns, CreateTriagePayload, TriageAssessment } from '../../shared/types/domain';
import { patientName } from '../../shared/types/domain';
import { createTriageAssessment, listTriageAssessments } from '../../shared/api/triage';
import { moveToWaiting } from '../../shared/api/encounters';
import { CTASBadge } from '../../shared/ui/Badge';
import { StatusPill } from '../../shared/ui/StatusPill';
import { useToast } from '../../shared/ui/ToastContext';

interface TriageWorkspaceProps {
  encounter: EncounterDetail;
  onClose: () => void;
  onComplete: () => void;
}

// ─── localStorage draft helpers ─────────────────────────────────────────────

interface TriageDraft {
  ctasLevel: number;
  painLevel: number;
  chiefComplaint: string;
  note: string;
  bloodPressure: string;
  heartRate: string;
  temperature: string;
}

interface StoredTriageDraft {
  draft: TriageDraft;
  savedAt: string;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
}

interface BrowserSpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface BrowserSpeechRecognitionConstructor {
  new (): BrowserSpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  }
}

const DRAFT_PREFIX = 'priage_triage_draft_';
const INFO_PANEL_DEFAULT_WIDTH = 420;
const INFO_PANEL_MIN_WIDTH = 320;
const FORM_PANEL_MIN_WIDTH = 460;
const SIDEBAR_HEADER_CLASS = 'text-sm font-semibold uppercase tracking-wide text-gray-900';
const SIDEBAR_SUBHEADER_CLASS = 'text-xs font-bold uppercase tracking-[0.2em] text-gray-800';
const TRIAGE_HEADER_CLASS = 'text-sm font-semibold uppercase tracking-wide text-gray-900';

const CTAS_OPTION_STYLES: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'bg-ctas-1 border-ctas-1 text-white shadow-md',
  2: 'bg-ctas-2 border-ctas-2 text-white shadow-md',
  3: 'bg-ctas-3 border-ctas-3 text-gray-900 shadow-md',
  4: 'bg-ctas-4 border-ctas-4 text-white shadow-md',
  5: 'bg-ctas-5 border-ctas-5 text-white shadow-md',
};

const CTAS_TEXT_STYLES: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'text-red-700',
  2: 'text-orange-700',
  3: 'text-amber-700',
  4: 'text-emerald-700',
  5: 'text-blue-700',
};

const CTAS_LEVEL_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'Resuscitation',
  2: 'Emergent',
  3: 'Urgent',
  4: 'Less Urgent',
  5: 'Non-Urgent',
};

function loadDraft(encounterId: number): TriageDraft | null {
  try {
    const raw = localStorage.getItem(`${DRAFT_PREFIX}${encounterId}`);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as TriageDraft | StoredTriageDraft;
    if (parsed && typeof parsed === 'object' && 'draft' in parsed) {
      return parsed.draft as TriageDraft;
    }

    return parsed as TriageDraft;
  } catch {
    return null;
  }
}

function loadDraftSavedAt(encounterId: number): string | null {
  try {
    const raw = localStorage.getItem(`${DRAFT_PREFIX}${encounterId}`);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as TriageDraft | StoredTriageDraft;
    if (parsed && typeof parsed === 'object' && 'savedAt' in parsed && typeof parsed.savedAt === 'string') {
      return parsed.savedAt;
    }

    return null;
  } catch {
    return null;
  }
}

function saveDraft(encounterId: number, draft: TriageDraft): string | null {
  try {
    const savedAt = new Date().toISOString();
    const storedDraft: StoredTriageDraft = { draft, savedAt };
    localStorage.setItem(`${DRAFT_PREFIX}${encounterId}`, JSON.stringify(storedDraft));
    return savedAt;
  } catch { /* quota exceeded — ignore */ }
  return null;
}

function clearDraft(encounterId: number) {
  localStorage.removeItem(`${DRAFT_PREFIX}${encounterId}`);
}

// ─── Microphone button (UI-only, not implemented) ───────────────────────────

function MicrophoneButton({
  onTranscriptChange,
  onStart,
  onStop,
  onStatusChange,
}: {
  onTranscriptChange?: (text: string) => void;
  onStart?: () => void;
  onStop?: () => void;
  onStatusChange?: (message: string | null) => void;
}) {
  const { showToast } = useToast();
  const [recording, setRecording] = useState(false);
  const [requestingPermission, setRequestingPermission] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const finalTranscriptRef = useRef('');
  const manualStopRef = useRef(false);
  const shouldContinueRef = useRef(false);
  const didHandleErrorRef = useRef(false);

  useEffect(() => () => {
    shouldContinueRef.current = false;
    recognitionRef.current?.abort();
    recognitionRef.current = null;
  }, []);

  const handleToggle = async () => {
    if (recording) {
      manualStopRef.current = true;
      shouldContinueRef.current = false;
      recognitionRef.current?.stop();
      onStatusChange?.('Stopping dictation…');
      return;
    }

    const SpeechRecognitionCtor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      showToast('Live dictation is not supported in this browser.', 'info');
      onStatusChange?.('Dictation is unavailable in this browser.');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      showToast('This device cannot request microphone access from the browser.', 'error');
      onStatusChange?.('Microphone access is unavailable on this device.');
      return;
    }

    setRequestingPermission(true);
    onStatusChange?.('Requesting microphone access…');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
    } catch (error) {
      const message = error instanceof DOMException && error.name === 'NotAllowedError'
        ? 'Microphone access was denied.'
        : 'Unable to access the device microphone.';
      showToast(message, 'error');
      onStatusChange?.(message);
      setRequestingPermission(false);
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || 'en-CA';
    finalTranscriptRef.current = '';
    manualStopRef.current = false;
    shouldContinueRef.current = true;
    didHandleErrorRef.current = false;

    recognition.onresult = (event) => {
      let interimTranscript = '';

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript?.trim();
        if (!transcript) {
          continue;
        }

        if (result.isFinal) {
          finalTranscriptRef.current += `${transcript} `;
        } else {
          interimTranscript = transcript;
        }
      }

      const previewText = `${finalTranscriptRef.current}${interimTranscript}`.trim();
      onTranscriptChange?.(previewText);
      onStatusChange?.(previewText ? `Listening… ${previewText}` : 'Listening…');
    };

    recognition.onerror = (event) => {
      didHandleErrorRef.current = true;
      shouldContinueRef.current = false;
      const message = event.error === 'not-allowed'
        ? 'Microphone access was denied.'
        : event.error === 'no-speech'
          ? 'No speech was detected. Try again when ready.'
          : 'Dictation stopped unexpectedly.';
      showToast(message, event.error === 'no-speech' ? 'info' : 'error');
      onStatusChange?.(message);
      onStop?.();
      setRecording(false);
      setRequestingPermission(false);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      if (didHandleErrorRef.current) {
        return;
      }

      if (shouldContinueRef.current && !manualStopRef.current) {
        try {
          recognition.start();
          onStatusChange?.('Listening…');
          return;
        } catch {
          shouldContinueRef.current = false;
        }
      }

      const transcript = finalTranscriptRef.current.trim();
      if (transcript) {
        onTranscriptChange?.(transcript);
      }

      onStatusChange?.(transcript ? 'Dictation added to notes.' : 'Dictation stopped.');
      onStop?.();
      setRecording(false);
      setRequestingPermission(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
      onStart?.();
      setRecording(true);
      setRequestingPermission(false);
      onStatusChange?.('Listening…');
    } catch {
      shouldContinueRef.current = false;
      recognitionRef.current = null;
      setRecording(false);
      setRequestingPermission(false);
      showToast('Dictation could not be started. Please try again.', 'error');
      onStatusChange?.('Dictation could not be started.');
      onStop?.();
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={requestingPermission}
      title={recording ? 'Stop dictation' : 'Start dictation'}
      className={`
        w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer
        disabled:cursor-wait disabled:opacity-70
        ${recording
          ? 'bg-red-100 text-red-600 border border-red-300 animate-pulse'
          : requestingPermission
            ? 'bg-amber-50 text-amber-700 border border-amber-200'
            : 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200'
        }
      `}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="5.5" y="1" width="5" height="9" rx="2.5" stroke="currentColor" strokeWidth="1.3" />
        <path d="M3 7.5a5 5 0 0 0 10 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M8 13v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    </button>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export function TriageWorkspace({ encounter, onClose, onComplete }: TriageWorkspaceProps) {
  const { showToast } = useToast();
  const p = encounter.patient;
  const name = patientName(p);
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const resizeStateRef = useRef<{ startX: number; startWidth: number } | null>(null);

  // Load existing assessments
  const [existingAssessments, setExistingAssessments] = useState<TriageAssessment[]>(
    encounter.triageAssessments ?? [],
  );
  const [loadingAssessments, setLoadingAssessments] = useState(false);
  const [infoPanelWidth, setInfoPanelWidth] = useState(INFO_PANEL_DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingAssessments(true);
      try {
        const list = await listTriageAssessments(encounter.id);
        if (!cancelled) setExistingAssessments(list);
      } catch { /* silent */ }
      finally { if (!cancelled) setLoadingAssessments(false); }
    })();
    return () => { cancelled = true; };
  }, [encounter.id]);

  // ─── Form state (loaded from draft or defaults) ───────────────────────

  const draft = loadDraft(encounter.id);

  const [ctasLevel, setCtasLevel] = useState(draft?.ctasLevel ?? 3);
  const [painLevel, setPainLevel] = useState(draft?.painLevel ?? 0);
  const [chiefComplaint, setChiefComplaint] = useState(
    draft?.chiefComplaint ?? encounter.chiefComplaint ?? '',
  );
  const [note, setNote] = useState(draft?.note ?? '');
  const [bloodPressure, setBloodPressure] = useState(draft?.bloodPressure ?? '');
  const [heartRate, setHeartRate] = useState(draft?.heartRate ?? '');
  const [temperature, setTemperature] = useState(draft?.temperature ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saving' | 'saved'>(loadDraftSavedAt(encounter.id) ? 'saved' : 'idle');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(loadDraftSavedAt(encounter.id));
  const [dictationStatus, setDictationStatus] = useState<string | null>(null);
  const [isDictating, setIsDictating] = useState(false);
  const shouldPersistDraftRef = useRef(true);
  const hasMountedRef = useRef(false);
  const noteRef = useRef(note);
  const dictationBaseNoteRef = useRef<string | null>(null);

  // ─── Auto-save draft on changes ──────────────────────────────────────

  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    noteRef.current = note;
  }, [note]);

  const draftSnapshot = useCallback((): TriageDraft => ({
    ctasLevel, painLevel, chiefComplaint, note,
    bloodPressure, heartRate, temperature,
  }), [ctasLevel, painLevel, chiefComplaint, note, bloodPressure, heartRate, temperature]);

  const persistDraftNow = useCallback(() => {
    if (!shouldPersistDraftRef.current) {
      return;
    }

    const savedAt = saveDraft(encounter.id, draftSnapshot());
    if (savedAt) {
      setLastSavedAt(savedAt);
      setDraftStatus('saved');
    }
  }, [encounter.id, draftSnapshot]);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    if (saveTimer.current) clearTimeout(saveTimer.current);
    setDraftStatus('saving');
    saveTimer.current = setTimeout(() => {
      persistDraftNow();
    }, 500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [encounter.id, draftSnapshot, persistDraftNow]);

  useEffect(() => {
    const handlePageHide = () => {
      persistDraftNow();
    };

    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handlePageHide);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handlePageHide);
    };
  }, [persistDraftNow]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
      persistDraftNow();
    };
  }, [persistDraftNow]);

  const clampInfoPanelWidth = useCallback((nextWidth: number) => {
    const containerWidth = workspaceRef.current?.getBoundingClientRect().width ?? window.innerWidth;
    const maxWidth = Math.max(
      INFO_PANEL_MIN_WIDTH,
      containerWidth - (containerWidth < 1100 ? 360 : FORM_PANEL_MIN_WIDTH),
    );

    return Math.min(Math.max(nextWidth, INFO_PANEL_MIN_WIDTH), maxWidth);
  }, []);

  useEffect(() => {
    const syncWidth = () => {
      setInfoPanelWidth((current) => clampInfoPanelWidth(current));
    };

    syncWidth();
    window.addEventListener('resize', syncWidth);
    return () => window.removeEventListener('resize', syncWidth);
  }, [clampInfoPanelWidth]);

  useEffect(() => {
    if (!isResizing) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const resizeState = resizeStateRef.current;
      if (!resizeState) {
        return;
      }

      const delta = event.clientX - resizeState.startX;
      setInfoPanelWidth(clampInfoPanelWidth(resizeState.startWidth + delta));
    };

    const stopResizing = () => {
      resizeStateRef.current = null;
      setIsResizing(false);
    };

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopResizing);
    window.addEventListener('pointercancel', stopResizing);

    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopResizing);
      window.removeEventListener('pointercancel', stopResizing);
    };
  }, [clampInfoPanelWidth, isResizing]);

  const handleResizeStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    resizeStateRef.current = {
      startX: event.clientX,
      startWidth: infoPanelWidth,
    };
    setIsResizing(true);
    event.preventDefault();
  };

  const handleResizeReset = () => {
    setInfoPanelWidth(clampInfoPanelWidth(INFO_PANEL_DEFAULT_WIDTH));
  };

  // ─── Submit ──────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setError(null);
    setDictationStatus(null);
    setSubmitting(true);

    try {
      const vitalSigns: VitalSigns = {};
      if (bloodPressure) vitalSigns.bloodPressure = bloodPressure;
      if (heartRate) vitalSigns.heartRate = Number(heartRate);
      if (temperature) vitalSigns.temperature = Number(temperature);

      const payload: CreateTriagePayload = {
        encounterId: encounter.id,
        ctasLevel,
        painLevel,
        chiefComplaint: chiefComplaint || undefined,
        vitalSigns: Object.keys(vitalSigns).length > 0 ? vitalSigns : undefined,
        note: note || undefined,
      };

      await createTriageAssessment(payload);
      await moveToWaiting(encounter.id);
      shouldPersistDraftRef.current = false;
      clearDraft(encounter.id);
      showToast('Triage completed and patient moved to waiting.', 'success');
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete triage');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Medical alerts from patient record ──────────────────────────────

  const warnings: string[] = [];
  if (p.allergies) warnings.push(`Allergies: ${p.allergies}`);
  if (p.conditions) warnings.push(`Conditions: ${p.conditions}`);

  const healthInfo = p.optionalHealthInfo as Record<string, unknown> | null;
  const selectedCtasTextClass = CTAS_TEXT_STYLES[ctasLevel as 1 | 2 | 3 | 4 | 5] ?? 'text-gray-700';

  const mergeTranscriptIntoNote = useCallback((baseNote: string, transcript: string) => {
    const cleanedTranscript = transcript.trim();
    if (!cleanedTranscript) {
      return baseNote;
    }

    const trimmedNote = baseNote.trimEnd();
    if (!trimmedNote) {
      return cleanedTranscript;
    }

    const separator = /[.!?]$/.test(trimmedNote) ? ' ' : '\n';
    return `${trimmedNote}${separator}${cleanedTranscript}`;
  }, []);

  const handleDictationStart = useCallback(() => {
    dictationBaseNoteRef.current = noteRef.current;
    setIsDictating(true);
    setDictationStatus('Listening…');
  }, []);

  const handleTranscriptChange = useCallback((transcript: string) => {
    const nextNote = mergeTranscriptIntoNote(dictationBaseNoteRef.current ?? noteRef.current, transcript);
    setNote(nextNote);
  }, [mergeTranscriptIntoNote]);

  const handleDictationStop = useCallback(() => {
    dictationBaseNoteRef.current = null;
    setIsDictating(false);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to list
          </button>
          <div className="h-5 w-px bg-gray-200" />
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-priage-600 text-white flex items-center justify-center text-xs font-bold">
              {initials}
            </div>
            <div>
              <div className="font-semibold text-gray-900 text-sm">{name}</div>
              <div className="text-xs text-gray-500 flex items-center gap-2">
                #{encounter.id}
                <StatusPill status={encounter.status} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">
            {draftStatus === 'saving'
              ? 'Saving draft...'
              : lastSavedAt
                ? `Draft saved ${new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : 'Draft not saved yet'}
          </span>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-5 py-2.5 bg-accent-600 text-white rounded-lg text-sm font-semibold hover:bg-accent-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            {submitting ? 'Completing…' : 'Complete Triage & Move to Waiting'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-3 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Two-column layout ────────────────────────────────────────── */}
      <div ref={workspaceRef} className="flex flex-1 overflow-hidden">
        {/* LEFT: Patient info */}
        <div
          style={{ width: infoPanelWidth }}
          className="min-h-0 shrink-0 overflow-y-auto border-r border-gray-200 bg-white p-6 space-y-6"
        >
          <h3 className={SIDEBAR_HEADER_CLASS}>Patient Information</h3>

          <div className="grid grid-cols-2 gap-2.5">
            <InfoField label="Full Name" value={name} />
            <InfoField label="Age" value={p.age ? `${p.age} years` : 'N/A'} />
            <InfoField label="Gender" value={p.gender ?? 'N/A'} />
            <InfoField label="Phone" value={p.phone ?? 'N/A'} />
            <InfoField label="Language" value={p.preferredLanguage ?? 'English'} />
            <InfoField label="Encounter" value={`#${encounter.id}`} />
          </div>

          {/* Chief Complaint */}
          <div>
            <h3 className={`${SIDEBAR_HEADER_CLASS} mb-3 text-base`}>Chief Complaint</h3>
            <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
              <p className="m-0 text-[1.05rem] font-semibold leading-7 text-slate-900">
                {encounter.chiefComplaint ?? 'No complaint recorded'}
              </p>
              {encounter.details && (
                <p className="mt-2 m-0 text-sm leading-6 text-slate-700">{encounter.details}</p>
              )}
            </div>
          </div>

          {encounter.priageSummary && (
            <div>
              <h3 className={`${SIDEBAR_HEADER_CLASS} mb-3`}>Priage Intake Handoff</h3>
              <div className="space-y-3">
                <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={SIDEBAR_SUBHEADER_CLASS}>AI Briefing</span>
                    {encounter.priageSummary.recommendedCtasLevel != null && (
                      <CTASBadge level={encounter.priageSummary.recommendedCtasLevel as 1 | 2 | 3 | 4 | 5} />
                    )}
                  </div>
                  <p className="mt-2 m-0 text-base leading-7 text-sky-950">{encounter.priageSummary.briefing}</p>
                </div>

                <div className="rounded-lg bg-gray-50 px-4 py-3">
                  <div className={SIDEBAR_SUBHEADER_CLASS}>Case Summary</div>
                  <p className="mt-2 m-0 text-base leading-7 text-gray-800">{encounter.priageSummary.caseSummary}</p>
                </div>

                {encounter.priageSummary.progressionRisks.length > 0 && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
                    <div className={SIDEBAR_SUBHEADER_CLASS}>Progression Risks</div>
                    <ul className="mt-2 space-y-2 pl-5 text-base leading-7 text-rose-900">
                      {encounter.priageSummary.progressionRisks.map((risk) => (
                        <li key={risk}>{risk}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {encounter.priageSummary.questionAnswers.length > 0 && (
                  <div className="space-y-3">
                    <div className={SIDEBAR_SUBHEADER_CLASS}>Question Log</div>
                    {encounter.priageSummary.questionAnswers.map((item, index) => (
                      <div key={`${item.answeredAt}-${index}`} className="rounded-lg border border-gray-200 bg-white px-4 py-3">
                        <div className="text-[13px] font-semibold uppercase tracking-wide text-gray-700">Question</div>
                        <div className="mt-1 text-base leading-7 text-gray-900">{item.question}</div>
                        <div className="mt-3 text-[13px] font-semibold uppercase tracking-wide text-gray-700">Answer</div>
                        <div className="mt-1 text-base leading-7 text-gray-900">{item.answer}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Medical Alerts */}
          {warnings.length > 0 && (
            <div>
              <h3 className={`${SIDEBAR_HEADER_CLASS} mb-3`}>Medical Alerts</h3>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                {warnings.map((w, i) => (
                  <p key={i} className="m-0 mt-2 first:mt-0 text-base leading-7 text-red-800">⚠ {w}</p>
                ))}
              </div>
            </div>
          )}

          {/* Pre-Triage Answers */}
          {healthInfo && Object.keys(healthInfo).length > 0 && (
            <div>
              <h3 className={`${SIDEBAR_HEADER_CLASS} mb-3`}>Pre-Triage Form</h3>
              <div className="space-y-2">
                {Object.entries(healthInfo).map(([key, value]) => {
                  if (value == null || value === '') return null;
                  const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
                  return (
                    <div key={key} className="rounded-lg bg-gray-50 px-4 py-3">
                      <div className="text-xs font-semibold uppercase tracking-wider text-gray-600">{label}</div>
                      <div className="mt-1 text-base leading-7 text-gray-800">{String(value)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Previous Assessments */}
          {existingAssessments.length > 0 && (
            <div>
              <h3 className={`${SIDEBAR_HEADER_CLASS} mb-3`}>
                Previous Assessments ({existingAssessments.length})
              </h3>
              <div className="space-y-2">
                {existingAssessments.map((a) => (
                  <div key={a.id} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <CTASBadge level={a.ctasLevel as 1|2|3|4|5} />
                      <span className="text-xs text-gray-500">
                        {new Date(a.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    {a.note && <p className="m-0 text-base leading-7 text-gray-700">{a.note}</p>}
                    {a.vitalSigns && (
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
                        {a.vitalSigns.heartRate && <span>HR: {a.vitalSigns.heartRate}</span>}
                        {a.vitalSigns.bloodPressure && <span>BP: {a.vitalSigns.bloodPressure}</span>}
                        {a.vitalSigns.temperature && <span>Temp: {a.vitalSigns.temperature}°C</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {loadingAssessments && (
            <p className="text-xs text-gray-400">Loading assessments…</p>
          )}
        </div>

        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize encounter information panel"
          aria-valuemin={INFO_PANEL_MIN_WIDTH}
          aria-valuenow={Math.round(infoPanelWidth)}
          onPointerDown={handleResizeStart}
          onDoubleClick={handleResizeReset}
          className={`
            group relative z-10 flex w-4 shrink-0 cursor-col-resize touch-none items-stretch justify-center
            bg-white/80 transition-colors hover:bg-slate-100
            ${isResizing ? 'bg-slate-100' : ''}
          `}
          title="Drag to resize encounter information"
        >
          <div className="my-4 w-px rounded-full bg-gray-200 transition-colors group-hover:bg-priage-400" />
          <div className="pointer-events-none absolute inset-y-1/2 left-1/2 h-10 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-sm ring-1 ring-gray-200 transition-colors group-hover:bg-priage-50 group-hover:ring-priage-300" />
        </div>

        {/* RIGHT: Triage form */}
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-6">
          <div className="max-w-[640px] mx-auto space-y-6">
            <h3 className="text-[1.3rem] font-bold text-gray-900 m-0">Triage Assessment</h3>

            {/* CTAS Level */}
            <div>
              <label className={`block mb-2 ${TRIAGE_HEADER_CLASS}`}>
                CTAS Level (1–5)
              </label>
              <div className="flex gap-2">
                {([1, 2, 3, 4, 5] as const).map(level => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setCtasLevel(level)}
                    className={`
                      flex-1 py-3 rounded-lg text-[1.15rem] font-semibold transition-all cursor-pointer
                      ${ctasLevel === level
                        ? `border-2 ${CTAS_OPTION_STYLES[level]}`
                        : 'bg-white text-gray-800 border border-gray-300 hover:border-priage-300'
                      }
                    `}
                  >
                    {level}
                  </button>
                ))}
              </div>
              {ctasLevel && (
                <div className="mt-2 flex items-center gap-2">
                  <CTASBadge level={ctasLevel as 1|2|3|4|5} />
                  <span className={`text-sm font-semibold ${selectedCtasTextClass}`}>
                    {CTAS_LEVEL_LABELS[ctasLevel as 1 | 2 | 3 | 4 | 5]}
                  </span>
                </div>
              )}
            </div>

            {/* Pain Level */}
            <div>
              <label className={`block mb-2 ${TRIAGE_HEADER_CLASS}`}>
                Pain Level: <span className="text-gray-900 text-[1.05rem]">{painLevel}/10</span>
              </label>
              <input
                type="range"
                min={0}
                max={10}
                value={painLevel}
                onChange={(e) => setPainLevel(Number(e.target.value))}
                className="w-full accent-priage-600"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>No pain</span>
                <span>Worst possible</span>
              </div>
            </div>

            {/* Chief Complaint (editable) */}
            <div>
              <label className={`block mb-2 ${TRIAGE_HEADER_CLASS}`}>
                Chief Complaint (nurse assessment)
              </label>
              <input
                type="text"
                value={chiefComplaint}
                onChange={(e) => setChiefComplaint(e.target.value)}
                placeholder="e.g. Severe abdominal pain with nausea"
                maxLength={240}
                className="w-full px-3.5 py-3 border border-gray-200 rounded-lg text-[1.05rem] bg-white focus:outline-none focus:ring-2 focus:ring-priage-300"
              />
            </div>

            {/* Vital Signs */}
            <div>
              <label className={`block mb-2 ${TRIAGE_HEADER_CLASS}`}>
                Vital Signs
              </label>
              <p className="text-sm text-gray-500 mb-3 -mt-1">
                Record values measured during examination.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <VitalField
                  label="Blood Pressure"
                  value={bloodPressure}
                  onChange={setBloodPressure}
                  placeholder="120/80"
                  unit="mmHg"
                />
                <VitalField
                  label="Heart Rate"
                  value={heartRate}
                  onChange={setHeartRate}
                  placeholder="72"
                  unit="bpm"
                  type="number"
                />
                <VitalField
                  label="Temperature"
                  value={temperature}
                  onChange={setTemperature}
                  placeholder="37.0"
                  unit="°C"
                  type="number"
                  step="0.1"
                />
              </div>
            </div>

            {/* Notes with microphone */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[1.1rem] font-bold uppercase tracking-[0.16em] text-gray-950">
                  Triage Notes
                </label>
                <MicrophoneButton
                  onTranscriptChange={handleTranscriptChange}
                  onStart={handleDictationStart}
                  onStop={handleDictationStop}
                  onStatusChange={setDictationStatus}
                />
              </div>
              <div className="mb-3 min-h-[2.75rem] rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-800">
                {dictationStatus
                  ? dictationStatus
                  : isDictating
                    ? 'Listening…'
                    : 'Tap the microphone to dictate notes live into this field.'}
              </div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Clinical observations, patient presentation, relevant history…"
                rows={5}
                className="w-full px-3.5 py-3 border border-gray-200 rounded-lg text-[1.05rem] bg-white resize-y focus:outline-none focus:ring-2 focus:ring-priage-300"
              />
            </div>

            {/* Submit */}
            <div className="pt-2 border-t border-gray-200">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-700 mb-4">
                  {error}
                </div>
              )}
              <div className="flex items-center justify-between">
                <button
                  onClick={onClose}
                  className="px-4 py-2.5 text-[1.05rem] font-medium text-gray-600 hover:text-gray-800 cursor-pointer bg-transparent border-0"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="px-6 py-3 bg-accent-600 text-white rounded-lg text-[1.05rem] font-semibold hover:bg-accent-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  {submitting ? 'Completing…' : 'Complete Triage & Move to Waiting'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-gray-600">{label}</div>
      <div className="mt-1 text-base font-medium leading-7 text-gray-800">{value}</div>
    </div>
  );
}

function VitalField({
  label, value, onChange, placeholder, unit, type = 'text', step, hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  unit: string;
  type?: string;
  step?: string;
  hint?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <span className="text-xs text-gray-500">{unit}</span>
      </div>
      <input
        type={type}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-[1.05rem] bg-white focus:outline-none focus:ring-2 focus:ring-priage-300"
      />
      {hint && <span className="text-xs text-gray-500 mt-0.5 block">{hint}</span>}
    </div>
  );
}
