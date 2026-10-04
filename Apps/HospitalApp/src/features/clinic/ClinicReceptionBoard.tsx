import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { client } from '../../shared/api/client';
import { getSocket, subscribeToEncounterRealtime } from '../../shared/realtime/socket';
import { RealtimeEvents } from '../../shared/types/domain';
import { ClinicAppointmentsPanel } from './ClinicAppointmentsPanel';
import { ChangeTimeDialog } from './reception/ChangeTimeDialog';
import { ConfirmActionDialog, type DestructiveAction } from './reception/ConfirmActionDialog';
import type { Grant } from './reception/DeskAssessment';
import { PatientPanel, type PanelTab } from './reception/PatientPanel';
import { ReceptionList, rowKey } from './reception/ReceptionList';
import { StaffAssessment } from './reception/StaffAssessment';
import { WalkInDialog } from './reception/WalkInDialog';
import {
  GROUPS, buildAttention, buildSections, isAppointment, matchesSearch, sameSelection, selectionFor, slotSentence, slotStart,
  type AppointmentRow, type Availability, type BoardItem, type ClinicRow, type CommandKind, type Delivery, type Group, type Queue,
  type ReceptionList as ReceptionData, type Selection,
} from './reception/receptionModel';
import { PageTitle, todayLabel } from './ui/ClinicShell';
import { Button, Dot, IconButton, cx } from './ui/controls';
import { describeError, isConflict } from './ui/errors';
import { Icon } from './ui/Icon';
import { useClinicToast } from './ui/toast';

type User = { email: string; role: string };
type DialogState =
  | { kind: 'walkin' }
  | { kind: 'reschedule'; row: AppointmentRow; confirmed: boolean }
  | { kind: 'destructive'; action: DestructiveAction; row: AppointmentRow }
  | null;

const RECEPTION_ROLES = ['STAFF', 'ADMIN', 'CLINICAL_ADMIN'];
const EMPTY_RECEPTION: ReceptionData = { acceptsWalkIns: false, walkInPath: '/walk-in', walkIns: [], completedPrevisits: [] };
const EMPTY_QUEUE: Queue = { newAppointments: [], expected: [], arrived: [] };

export function ClinicReceptionBoard({ user }: { user: User }) {
  if (user.role === 'IT_ADMIN') {
    return (
      <div className="flex flex-col">
        <header className="flex h-[76px] items-center gap-4 border-b border-line px-7"><PageTitle aside="Hours patients can request">Availability</PageTitle></header>
        <div className="px-4 py-6 sm:px-7"><ClinicAppointmentsPanel /></div>
      </div>
    );
  }
  return <Reception user={user} />;
}

