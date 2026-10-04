import { useState } from 'react';
import type { CareQueueItem } from '../../../shared/api/care';
import { PageTitle, todayLabel } from '../ui/ClinicShell';
import { Button, Dot, IconButton, StatusLine, cx } from '../ui/controls';
import { Icon } from '../ui/Icon';
import {
  QUEUE_GROUPS, clockTime, minutesWaiting, nextReady, patientMeta, queueGroups, queueStatus, waitWords,
  type QueueGroupKey,
} from './careModel';

function rowTime(item: CareQueueItem, group: QueueGroupKey): { time: string; note: string } {
  if (group === 'completed') return { time: clockTime(item.departedAt), note: 'Finished' };
  if (group === 'active') return { time: clockTime(item.seenAt), note: 'Care started' };
  return { time: clockTime(item.arrivedAt), note: waitWords(minutesWaiting(item.arrivedAt)) };
}

function NextReady({ item, onOpen }: { item: CareQueueItem; onOpen: (id: number) => void }) {
  const status = queueStatus(item);
  const waited = waitWords(minutesWaiting(item.arrivedAt));
  return (
    <section aria-label="Next ready" className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-6 shadow-[0_1px_2px_rgba(14,22,48,.04),0_16px_34px_-24px_rgba(14,22,48,.28)] md:flex-row md:items-center">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-ink-2">Next ready{waited ? `, waiting ${waited}` : ''}</span>
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h2 className="font-display text-[30px] leading-tight">{item.patientName}</h2>
          <span className="text-sm text-ink-2">{patientMeta(item.age, item.gender)}</span>
        </div>
        <p className="max-w-[72ch] text-[15px] leading-relaxed text-[#1E2643]">{item.briefing || item.chiefComplaint || 'No reason recorded'}</p>
        <StatusLine tone={status.tone} className="mt-1">{status.text}{status.detail ? `. ${status.detail}` : ''}</StatusLine>
      </div>
      <Button variant="primary" size="lg" onClick={() => onOpen(item.id)}>Open visit<Icon name="forward" size={18} /></Button>
    </section>
  );
}

export function CareQueue({ items, loading, error, onRefresh, onOpen }: {
  items: CareQueueItem[]; loading: boolean; error: string; onRefresh: () => void; onOpen: (id: number) => void;
}) {
  const [search, setSearch] = useState('');
  const groups = queueGroups(items, search);
  const next = search.trim() ? null : nextReady(items);

  return (
    <div className="flex h-[calc(100vh-56px)] min-h-0 flex-col lg:h-screen">
      <header className="flex h-[76px] shrink-0 items-center gap-4 border-b border-line px-4 sm:px-7">
        <PageTitle aside={todayLabel()}>Care</PageTitle>
        <div className="relative hidden w-[320px] md:block">
          <label htmlFor="care-search" className="sr-only">Search Care visits</label>
          <span className="pointer-events-none absolute left-3.5 top-[11px] text-ink-3"><Icon name="search" /></span>
          <input
            id="care-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Escape') setSearch(''); }}
            placeholder="Search name, reason or visit number"
            className="h-10 w-full rounded-xl border border-line-strong bg-white pl-10 pr-3.5 text-sm outline-none placeholder:text-ink-3 focus:border-brand focus:ring-[3px] focus:ring-brand/20"
          />
        </div>
        <IconButton icon="refresh" label="Refresh now" onClick={onRefresh} />
      </header>

      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-4 px-4 pb-10 pt-5 sm:px-6">
          <div className="md:hidden">
            <label htmlFor="care-search-small" className="sr-only">Search Care visits</label>
            <input id="care-search-small" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, reason or visit number" className="h-10 w-full rounded-xl border border-line-strong bg-white px-3.5 text-sm outline-none focus:border-brand" />
          </div>
          {error && (
            <div role="status" className="flex items-center gap-3 rounded-2xl border border-signal-amber-dot/40 bg-signal-amber-bg px-4 py-3 text-sm text-signal-amber">
              <span className="flex-1">{error}</span>
              <Button size="sm" onClick={onRefresh}>Try now</Button>
            </div>
          )}
          {loading ? (
            <p className="px-1 py-8 text-sm text-ink-2">Loading Care visits…</p>
          ) : (
            <>
              {next && <NextReady item={next} onOpen={onOpen} />}
              <div className="overflow-hidden rounded-2xl border border-line bg-white">
                {groups.map((group, index) => {
                  const definition = QUEUE_GROUPS.find((candidate) => candidate.key === group.key)!;
                  return (
                    <section key={group.key} aria-labelledby={`care-group-${group.key}`} className={cx(index > 0 && 'border-t border-line')}>
                      <div className="flex items-baseline gap-2 px-5 pb-2 pt-[18px]">
                        <h2 id={`care-group-${group.key}`} className="text-sm font-semibold">{definition.label}</h2>
                        <span className="text-sm font-medium tabular-nums text-ink-3">{group.rows.length}</span>
                        <span className="flex-1" />
                        {definition.note && <span className="hidden text-[13px] text-ink-3 md:inline">{definition.note}</span>}
                      </div>
                      {group.rows.length === 0 ? (
                        <p className="border-t border-line px-5 py-3.5 text-sm text-ink-3">{search.trim() ? 'No one in this group matches the search.' : definition.empty}</p>
                      ) : (
                        <ul>
                          {group.rows.map((item) => {
                            const time = rowTime(item, group.key);
                            const status = queueStatus(item);
                            return (
                              <li key={item.id} className="border-t border-line transition-colors hover:bg-[#F5F7FA]">
                                <button
                                  type="button"
                                  onClick={() => onOpen(item.id)}
                                  className="grid w-full grid-cols-[72px_minmax(0,1fr)] items-start gap-x-4 gap-y-1 px-5 py-3.5 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand md:grid-cols-[84px_200px_minmax(0,1fr)_220px]"
                                >
                                  <span className="flex flex-col">
                                    <span className="text-sm font-semibold tabular-nums">{time.time || '—'}</span>
                                    <span className="text-[12px] text-ink-3">{time.note}</span>
                                  </span>
                                  <span className="flex min-w-0 flex-col">
                                    <span className="truncate text-[15px] font-semibold">{item.patientName}</span>
                                    <span className="text-[13px] text-ink-2">{patientMeta(item.age, item.gender)}</span>
                                  </span>
                                  <span className="col-start-2 line-clamp-2 text-sm leading-snug text-ink-2 md:col-start-auto">{item.briefing || item.chiefComplaint || 'No reason recorded'}</span>
                                  <span className="col-start-2 flex flex-col gap-0.5 md:col-start-auto">
                                    <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink"><Dot tone={status.tone} />{status.text}</span>
                                    {status.detail && <span className="pl-4 text-[12px] text-signal-red">{status.detail}</span>}
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </section>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
