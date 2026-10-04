import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addCareComment, addCareQuestion, auditCareCopy, clearCareFeedback, finishCare, getCareExport, saveCareNote, setCareFeedback, startCare, updateCareQuestion,
  type CareFeedbackKind, type CareSegment, type CareState,
} from '../../../shared/api/care';
import { useLeaveGuard } from '../ui/ClinicShell';
import { Button, IconButton, StatusLine, Tabs, cx, tabIds, type Tone } from '../ui/controls';
import { Icon } from '../ui/Icon';
import { useClinicToast } from '../ui/toast';
import { BeforeYouGoIn, type AskInRoomActions } from './BeforeYouGoIn';
import { AmendNoteDialog, CopyChartDialog, FeedbackNoteDialog, FinishVisitDialog, NoteConflictDialog, StartUrgentDialog, UnsavedNoteDialog } from './CareDialogs';
import {
  askLineForNote, clockTime, copySectionFor, dateTime, feedbackFor, normalizeSnapshot, patientMeta, quoteForNote, tabForSegment,
  type EvidenceTab,
} from './careModel';
import { EvidencePanel } from './EvidencePanels';
import { ReadingProvider, SelectionToolbar, type ReadingContextValue } from './reading';
import { careError, useCareWorkspace } from './useCareWorkspace';
import { useSegmentSelection } from './useSegmentSelection';
import { YourWork, type PendingComment, type WorkTab } from './YourWork';

type DialogKind = 'start' | 'finish' | 'conflict' | 'amend' | 'chart' | 'leave';
const NO_SEGMENTS: ReadonlyMap<string, CareSegment> = new Map();
const PENDING_ID = -1;

interface FeedbackDraft { mode: 'not_right' | 'missing'; segmentId?: string; sectionKey: string; quote: string; existingNote: string | null; existing: boolean }

function visitStatus(state: CareState): { tone: Tone; text: string } {
  const { encounter } = state;
  if (encounter.status === 'COMPLETE') return { tone: 'green', text: `Finished ${dateTime(encounter.departedAt)}` };
  if (encounter.status === 'CARE') return { tone: 'blue', text: `In Care since ${clockTime(encounter.seenAt)}` };
  return state.assessmentStatus === 'complete'
    ? { tone: 'blue', text: 'Assessment finished, ready for Care' }
    : { tone: 'amber', text: 'Assessment not finished yet' };
}

