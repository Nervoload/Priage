import { useEffect, useRef, useState, type FormEvent } from 'react';
import { addCareQuestion, auditCareCopy, updateCareComment, updateCareQuestion, type CareState } from '../../../shared/api/care';
import { CopyButton } from '../ui/CopyButton';
import { Button, Dot, Tabs, cx, inputClass, tabIds, textareaClass } from '../ui/controls';
import { clockTime, dateTime } from './careModel';
import type { useCareWorkspace } from './useCareWorkspace';

export type WorkTab = 'note' | 'comments' | 'questions';
export interface PendingComment { snapshotId: number; segmentId: string; startOffset: number; endOffset: number; quote: string }

const SOAP_HEADINGS = 'Subjective\n\nObjective\n\nAssessment\n\nPlan\n';
const REVISION_KIND: Record<string, string> = { AUTOSAVE: 'Saved', AMENDMENT: 'Amended', FINAL: 'Finished' };

type Workspace = ReturnType<typeof useCareWorkspace>;

function NoteStatus({ ws, onReviewConflict }: { ws: Workspace; onReviewConflict: () => void }) {
  if (ws.saveStatus === 'conflict') {
    return <span className="flex items-center gap-2 text-[13px] text-signal-amber"><Dot tone="amber" />A newer version was saved elsewhere<Button size="sm" variant="quiet" onClick={onReviewConflict}>Review</Button></span>;
  }
  if (ws.saveStatus === 'failed') {
    return <span className="flex items-center gap-2 text-[13px] text-signal-red"><Dot tone="red" />Didn’t save<Button size="sm" variant="quiet" onClick={ws.retrySave}>Retry</Button></span>;
  }
  const text = ws.saveStatus === 'saving' ? 'Saving…' : ws.saveStatus === 'unsaved' ? 'Unsaved changes' : ws.savedAt ? `Saved ${clockTime(ws.savedAt)}` : 'Saved';
  return <span role="status" className="flex items-center gap-2 text-[13px] text-ink-2"><Dot tone={ws.saveStatus === 'saved' ? 'green' : 'amber'} />{text}</span>;
}

export function YourWork({
  state, ws, tab, onTab, canWrite, pendingComment, onCancelComment, onSubmitComment, activeCommentId, onJumpToComment,
  amending, onStartAmend, onCancelAmend, onSaveAmendment, onReviewConflict,
}: {
  state: CareState; ws: Workspace; tab: WorkTab; onTab: (tab: WorkTab) => void; canWrite: boolean;
  pendingComment: PendingComment | null; onCancelComment: () => void; onSubmitComment: (text: string) => Promise<boolean>;
  activeCommentId: number | null; onJumpToComment: (comment: CareState['comments'][number]) => void;
  amending: { reason: string } | null; onStartAmend: () => void; onCancelAmend: () => void; onSaveAmendment: (text: string) => Promise<boolean>;
  onReviewConflict: () => void;
}) {
  const isComplete = state.encounter.status === 'COMPLETE';
  const openComments = state.comments.filter((comment) => !comment.resolvedAt).length;
  const openQuestions = state.openQuestions.filter((question) => !question.addressedAt).length;
  const ids = tabIds('care-work', tab);

  return (
    <aside aria-label="Your work" className="flex w-full flex-col border-line bg-rail xl:h-full xl:w-[440px] xl:shrink-0 xl:border-l">
      <Tabs
        className="shrink-0 px-5 pt-1"
        idBase="care-work"
        label="Your work"
        value={tab}
        onChange={onTab}
        tabs={[{ id: 'note', label: 'Visit note' }, { id: 'comments', label: 'Comments', count: openComments || undefined }, { id: 'questions', label: 'Questions', count: openQuestions || undefined }]}
      />
      <div role="tabpanel" id={ids.panel} aria-labelledby={ids.tab} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {tab === 'note' && <NotePanel state={state} ws={ws} canWrite={canWrite} isComplete={isComplete} amending={amending} onStartAmend={onStartAmend} onCancelAmend={onCancelAmend} onSaveAmendment={onSaveAmendment} onReviewConflict={onReviewConflict} />}
        {tab === 'comments' && <CommentsPanel state={state} ws={ws} canWrite={canWrite} pending={pendingComment} onCancel={onCancelComment} onSubmit={onSubmitComment} activeCommentId={activeCommentId} onJump={onJumpToComment} />}
        {tab === 'questions' && <QuestionsPanel state={state} ws={ws} canWrite={canWrite} />}
      </div>
    </aside>
  );
}

