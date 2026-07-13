import type { ReactNode } from 'react';

import type { PriageSummary } from '../types/domain';

interface PriageSummaryPanelProps {
  summary: PriageSummary | null | undefined;
  compact?: boolean;
  showRawJson?: boolean;
}

export function PriageSummaryPanel({
  summary,
  compact = false,
  showRawJson = true,
}: PriageSummaryPanelProps) {
  if (!summary) {
    return (
      <div className="rounded-[20px] border border-slate-200/80 bg-slate-50/88 px-4 py-5 text-sm text-slate-500">
        No AI-assisted intake handoff is available for this encounter.
      </div>
    );
  }

  const baseline = summary.mandatoryAnswers;
  const warningItems = unique([...summary.urgentWarningSigns, ...summary.redFlags]);

  return (
    <section className={`space-y-4 ${compact ? '' : 'rounded-[26px] border border-sky-100 bg-sky-50/35 p-4 sm:p-5'}`}>
      <div className={`rounded-[22px] border px-4 py-4 ${
        summary.urgentReview ? 'border-rose-300 bg-rose-50' : 'border-sky-200 bg-sky-50'
      }`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-800">
            Patient-reported AI intake
          </span>
          <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-700">
            Unreviewed
          </span>
          <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-700">
            {summary.generationMode}
          </span>
          <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-700">
            Intake flag: {summary.urgency}
          </span>
          {summary.urgentReview && (
            <span className="rounded-full bg-rose-700 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
              Immediate staff review
            </span>
          )}
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-900">{summary.briefing}</p>
        <p className="mt-2 text-xs leading-5 text-slate-600">
          Generated {formatDateTime(summary.generatedAt)}. This information does not contain a confirmed diagnosis or triage level.
        </p>
      </div>

      <div className={`grid gap-3 ${compact ? '' : 'md:grid-cols-2'}`}>
        <DataCard title="Original chief concern">
          <p className="text-sm leading-6 text-slate-700">
            {summary.originalChiefComplaint || summary.chiefComplaint || 'Not provided'}
          </p>
        </DataCard>

        <DataCard title="Required baseline">
          <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-2 text-sm">
            <dt className="font-semibold text-slate-500">Onset</dt>
            <dd className="text-slate-800">{summary.onset || baseline?.onset || 'Unknown'}</dd>
            <dt className="font-semibold text-slate-500">Severity</dt>
            <dd className="text-slate-800">{summary.severity || formatValue(baseline?.severity) || 'Unknown'}</dd>
            <dt className="font-semibold text-slate-500">Progression</dt>
            <dd className="text-slate-800">{summary.progression || baseline?.progression || 'Unknown'}</dd>
            <dt className="font-semibold text-slate-500">Relevant history</dt>
            <dd className="text-slate-800">{baseline?.relevantHistory || 'Unknown'}</dd>
          </dl>
        </DataCard>
      </div>

      <ListSection title="Reported details" items={summary.relevantSymptoms} />
      <ListSection title="Patient explicitly denied" items={summary.relevantNegatives} tone="emerald" />
      <ListSection title="Possible warning signs" items={warningItems} tone="rose" />

      <div className={`grid gap-3 ${compact ? '' : 'md:grid-cols-3'}`}>
        <ListSection title="Medical history" items={summary.medicalHistory} />
        <ListSection title="Medications" items={summary.medications} />
        <ListSection title="Allergies" items={summary.allergies} />
      </div>

      <ListSection title="Additional context" items={summary.additionalContext} />
      <ListSection
        title="Important information still unknown"
        items={summary.unansweredImportantQuestions}
        tone="amber"
      />

      {summary.questionAnswers.length > 0 && (
        <DataCard title="Intake question log">
          <div className="space-y-3">
            {summary.questionAnswers.map((item, index) => (
              <div key={`${item.answeredAt}-${index}`} className="rounded-[16px] border border-slate-200 bg-white px-3 py-3">
                <div className="text-sm font-semibold text-slate-800">{item.question}</div>
                <div className="mt-1 text-sm leading-6 text-slate-600">{item.answer}</div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-slate-400">
                  {item.phase} · {formatDateTime(item.answeredAt)}
                </div>
              </div>
            ))}
          </div>
        </DataCard>
      )}

      {summary.recommendedAction && (
        <DataCard title="System handoff note">
          <p className="text-sm leading-6 text-slate-700">{summary.recommendedAction}</p>
        </DataCard>
      )}

      {showRawJson && (
        <details className="rounded-[18px] border border-slate-200 bg-slate-950 text-slate-100">
          <summary className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em]">
            Structured intake JSON
          </summary>
          <pre className="max-h-96 overflow-auto border-t border-slate-700 p-4 text-xs leading-5">
            {JSON.stringify(summary.structuredData, null, 2)}
          </pre>
        </details>
      )}
    </section>
  );
}

function DataCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[20px] border border-slate-200/80 bg-white px-4 py-4">
      <h4 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</h4>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function ListSection({
  title,
  items,
  tone = 'slate',
}: {
  title: string;
  items: string[];
  tone?: 'slate' | 'rose' | 'amber' | 'emerald';
}) {
  if (items.length === 0) return null;

  const toneClass = {
    slate: 'border-slate-200 bg-white text-slate-700',
    rose: 'border-rose-200 bg-rose-50 text-rose-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  }[tone];

  return (
    <section className={`rounded-[20px] border px-4 py-4 ${toneClass}`}>
      <h4 className="text-[10px] font-semibold uppercase tracking-[0.18em]">{title}</h4>
      <ul className="mt-2 space-y-1.5 pl-5 text-sm leading-6">
        {items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
      </ul>
    </section>
  );
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function formatValue(value: number | string | undefined): string {
  if (value == null) return '';
  return String(value).replace(/_/g, ' ');
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
