import type { ReactNode } from 'react';
import type { CareState } from '../../../shared/api/care';
import { Dot } from '../ui/controls';
import { clinicQuestionsAside, clockTime, dateTime, entryWords, groupAnswers, type CareView, type EvidenceTab } from './careModel';
import { FeedbackControl, GeneratedBlock, MissingLink, Passage, RefLink, SectionTitle } from './reading';

const GROUP_ASIDE: Record<string, string | undefined> = { safety: 'Asked of everyone first' };

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[150px_1fr] gap-x-4 border-t border-line py-3 first:border-t-0">
      <dt className="text-[13px] text-ink-3">{label}</dt>
      <dd className="min-w-0 text-sm">{children}</dd>
    </div>
  );
}

function humanize(key: string): string {
  const words = key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim().toLowerCase();
  return words ? words[0].toUpperCase() + words.slice(1) : key;
}

function displayValue(value: unknown): string {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  if (value == null || value === '') return 'Not answered';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

export function AnswersPanel({ view }: { view: CareView }) {
  const groups = groupAnswers(view.answers);
  let number = 0;
  if (!groups.length && !view.unasked.length) return <p className="text-sm text-ink-2">No answers were recorded.</p>;
  return (
    <div className="flex flex-col gap-8">
      <p className="text-[13px] text-ink-3">Exactly as recorded. Select any text to comment on it or copy it.</p>
      {groups.map((group) => (
        <section key={group.key} aria-label={group.label} className="flex flex-col gap-1">
          <SectionTitle aside={group.key === 'clinic' ? clinicQuestionsAside(view.questionnaire) : GROUP_ASIDE[group.key]}>{group.label}</SectionTitle>
          <ol className="flex flex-col">
            {group.answers.map((answer) => {
              number += 1;
              return (
                <li key={answer.questionId} className="grid grid-cols-[28px_1fr] gap-x-3 border-t border-line py-4 first:border-t-0">
                  <span className="pt-0.5 text-[13px] tabular-nums text-ink-3">{number}</span>
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <Passage id={`question:${answer.questionId}`} fallback={answer.question} voice="record" />
                    <Passage id={`answer:${answer.questionId}`} fallback={answer.answer} voice="patient" />
                    <span className="text-[12px] text-ink-3">{entryWords(answer.entryMode, answer.enteredByUserId)}, {clockTime(answer.answeredAt)}</span>
                    {answer.why && (
                      <details className="group/why mt-0.5">
                        <summary className="w-fit cursor-pointer list-none text-[13px] font-semibold text-brand-700 hover:underline">Why we asked</summary>
                        <GeneratedBlock label={null} className="mt-1.5">
                          <Passage id={`why:${answer.questionId}`} fallback={answer.why} voice="plain" className="text-sm leading-relaxed text-[#1E2643]" />
                        </GeneratedBlock>
                      </details>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
      {view.unasked.length > 0 && (
        <section aria-label="Not asked" className="flex flex-col gap-2">
          <SectionTitle aside="Planned but not asked. These aren’t patient statements.">Not asked</SectionTitle>
          <GeneratedBlock label={null}>
            <ul className="flex flex-col gap-3">
              {view.unasked.map((item) => (
                <li key={item.questionId} className="flex flex-col gap-0.5">
                  <Passage id={`unasked:${item.questionId}`} fallback={item.question} voice="generated" />
                  {item.why && <Passage id={`unasked-why:${item.questionId}`} fallback={item.why} voice="plain" className="text-[13px] text-ink-3" />}
                </li>
              ))}
            </ul>
          </GeneratedBlock>
        </section>
      )}
    </div>
  );
}

const SCREEN_STATUS = {
  reported: { tone: 'red', text: 'Reported' },
  denied: { tone: 'green', text: 'Denied' },
  not_screened: { tone: 'grey', text: 'Not screened' },
} as const;

export function GapsPanel({ view }: { view: CareView }) {
  const empty = !view.redFlagScreen.length && !view.gaps.length && !view.considerations.length && !view.examSuggestions.length && !view.timedRisks.length;
  if (empty) {
    return <p className="text-sm text-ink-2">{view.schemaVersion === 1 ? 'This assessment is from an earlier version, which didn’t record what couldn’t be established.' : 'Nothing the rules can detect is missing.'}</p>;
  }
  return (
    <div className="flex flex-col gap-8">
      {view.redFlagScreen.length > 0 && (
        <section aria-label="Red-flag screen" className="flex flex-col gap-2">
          <SectionTitle aside="Reported, denied or not screened">Red-flag screen</SectionTitle>
          <ul className="flex flex-col">
            {view.redFlagScreen.map((row) => (
              <li key={row.domain} className="flex items-center gap-3 border-t border-line py-2.5 first:border-t-0">
                <span className="min-w-0 flex-1 text-sm">{row.label}</span>
                <span className="inline-flex w-[118px] items-center gap-2 text-[13px] font-medium text-ink-2"><Dot tone={SCREEN_STATUS[row.status].tone} />{SCREEN_STATUS[row.status].text}</span>
                <span className="w-[110px] text-right"><RefLink refs={row.refs} /></span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {view.gaps.length > 0 && (
        <section aria-label="Not established" className="group/section flex flex-col gap-2">
          <SectionTitle aside="What the assessment couldn’t settle" action={<MissingLink sectionKey="gaps" />}>Not established</SectionTitle>
          <GeneratedBlock label={null}>
            <ul className="flex flex-col gap-2">
              {view.gaps.map((gap) => (
                <li key={gap.segmentId} className="group/item relative">
                  <Passage id={gap.segmentId} fallback={gap.text} as="span" /> <RefLink refs={gap.refs} /> <FeedbackControl segmentId={gap.segmentId} />
                </li>
              ))}
            </ul>
          </GeneratedBlock>
        </section>
      )}
      {view.considerations.length > 0 && (
        <section aria-label="Possible considerations" className="flex flex-col gap-2">
          <SectionTitle aside="Not a diagnosis. Weigh against the answers.">Possible considerations</SectionTitle>
          <GeneratedBlock label={null}>
            <ul className="flex flex-col gap-3">
              {view.considerations.map((item, index) => (
                <li key={item.id} className="group/item relative flex flex-col gap-1">
                  <span><Passage id={`consider:${index}`} fallback={item.text} as="span" /> <FeedbackControl segmentId={`consider:${index}`} /></span>
                  <span className="flex flex-wrap gap-3 text-[13px] text-ink-3">
                    {item.supporting.length > 0 && <span className="inline-flex items-baseline gap-1">Supported by <RefLink refs={item.supporting} label="these answers" /></span>}
                    {item.against.length > 0 && <span className="inline-flex items-baseline gap-1">Argued against by <RefLink refs={item.against} label="these answers" /></span>}
                  </span>
                </li>
              ))}
            </ul>
          </GeneratedBlock>
        </section>
      )}
      {view.examSuggestions.length > 0 && (
        <section aria-label="Focused exam suggestions" className="flex flex-col gap-2">
          <SectionTitle>Focused exam suggestions</SectionTitle>
          <GeneratedBlock label={null}>
            <ul className="flex flex-col gap-3">
              {view.examSuggestions.map((item, index) => (
                <li key={item.id} className="group/item relative flex flex-col gap-0.5">
                  <span><Passage id={`exam:${index}`} fallback={item.text} as="span" /> <FeedbackControl segmentId={`exam:${index}`} /></span>
                  <span className="flex items-baseline gap-2"><Passage id={`exam:${index}:why`} fallback={item.why} as="span" voice="plain" className="text-[13px] text-ink-2" /><RefLink refs={item.refs} /></span>
                </li>
              ))}
            </ul>
          </GeneratedBlock>
        </section>
      )}
      {view.timedRisks.length > 0 && (
        <section aria-label="Watch for" className="flex flex-col gap-2">
          <SectionTitle>Watch for</SectionTitle>
          <GeneratedBlock label={null}>
            <ul className="flex flex-col gap-2">
              {view.timedRisks.map((risk) => (
                <li key={risk.id} className="group/item relative">
                  <Passage id={risk.id} fallback={risk.text} as="span" />
                  {risk.window && <span className="text-[13px] text-ink-3"> {risk.window}</span>} <FeedbackControl segmentId={risk.id} />
                </li>
              ))}
            </ul>
          </GeneratedBlock>
        </section>
      )}
    </div>
  );
}

export function SummaryPanel({ view }: { view: CareView }) {
  return (
    <div className="flex flex-col gap-4">
      <GeneratedBlock>
        <div className="group/item flex flex-col gap-1">
          <Passage id="summary:case" fallback={view.caseSummary || 'No case summary was recorded.'} voice="plain" className="text-base leading-relaxed text-[#1E2643]" />
          <span className="-ml-1.5"><FeedbackControl segmentId="summary:case" overlay={false} /></span>
        </div>
      </GeneratedBlock>
      <p className="text-[13px] text-ink-3">
        {view.generation.mode === 'ai' ? 'Written by the assessment model.' : 'Written from the answers by Priage’s rules.'}
        {view.generation.rulesVersion ? ` Rules ${view.generation.rulesVersion}.` : ''} Decision support only, not a diagnosis.
      </p>
    </div>
  );
}

export function VisitRecordPanel({ view, state }: { view: CareView; state: CareState }) {
  const { encounter } = state;
  const healthInfo = encounter.patient.optionalHealthInfo && typeof encounter.patient.optionalHealthInfo === 'object' && !Array.isArray(encounter.patient.optionalHealthInfo)
    ? Object.entries(encounter.patient.optionalHealthInfo as Record<string, unknown>)
    : [];
  return (
    <dl className="flex flex-col">
      <Fact label="Reason for visit"><Passage id="visit:complaint" fallback={encounter.chiefComplaint || 'Not recorded'} voice="patient" /></Fact>
      {view.visitRecord ? (
        <Fact label="Their note">{view.visitRecord.patientNote ? <Passage id="visit:note" voice="patient" /> : <span className="text-ink-3">None</span>}</Fact>
      ) : encounter.details && (
        <Fact label="Visit details"><p className="whitespace-pre-wrap text-ink-2">{encounter.details}</p><p className="mt-1 text-[12px] text-ink-3">Earlier intake text. It may repeat generated text.</p></Fact>
      )}
      <Fact label="Allergies">{encounter.patient.allergies || <span className="text-ink-3">Not recorded</span>}</Fact>
      <Fact label="Conditions">{encounter.patient.conditions || <span className="text-ink-3">Not recorded</span>}</Fact>
      {healthInfo.map(([key, value]) => <Fact key={key} label={humanize(key)}>{displayValue(value)}</Fact>)}
      <Fact label="Contact">{[encounter.contact?.email, encounter.contact?.phone].filter(Boolean).join(', ') || <span className="text-ink-3">None given</span>}</Fact>
      {encounter.appointment && <Fact label="Appointment">{dateTime(encounter.appointment.confirmedStartAt || encounter.appointment.requestedStartAt)}</Fact>}
      <Fact label="Arrived">{dateTime(encounter.arrivedAt)}</Fact>
      {encounter.seenAt && <Fact label="Care started">{dateTime(encounter.seenAt)}</Fact>}
      {encounter.departedAt && <Fact label="Finished">{dateTime(encounter.departedAt)}</Fact>}
    </dl>
  );
}

export function EvidencePanel({ tab, view, state }: { tab: EvidenceTab; view: CareView; state: CareState }) {
  if (tab === 'gaps') return <GapsPanel view={view} />;
  if (tab === 'summary') return <SummaryPanel view={view} />;
  if (tab === 'visit') return <VisitRecordPanel view={view} state={state} />;
  return <AnswersPanel view={view} />;
}
