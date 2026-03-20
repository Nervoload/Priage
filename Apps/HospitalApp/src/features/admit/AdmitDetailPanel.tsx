import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { EncounterDetail } from '../../shared/types/domain';
import { patientName } from '../../shared/types/domain';
import { CTASBadge } from '../../shared/ui/Badge';
import { StatusPill } from '../../shared/ui/StatusPill';
import {
  DASHBOARD_STATUS_THEME,
  formatDashboardPatientSex,
  getDashboardAvatarTheme,
  getDashboardInitials,
} from '../../shared/ui/dashboardTheme';
import { checkFormCompleteness, buildReminderMessage } from '../../shared/hooks/formCompleteness';

interface AdmitDetailPanelProps {
  encounter: EncounterDetail;
  onClose: () => void;
  onAdmit: (encounter: EncounterDetail) => void;
  onSendReminder?: (encounter: EncounterDetail, message: string) => Promise<void>;
}

type DetailTab = 'overview' | 'form' | 'summary';

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return 'Not recorded';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatHealthInfoLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (value) => value.toUpperCase())
    .trim();
}

function formatHealthInfoValues(value: unknown): string[] {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean);
  }
  if (typeof value === 'boolean') return [value ? 'Yes' : 'No'];
  if (typeof value === 'object') return [JSON.stringify(value)];
  return [String(value)];
}

