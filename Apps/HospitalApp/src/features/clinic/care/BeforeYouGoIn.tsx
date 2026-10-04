import { useState, type FormEvent } from 'react';
import type { CareAskItem, CareState } from '../../../shared/api/care';
import { Button, Dot, cx, inputClass } from '../ui/controls';
import { clockTime, dateTime, urgencyTone, type CareView } from './careModel';
import { FeedbackControl, GeneratedBlock, MissingLink, Passage, RefLink, SectionTitle } from './reading';

const TONE_TEXT = { red: 'text-signal-red', amber: 'text-signal-amber', green: 'text-signal-green', grey: 'text-ink-2', blue: 'text-brand-700' } as const;

type OpenQuestion = CareState['openQuestions'][number];

/** What the band needs to let a clinician tick off "Ask in the room" items during Care. */
export interface AskInRoomActions {
  canTick: boolean;
  busy: boolean;
  /** The clinician question recorded for each ticked item, by segment id. */
  questions: ReadonlyMap<string, OpenQuestion>;
  onTick: (segmentId: string, text: string, asked: boolean) => void;
  /** Saves what the patient said. The first answer is also added to the note. */
  onAnswer: (segmentId: string, answer: string) => Promise<boolean>;
}

/**
 * The top band: what a clinician needs before walking in. Everything here is
 * generated decision support except the patient's own history facts and the
 * record of any emergency warning they saw.
 */
