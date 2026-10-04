import { forwardRef, type ReactNode } from 'react';
import { ClinicDeliveryHistory } from '../ClinicNotifications';
import { SidePanel } from '../ui/SidePanel';
import { Button, IconButton, StatusLine, Tabs, tabIds } from '../ui/controls';
import { CopyButton } from '../ui/CopyButton';
import { DeskAssessment, type Grant } from './DeskAssessment';
import {
  firstName, isAppointment, patientMeta, slotLabel, slotStart, statusFor, visitIdFor,
  type Availability, type BoardItem, type CommandKind,
} from './receptionModel';

export type PanelTab = 'visit' | 'emails' | 'assessment';

function Fact({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-[13px] text-ink-3">{label}</dt>
      <dd className="break-words text-sm font-medium tabular-nums">{value}</dd>
      {hint && <dd className="text-[13px] text-ink-3">{hint}</dd>}
    </div>
  );
}

function placesHint(item: BoardItem, availability: Availability | null): string | undefined {
  if (!isAppointment(item) || item.group !== 'new') return undefined;
  const slot = availability?.slots.find((candidate) => candidate.startAt === item.row.requestedStartAt);
  if (!slot) return 'No other places open at this time';
  return `${slot.remaining} more open at this time`;
}

interface PatientPanelProps {
  item: BoardItem;
  tab: PanelTab;
  onTab: (tab: PanelTab) => void;
  canPrev: boolean;
  canNext: boolean;
  onMove: (direction: 1 | -1) => void;
  onClose: () => void;
  canManage: boolean;
  availability: Availability | null;
  notice: string;
  busy: boolean;
  onCommand: (kind: CommandKind) => void;
  grant: Grant | null;
  deskError: string;
  onIssueGrant: () => void;
  onRevokeGrant: () => void;
  onAskTogether: () => void;
}