export function AdmitDetailPanel({ encounter, onClose, onAdmit, onSendReminder }: AdmitDetailPanelProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [expanded, setExpanded] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [reminderSent, setReminderSent] = useState(false);
  const [reminderError, setReminderError] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab('overview');
    setExpanded(false);
    setReminderSent(false);
    setReminderError(null);
  }, [encounter.id]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const name = patientName(encounter.patient);
  const initials = getDashboardInitials(name);
  const avatarTheme = getDashboardAvatarTheme(encounter.patientId);
  const patientSex = formatDashboardPatientSex(encounter.patient.gender);
  const completeness = checkFormCompleteness(encounter);
  const actionLabel =
    encounter.status === 'EXPECTED'
      ? 'Confirm Arrival'
      : encounter.status === 'ADMITTED'
        ? 'Start Triage'
        : 'Update';

  const statusTheme = DASHBOARD_STATUS_THEME[encounter.status].cardPill;
  const healthInfo = encounter.patient.optionalHealthInfo as Record<string, unknown> | null;
  const healthInfoEntries = Object.entries(healthInfo ?? {}).filter(([key, value]) => {
    if (key === 'warningNotes') return false;
    if (value == null || value === '') return false;
    if (Array.isArray(value) && value.length === 0) return false;
    return true;
  });

  const handleBack = () => onClose();

  const handleSendReminder = async () => {
    if (!onSendReminder) return;
    const message = buildReminderMessage(completeness);
    if (!message) return;

    setSendingReminder(true);
    setReminderError(null);
    try {
      await onSendReminder(encounter, message);
      setReminderSent(true);
    } catch (error) {
      setReminderError(error instanceof Error ? error.message : 'Failed to send reminder');
    } finally {
      setSendingReminder(false);
    }
  };

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in"
      onClick={(event) => {
        if (event.target === backdropRef.current) onClose();
      }}
    >
      <div className="absolute inset-0 bg-slate-950/35 backdrop-blur-[3px]" />

      <div
        className={`
          relative flex w-full flex-col overflow-hidden rounded-[34px] border border-white/80
          bg-[radial-gradient(circle_at_top,_rgba(255,247,237,0.95)_0%,_rgba(255,255,255,0.96)_34%,_rgba(248,250,252,1)_100%)]
          shadow-[0_32px_90px_-48px_rgba(15,23,42,0.55)] animate-slide-up
          ${expanded ? 'h-[calc(100vh-24px)] max-w-none w-[calc(100vw-24px)]' : 'max-h-[88vh] max-w-6xl'}
        `}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative overflow-hidden border-b border-slate-200/80 bg-white/78">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_right,_rgba(219,234,254,0.8)_0%,_transparent_62%)]" />

          <div className="relative px-6 pb-5 pt-5">
            <div className="flex items-center justify-between gap-4">
              <button
                onClick={handleBack}
                className="inline-flex items-center gap-2 rounded-[16px] border border-slate-200/80 bg-white/90 px-3 py-2 text-sm font-semibold text-slate-600 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.35)] transition-colors hover:border-slate-300 hover:text-slate-900 cursor-pointer"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                  Back
              </button>

              <button
                onClick={() => setExpanded((value) => !value)}
                className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-slate-200/80 bg-white/90 text-slate-400 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.35)] transition-colors hover:border-slate-300 hover:text-slate-700 cursor-pointer"
                title={expanded ? 'Collapse popup' : 'Expand to fullscreen'}
              >
                {expanded ? (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M10 2v4h4M6 14v-4H2M10 6L14 2M6 10l-4 4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M14 2l-4 4M2 14l4-4M10 2h4v4M6 14H2v-4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            </div>

            <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-start">
              <div
                className="flex h-18 w-18 shrink-0 items-center justify-center rounded-[24px] text-xl font-bold text-white shadow-[0_22px_48px_-24px_rgba(15,23,42,0.55)]"
                style={{ backgroundImage: avatarTheme.gradient }}
              >
                {initials}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-hospital-display text-[1.9rem] font-semibold tracking-[-0.04em] text-slate-950">
                    {name}
                  </h2>
                  <StatusPill
                    status={encounter.status}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-bold tracking-[0.16em] ${statusTheme}`}
                  />
                  {encounter.currentCtasLevel && <CTASBadge level={encounter.currentCtasLevel} size="md" />}
                  {encounter.priageSummary?.recommendedCtasLevel != null && (
                    <span className="inline-flex items-center rounded-full bg-sky-100 px-3 py-1 text-[11px] font-semibold text-sky-800">
                      AI CTAS {encounter.priageSummary.recommendedCtasLevel}
                    </span>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                  <span>{patientSex}</span>
                  <span>{encounter.patient.age != null ? `Age: ${encounter.patient.age}` : 'Age: N/A'}</span>
                  <span>#{encounter.id}</span>
                  <span>{encounter.patient.phone ?? 'No phone listed'}</span>
                </div>

                <p className="mt-4 max-w-4xl text-[1.08rem] font-semibold leading-7 text-slate-800">
                  {encounter.chiefComplaint ?? 'No chief complaint recorded'}
                </p>
                {encounter.details && (
                  <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-500">{encounter.details}</p>
                )}
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <HeaderMetric
                label="Form completion"
                value={`${completeness.score}%`}
                supporting={
                  completeness.issues.length === 0
                    ? 'All required intake fields are complete'
                    : `${completeness.issues.length} intake items still need review`
                }
              />
              <HeaderMetric
                label="Encounter status"
                value={encounter.status}
                supporting={encounter.currentPriorityScore != null ? `Priority ${encounter.currentPriorityScore}` : 'Priority pending'}
              />
              <HeaderMetric
                label="Arrival"
                value={formatDateTime(encounter.arrivedAt)}
                supporting={encounter.expectedAt ? `Expected ${formatDateTime(encounter.expectedAt)}` : 'No expected arrival time'}
              />
              <HeaderMetric
                label="AI handoff"
                value={encounter.priageSummary ? 'Available' : 'Pending'}
                supporting={
                  encounter.priageSummary
                    ? `${encounter.priageSummary.questionAnswers.length} intake answers summarized`
                    : 'No Priage summary has been generated yet'
                }
              />
            </div>
          </div>

          <div className="relative border-t border-slate-200/80 px-6 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-[18px] border border-slate-200/80 bg-slate-50/90 p-1 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.34)]">
                <PageButton
                  active={activeTab === 'overview'}
                  onClick={() => setActiveTab('overview')}
                  label="Overview"
                />
                <PageButton
                  active={activeTab === 'form'}
                  onClick={() => setActiveTab('form')}
                  label="Form Details"
                />
                <PageButton
                  active={activeTab === 'summary'}
                  onClick={() => setActiveTab('summary')}
                  label="Priage AI Summary"
                />
              </div>

              {activeTab === 'summary' && !encounter.priageSummary && (
                <span className="text-xs font-medium text-slate-500">
                  The Priage AI summary has not been generated for this encounter yet.
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-4 custom-scrollbar">
          {activeTab === 'overview' ? (
            <OverviewPage
              encounter={encounter}
            />
          ) : activeTab === 'form' ? (
            <FormDetailsPage
              encounter={encounter}
              completeness={completeness}
              reminderSent={reminderSent}
              reminderError={reminderError}
              sendingReminder={sendingReminder}
              healthInfoEntries={healthInfoEntries}
              onSendReminder={onSendReminder ? handleSendReminder : undefined}
            />
          ) : (
            <SummaryPage encounter={encounter} />
          )}
        </div>

        <div className="border-t border-slate-200/80 bg-white/84 px-6 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs font-medium text-slate-500">
              {encounter.priageSummary
                ? `Summary generated ${formatDateTime(encounter.priageSummary.generatedAt)}`
                : `Encounter created ${formatDateTime(encounter.createdAt)}`}
            </div>
            <button
              onClick={() => onAdmit(encounter)}
              className="inline-flex items-center justify-center rounded-[18px] bg-accent-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_22px_42px_-24px_rgba(220,38,38,0.6)] transition-all hover:bg-accent-700 active:scale-[0.98] cursor-pointer"
            >
              {actionLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function OverviewPage({
  encounter,
}: {
  encounter: EncounterDetail;
}) {
  const patient = encounter.patient;

  return (
    <div className="grid gap-4 xl:grid-cols-[1.08fr,0.92fr]">
      <SectionCard eyebrow="Patient" title="Profile">
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoField label="Full Name" value={patientName(patient)} />
          <InfoField label="Encounter ID" value={`#${encounter.id}`} />
          <InfoField label="Sex" value={formatDashboardPatientSex(patient.gender)} />
          <InfoField label="Age" value={patient.age != null ? `${patient.age} years` : 'Not recorded'} />
          <InfoField label="Phone" value={patient.phone ?? 'Not recorded'} />
          <InfoField label="Language" value={patient.preferredLanguage ?? 'English'} />
        </div>
      </SectionCard>

      <SectionCard eyebrow="Encounter" title="Current Information">
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoField label="Status" value={encounter.status} />
          <InfoField label="Current CTAS" value={encounter.currentCtasLevel != null ? String(encounter.currentCtasLevel) : 'Pending'} />
          <InfoField label="Priority Score" value={encounter.currentPriorityScore != null ? String(encounter.currentPriorityScore) : 'Pending'} />
          <InfoField label="Generated Preview" value={encounter.priagePreview ? 'Available' : 'Not yet available'} />
        </div>
      </SectionCard>

      {(patient.allergies || patient.conditions) && (
        <SectionCard eyebrow="Medical" title="Alerts" tone="rose">
          <div className="space-y-3">
            {patient.allergies && (
              <AlertBlock label="Allergies" value={patient.allergies} />
            )}
            {patient.conditions && (
              <AlertBlock label="Conditions" value={patient.conditions} />
            )}
          </div>
        </SectionCard>
      )}

      <SectionCard eyebrow="Encounter" title="Timeline">
        <div className="space-y-4">
          <TimelineItem label="Created" time={encounter.createdAt} />
          <TimelineItem label="Expected" time={encounter.expectedAt} />
          <TimelineItem label="Arrived" time={encounter.arrivedAt} />
          <TimelineItem label="Triage Started" time={encounter.triagedAt} />
          <TimelineItem label="Waiting" time={encounter.waitingAt} />
          <TimelineItem label="Seen" time={encounter.seenAt} />
          <TimelineItem label="Departed" time={encounter.departedAt} />
        </div>
      </SectionCard>
    </div>
  );
}