export function BeforeYouGoIn({ view, state, ask }: { view: CareView; state: CareState; ask: AskInRoomActions }) {
  const patient = state.encounter.patient;
  const must = view.askInRoom.filter(({ item }) => item.priority === 'must');
  const worth = view.askInRoom.filter(({ item }) => item.priority === 'worth');
  const tone = urgencyTone(view.urgency?.level);

  return (
    <section aria-label="Before you go in" className="flex flex-col gap-5 rounded-2xl [--row-bg:white] border border-line bg-white p-6 shadow-[0_1px_2px_rgba(14,22,48,.04),0_16px_34px_-24px_rgba(14,22,48,.28)]">
      <div className="group/item relative flex flex-wrap items-center gap-x-4 gap-y-1">
        {view.urgency ? (
          <span className={cx('inline-flex items-center gap-2.5 text-[17px] font-semibold', TONE_TEXT[tone])}>
            <Dot tone={tone} className="h-2.5 w-2.5" />
            <Passage id="urgency:sentence" fallback={view.urgency.sentence} as="span" voice="plain" />
          </span>
        ) : (
          <span className="text-sm text-ink-2">This assessment is from an earlier version, so it has no urgency rating, questions for the room or gaps.</span>
        )}
        <FeedbackControl segmentId="urgency:sentence" overlay={false} />
        <span className="flex-1" />
        <span className="text-[13px] text-ink-3">{view.generation.mode === 'ai' ? 'Model-generated' : 'Rule-based preview'}{view.generation.generatedAt ? `, ${dateTime(view.generation.generatedAt)}` : ''}</span>
      </div>

      {view.emergencyEvents.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="Emergency warnings">
          {view.emergencyEvents.map(({ segmentId, event }) => (
            <li key={segmentId} className="flex items-start gap-3 rounded-xl bg-signal-red-bg px-4 py-3">
              <Dot tone="red" className="mt-2" />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <Passage id={segmentId} voice="clinic" />
                <span className="text-[13px] text-ink-2">Shown {clockTime(event.shownAt)}{event.acknowledgedAt ? `, continued ${clockTime(event.acknowledgedAt)}` : ''}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <GeneratedBlock>
        <div className="group/item flex flex-col gap-1">
          <Passage id="summary:briefing" fallback={view.briefing} voice="plain" className="text-[18px] leading-snug text-ink" />
          <span className="-ml-1.5"><FeedbackControl segmentId="summary:briefing" overlay={false} /></span>
        </div>
        {view.urgency && view.urgency.reasons.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {view.urgency.reasons.map((reason, index) => (
              <li key={reason.id} className="group/item relative flex items-baseline gap-2">
                <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-3" />
                <span className="min-w-0 flex-1">
                  <Passage id={`urgency:reason:${index}`} fallback={reason.text} as="span" /> <RefLink refs={reason.refs} /> <FeedbackControl segmentId={`urgency:reason:${index}`} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </GeneratedBlock>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-5">
          {view.redFlags.length > 0 && (
            <div className="group/section flex flex-col gap-2">
              <SectionTitle action={<MissingLink sectionKey="red_flags" />}>Red flags</SectionTitle>
              <ul className="flex flex-col gap-1.5">
                {view.redFlags.map((flag) => (
                  <li key={flag.segmentId} className="group/item relative flex items-baseline gap-2.5">
                    <Dot tone="red" className="translate-y-[-1px]" />
                    <span className="min-w-0 flex-1">
                      <Passage id={flag.segmentId} fallback={flag.label} as="span" voice="plain" className="text-[15px] font-medium text-signal-red" /> <RefLink refs={flag.refs} /> <FeedbackControl segmentId={flag.segmentId} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {view.nextSteps.length > 0 && (
            <div className="group/section flex flex-col gap-2">
              <SectionTitle action={<MissingLink sectionKey="next_steps" />}>Next steps</SectionTitle>
              <ul className="flex flex-col gap-1.5">
                {view.nextSteps.map((step) => (
                  <li key={step.segmentId} className="group/item relative flex items-baseline gap-2">
                    <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-3" />
                    <span className="min-w-0 flex-1">
                      <Passage id={step.segmentId} fallback={step.text} as="span" /> <FeedbackControl segmentId={step.segmentId} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <SectionTitle aside="As the patient reported">History</SectionTitle>
          <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 text-sm">
            <dt className="text-ink-3">Allergies</dt>
            <dd>{view.segments.has('visit:allergies') ? <Passage id="visit:allergies" voice="plain" as="span" className="text-sm font-medium text-signal-red" /> : <span className={patient.allergies ? 'font-medium text-signal-red' : 'text-ink-3'}>{patient.allergies || 'Not recorded'}</span>}</dd>
            <dt className="text-ink-3">Conditions</dt>
            <dd>{view.segments.has('visit:conditions') ? <Passage id="visit:conditions" voice="plain" as="span" className="text-sm text-ink" /> : <span className={patient.conditions ? '' : 'text-ink-3'}>{patient.conditions || 'Not recorded'}</span>}</dd>
          </dl>
        </div>
      </div>

      {view.askInRoom.length > 0 && (
        <div className="group/section flex flex-col gap-3 border-t border-line pt-5">
          <SectionTitle aside={ask.canTick ? 'Tick each one once you’ve asked it' : 'Suggested questions for the visit'} action={<MissingLink sectionKey="ask_in_room" />}>Ask in the room</SectionTitle>
          {[{ key: 'must', label: 'Must ask', items: must }, { key: 'worth', label: 'Worth asking', items: worth }].filter((group) => group.items.length > 0).map((group) => (
            <div key={group.key} className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold text-ink-2">{group.label}</span>
              <ul className="flex flex-col gap-2.5">
                {group.items.map(({ segmentId, whySegmentId, item }) => (
                  <AskItem key={segmentId} segmentId={segmentId} whySegmentId={whySegmentId} item={item} ask={ask} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function AskItem({ segmentId, whySegmentId, item, ask }: { segmentId: string; whySegmentId: string; item: CareAskItem; ask: AskInRoomActions }) {
  const question = ask.questions.get(segmentId);
  const asked = !!question?.addressedAt;
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const answer = question?.answerText ?? '';
  const showForm = ask.canTick && asked && (editing || !answer);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    if (await ask.onAnswer(segmentId, draft)) { setDraft(''); setEditing(false); }
  }

  return (
    <li className={cx('group/item relative flex gap-3', !ask.canTick && 'border-l-2 border-dashed border-brand-rule pl-3.5')}>
      {ask.canTick && (
        <input
          type="checkbox"
          aria-label={`Asked: ${item.text}`}
          className="mt-[3px] h-[18px] w-[18px] shrink-0 accent-brand"
          checked={asked}
          disabled={ask.busy}
          onChange={(event) => ask.onTick(segmentId, item.text, event.target.checked)}
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span>
          <Passage id={segmentId} fallback={item.text} as="span" voice="plain" className={cx('text-[15px] font-medium', asked ? 'text-ink-2' : 'text-ink')} /> <FeedbackControl segmentId={segmentId} />
        </span>
        <span>
          <Passage id={whySegmentId} fallback={item.why} as="span" voice="plain" className="text-[13px] text-ink-2" /> <RefLink refs={item.basedOn} />
        </span>
        {asked && answer && !editing && (
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-sm text-ink">
            <span className="text-ink-3">They said</span>{answer}
            {ask.canTick && <button type="button" onClick={() => { setDraft(answer); setEditing(true); }} className="text-[13px] font-semibold text-brand-700 hover:underline">Edit</button>}
          </p>
        )}
        {showForm && (
          <form onSubmit={(event) => void save(event)} className="mt-1.5 flex gap-2">
            <input aria-label={`What they said to: ${item.text}`} className={cx(inputClass, 'h-9 text-sm')} maxLength={2000} placeholder="What they said" value={draft} onChange={(event) => setDraft(event.target.value)} />
            <Button type="submit" size="sm" busy={ask.busy} disabled={!draft.trim()}>{editing ? 'Save' : 'Add to note'}</Button>
            {editing && <Button size="sm" variant="quiet" onClick={() => setEditing(false)}>Cancel</Button>}
          </form>
        )}
      </div>
    </li>
  );
}