function NotePanel({ state, ws, canWrite, isComplete, amending, onStartAmend, onCancelAmend, onSaveAmendment, onReviewConflict }: {
  state: CareState; ws: Workspace; canWrite: boolean; isComplete: boolean;
  amending: { reason: string } | null; onStartAmend: () => void; onCancelAmend: () => void; onSaveAmendment: (text: string) => Promise<boolean>; onReviewConflict: () => void;
}) {
  const [amendText, setAmendText] = useState(state.note.text);
  useEffect(() => { if (amending) setAmendText(state.note.text); }, [amending, state.note.text]);
  const text = isComplete ? state.note.text : ws.noteDraft;
  const author = state.note.updatedByUserId ? `user #${state.note.updatedByUserId}` : null;

  return (
    <div className="flex min-h-full flex-col gap-3 px-5 pb-5 pt-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {isComplete ? <span className="flex items-center gap-2 text-[13px] text-ink-2"><Dot tone="green" />Finished {dateTime(state.note.finalizedAt)}</span> : <NoteStatus ws={ws} onReviewConflict={onReviewConflict} />}
        <span className="text-[13px] tabular-nums text-ink-3">Version {state.note.version}</span>
        <span className="flex-1" />
        {canWrite && !isComplete && <Button size="sm" variant="quiet" onClick={() => ws.setNoteDraft(ws.noteDraft.trim() ? `${ws.noteDraft.replace(/\s+$/, '')}\n\n${SOAP_HEADINGS}` : SOAP_HEADINGS)}>Add SOAP headings</Button>}
      </div>

      {isComplete && !amending && (
        <>
          <p className="min-h-[200px] flex-1 whitespace-pre-wrap rounded-xl border border-line bg-white px-4 py-3.5 text-[15px] leading-relaxed text-ink">{state.note.text || <span className="text-ink-3">No note was recorded.</span>}</p>
          {state.allowedActions.edit && <Button className="self-start" onClick={onStartAmend}>Amend note</Button>}
        </>
      )}
      {isComplete && amending && (
        <>
          <p className="text-[13px] text-ink-2">Amending because: {amending.reason}</p>
          <textarea aria-label="Amended note" className={cx(textareaClass, 'min-h-[260px] flex-1 text-[15px]')} value={amendText} onChange={(event) => setAmendText(event.target.value)} />
          <div className="flex gap-2"><Button onClick={onCancelAmend} disabled={ws.busy}>Cancel</Button><Button variant="primary" busy={ws.busy} disabled={amendText === state.note.text} onClick={() => void onSaveAmendment(amendText)}>Save amendment</Button></div>
        </>
      )}
      {!isComplete && (
        <textarea
          aria-label="Visit note"
          className={cx(textareaClass, 'min-h-[320px] flex-1 text-[15px]')}
          value={ws.noteDraft}
          disabled={!canWrite}
          onChange={(event) => ws.setNoteDraft(event.target.value)}
          placeholder={canWrite ? 'Your assessment and plan…' : state.encounter.status === 'ADMITTED' ? 'Start Care to write the visit note.' : 'Only physicians can write the visit note.'}
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] text-ink-3">{author ? `Last written by ${author}` : 'The clinician’s own words'}</span>
        <span className="flex-1" />
        {text && <CopyButton text={text} label="Copy note" beforeCopy={() => auditCareCopy(state.encounter.id, 'physician_note')} />}
      </div>
      {state.note.history.length > 0 && (
        <details className="text-[13px] text-ink-2">
          <summary className="cursor-pointer font-semibold text-brand-700">Revision history</summary>
          <ul className="mt-2 flex flex-col gap-1">
            {state.note.history.map((item) => <li key={item.version}>Version {item.version}, {REVISION_KIND[item.kind] ?? item.kind.toLowerCase()} by user #{item.actorUserId}, {dateTime(item.createdAt)}{item.reason ? `. Reason: ${item.reason}` : ''}</li>)}
          </ul>
        </details>
      )}
    </div>
  );
}

function CommentsPanel({ state, ws, canWrite, pending, onCancel, onSubmit, activeCommentId, onJump }: {
  state: CareState; ws: Workspace; canWrite: boolean; pending: PendingComment | null; onCancel: () => void; onSubmit: (text: string) => Promise<boolean>;
  activeCommentId: number | null; onJump: (comment: CareState['comments'][number]) => void;
}) {
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<{ id: number; text: string } | null>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (pending) { setDraft(''); window.requestAnimationFrame(() => composer.current?.focus()); } }, [pending]);
  useEffect(() => {
    if (activeCommentId != null) document.getElementById(`care-comment-${activeCommentId}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeCommentId]);
  const ordered = [...state.comments].sort((left, right) => Number(!!left.resolvedAt) - Number(!!right.resolvedAt));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    if (await onSubmit(draft.trim())) setDraft('');
  }

  return (
    <div className="flex flex-col gap-3 px-5 pb-5 pt-4">
      {pending && (
        <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-2.5 rounded-2xl bg-white p-4 shadow-[0_0_0_1.5px_rgba(41,134,255,.45),0_18px_40px_-24px_rgba(14,22,48,.4)]">
          <span className="text-[13px] text-ink-2">Comment on <q className="font-display text-[15px] text-ink">{pending.quote}</q></span>
          <textarea ref={composer} aria-label="Comment" className={cx(textareaClass, 'text-sm')} rows={3} maxLength={4000} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); onCancel(); } }} />
          <div className="flex items-center gap-2"><span className="flex-1 text-[12px] text-ink-3">Seen by the care team</span><Button size="sm" onClick={onCancel}>Cancel</Button><Button size="sm" variant="primary" type="submit" busy={ws.busy} disabled={!draft.trim()}>Comment</Button></div>
        </form>
      )}
      {!ordered.length && !pending && <p className="text-sm text-ink-2">Select text in the assessment, then choose Comment. Comments stay attached to the words you selected.</p>}
      {ordered.map((comment) => {
        const active = comment.id === activeCommentId;
        return (
          <article key={comment.id} id={`care-comment-${comment.id}`} className={cx('flex flex-col gap-2 rounded-2xl border bg-white p-4 text-sm transition-shadow', active ? 'border-brand shadow-[0_0_0_3px_rgba(41,134,255,.15)]' : 'border-line', comment.resolvedAt && 'opacity-70')}>
            <button type="button" onClick={() => onJump(comment)} className="text-left text-[13px] text-ink-2 hover:text-ink">
              On <q className="rounded-[2px] bg-[#FFEDB8] px-0.5 font-display text-[15px] text-ink">{comment.quote}</q>
            </button>
            {editing?.id === comment.id ? (
              <div className="flex flex-col gap-2">
                <textarea aria-label="Edit comment" className={cx(textareaClass, 'text-sm')} rows={3} value={editing.text} onChange={(event) => setEditing({ id: comment.id, text: event.target.value })} />
                <div className="flex gap-2">
                  <Button size="sm" variant="primary" busy={ws.busy} disabled={!editing.text.trim()} onClick={() => void ws.run(() => updateCareComment(state.encounter.id, comment.id, { expectedVersion: comment.version, text: editing.text }), 'The comment didn’t save.').then((ok) => { if (ok) setEditing(null); })}>Save</Button>
                  <Button size="sm" onClick={() => setEditing(null)}>Cancel</Button>
                </div>
              </div>
            ) : <p className="whitespace-pre-wrap text-ink">{comment.text}</p>}
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex-1 text-[12px] text-ink-3">User #{comment.actorUserId}, {dateTime(comment.updatedAt)}{comment.resolvedAt ? ', resolved' : ''}</span>
              {canWrite && editing?.id !== comment.id && <>
                <Button size="sm" variant="quiet" onClick={() => setEditing({ id: comment.id, text: comment.text })}>Edit</Button>
                <Button size="sm" variant="quiet" disabled={ws.busy} onClick={() => void ws.run(() => updateCareComment(state.encounter.id, comment.id, { expectedVersion: comment.version, resolved: !comment.resolvedAt }), 'The comment didn’t update.')}>{comment.resolvedAt ? 'Reopen' : 'Resolve'}</Button>
              </>}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function QuestionsPanel({ state, ws, canWrite }: { state: CareState; ws: Workspace; canWrite: boolean }) {
  const [draft, setDraft] = useState('');
  async function add(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    if (await ws.run(() => addCareQuestion(state.encounter.id, draft.trim()), 'The question didn’t save.')) setDraft('');
  }
  return (
    <div className="flex flex-col gap-3 px-5 pb-5 pt-4">
      <p className="text-[13px] text-ink-3">Your own questions to work through during the visit.</p>
      {!state.openQuestions.length && <p className="text-sm text-ink-2">No questions yet.</p>}
      <ul className="flex flex-col">
        {state.openQuestions.map((question) => (
          <li key={question.id} className="flex items-start gap-3 border-t border-line py-3 first:border-t-0">
            <input
              type="checkbox"
              aria-label={`Mark “${question.text}” addressed`}
              className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-brand"
              checked={!!question.addressedAt}
              disabled={!canWrite || ws.busy}
              onChange={() => void ws.run(() => updateCareQuestion(state.encounter.id, question.id, { expectedVersion: question.version, addressed: !question.addressedAt }), 'The question didn’t update.')}
            />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className={cx('text-sm', question.addressedAt ? 'text-ink-3 line-through' : 'text-ink')}>{question.text}</span>
              {question.answerText && <span className="text-[13px] text-ink"><span className="text-ink-3">They said </span>{question.answerText}</span>}
              {question.sourceSegmentId && <span className="text-[12px] text-ink-3">From Ask in the room</span>}
            </span>
            <span className="text-[12px] text-ink-3">{question.addressedAt ? (question.sourceSegmentId ? 'Asked' : 'Addressed') : 'Open'}</span>
          </li>
        ))}
      </ul>
      {canWrite && (
        <form onSubmit={(event) => void add(event)} className="flex gap-2">
          <input aria-label="New question" className={cx(inputClass, 'h-10 text-sm')} maxLength={1000} placeholder="Add a question to explore" value={draft} onChange={(event) => setDraft(event.target.value)} />
          <Button type="submit" busy={ws.busy} disabled={!draft.trim()}>Add</Button>
        </form>
      )}
    </div>
  );
}