export function CareWorkspace({ id, onBack, onChanged }: { id: number; onBack: () => void; onChanged: () => void }) {
  const ws = useCareWorkspace(id, onChanged);
  const toast = useClinicToast();
  const [snapshotId, setSnapshotId] = useState<number | null>(null);
  const [tab, setTab] = useState<EvidenceTab>('answers');
  const [workTab, setWorkTab] = useState<WorkTab>('note');
  const [pendingComment, setPendingComment] = useState<PendingComment | null>(null);
  const [activeCommentId, setActiveCommentId] = useState<number | null>(null);
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const [amending, setAmending] = useState<{ reason: string } | null>(null);
  const [reading, setReading] = useState(false);
  const [body, setBody] = useState<HTMLElement | null>(null);
  const [feedbackDraft, setFeedbackDraft] = useState<FeedbackDraft | null>(null);
  const afterLeave = useRef<(() => void) | null>(null);
  const feedbackHandler = useRef<ReadingContextValue['onFeedback']>(() => undefined);

  const state = ws.state;
  const snapshot = state ? state.snapshots.find((item) => item.id === snapshotId) ?? state.snapshot : null;
  const view = useMemo(() => (snapshot ? normalizeSnapshot(snapshot.content) : null), [snapshot]);
  const { selection, clear } = useSegmentSelection(body, view?.segments ?? NO_SEGMENTS);
  const feedback = useMemo(() => feedbackFor(state?.myFeedback, snapshot?.id), [snapshot?.id, state?.myFeedback]);
  const askQuestions = useMemo(
    () => new Map((state?.openQuestions ?? []).filter((question) => question.sourceSegmentId && question.snapshotId === snapshot?.id).map((question) => [question.sourceSegmentId as string, question])),
    [snapshot?.id, state?.openQuestions],
  );

  const isComplete = state?.encounter.status === 'COMPLETE';
  const canWrite = !!state && state.allowedActions.edit && state.encounter.status === 'CARE';
  const patientName = state ? [state.encounter.patient.firstName, state.encounter.patient.lastName].filter(Boolean).join(' ') || 'Patient' : '';

  const openDialog = (kind: DialogKind) => { ws.setError(''); setDialog(kind); };

  // Leaving with a note that hasn't saved asks first, in our own dialog.
  const guardLeave = useCallback((proceed: () => void) => {
    if (!ws.isDirty()) return true;
    afterLeave.current = proceed;
    setDialog('leave');
    return false;
  }, [ws]);
  useLeaveGuard(guardLeave);

  const reveal = useCallback((segmentId: string) => {
    const target = tabForSegment(segmentId);
    if (target) setTab(target);
    // Wait for the tab to render before looking for the passage.
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      const element = body?.querySelector<HTMLElement>(`[data-segment-id="${CSS.escape(segmentId)}"]`);
      if (!element) return;
      element.closest('details')?.setAttribute('open', '');
      element.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      element.classList.add('care-flash');
      window.setTimeout(() => element.classList.remove('care-flash'), 1400);
    }));
  }, [body]);

  // One stable callback for the reading context; the handler below always sees the latest state.
  const onFeedback = useCallback<ReadingContextValue['onFeedback']>((target, kind) => feedbackHandler.current(target, kind), []);

  const openComment = useCallback((commentId: number) => {
    setWorkTab('comments');
    if (commentId !== PENDING_ID) setActiveCommentId(commentId);
  }, []);

  useEffect(() => {
    if (!reading) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !dialog && !selection) setReading(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog, reading, selection]);

  const readingValue = useMemo<ReadingContextValue | null>(() => {
    if (!view || !snapshot || !state) return null;
    const comments = pendingComment && pendingComment.snapshotId === snapshot.id
      ? [...state.comments, { id: PENDING_ID, ...pendingComment, text: '', version: 0, resolvedAt: null, actorUserId: 0, updatedAt: '' }]
      : state.comments;
    return {
      view, snapshotId: snapshot.id, comments, activeCommentId: pendingComment ? PENDING_ID : activeCommentId, onOpenComment: openComment, reveal,
      feedback, canFeedback: !!state.allowedActions.feedback, onFeedback,
    };
  }, [activeCommentId, feedback, onFeedback, openComment, pendingComment, reveal, snapshot, state, view]);

  if (ws.loading) return <div className="flex h-[calc(100vh-56px)] items-center justify-center text-sm text-ink-2 lg:h-screen">Loading the visit…</div>;
  if (!state) {
    return (
      <div className="flex h-[calc(100vh-56px)] flex-col items-center justify-center gap-4 px-6 text-center lg:h-screen">
        <p role="alert" className="text-[15px] text-ink-2">{ws.error || 'This visit isn’t available.'}</p>
        <div className="flex gap-2"><Button onClick={onBack}>Back to Care queue</Button><Button variant="primary" onClick={() => void ws.refresh()}>Try again</Button></div>
      </div>
    );
  }

  const status = visitStatus(state);
  const evidenceIds = tabIds('care-evidence', tab);

  feedbackHandler.current = (target, kind) => {
    if (!snapshot || !view) return;
    const targetKey = kind === 'MISSING' ? `missing:${target.sectionKey}` : target.segmentId ?? '';
    const mine = feedback.get(targetKey);
    if (kind === null) { void ws.run(() => clearCareFeedback(id, snapshot.id, targetKey), 'Your feedback didn’t clear. Try again.'); return; }
    if (kind === 'USEFUL') { void ws.run(() => setCareFeedback(id, { snapshotId: snapshot.id, kind, segmentId: target.segmentId }), 'Your feedback didn’t save. Try again.'); return; }
    const segment = target.segmentId ? view.segments.get(target.segmentId) : undefined;
    ws.setError('');
    setFeedbackDraft({
      mode: kind === 'MISSING' ? 'missing' : 'not_right', segmentId: target.segmentId, sectionKey: target.sectionKey ?? segment?.section ?? '',
      quote: segment?.text ?? '', existingNote: mine?.kind === kind ? mine.note : null, existing: mine?.kind === kind,
    });
  };

  async function saveFeedback(kind: CareFeedbackKind, note: string) {
    if (!feedbackDraft || !snapshot) return;
    const draft = feedbackDraft;
    const ok = await ws.run(() => setCareFeedback(id, { snapshotId: snapshot.id, kind, segmentId: draft.mode === 'missing' ? undefined : draft.segmentId, sectionKey: draft.mode === 'missing' ? draft.sectionKey : undefined, note: note || undefined }), 'Your feedback didn’t save. Try again.');
    if (ok) { setFeedbackDraft(null); toast.show({ message: 'Feedback saved' }); }
  }

  const ask: AskInRoomActions = {
    canTick: canWrite && !!snapshot && view?.schemaVersion === 2,
    busy: ws.busy,
    questions: askQuestions,
    onTick: (segmentId, text, asked) => {
      const existing = askQuestions.get(segmentId);
      if (existing) void ws.run(() => updateCareQuestion(id, existing.id, { expectedVersion: existing.version, addressed: asked }), 'That didn’t save. Try again.');
      else if (asked && snapshot) void ws.run(() => addCareQuestion(id, text, { snapshotId: snapshot.id, sourceSegmentId: segmentId, addressed: true }), 'That didn’t save. Try again.');
    },
    onAnswer: async (segmentId, answer) => {
      const existing = askQuestions.get(segmentId);
      if (!existing) return false;
      const first = !existing.answerText;
      const ok = await ws.run(() => updateCareQuestion(id, existing.id, { expectedVersion: existing.version, answerText: answer.trim() }), 'Their answer didn’t save. Try again.');
      if (ok && first) { ws.appendToDraft(askLineForNote(existing.text, answer)); toast.show({ message: 'Added to your note' }); }
      return ok;
    },
  };

  function leave(proceed: () => void) {
    if (guardLeave(proceed)) proceed();
  }

  function start() {
    if (state!.assessmentStatus === 'complete') {
      void ws.run(() => startCare(id), 'Care didn’t start. Try again.').then((ok) => { if (ok) setWorkTab('note'); });
    } else {
      openDialog('start');
    }
  }

  function commentOnSelection() {
    if (!selection?.valid || !selection.segmentId || !snapshot) return;
    setPendingComment({ snapshotId: snapshot.id, segmentId: selection.segmentId, startOffset: selection.start, endOffset: selection.end, quote: selection.quote });
    setActiveCommentId(null);
    setWorkTab('comments');
    clear();
  }

  async function copySelection() {
    if (!selection?.segmentId) return;
    const segment = view?.segments.get(selection.segmentId);
    try {
      await auditCareCopy(id, copySectionFor(selection.segmentId, segment), snapshot?.id);
      await navigator.clipboard.writeText(selection.quote);
      toast.show({ message: 'Copied' });
    } catch {
      toast.show({ message: 'That didn’t copy. Try again.', tone: 'error' });
    }
    clear();
  }

  function quoteSelection() {
    if (!selection?.segmentId) return;
    ws.appendToDraft(quoteForNote(view?.segments.get(selection.segmentId), selection.quote));
    setWorkTab('note');
    toast.show({ message: 'Quoted in your note' });
    clear();
  }

  async function submitComment(text: string): Promise<boolean> {
    if (!pendingComment) return false;
    const ok = await ws.run(() => addCareComment(id, { ...pendingComment, text }), 'The comment didn’t save. Try again.');
    if (ok) setPendingComment(null);
    return ok;
  }

  function jumpToComment(comment: CareState['comments'][number]) {
    setActiveCommentId(comment.id);
    if (snapshot && comment.snapshotId !== snapshot.id) setSnapshotId(comment.snapshotId);
    reveal(comment.segmentId);
  }

  async function downloadExport() {
    if (ws.isDirty()) { toast.show({ message: 'Wait for the note to save, then download.', tone: 'error' }); return; }
    try {
      const result = await getCareExport(id);
      const url = URL.createObjectURL(new Blob([result.text], { type: 'text/plain;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      toast.show({ message: careError(cause, 'The chart didn’t download. Try again.'), tone: 'error' });
    }
  }

  async function finish() {
    const ok = await ws.run(() => finishCare(id, ws.noteVersion()), 'The visit didn’t finish. Try again.');
    if (ok) { setDialog(null); toast.show({ message: `${patientName}’s visit is finished` }); }
  }

  async function saveAmendment(text: string): Promise<boolean> {
    if (!amending) return false;
    const ok = await ws.run(() => saveCareNote(id, text, state!.note.version, amending.reason), 'The amendment didn’t save. Try again.');
    if (ok) { setAmending(null); toast.show({ message: 'Amendment saved' }); }
    return ok;
  }

  const viewingOlder = !!snapshot && !!state.snapshot && snapshot.id !== state.snapshot.id;

  return (
    <div className={cx('flex min-h-0 flex-col bg-paper', reading ? 'fixed inset-0 z-[70]' : 'h-[calc(100vh-56px)] lg:h-screen')}>
      <header className="flex shrink-0 flex-col gap-3 border-b border-line px-4 pb-4 pt-3 sm:px-7">
        <div className="flex flex-wrap items-center gap-2">
          {reading
            ? <Button variant="quiet" size="sm" icon="collapse" onClick={() => setReading(false)}>Exit reading view</Button>
            : <Button variant="quiet" size="sm" icon="back" onClick={() => leave(onBack)}>Care queue</Button>}
          <span className="flex-1" />
          {state.allowedActions.start && <Button variant="primary" busy={ws.busy && dialog === null} onClick={start}>Start Care</Button>}
          {state.allowedActions.finish && <Button variant="primary" onClick={() => openDialog('finish')}>Finish visit</Button>}
          <Button icon="copy" onClick={() => setDialog('chart')}>Copy chart</Button>
          <IconButton icon="download" label="Download chart text" outlined onClick={() => void downloadExport()} />
          {!reading && <span className="hidden lg:contents"><IconButton icon="expand" label="Reading view" outlined onClick={() => { setReading(true); setWorkTab('comments'); }} /></span>}
        </div>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="font-display text-[34px] leading-none tracking-[-0.01em]">{patientName}</h1>
            <p className="flex flex-wrap gap-x-4 text-sm text-ink-2">
              <span>{patientMeta(state.encounter.patient.age, state.encounter.patient.gender)}</span>
              <span>Visit {state.encounter.id}</span>
              <span>Arrived {dateTime(state.encounter.arrivedAt)}</span>
            </p>
          </div>
          <span className="flex-1" />
          <StatusLine tone={status.tone}>{status.text}</StatusLine>
          {state.snapshots.length > 1 && (
            <label className="flex items-center gap-2 text-[13px] text-ink-2">
              Assessment
              <select
                className="h-9 rounded-[10px] border border-line-strong bg-white px-2.5 text-[13px] text-ink outline-none focus:border-brand"
                value={snapshot?.id ?? ''}
                onChange={(event) => { setSnapshotId(Number(event.target.value)); setPendingComment(null); clear(); }}
              >
                {state.snapshots.map((item) => <option key={item.id} value={item.id}>Version {item.version}{item.partial ? ', unfinished' : ''}, {dateTime(item.createdAt)}</option>)}
              </select>
            </label>
          )}
        </div>
        {state.handoffOverride && (
          <StatusLine tone="amber" className="text-[13px]">
            Care started before the assessment finished: {state.handoffOverride.reason} (user #{state.handoffOverride.actorUserId}, {dateTime(state.handoffOverride.createdAt)})
          </StatusLine>
        )}
      </header>

      <div ref={setBody} className="flex min-h-0 flex-1 flex-col overflow-y-auto xl:flex-row xl:overflow-hidden">
        <div className="min-w-0 flex-1 xl:overflow-y-auto">
          <div className={cx('mx-auto flex flex-col gap-6 px-4 pb-16 pt-6 sm:px-8', reading ? 'max-w-[820px]' : 'max-w-[960px]')}>
            {ws.error && !dialog && !feedbackDraft && (
              <div role="alert" className="flex items-center gap-3 rounded-2xl bg-signal-red-bg px-4 py-3 text-sm text-signal-red">
                <span className="flex-1">{ws.error}</span>
                <IconButton icon="x" label="Dismiss" onClick={() => ws.setError('')} />
              </div>
            )}
            {viewingOlder && (
              <div className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink-2">
                <span className="flex-1">You’re reading assessment version {snapshot!.version}. Comments you add stay on this version.</span>
                <Button size="sm" variant="quiet" onClick={() => { setSnapshotId(null); setPendingComment(null); clear(); }}>Show latest</Button>
              </div>
            )}

            {readingValue && view ? (
              <ReadingProvider value={readingValue}>
                <BeforeYouGoIn view={view} state={state} ask={ask} />
                <div className="flex flex-col">
                  <Tabs
                    className="overflow-x-auto [scrollbar-width:none]"
                    idBase="care-evidence"
                    label="Assessment"
                    value={tab}
                    onChange={setTab}
                    tabs={[
                      { id: 'answers', label: 'Answers', count: view.answers.length },
                      { id: 'gaps', label: 'Not established', count: view.gaps.length || undefined },
                      { id: 'summary', label: 'Case summary' },
                      { id: 'visit', label: 'Visit record' },
                    ]}
                  />
                  <div role="tabpanel" id={evidenceIds.panel} aria-labelledby={evidenceIds.tab} className="pt-6 [--row-bg:var(--color-paper)]">
                    <EvidencePanel tab={tab} view={view} state={state} />
                  </div>
                </div>
              </ReadingProvider>
            ) : (
              <NoAssessment state={state} />
            )}
          </div>
        </div>

        <YourWork
          state={state}
          ws={ws}
          tab={workTab}
          onTab={setWorkTab}
          canWrite={canWrite}
          pendingComment={pendingComment}
          onCancelComment={() => setPendingComment(null)}
          onSubmitComment={submitComment}
          activeCommentId={activeCommentId}
          onJumpToComment={jumpToComment}
          amending={amending}
          onStartAmend={() => setDialog('amend')}
          onCancelAmend={() => setAmending(null)}
          onSaveAmendment={saveAmendment}
          onReviewConflict={() => setDialog('conflict')}
        />
      </div>

      <SelectionToolbar
        selection={selection}
        canComment={canWrite && !!snapshot}
        commentHint={state.encounter.status === 'ADMITTED' ? 'Comments open once Care starts' : isComplete ? 'Finished visits can’t take new comments' : 'Only physicians can comment'}
        canQuote={canWrite && !isComplete}
        onComment={commentOnSelection}
        onCopy={() => void copySelection()}
        onQuote={quoteSelection}
      />

      <StartUrgentDialog
        open={dialog === 'start'}
        patientName={patientName}
        asked={view?.answers.length ?? 0}
        busy={ws.busy}
        error={ws.error}
        onClose={() => setDialog(null)}
        onStart={(reason) => void ws.run(() => startCare(id, reason), 'Care didn’t start. Try again.').then((ok) => { if (ok) { setDialog(null); setWorkTab('note'); } })}
      />
      <FinishVisitDialog open={dialog === 'finish'} state={state} patientName={patientName} noteSaved={ws.noteSaved} busy={ws.busy} error={ws.error} onClose={() => setDialog(null)} onFinish={() => void finish()} />
      <NoteConflictDialog
        open={dialog === 'conflict' && !!ws.conflict}
        mine={ws.noteDraft}
        theirs={ws.conflict?.text ?? ''}
        theirVersion={ws.conflict?.version ?? 0}
        onClose={() => setDialog(null)}
        onUseTheirs={() => { ws.acceptServerNote(); setDialog(null); }}
        onKeepMine={() => { ws.keepMineAndSave(); setDialog(null); }}
      />
      <AmendNoteDialog open={dialog === 'amend'} onClose={() => setDialog(null)} onContinue={(reason) => { setAmending({ reason }); setWorkTab('note'); setDialog(null); }} />
      <UnsavedNoteDialog
        open={dialog === 'leave'}
        failed={ws.saveStatus === 'failed'}
        onStay={() => { afterLeave.current = null; setDialog(null); }}
        onLeave={() => { const proceed = afterLeave.current; afterLeave.current = null; setDialog(null); proceed?.(); }}
      />
      <FeedbackNoteDialog
        open={!!feedbackDraft}
        mode={feedbackDraft?.mode ?? 'not_right'}
        quote={feedbackDraft?.quote ?? ''}
        sectionKey={feedbackDraft?.sectionKey ?? ''}
        existingNote={feedbackDraft?.existingNote ?? null}
        busy={ws.busy}
        error={feedbackDraft ? ws.error : ''}
        onClose={() => setFeedbackDraft(null)}
        onSave={(note) => void saveFeedback(feedbackDraft?.mode === 'missing' ? 'MISSING' : 'NOT_RIGHT', note)}
        onRemove={feedbackDraft?.existing ? () => {
          const draft = feedbackDraft;
          const targetKey = draft.mode === 'missing' ? `missing:${draft.sectionKey}` : draft.segmentId ?? '';
          void ws.run(() => clearCareFeedback(id, snapshot!.id, targetKey), 'Your feedback didn’t clear. Try again.').then((ok) => { if (ok) setFeedbackDraft(null); });
        } : null}
      />
      <CopyChartDialog open={dialog === 'chart'} state={state} view={view} onClose={() => setDialog(null)} onError={(message) => toast.show({ message, tone: 'error' })} />
    </div>
  );
}

/** A visit that reached Care without any recorded assessment, such as an urgent start before the first answer. */
function NoAssessment({ state }: { state: CareState }) {
  const { encounter } = state;
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-6">
      <p className="text-[15px] text-ink-2">No assessment answers were recorded for this visit.</p>
      <dl className="grid grid-cols-[150px_1fr] gap-x-4 gap-y-3 text-sm">
        <dt className="text-ink-3">Reason for visit</dt><dd className="font-display text-[19px] leading-snug">{encounter.chiefComplaint || 'Not recorded'}</dd>
        <dt className="text-ink-3">Allergies</dt><dd className={encounter.patient.allergies ? 'font-medium text-signal-red' : 'text-ink-3'}>{encounter.patient.allergies || 'Not recorded'}</dd>
        <dt className="text-ink-3">Conditions</dt><dd className={encounter.patient.conditions ? '' : 'text-ink-3'}>{encounter.patient.conditions || 'Not recorded'}</dd>
      </dl>
      <p className="flex items-center gap-2 text-[13px] text-ink-3"><Icon name="alert" size={15} />Ask the history in the room and record it in your note.</p>
    </section>
  );
}
