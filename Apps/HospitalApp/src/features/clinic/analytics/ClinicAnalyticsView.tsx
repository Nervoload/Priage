import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { getAssessmentAnalytics, type AssessmentAnalytics, type FeedbackCounts } from '../../../shared/api/clinicAnalytics';
import { dateTime } from '../care/careModel';
import { PageTitle } from '../ui/ClinicShell';
import { Button, Dot, IconButton, cx } from '../ui/controls';
import { describeError } from '../ui/errors';
import { PERIODS, feedbackTotal, percent, periodWords, sectionLabel, urgencyBar, usefulShare } from './analyticsModel';

const BAR: Record<string, string> = { red: 'bg-signal-red', amber: 'bg-signal-amber-dot', green: 'bg-signal-green-dot', grey: 'bg-signal-grey-dot' };

function Panel({ title, aside, children, className }: { title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={cx('flex flex-col gap-4 rounded-2xl border border-line bg-white p-5', className)}>
      <div className="flex items-baseline gap-3">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {aside && <span className="text-[13px] text-ink-3">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

function Figure({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="flex flex-col">
      <span className="font-display text-[34px] leading-none tabular-nums">{value}</span>
      <span className="mt-1 text-[13px] text-ink-2">{label}</span>
    </div>
  );
}

function FeedbackTable<T extends FeedbackCounts>({ rows, name, label, empty }: { rows: T[]; name: (row: T) => string; label: string; empty: string }) {
  if (!rows.length) return <p className="text-sm text-ink-3">{empty}</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-[12px] text-ink-3">
          <th scope="col" className="pb-2 font-medium">{label}</th>
          <th scope="col" className="w-20 pb-2 text-right font-medium">Useful</th>
          <th scope="col" className="w-20 pb-2 text-right font-medium">Not right</th>
          <th scope="col" className="w-20 pb-2 text-right font-medium">Missing</th>
          <th scope="col" className="w-24 pb-2 text-right font-medium">Useful share</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={name(row)} className="border-t border-line">
            <td className="py-2.5 pr-3">{name(row)}</td>
            <td className="py-2.5 text-right tabular-nums">{row.useful}</td>
            <td className={cx('py-2.5 text-right tabular-nums', row.notRight > 0 && 'font-semibold text-signal-red')}>{row.notRight}</td>
            <td className="py-2.5 text-right tabular-nums">{row.missing}</td>
            <td className="py-2.5 text-right tabular-nums text-ink-2">{usefulShare(row)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** For clinic admins: how Priage's assessment suggestions are landing with their clinicians. */
export function ClinicAnalyticsView() {
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<AssessmentAnalytics | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (period: number) => {
    setLoading(true);
    try { setData(await getAssessmentAnalytics(period)); setError(''); }
    catch (cause) { setError(describeError(cause, 'Analytics didn’t load. Try again.')); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(days); }, [days, load]);

  const bar = data ? urgencyBar(data.urgency) : [];

  return (
    <div className="flex h-[calc(100vh-56px)] min-h-0 flex-col lg:h-screen">
      <header className="flex h-[76px] shrink-0 items-center gap-4 border-b border-line px-4 sm:px-7">
        <PageTitle aside="How Priage’s suggestions are landing">Analytics</PageTitle>
        <div role="group" aria-label="Period" className="flex gap-0.5 rounded-[14px] bg-ink/5 p-1">
          {PERIODS.map((period) => (
            <button
              key={period}
              type="button"
              aria-pressed={days === period}
              onClick={() => setDays(period)}
              className={cx('h-[34px] rounded-[10px] px-3 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-brand', days === period ? 'bg-white text-ink shadow-[0_1px_2px_rgba(14,22,48,.08)]' : 'text-ink-2 hover:text-ink')}
            >
              {period} days
            </button>
          ))}
        </div>
        <IconButton icon="refresh" label="Refresh now" onClick={() => void load(days)} />
      </header>

      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-4 px-4 pb-12 pt-5 sm:px-6">
          {error && (
            <div role="alert" className="flex items-center gap-3 rounded-2xl bg-signal-red-bg px-4 py-3 text-sm text-signal-red">
              <span className="flex-1">{error}</span>
              <Button size="sm" onClick={() => void load(days)}>Try again</Button>
            </div>
          )}
          {!data && loading && <p className="px-1 py-8 text-sm text-ink-2">Loading analytics…</p>}
          {data && (
            <>
              <p className="text-[13px] text-ink-3">
                Care visits assessed in {periodWords(data.days)}, from what clinicians read and marked in Care. Feedback comes from physicians and clinical admins; each sees only their own.
                {data.truncated ? ' Only the most recent 3,000 assessments are counted.' : ''}
              </p>

              <div className="grid gap-4 lg:grid-cols-3">
                <Panel title="Urgency" aside={`${data.visits} visit${data.visits === 1 ? '' : 's'}`} className="lg:col-span-2">
                  {bar.length ? (
                    <>
                      <div className="flex h-3 overflow-hidden rounded-full bg-sunken" role="img" aria-label={bar.map((part) => `${part.label}: ${part.count}`).join(', ')}>
                        {bar.map((part) => <span key={part.key} className={BAR[part.tone]} style={{ width: `${part.share * 100}%` }} />)}
                      </div>
                      <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                        {bar.map((part) => (
                          <li key={part.key} className="inline-flex items-center gap-2"><Dot tone={part.tone} /><span className="font-semibold tabular-nums">{part.count}</span><span className="text-ink-2">{part.label}, {percent(part.count, data.visits)}</span></li>
                        ))}
                      </ul>
                    </>
                  ) : <p className="text-sm text-ink-3">No Care visits in {periodWords(data.days)}.</p>}
                </Panel>
                <Panel title="Emergency warnings">
                  <div className="flex gap-8">
                    <Figure value={data.emergency.shown} label="visits saw one" />
                    <Figure value={data.emergency.continued} label="continued past it" />
                  </div>
                </Panel>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Panel title="Ask in the room" aside="Suggested questions clinicians ticked off">
                  <div className="flex gap-8">
                    <Figure value={data.askInRoom.suggested} label="suggested" />
                    <Figure value={data.askInRoom.asked} label={`asked, ${percent(data.askInRoom.asked, data.askInRoom.suggested)}`} />
                    <Figure value={data.askInRoom.answered} label="with an answer recorded" />
                  </div>
                </Panel>
                <Panel title="Your clinic’s questions">
                  <div className="flex gap-8">
                    <Figure value={data.clinicQuestions.inInterview} label="answered in the assessment" />
                    <Figure value={data.clinicQuestions.afterInterview} label="answered before booking" />
                    <Figure value={data.clinicQuestions.missing} label="not all answered" />
                  </div>
                </Panel>
              </div>

              <Panel title="Clinician feedback" aside={`${feedbackTotal(data.feedback.totals)} in ${periodWords(data.days)}`}>
                <p className="text-sm text-ink-2">
                  <span className="font-semibold text-ink">{data.feedback.totals.useful}</span> useful, <span className="font-semibold text-ink">{data.feedback.totals.notRight}</span> not right and <span className="font-semibold text-ink">{data.feedback.totals.missing}</span> notes that something was missing. Useful share {usefulShare(data.feedback.totals)}.
                </p>
                <div className="grid gap-6 xl:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <h3 className="text-[13px] font-semibold text-ink-2">By section</h3>
                    <FeedbackTable rows={data.feedback.bySection} name={(row) => sectionLabel(row.sectionKey)} label="Section" empty="No feedback yet." />
                  </div>
                  <div className="flex flex-col gap-2">
                    <h3 className="text-[13px] font-semibold text-ink-2">Rules marked not right most often</h3>
                    <FeedbackTable rows={data.feedback.byRule.slice(0, 8)} name={(row) => row.ruleId} label="Rule" empty="No feedback on specific rules yet." />
                  </div>
                </div>
                {data.feedback.byGenerator.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <h3 className="text-[13px] font-semibold text-ink-2">By version of the rules or model</h3>
                    <FeedbackTable rows={data.feedback.byGenerator} name={(row) => row.generator} label="Generated by" empty="" />
                  </div>
                )}
              </Panel>

              <Panel title="Recent notes" aside="What clinicians said was wrong or missing">
                {data.recentNotes.length ? (
                  <ul className="flex flex-col">
                    {data.recentNotes.map((note, index) => (
                      <li key={`${note.createdAt}-${index}`} className="flex flex-col gap-1.5 border-t border-line py-3.5 first:border-t-0">
                        <span className="flex flex-wrap items-center gap-x-3 text-[13px] text-ink-2">
                          <span className="inline-flex items-center gap-2 font-semibold text-ink"><Dot tone={note.kind === 'NOT_RIGHT' ? 'red' : 'amber'} />{note.kind === 'NOT_RIGHT' ? 'Not right' : 'Something missing'}</span>
                          <span>{sectionLabel(note.sectionKey)}</span>
                          <span className="text-ink-3">{dateTime(note.createdAt)}</span>
                        </span>
                        {note.itemText && <p className="border-l-2 border-dashed border-brand-rule pl-3 text-sm text-[#1E2643]">{note.itemText}</p>}
                        <p className="text-[15px] text-ink">{note.note}</p>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-ink-3">No notes in {periodWords(data.days)}.</p>}
              </Panel>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
