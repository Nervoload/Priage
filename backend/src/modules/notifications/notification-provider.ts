import { Injectable } from '@nestjs/common';
import { Resend, type GetDomainResponseSuccess, type GetEmailResponseSuccess } from 'resend';
import { assertProviderConfiguration, emailMode, type EmailPayload } from './notification-core';

export class EmailSendError extends Error {
  constructor(readonly code: string, readonly retryable: boolean, readonly ambiguous: boolean) { super(code); }
}

@Injectable()
export class NotificationProvider {
  private domainCheckedAt = 0;
  private async verifySenderDomain() {
    if (Date.now() - this.domainCheckedAt < 60_000) return;
    const options = { headers: {}, signal: AbortSignal.timeout(10_000) };
    const response = await new Resend(process.env.RESEND_API_KEY).get<GetDomainResponseSuccess>('/domains/' + encodeURIComponent(process.env.RESEND_SENDER_DOMAIN_ID!), options);
    if (response.error) throw new EmailSendError('sender_domain_check_unavailable', true, false);
    const domain = response.data;
    const senderDomain = process.env.CLINIC_EMAIL_FROM?.split('@')[1]?.toLowerCase();
    if (!domain || domain.status !== 'verified' || domain.name.toLowerCase() !== senderDomain || domain.open_tracking !== false || domain.click_tracking !== false) throw new EmailSendError('sender_domain_or_tracking_not_ready', false, false);
    this.domainCheckedAt = Date.now();
  }
  async send(payload: EmailPayload, key: string): Promise<{ id: string; provider: string }> {
    const mode = emailMode();
    if (mode === 'capture') return { id: 'capture_' + key, provider: 'capture' };
    if (mode === 'disabled') throw new EmailSendError('delivery_disabled', false, false);
    assertProviderConfiguration();
    if (mode === 'test' && !(process.env.CLINIC_EMAIL_RECIPIENT_ALLOWLIST || '').split(',').map((item) => item.trim().toLowerCase()).includes(payload.to[0].toLowerCase())) throw new EmailSendError('recipient_not_allowlisted', false, false);
    try {
      await this.verifySenderDomain();
      const options = { idempotencyKey: key, signal: AbortSignal.timeout(15_000) };
      const result = await new Resend(process.env.RESEND_API_KEY).emails.send(payload, options);
      if (result.error) {
        const code = result.error.name;
        const retryable = ['rate_limit_exceeded', 'daily_quota_exceeded', 'monthly_quota_exceeded', 'concurrent_idempotent_requests', 'application_error', 'internal_server_error'].includes(code);
        throw new EmailSendError(code, retryable, ['application_error', 'internal_server_error', 'concurrent_idempotent_requests'].includes(code));
      }
      if (!result.data?.id) throw new EmailSendError('missing_provider_receipt', true, true);
      return { id: result.data.id, provider: 'resend' };
    } catch (error) { if (error instanceof EmailSendError) throw error; throw new EmailSendError('provider_network_error', true, true); }
  }

  verify(body: string, headers: { id: string; timestamp: string; signature: string }) {
    return new Resend(process.env.RESEND_API_KEY || 'unused').webhooks.verify({ payload: body, headers, webhookSecret: process.env.RESEND_WEBHOOK_SECRET || '' });
  }

  async retrieve(id: string) { const options = { headers: {}, signal: AbortSignal.timeout(10_000) }; return new Resend(process.env.RESEND_API_KEY).get<GetEmailResponseSuccess>('/emails/' + encodeURIComponent(id), options); }
}