export const PatientPanel = forwardRef<HTMLHeadingElement, PatientPanelProps>(function PatientPanel(props, headingRef) {
  const { item, tab, onTab, canPrev, canNext, onMove, onClose, canManage, availability, notice, busy, onCommand, grant, deskError, onIssueGrant, onRevokeGrant, onAskTogether } = props;
  const status = statusFor(item);
  const name = firstName(item.row.patientName);
  const appointment = isAppointment(item) ? item.row : null;
  const visit = isAppointment(item) ? null : item.row;
  const tabs = appointment
    ? [{ id: 'visit' as const, label: 'Visit' }, ...(canManage ? [{ id: 'emails' as const, label: 'Emails' }] : [])]
    : item.group === 'walkins'
      ? [{ id: 'visit' as const, label: 'Visit' }, { id: 'assessment' as const, label: 'Assessment' }]
      : [{ id: 'visit' as const, label: 'Visit' }];
  const activeTab = tabs.some((candidate) => candidate.id === tab) ? tab : 'visit';
  const idBase = `reception-${item.group}-${item.id}`;
  const allowed = appointment?.allowedActions ?? [];

  const header = (
    <div className="flex flex-col gap-1.5">
      <div className="-ml-2 flex items-center gap-1">
        <IconButton icon="chevronUp" label="Previous patient" disabled={!canPrev} onClick={() => onMove(-1)} />
        <IconButton icon="chevronDown" label="Next patient" disabled={!canNext} onClick={() => onMove(1)} />
        <span className="flex-1" />
        <span className="text-[13px] tabular-nums text-ink-3">Visit {visitIdFor(item)}</span>
        <IconButton icon="x" label="Close" onClick={onClose} />
      </div>
      <h2 ref={headingRef} tabIndex={-1} className="pt-1.5 font-display text-[36px] leading-[1.05] tracking-[-0.01em] outline-none">{item.row.patientName}</h2>
      <span className="text-ink-2">{patientMeta(item.row.age, item.row.gender)}</span>
      <StatusLine tone={status.tone} className="mt-1.5">{status.text}</StatusLine>
      <Tabs className="mt-3.5" tabs={tabs} value={activeTab} onChange={onTab} label="Patient details" idBase={idBase} />
    </div>
  );

  let footer: ReactNode = null;
  if (item.pending) {
    footer = <span className="text-sm text-ink-2">Sending in a few seconds. Use Undo at the bottom of the screen to stop it.</span>;
  } else if (appointment && !canManage) {
    footer = <span className="text-sm text-ink-2">Reception staff confirm and change appointments.</span>;
  } else if (item.group === 'new') {
    footer = <>
      <Button variant="dangerQuiet" onClick={() => onCommand('decline')} disabled={busy || !allowed.includes('decline')}>Decline</Button>
      <span className="flex-1" />
      {allowed.includes('reschedule') && <Button onClick={() => onCommand('reschedule')} disabled={busy}>Change time</Button>}
      <Button variant="primary" onClick={() => onCommand('confirm')} disabled={busy || !allowed.includes('confirm')}>Confirm time</Button>
    </>;
  } else if (item.group === 'expected') {
    footer = <>
      {allowed.includes('cancel') && <Button variant="dangerQuiet" onClick={() => onCommand('cancel')} disabled={busy}>Cancel visit</Button>}
      <span className="flex-1" />
      {allowed.includes('no-show') && <Button onClick={() => onCommand('no-show')} disabled={busy}>No-show</Button>}
      {allowed.includes('reschedule') && <Button onClick={() => onCommand('reschedule')} disabled={busy}>Change time</Button>}
      {allowed.includes('arrive') && <Button variant="primary" onClick={() => onCommand('arrive')} disabled={busy}>Mark arrived</Button>}
    </>;
  } else if (item.group === 'arrived') {
    footer = <span className="text-sm text-ink-2">Waiting for Care. Physicians see {name} in the Care queue.</span>;
  } else if (item.group === 'walkins') {
    footer = item.row.interviewStatus === 'complete'
      ? <span className="text-sm text-ink-2">Assessment finished. {name} is in the Care queue.</span>
      : <><span className="flex-1 text-sm text-ink-2">Care can start once the assessment is finished.</span>{activeTab !== 'assessment' && <Button onClick={() => onTab('assessment')}>Assessment options</Button>}</>;
  } else {
    footer = <span className="text-sm text-ink-2">Nothing to do until {name} picks a time.</span>;
  }

  const ids = tabIds(idBase, activeTab);

  return (
    <SidePanel label={`${item.row.patientName}, visit details`} onClose={onClose} header={header} footer={footer} contentKey={`${idBase}`}>
      <div role="tabpanel" id={ids.panel} aria-labelledby={ids.tab} className="flex flex-col gap-6">
        {notice && <p role="alert" className="rounded-xl bg-signal-red-bg px-3.5 py-2.5 text-sm text-signal-red">{notice}</p>}

        {activeTab === 'visit' && <>
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-ink-2">Reason for visit, in their words</span>
            {item.row.chiefComplaint
              ? <p className="font-display text-[22px] leading-[1.35] text-ink">{item.row.chiefComplaint}</p>
              : <p className="text-ink-3">No reason recorded</p>}
          </div>
          <dl className="grid grid-cols-2 gap-x-7 gap-y-4">
            {appointment && <>
              <Fact label={item.group === 'new' ? 'Requested time' : 'Appointment'} value={slotLabel(slotStart(appointment), appointment.timezone)} hint={placesHint(item, availability) ?? (item.group === 'expected' ? (item.pending ? 'Confirming' : 'Confirmed') : undefined)} />
              {item.group === 'new' && appointment.expiresAt
                ? <Fact label="Held until" value={slotLabel(appointment.expiresAt, appointment.timezone)} hint="Then the time is released" />
                : <Fact label="Assessment" value="Finished" hint="Physicians read it in Care" />}
            </>}
            {visit && <>
              <Fact label={item.group === 'walkins' ? 'Registered' : 'Visit started'} value={slotLabel(visit.createdAt, null)} />
              <Fact label="Assessment" value={visit.interviewStatus === 'complete' ? 'Finished' : visit.interviewStatus === 'in_progress' ? 'In progress' : visit.interviewStatus === 'emergency_ack_required' ? 'Stopped at an emergency check' : 'Not started'} />
            </>}
            <Fact label="Email" value={item.row.contactEmail || <span className="text-ink-3">Not given</span>} />
            <Fact label="Phone" value={item.row.contactPhone || <span className="text-ink-3">Not given</span>} />
            {appointment && item.group === 'new' && <Fact label="Assessment" value="Finished" hint="Physicians read it in Care" />}
            {appointment && <Fact label="Visit started" value={slotLabel(appointment.createdAt, appointment.timezone)} />}
          </dl>
          {appointment && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold text-ink-2">For PS-SUITE</span>
                <CopyButton text={appointment.copyText} label="Copy" />
              </div>
              <p className="whitespace-pre-line rounded-xl border border-line bg-[#F5F7FA] px-3.5 py-3 text-[13px] leading-relaxed text-[#1E2643]">{appointment.copyText}</p>
            </div>
          )}
          {item.group === 'awaiting' && <p className="text-[15px] text-ink-2">This visit moves to New requests when {name} picks a time. Nothing to do yet.</p>}
        </>}

        {activeTab === 'emails' && appointment && (
          <ClinicDeliveryHistory
            key={appointment.id}
            appointmentId={appointment.id}
            bare
            emptyText={item.group === 'new' ? 'No emails yet. The confirmation email goes out when you confirm the time.' : 'No emails recorded for this visit.'}
          />
        )}

        {activeTab === 'assessment' && item.group === 'walkins' && (
          <DeskAssessment row={item.row} grant={grant} busy={busy} error={deskError} onIssue={onIssueGrant} onRevoke={onRevokeGrant} onAskTogether={onAskTogether} />
        )}
      </div>
    </SidePanel>
  );
});
