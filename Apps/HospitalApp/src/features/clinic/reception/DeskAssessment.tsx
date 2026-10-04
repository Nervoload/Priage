import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Button, StatusLine } from '../ui/controls';
import { CopyButton } from '../ui/CopyButton';
import { Icon } from '../ui/Icon';
import { firstName, interviewWords, timeOnly, untilWords, type ClinicRow } from './receptionModel';

export type Grant = { grantId: number; token: string; expiresAt: string; walkInPath: string; issuedAt?: string };

const GRANT_MINUTES = 10;

function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

// The Assessment tab for a walk-in: hand over a one-use code, or ask the
// questions together. Care starts once the assessment is finished.
export function DeskAssessment({ row, grant, busy, error, onIssue, onRevoke, onAskTogether }: {
  row: ClinicRow; grant: Grant | null; busy: boolean; error: string;
  onIssue: () => void; onRevoke: () => void; onAskTogether: () => void;
}) {
  const now = useNow(15_000);
  const [qr, setQr] = useState<{ url: string; image: string } | null>(null);
  const [showCode, setShowCode] = useState(false);
  const name = firstName(row.patientName);
  const patientAppUrl = (import.meta.env.VITE_PATIENT_APP_URL as string | undefined)?.replace(/\/$/, '');
  const deskUrl = grant && patientAppUrl ? `${patientAppUrl}${grant.walkInPath}#token=${encodeURIComponent(grant.token)}` : null;
  const expired = grant ? new Date(grant.expiresAt) <= now : false;
  const expiresMs = grant ? new Date(grant.expiresAt).getTime() : 0;
  const lifetimeMs = grant?.issuedAt ? expiresMs - new Date(grant.issuedAt).getTime() : GRANT_MINUTES * 60_000;
  const leftRatio = grant ? Math.max(0, Math.min(1, (expiresMs - now.getTime()) / Math.max(lifetimeMs, 1))) : 0;

  useEffect(() => {
    setShowCode(false);
    if (!deskUrl) { setQr(null); return; }
    let active = true;
    void QRCode.toDataURL(deskUrl, { width: 288, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0E1630', light: '#FFFFFF' } })
      .then((image) => { if (active) setQr({ url: deskUrl, image }); })
      .catch(() => { if (active) setQr(null); });
    return () => { active = false; };
  }, [deskUrl]);

  if (row.interviewStatus === 'complete') {
    return (
      <div className="flex flex-col gap-2">
        <StatusLine tone="green">Assessment finished</StatusLine>
        <p className="text-[15px] text-ink-2">Care can start when a physician is ready. {name} doesn’t need to do anything else at the desk.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p role="alert" className="rounded-xl bg-signal-red-bg px-3.5 py-2.5 text-sm text-signal-red">{error}</p>}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[15px] text-ink-2">Care starts once the assessment is finished.</p>
        <StatusLine tone={row.interviewStatus === 'emergency_ack_required' ? 'red' : 'amber'} className="shrink-0 text-[13px]">{interviewWords(row.interviewStatus)}</StatusLine>
      </div>

      {grant && !expired ? (
        <section aria-label="One-use code" className="flex flex-col gap-4 rounded-2xl border border-line p-4 sm:flex-row sm:items-center">
          <div className="shrink-0 self-start rounded-xl bg-white p-2 shadow-[0_0_0_1px_rgba(14,22,48,.08)]">
            {qr?.url === deskUrl ? <img src={qr.image} width={136} height={136} alt={`QR code that opens ${name}’s assessment once`} /> : <div className="flex h-[136px] w-[136px] items-center justify-center text-center text-xs text-ink-3">{patientAppUrl ? 'Drawing the code…' : 'Set the patient app address to show a QR code'}</div>}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            <div className="flex flex-col gap-0.5">
              <span className="text-[17px] font-semibold">Scan to start the assessment</span>
              <span className="text-sm text-ink-2">Works once. Expires at <strong className="font-semibold tabular-nums text-ink">{timeOnly(grant.expiresAt)}</strong>, {untilWords(grant.expiresAt, now)}.</span>
            </div>
            <div aria-hidden="true" className="h-1 overflow-hidden rounded-full bg-sunken"><div className="h-full rounded-full bg-brand transition-[width] duration-700" style={{ width: `${Math.round(leftRatio * 100)}%` }} /></div>
            <div className="flex flex-wrap items-center gap-1">
              {deskUrl && <CopyButton text={deskUrl} label="Copy link" />}
              {deskUrl && <a href={deskUrl} target="_blank" rel="noreferrer" className="inline-flex h-[34px] items-center gap-1.5 rounded-[10px] px-2.5 text-[13px] font-semibold text-brand-700 hover:bg-brand-select"><Icon name="external" size={15} />Open</a>}
              <Button variant="quiet" size="sm" onClick={() => setShowCode((value) => !value)} aria-expanded={showCode}>{showCode ? 'Hide code' : 'Show code'}</Button>
            </div>
            {showCode && <code className="break-all rounded-lg bg-paper px-2.5 py-2 font-mono text-xs text-ink-2">{grant.token}</code>}
            <Button variant="dangerQuiet" size="sm" className="self-start" busy={busy} onClick={onRevoke}>Revoke code</Button>
          </div>
        </section>
      ) : (
        <div className="flex flex-col gap-2.5">
          {grant && expired && <p className="text-sm text-signal-amber">The last code expired at {timeOnly(grant.expiresAt)}. Create a new one if {name} still needs it.</p>}
          <div className="flex items-start gap-3.5 rounded-2xl border border-line p-4">
            <span className="mt-0.5 text-brand"><Icon name="tablet" size={20} /></span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-semibold">{name} answers on a device</span>
              <span className="text-[13px] text-ink-3">The desk tablet or their own phone. A one-use code opens only this assessment, for {GRANT_MINUTES} minutes.</span>
            </div>
            <Button size="sm" busy={busy} onClick={onIssue}>Create code</Button>
          </div>
        </div>
      )}

      <div className="flex items-start gap-3.5 rounded-2xl border border-line p-4">
        <span className="mt-0.5 text-ink-2"><Icon name="people" size={20} /></span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-semibold">Ask the questions together</span>
          <span className="text-[13px] text-ink-3">You enter {name}’s answers. Each one is recorded as entered by you.</span>
        </div>
        <Button size="sm" onClick={onAskTogether}>{row.interviewStatus === 'not_started' ? 'Start' : 'Continue'}</Button>
      </div>
    </div>
  );
}
