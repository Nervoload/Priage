import { useCallback, useEffect, useState } from 'react';

import {
  createAlertWebhook,
  listAlertWebhookDeliveries,
  listAlertWebhooks,
  retryAlertWebhookDelivery,
  rotateAlertWebhookSecret,
  testAlertWebhook,
  updateAlertWebhook,
  type AlertWebhookDelivery,
  type AlertWebhookSeverity,
  type AlertWebhookSubscription,
} from '../../shared/api/alertWebhooks';
import { useToast } from '../../shared/ui/ToastContext';

const SEVERITIES: AlertWebhookSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const INPUT = 'w-full rounded-[16px] border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-priage-400';

export function AlertEscalationSettings({ hospitalId }: { hospitalId: number }) {
  const { showToast } = useToast();
  const [subscriptions, setSubscriptions] = useState<AlertWebhookSubscription[]>([]);
  const [deliveries, setDeliveries] = useState<Record<number, AlertWebhookDelivery[]>>({});
  const [name, setName] = useState('On-call escalation');
  const [targetUrl, setTargetUrl] = useState('');
  const [minimumSeverity, setMinimumSeverity] = useState<AlertWebhookSeverity>('HIGH');
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const next = await listAlertWebhooks(hospitalId);
    setSubscriptions(next);
    const history = await Promise.all(
      next.map(async (subscription) => [
        subscription.id,
        await listAlertWebhookDeliveries(hospitalId, subscription.id),
      ] as const),
    );
    setDeliveries(Object.fromEntries(history));
  }, [hospitalId]);

  useEffect(() => {
    void reload().catch((error) => {
      console.error('[AlertEscalationSettings] Failed to load webhooks:', error);
      showToast('Could not load alert escalation targets.', 'error');
    });
  }, [reload, showToast]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      console.error('[AlertEscalationSettings] Webhook operation failed:', error);
      showToast(error instanceof Error ? error.message : 'Webhook operation failed.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-white/80 bg-white/90 px-5 py-5 shadow-[0_24px_70px_-50px_rgba(15,23,42,0.45)]">
        <h2 className="font-hospital-display text-xl font-semibold text-slate-950">Alert escalation target</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Send PHI-free safety events to an allowlisted on-call webhook. The signing secret is shown only once.
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-[0.8fr,1.5fr,0.55fr,auto]">
          <input className={INPUT} value={name} onChange={(event) => setName(event.target.value)} placeholder="Display name" />
          <input className={INPUT} value={targetUrl} onChange={(event) => setTargetUrl(event.target.value)} placeholder="https://alerts.example.ca/priage" />
          <select className={INPUT} value={minimumSeverity} onChange={(event) => setMinimumSeverity(event.target.value as AlertWebhookSeverity)}>
            {SEVERITIES.map((severity) => <option key={severity}>{severity}</option>)}
          </select>
          <button
            disabled={busy || !name.trim() || !targetUrl.trim()}
            onClick={() => void run(async () => {
              const created = await createAlertWebhook(hospitalId, { name, targetUrl, minimumSeverity });
              setRevealedSecret(created.signingSecret);
              setTargetUrl('');
              await reload();
              showToast('Escalation target created. Copy its signing secret now.', 'success');
            })}
            className="rounded-[16px] bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Create
          </button>
        </div>
        {revealedSecret && (
          <div className="mt-4 rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-800">Copy this secret now</div>
            <code className="mt-2 block break-all text-sm text-amber-950">{revealedSecret}</code>
            <button className="mt-2 text-sm font-semibold text-amber-900 underline" onClick={() => setRevealedSecret(null)}>I have stored it securely</button>
          </div>
        )}
      </section>

      {subscriptions.map((subscription) => (
        <section key={subscription.id} className="rounded-[28px] border border-white/80 bg-white/90 px-5 py-5 shadow-[0_24px_70px_-50px_rgba(15,23,42,0.45)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-950">{subscription.name}</h3>
              <div className="mt-1 break-all text-sm text-slate-500">{subscription.targetUrl}</div>
              <div className="mt-2 text-xs text-slate-500">Secret …{subscription.secretFingerprint} · key v{subscription.secretKeyVersion}</div>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${subscription.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
              {subscription.status}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <select
              className={`${INPUT} w-auto`}
              value={subscription.minimumSeverity}
              disabled={busy}
              onChange={(event) => void run(async () => {
                await updateAlertWebhook(hospitalId, subscription.id, { minimumSeverity: event.target.value as AlertWebhookSeverity });
                await reload();
              })}
            >
              {SEVERITIES.map((severity) => <option key={severity} value={severity}>{severity}+</option>)}
            </select>
            <button className="rounded-[14px] border border-slate-300 px-3 py-2 text-sm font-semibold" disabled={busy} onClick={() => void run(async () => { await testAlertWebhook(hospitalId, subscription.id); await reload(); showToast('Test delivery queued.', 'success'); })}>Test</button>
            <button className="rounded-[14px] border border-slate-300 px-3 py-2 text-sm font-semibold" disabled={busy} onClick={() => void run(async () => { const rotated = await rotateAlertWebhookSecret(hospitalId, subscription.id); setRevealedSecret(rotated.signingSecret); await reload(); })}>Rotate secret</button>
            <button className="rounded-[14px] border border-slate-300 px-3 py-2 text-sm font-semibold" disabled={busy} onClick={() => void run(async () => { await updateAlertWebhook(hospitalId, subscription.id, { status: subscription.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' }); await reload(); })}>{subscription.status === 'ACTIVE' ? 'Disable' : 'Enable'}</button>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="text-slate-500"><tr><th className="py-2">Event</th><th>Status</th><th>Attempts</th><th>Last attempt</th><th /></tr></thead>
              <tbody>
                {(deliveries[subscription.id] ?? []).slice(0, 10).map((delivery) => (
                  <tr key={delivery.id} className="border-t border-slate-100">
                    <td className="py-2 pr-3 font-medium text-slate-800">{delivery.eventType}</td>
                    <td className="pr-3">{delivery.status}{delivery.responseStatus ? ` (${delivery.responseStatus})` : ''}</td>
                    <td className="pr-3">{delivery.attempts}</td>
                    <td className="pr-3">{delivery.lastAttemptAt ? new Date(delivery.lastAttemptAt).toLocaleString() : 'Not attempted'}</td>
                    <td>{delivery.status === 'FAILED' && <button className="font-semibold text-priage-700 underline" disabled={busy} onClick={() => void run(async () => { await retryAlertWebhookDelivery(hospitalId, subscription.id, delivery.id); await reload(); })}>Retry</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
