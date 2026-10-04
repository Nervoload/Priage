import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../../../shared/api/client';
import { getCareState, saveCareNote, type CareState } from '../../../shared/api/care';
import { getSocket, subscribeToEncounterRealtime } from '../../../shared/realtime/socket';
import { RealtimeEvents } from '../../../shared/types/domain';
import { describeError, isConflict } from '../ui/errors';
import { appendToNote } from './careModel';

export type NoteSaveStatus = 'saved' | 'unsaved' | 'saving' | 'failed' | 'conflict';

export function careError(cause: unknown, fallback: string): string {
  if (isConflict(cause)) return 'This visit changed on another screen. The latest version is loaded; review it, then try again.';
  return describeError(cause, fallback);
}

/**
 * Loads one Care visit and keeps its physician note autosaved.
 *
 * The note draft lives in memory only. Saves are debounced, carry the version
 * they were based on, and a newer server version never overwrites local edits:
 * it becomes a conflict for the clinician to resolve.
 */
export function useCareWorkspace(id: number, onChanged: () => void) {
  const [state, setState] = useState<CareState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [noteDraft, setNoteDraftState] = useState('');
  const [saveStatus, setSaveStatus] = useState<NoteSaveStatus>('saved');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ text: string; version: number } | null>(null);
  const [saveCycle, setSaveCycle] = useState(0);
  const savedTextRef = useRef('');
  const noteVersionRef = useRef(0);
  const draftRef = useRef('');
  const savingRef = useRef(false);
  const failedDraftRef = useRef<string | null>(null);
  const saveErrorRef = useRef('');

  const apply = useCallback((next: CareState, force = false) => {
    setState(next);
    if (force || draftRef.current === savedTextRef.current) {
      draftRef.current = next.note.text;
      savedTextRef.current = next.note.text;
      noteVersionRef.current = next.note.version;
      setNoteDraftState(next.note.text);
      setConflict(null);
      setSaveStatus('saved');
      setSavedAt(next.note.updatedAt);
    } else if (!savingRef.current && next.note.version !== noteVersionRef.current && next.note.text !== savedTextRef.current) {
      setConflict({ text: next.note.text, version: next.note.version });
      setSaveStatus('conflict');
    }
  }, []);

  const refresh = useCallback(async () => {
    try { apply(await getCareState(id)); setError(''); }
    catch (cause) { setError(careError(cause, 'This visit didn’t load. Check the connection; it retries on its own.')); }
    finally { setLoading(false); }
  }, [apply, id]);

  useEffect(() => {
    void refresh();
    const socket = getSocket();
    const onUpdate = (payload: { encounterId?: number }) => { if (payload.encounterId === id) void refresh(); };
    const onFocus = () => void refresh();
    socket.on(RealtimeEvents.EncounterUpdated, onUpdate);
    socket.on('connect', onFocus);
    window.addEventListener('focus', onFocus);
    void subscribeToEncounterRealtime([id]).catch(() => { /* polling below is the fallback */ });
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => { socket.off(RealtimeEvents.EncounterUpdated, onUpdate); socket.off('connect', onFocus); window.removeEventListener('focus', onFocus); window.clearInterval(timer); };
  }, [id, refresh]);

  useEffect(() => {
    if (!state || state.encounter.status !== 'CARE' || noteDraft === savedTextRef.current || conflict || savingRef.current || failedDraftRef.current === noteDraft) return;
    setSaveStatus('unsaved');
    const timer = window.setTimeout(async () => {
      const text = draftRef.current;
      savingRef.current = true;
      setSaveStatus('saving');
      try {
        const next = await saveCareNote(id, text, noteVersionRef.current);
        savedTextRef.current = text;
        failedDraftRef.current = null;
        noteVersionRef.current = next.note.version;
        setState(next);
        setSavedAt(next.note.updatedAt);
        setSaveStatus(draftRef.current === text ? 'saved' : 'unsaved');
        // A save that works clears its own earlier failure, and nothing else.
        setError((current) => (current && current === saveErrorRef.current ? '' : current));
      } catch (cause) {
        failedDraftRef.current = text;
        setSaveStatus('failed');
        saveErrorRef.current = careError(cause, 'The note didn’t save. Your text is still here; retry when the connection is back.');
        setError(saveErrorRef.current);
        if (cause instanceof ApiError && cause.status === 409) { savingRef.current = false; void refresh(); }
      } finally { savingRef.current = false; setSaveCycle((value) => value + 1); }
    }, 900);
    return () => window.clearTimeout(timer);
  }, [conflict, id, noteDraft, refresh, saveCycle, state]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (draftRef.current !== savedTextRef.current) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  async function run(action: () => Promise<CareState>, fallback = 'That didn’t save. Try again.'): Promise<boolean> {
    setBusy(true); setError('');
    try { apply(await action()); onChanged(); return true; }
    catch (cause) { setError(careError(cause, fallback)); if (isConflict(cause)) await refresh(); return false; }
    finally { setBusy(false); }
  }

  const setNoteDraft = useCallback((text: string) => {
    failedDraftRef.current = null;
    draftRef.current = text;
    setNoteDraftState(text);
  }, []);

  /** Adds a line to the latest draft, even if the clinician typed while a request was in flight. */
  const appendToDraft = useCallback((line: string) => setNoteDraft(appendToNote(draftRef.current, line)), [setNoteDraft]);

  const retrySave = useCallback(() => { failedDraftRef.current = null; setSaveCycle((value) => value + 1); }, []);

  const acceptServerNote = useCallback(() => {
    if (!conflict) return;
    draftRef.current = conflict.text;
    savedTextRef.current = conflict.text;
    noteVersionRef.current = conflict.version;
    setNoteDraftState(conflict.text);
    setConflict(null);
    setSaveStatus('saved');
  }, [conflict]);

  const keepMineAndSave = useCallback(() => {
    if (!conflict) return;
    failedDraftRef.current = null;
    savedTextRef.current = conflict.text;
    noteVersionRef.current = conflict.version;
    setConflict(null);
    setSaveStatus('unsaved');
    setSaveCycle((value) => value + 1);
  }, [conflict]);

  const isDirty = useCallback(() => draftRef.current !== savedTextRef.current, []);

  return {
    state, loading, error, setError, busy, run, refresh,
    noteDraft, setNoteDraft, appendToDraft, saveStatus, savedAt, conflict, retrySave, acceptServerNote, keepMineAndSave, isDirty,
    noteVersion: () => noteVersionRef.current,
    noteSaved: noteDraft === savedTextRef.current && !conflict && saveStatus !== 'failed' && !savingRef.current,
  };
}