function FormDetailsPage({
  encounter,
  completeness,
  reminderSent,
  reminderError,
  sendingReminder,
  healthInfoEntries,
  onSendReminder,
}: {
  encounter: EncounterDetail;
  completeness: ReturnType<typeof checkFormCompleteness>;
  reminderSent: boolean;
  reminderError: string | null;
  sendingReminder: boolean;
  healthInfoEntries: Array<[string, unknown]>;
  onSendReminder?: () => Promise<void>;
}) {
  const patient = encounter.patient;
  const completenessTone =
    completeness.score >= 80
      ? 'bg-emerald-500'
      : completeness.score >= 50
        ? 'bg-amber-500'
        : 'bg-rose-500';

  const missingFields = new Set(completeness.issues.map((issue) => issue.field));
  const formFieldRows = [
    { field: 'firstName', label: 'First Name', value: patient.firstName ?? 'Missing' },
    { field: 'lastName', label: 'Last Name', value: patient.lastName ?? 'Missing' },
    { field: 'chiefComplaint', label: 'Chief Complaint', value: encounter.chiefComplaint ?? 'Missing' },
    { field: 'phone', label: 'Phone Number', value: patient.phone ?? 'Missing' },
    { field: 'age', label: 'Age', value: patient.age != null ? `${patient.age}` : 'Missing' },
    { field: 'gender', label: 'Sex', value: patient.gender ?? 'Missing' },
    { field: 'allergies', label: 'Allergies', value: patient.allergies ?? 'Not provided' },
    { field: 'conditions', label: 'Medical Conditions', value: patient.conditions ?? 'Not provided' },
    {
      field: 'optionalHealthInfo',
      label: 'Pre-Triage Questionnaire',
      value: healthInfoEntries.length > 0 ? `${healthInfoEntries.length} field${healthInfoEntries.length === 1 ? '' : 's'} completed` : 'Not completed',
    },
  ];

  const questionAnswers = encounter.priageSummary?.questionAnswers ?? [];

  return (
    <div className="grid gap-4 xl:grid-cols-[1.02fr,0.98fr]">
      <SectionCard eyebrow="Forms" title="Completion Status">
        <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/88 px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-800">{completeness.score}% complete</div>
            <div className="text-xs text-slate-500">
              {completeness.issues.length === 0 ? 'Everything needed is present' : `${completeness.issues.length} fields need attention`}
            </div>
          </div>
          <div className="mt-3 h-2.5 rounded-full bg-slate-200">
            <div
              className={`h-2.5 rounded-full transition-all ${completenessTone}`}
              style={{ width: `${completeness.score}%` }}
            />
          </div>
        </div>

        {completeness.issues.length > 0 ? (
          <div className="mt-4 space-y-2">
            {completeness.issues.map((issue) => (
              <div
                key={issue.field}
                className="flex items-center justify-between gap-3 rounded-[18px] border border-slate-200/80 bg-white/92 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-800">{issue.label}</div>
                  <div className="text-xs text-slate-500">Needs intake follow-up</div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                    issue.severity === 'required' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {issue.severity}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-[18px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
            This patient has completed the required intake information.
          </div>
        )}

        {completeness.issues.length > 0 && onSendReminder && (
          <div className="mt-4">
            {reminderSent ? (
              <div className="rounded-[18px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
                Reminder sent to the patient to complete missing forms.
              </div>
            ) : (
              <>
                <button
                  onClick={() => {
                    void onSendReminder();
                  }}
                  disabled={sendingReminder}
                  className="inline-flex items-center justify-center rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                >
                  {sendingReminder ? 'Sending...' : 'Send Reminder to Complete Forms'}
                </button>
                {reminderError && <p className="mt-2 text-sm text-rose-600">{reminderError}</p>}
              </>
            )}
          </div>
        )}
      </SectionCard>

      <SectionCard eyebrow="Forms" title="Detailed Field Review">
        <div className="space-y-2">
          {formFieldRows.map((row) => {
            const isMissing = missingFields.has(row.field);
            return (
              <div
                key={row.field}
                className="flex items-center justify-between gap-3 rounded-[18px] border border-slate-200/80 bg-slate-50/88 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-800">{row.label}</div>
                  <div className="truncate text-xs text-slate-500">{row.value}</div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                    isMissing ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {isMissing ? 'Needs input' : 'Captured'}
                </span>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {healthInfoEntries.length > 0 ? (
        <SectionCard eyebrow="Questionnaire" title="Submitted Form Responses">
          <div className="grid gap-3 sm:grid-cols-2">
            {healthInfoEntries.map(([key, value]) => (
              <MultiValueField key={key} label={formatHealthInfoLabel(key)} values={formatHealthInfoValues(value)} />
            ))}
          </div>
        </SectionCard>
      ) : (
        <SectionCard eyebrow="Questionnaire" title="Submitted Form Responses">
          <div className="rounded-[18px] border border-slate-200/80 bg-slate-50/88 px-4 py-4 text-sm text-slate-500">
            No structured questionnaire responses have been submitted yet.
          </div>
        </SectionCard>
      )}

      <SectionCard eyebrow="Questions" title="Completed Intake Questions">
        {questionAnswers.length > 0 ? (
          <div className="space-y-3">
            {questionAnswers.map((item, index) => (
              <div key={`${item.answeredAt}-${index}`} className="rounded-[20px] border border-slate-200/80 bg-slate-50/88 px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {item.phase}
                  </span>
                  <span className="text-[10px] font-medium text-slate-400">{formatDateTime(item.answeredAt)}</span>
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-800">{item.question}</div>
                <div className="mt-1 text-sm leading-6 text-slate-600">{item.answer}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[18px] border border-slate-200/80 bg-slate-50/88 px-4 py-4 text-sm text-slate-500">
            No question-and-answer detail is available for this encounter yet.
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function SummaryPage({ encounter }: { encounter: EncounterDetail }) {
  const summary = encounter.priageSummary;

  if (!summary) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center">
        <div className="max-w-lg rounded-[28px] border border-slate-200/80 bg-white/92 px-6 py-8 text-center shadow-[0_24px_60px_-42px_rgba(15,23,42,0.38)]">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[18px] bg-slate-100 text-slate-500">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M7 5.5A2.5 2.5 0 0 1 9.5 3h7A2.5 2.5 0 0 1 19 5.5v13A2.5 2.5 0 0 1 16.5 21h-7A2.5 2.5 0 0 1 7 18.5v-13Z"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path d="M10 8h6M10 12h6M10 16h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M5 7v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <h3 className="mt-4 font-hospital-display text-2xl font-semibold tracking-[-0.03em] text-slate-900">
            No Priage AI Summary Yet
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            This encounter does not have an AI handoff summary yet. The profile and intake page still contains the patient and form information needed for admittance.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.04fr,0.96fr]">
      <SectionCard eyebrow="AI Briefing" title="Priage Intake Handoff" tone="sky">
        <div className="rounded-[22px] border border-sky-200 bg-sky-50 px-4 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-700">
              Generated {formatDateTime(summary.generatedAt)}
            </span>
            <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-800">
              {summary.generationMode}
            </span>
            {summary.recommendedCtasLevel != null && (
              <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-sky-800">
                Provisional CTAS {summary.recommendedCtasLevel}
              </span>
            )}
          </div>
          <p className="mt-3 text-sm leading-6 text-sky-950">{summary.briefing}</p>
        </div>

        <div className="mt-4 rounded-[22px] border border-slate-200/80 bg-slate-50/88 px-4 py-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Case Summary</div>
          <p className="mt-2 text-sm leading-6 text-slate-700">{summary.caseSummary}</p>
        </div>

        <div className="mt-4 rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Recommended Action</div>
          <p className="mt-2 text-sm leading-6 text-emerald-900">{summary.recommendedAction}</p>
        </div>
      </SectionCard>

      <div className="space-y-4">
        {summary.redFlags.length > 0 && (
          <SectionCard eyebrow="Risk" title="Red Flags" tone="rose">
            <BulletList items={summary.redFlags} tone="rose" />
          </SectionCard>
        )}

        {summary.progressionRisks.length > 0 && (
          <SectionCard eyebrow="Monitoring" title="Progression Risks" tone="amber">
            <BulletList items={summary.progressionRisks} tone="amber" />
          </SectionCard>
        )}

        <SectionCard eyebrow="Summary" title="Summary Metadata">
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoField label="Generated" value={formatDateTime(summary.generatedAt)} />
            <InfoField label="Generation Mode" value={summary.generationMode} />
            <InfoField
              label="Question Answers"
              value={`${summary.questionAnswers.length} recorded`}
            />
            <InfoField
              label="Progression Risks"
              value={`${summary.progressionRisks.length} identified`}
            />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function PageButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`
        rounded-[14px] px-4 py-2.5 text-sm font-semibold transition-all cursor-pointer
        ${active
          ? 'bg-slate-900 text-white shadow-[0_16px_34px_-24px_rgba(15,23,42,0.82)]'
          : 'text-slate-600 hover:bg-white hover:text-slate-900'
        }
      `}
    >
      {label}
    </button>
  );
}

function HeaderMetric({
  label,
  value,
  supporting,
}: {
  label: string;
  value: string;
  supporting: string;
}) {
  return (
    <div className="rounded-[22px] border border-white/80 bg-white/88 px-4 py-3 shadow-[0_20px_48px_-38px_rgba(15,23,42,0.45)]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-1 font-hospital-display text-lg font-semibold tracking-[-0.03em] text-slate-900">
        {value}
      </div>
      <div className="mt-1 text-xs text-slate-500">{supporting}</div>
    </div>
  );
}

function SectionCard({
  eyebrow,
  title,
  children,
  tone = 'default',
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  tone?: 'default' | 'rose' | 'sky' | 'amber';
}) {
  const toneClasses = {
    default: 'border-white/80 bg-white/92',
    rose: 'border-rose-100/90 bg-[linear-gradient(180deg,_rgba(255,241,242,0.96)_0%,_rgba(255,255,255,0.94)_100%)]',
    sky: 'border-sky-100/90 bg-[linear-gradient(180deg,_rgba(239,246,255,0.96)_0%,_rgba(255,255,255,0.94)_100%)]',
    amber: 'border-amber-100/90 bg-[linear-gradient(180deg,_rgba(255,251,235,0.96)_0%,_rgba(255,255,255,0.94)_100%)]',
  };

  return (
    <section className={`rounded-[24px] border p-5 shadow-[0_20px_50px_-38px_rgba(15,23,42,0.42)] ${toneClasses[tone]}`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">{eyebrow}</div>
      <h3 className="mt-2 font-hospital-display text-xl font-semibold tracking-[-0.03em] text-slate-900">
        {title}
      </h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-slate-200/80 bg-slate-50/88 px-4 py-3 shadow-[0_16px_32px_-30px_rgba(15,23,42,0.34)]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-800">{value}</div>
    </div>
  );
}

function MultiValueField({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="rounded-[20px] border border-slate-200/80 bg-slate-50/88 px-4 py-3 shadow-[0_16px_32px_-30px_rgba(15,23,42,0.34)]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.map((value, index) => (
          <span key={`${label}-${index}`} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
            {value}
          </span>
        ))}
      </div>
    </div>
  );
}

function AlertBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-700">{label}</div>
      <div className="mt-2 text-sm leading-6 text-rose-900">{value}</div>
    </div>
  );
}

function TimelineItem({ label, time }: { label: string; time: string | null | undefined }) {
  const active = Boolean(time);

  return (
    <div className="flex items-start gap-3">
      <div className={`mt-1.5 h-2.5 w-2.5 rounded-full ${active ? 'bg-priage-500' : 'bg-slate-300'}`} />
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-800">{label}</div>
        <div className="text-xs text-slate-500">{formatDateTime(time)}</div>
      </div>
    </div>
  );
}

function BulletList({ items, tone }: { items: string[]; tone: 'rose' | 'amber' }) {
  const dotClass = tone === 'rose' ? 'bg-rose-500' : 'bg-amber-500';
  const textClass = tone === 'rose' ? 'text-rose-900' : 'text-amber-900';

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item} className="flex items-start gap-3 rounded-[18px] border border-white/80 bg-white/78 px-4 py-3">
          <span className={`mt-2 h-2 w-2 rounded-full ${dotClass}`} />
          <span className={`text-sm leading-6 ${textClass}`}>{item}</span>
        </div>
      ))}
    </div>
  );
}