function Reception({ user }: { user: User }) {
  const toast = useClinicToast();
  const canManage = RECEPTION_ROLES.includes(user.role);
  const [reception, setReception] = useState<ReceptionData>(EMPTY_RECEPTION);
  const [queue, setQueue] = useState<Queue>(EMPTY_QUEUE);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [failures, setFailures] = useState<Delivery[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Group | 'all'>('all');
  const [selection, setSelection] = useState<Selection | null>(null);
  const [tab, setTab] = useState<PanelTab>('visit');
  const [pending, setPending] = useState<Map<number, 'confirm' | 'arrive'>>(() => new Map());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [dialog, setDialog] = useState<DialogState>(null);
  const [dialogError, setDialogError] = useState('');
  const [grants, setGrants] = useState<Record<number, Grant>>({});
  const [deskError, setDeskError] = useState('');
  const [assisting, setAssisting] = useState<ClinicRow | null>(null);
  const requestNumber = useRef(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const focusPanel = useRef(false);
  const focusRowKey = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    const current = ++requestNumber.current;
    try {
      const [nextReception, nextQueue, nextAvailability] = await Promise.all([
        client<ReceptionData>('/clinic-intake/reception'),
        client<Queue>('/clinic-intake/reception/appointments'),
        client<Availability>('/clinic-intake/reception/availability'),
      ]);
      if (current !== requestNumber.current) return;
      setReception(nextReception); setQueue(nextQueue); setAvailability(nextAvailability);
      setLoaded(true); setLoadError('');
    } catch {
      if (current === requestNumber.current) setLoadError('Reception couldn’t refresh. You’re seeing the last list that loaded; it tries again on its own.');
    }
    if (canManage) {
      // Email failures only add to "Needs you"; the board works without them.
      try { setFailures(await client<Delivery[]>('/clinic-notifications/failures')); } catch { /* keep the last list */ }
    }
  }, [canManage]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15_000);
    const update = () => void refresh();
    const socket = getSocket();
    socket.on(RealtimeEvents.EncounterUpdated, update);
    socket.on('connect', update);
    window.addEventListener('focus', update);
    window.addEventListener('online', update);
    return () => {
      requestNumber.current++;
      window.clearInterval(timer);
      socket.off(RealtimeEvents.EncounterUpdated, update);
      socket.off('connect', update);
      window.removeEventListener('focus', update);
      window.removeEventListener('online', update);
    };
  }, [refresh]);

  useEffect(() => {
    const ids = [...queue.newAppointments, ...queue.expected, ...queue.arrived].map((item) => item.encounterId).concat(reception.walkIns.map((item) => item.id));
    if (ids.length) void subscribeToEncounterRealtime(ids).catch(() => { /* polling remains available */ });
  }, [queue, reception.walkIns]);

  // ⌘K or Ctrl+K jumps to search from anywhere on the board.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const sections = useMemo(() => buildSections(queue, reception, pending), [queue, reception, pending]);
  const visibleSections = useMemo(() => sections
    .filter((section) => filter === 'all' || section.key === filter)
    .map((section) => ({ ...section, rows: section.rows.filter((item) => matchesSearch(item, search)) })), [sections, filter, search]);
  const flat = useMemo(() => visibleSections.flatMap((section) => section.rows), [visibleSections]);
  const attention = useMemo(() => buildAttention(sections, failures), [sections, failures]);
  const selectedItem = useMemo(() => sections.flatMap((section) => section.rows).find((item) => sameSelection(item, selection)) ?? null, [sections, selection]);
  const index = selectedItem ? flat.findIndex((item) => sameSelection(item, selection)) : -1;

  useEffect(() => {
    if (focusPanel.current && selectedItem) { focusPanel.current = false; window.requestAnimationFrame(() => headingRef.current?.focus()); }
    if (focusRowKey.current) {
      const key = focusRowKey.current;
      focusRowKey.current = null;
      window.requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-row-key="${key}"]`)?.focus());
    }
  }, [selectedItem, selection]);

  function select(item: BoardItem, options: { focus?: 'panel' | 'row'; tab?: PanelTab } = {}) {
    setSelection(selectionFor(item));
    setTab(options.tab ?? 'visit');
    setNotice(''); setDeskError('');
    if (options.focus === 'panel') focusPanel.current = true;
    if (options.focus === 'row') focusRowKey.current = rowKey(item);
  }

  function move(direction: 1 | -1) {
    if (!flat.length) return;
    const next = index < 0 ? flat[direction > 0 ? 0 : flat.length - 1] : flat[index + direction];
    if (next) select(next, { focus: document.activeElement?.closest('[data-row-key]') ? 'row' : undefined, tab });
  }

  function close() {
    if (selectedItem) focusRowKey.current = rowKey(selectedItem);
    setSelection(null);
  }

  const clearPending = useCallback((id: number) => {
    setPending((current) => { const next = new Map(current); next.delete(id); return next; });
  }, []);

  async function runCommand(row: AppointmentRow, kind: CommandKind, extra: Record<string, unknown> = {}, keepalive = false): Promise<{ ok: true } | { ok: false; message: string }> {
    const storageKey = `clinic-staff-command-${row.id}-${kind}`;
    const commandKey = sessionStorage.getItem(storageKey) || crypto.randomUUID();
    sessionStorage.setItem(storageKey, commandKey);
    try {
      await client(`/clinic-intake/reception/appointments/${row.id}/${kind}`, { method: 'POST', keepalive, body: JSON.stringify({ commandKey, expectedRevision: row.revision, ...extra }) });
      sessionStorage.removeItem(storageKey);
      await refresh();
      return { ok: true };
    } catch (cause) {
      // A conflict means the command can't apply as sent; any other failure keeps
      // the key so a retry can't double-apply.
      if (isConflict(cause)) sessionStorage.removeItem(storageKey);
      await refresh();
      return {
        ok: false,
        message: isConflict(cause)
          ? `${row.patientName}’s appointment changed on another screen. Review the new details, then try again.`
          : describeError(cause, 'The appointment didn’t update. Check the connection and try again.'),
      };
    }
  }

  // Confirm and arrive wait five seconds so a mis-click costs nothing.
  function deferred(row: AppointmentRow, kind: 'confirm' | 'arrive') {
    setPending((current) => new Map(current).set(row.id, kind));
    setNotice('');
    toast.show({
      message: kind === 'confirm' ? `Confirmed ${row.patientName} for ${slotSentence(slotStart(row), row.timezone)}` : `Marked ${row.patientName} arrived`,
      actionLabel: 'Undo',
      onAction: () => clearPending(row.id),
      onExpire: () => {
        void runCommand(row, kind, {}, true).then((result) => {
          clearPending(row.id);
          if (!result.ok) {
            setNotice(result.message);
            toast.show({ message: kind === 'confirm' ? `${row.patientName} wasn’t confirmed. Open the visit for details.` : `${row.patientName} wasn’t marked arrived. Open the visit for details.`, tone: 'error', durationMs: 8000 });
          }
        });
      },
    });
  }

  function onCommand(kind: CommandKind) {
    if (!selectedItem || !isAppointment(selectedItem)) return;
    const row = selectedItem.row;
    setDialogError('');
    if (kind === 'confirm' || kind === 'arrive') deferred(row, kind);
    else if (kind === 'reschedule') setDialog({ kind: 'reschedule', row, confirmed: selectedItem.group === 'expected' });
    else setDialog({ kind: 'destructive', action: kind, row });
  }

  async function reschedule(startAt: string) {
    if (dialog?.kind !== 'reschedule') return;
    const { row } = dialog;
    setBusy(true); setDialogError('');
    const result = await runCommand(row, 'reschedule', { startAt });
    setBusy(false);
    if (!result.ok) { setDialogError(result.message); return; }
    setDialog(null);
    toast.show({ message: `Moved ${row.patientName} to ${slotSentence(startAt, row.timezone)}. Confirm the new time when you’re ready.` });
  }

  async function destructive() {
    if (dialog?.kind !== 'destructive') return;
    const { row, action } = dialog;
    setBusy(true); setDialogError('');
    const result = await runCommand(row, action);
    setBusy(false);
    if (!result.ok) { setDialogError(result.message); return; }
    setDialog(null);
    toast.show({ message: action === 'decline' ? `Declined ${row.patientName}’s request` : action === 'cancel' ? `Cancelled ${row.patientName}’s visit` : `Marked ${row.patientName} as a no-show` });
  }

  async function registered(visitId: number, name: string) {
    setDialog(null);
    await refresh();
    setSelection({ kind: 'walkin', id: visitId });
    setTab('assessment');
    focusPanel.current = true;
    toast.show({ message: `Registered ${name}. Choose how the assessment is answered.` });
  }

  async function issueGrant(row: ClinicRow) {
    setBusy(true); setDeskError('');
    try {
      const grant = await client<Grant>(`/clinic-intake/reception/walk-ins/${row.id}/grants`, { method: 'POST', body: '{}' });
      setGrants((current) => ({ ...current, [row.id]: { ...grant, issuedAt: new Date().toISOString() } }));
    } catch (cause) {
      setDeskError(describeError(cause, 'The code wasn’t created. Try again.'));
    } finally { setBusy(false); }
  }

  async function revokeGrant(row: ClinicRow) {
    const grant = grants[row.id];
    if (!grant) return;
    setBusy(true); setDeskError('');
    try {
      await client(`/clinic-intake/reception/grants/${grant.grantId}/revoke`, { method: 'POST', body: '{}' });
      setGrants((current) => { const next = { ...current }; delete next[row.id]; return next; });
      toast.show({ message: 'Code revoked. It no longer opens the assessment.' });
    } catch (cause) {
      setDeskError(describeError(cause, 'The code wasn’t revoked. Try again before handing over the device.'));
    } finally { setBusy(false); }
  }

  const counts = Object.fromEntries(sections.map((section) => [section.key, section.rows.length])) as Record<Group, number>;
  const walkIn = selectedItem?.group === 'walkins' ? selectedItem.row : null;

  return (
    <div className="flex h-[calc(100vh-56px)] min-h-0 flex-col lg:h-screen">
      <header className="flex h-[76px] shrink-0 items-center gap-4 border-b border-line px-4 sm:px-7">
        <PageTitle aside={todayLabel()}>Reception</PageTitle>
        <div className="relative hidden w-[320px] md:block">
          <label htmlFor="reception-search" className="sr-only">Search patients and visits</label>
          <span className="pointer-events-none absolute left-3.5 top-[11px] text-ink-3"><Icon name="search" /></span>
          <input
            id="reception-search"
            ref={searchRef}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Escape') setSearch(''); }}
            placeholder="Search name, reason or visit number"
            className="h-10 w-full rounded-xl border border-line-strong bg-white pl-10 pr-3.5 text-sm outline-none placeholder:text-ink-3 focus:border-brand focus:ring-[3px] focus:ring-brand/20"
          />
        </div>
        {reception.acceptsWalkIns && <Button variant="primary" icon="plus" onClick={() => { setDialogError(''); setDialog({ kind: 'walkin' }); }}>Register walk-in</Button>}
      </header>

      <div className="flex min-h-0 flex-1">
        {/* The scroll container is a plain block so the list keeps its full height and scrolls, instead of shrinking to fit. */}
        <div className="min-w-0 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-4 px-4 pb-10 pt-5 sm:px-6">
            {loadError && (
              <div role="status" className="flex items-center gap-3 rounded-2xl border border-signal-amber-dot/40 bg-signal-amber-bg px-4 py-3 text-sm text-signal-amber">
                <span className="flex-1">{loadError}</span>
                <Button size="sm" onClick={() => void refresh()}>Try now</Button>
              </div>
            )}

            {attention.length > 0 && (
              <section aria-label="Needs you" className="rounded-2xl border border-line bg-white py-1">
                <ul>
                  {attention.map((item, position) => (
                    <li key={item.key} className={cx('flex items-center gap-3 px-[18px] py-2', position > 0 && 'border-t border-line')}>
                      <Dot tone={item.tone} />
                      <span className="flex-1 text-sm">{item.text}</span>
                      <Button variant="quiet" size="sm" onClick={() => {
                        const target = sections.flatMap((section) => section.rows).find((row) => sameSelection(row, item.target));
                        if (target) select(target, { focus: 'panel', tab: item.tab });
                      }}>Review</Button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="flex items-center gap-3">
              <div role="group" aria-label="Show" className="flex min-w-0 gap-0.5 overflow-x-auto rounded-[14px] bg-ink/5 p-1">
                {[{ key: 'all' as const, label: 'All' }, ...GROUPS.map((group) => ({ key: group.key, label: group.short }))].map((option) => {
                  const on = filter === option.key;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setFilter(option.key)}
                      className={cx('flex h-[34px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[10px] px-3 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-brand', on ? 'bg-white text-ink shadow-[0_1px_2px_rgba(14,22,48,.08),0_6px_14px_-8px_rgba(14,22,48,.22)]' : 'text-ink-2 hover:text-ink')}
                    >
                      {option.label}
                      {option.key !== 'all' && <span className="font-medium tabular-nums text-ink-3">{counts[option.key]}</span>}
                    </button>
                  );
                })}
              </div>
              <span className="flex-1" />
              <IconButton icon="refresh" label="Refresh now" onClick={() => void refresh()} />
            </div>

            <div className="md:hidden">
              <label htmlFor="reception-search-small" className="sr-only">Search patients and visits</label>
              <input id="reception-search-small" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, reason or visit number" className="h-10 w-full rounded-xl border border-line-strong bg-white px-3.5 text-sm outline-none focus:border-brand" />
            </div>

            {!loaded && !loadError && <div className="rounded-2xl border border-line bg-white px-5 py-10 text-center text-sm text-ink-3">Loading Reception…</div>}
            {loaded && (
              <ReceptionList
                sections={visibleSections}
                selection={selection}
                compact={!!selectedItem}
                query={search}
                onSelect={(item) => select(item, { focus: 'panel' })}
                onMove={move}
                onClose={close}
              />
            )}

            {loaded && !reception.acceptsWalkIns && <p className="px-1 text-[13px] text-ink-3">This clinic takes appointments only, so walk-in registration is off.</p>}
          </div>
        </div>

        {selectedItem && (
          <PatientPanel
            ref={headingRef}
            item={selectedItem}
            tab={tab}
            onTab={setTab}
            canPrev={index > 0}
            canNext={index >= 0 && index < flat.length - 1}
            onMove={move}
            onClose={close}
            canManage={canManage}
            availability={availability}
            notice={notice}
            busy={busy}
            onCommand={onCommand}
            grant={walkIn ? grants[walkIn.id] ?? null : null}
            deskError={deskError}
            onIssueGrant={() => { if (walkIn) void issueGrant(walkIn); }}
            onRevokeGrant={() => { if (walkIn) void revokeGrant(walkIn); }}
            onAskTogether={() => { if (walkIn) setAssisting(walkIn); }}
          />
        )}
      </div>

      <WalkInDialog open={dialog?.kind === 'walkin'} onClose={() => setDialog(null)} onRegistered={(id, name) => void registered(id, name)} />
      <ChangeTimeDialog
        row={dialog?.kind === 'reschedule' ? dialog.row : null}
        confirmed={dialog?.kind === 'reschedule' && dialog.confirmed}
        availability={availability}
        busy={busy}
        error={dialogError}
        onClose={() => { if (!busy) setDialog(null); }}
        onSubmit={(startAt) => void reschedule(startAt)}
      />
      <ConfirmActionDialog
        action={dialog?.kind === 'destructive' ? dialog.action : null}
        row={dialog?.kind === 'destructive' ? dialog.row : null}
        busy={busy}
        error={dialogError}
        onClose={() => { if (!busy) setDialog(null); }}
        onConfirm={() => void destructive()}
      />
      {assisting && (
        <StaffAssessment
          row={assisting}
          onChanged={() => void refresh()}
          onClose={() => { setAssisting(null); void refresh(); }}
        />
      )}
    </div>
  );
}
