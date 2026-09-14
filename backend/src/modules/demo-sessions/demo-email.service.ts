import { Injectable, Logger } from '@nestjs/common';

type DemoEmailInput = {
  email: string;
  code: string;
  organization?: string | null;
  expiresAt: Date;
};

@Injectable()
export class DemoEmailService {
  private readonly logger = new Logger(DemoEmailService.name);

  async sendDemoCode(input: DemoEmailInput): Promise<void> {
    const webhookUrl = process.env.DEMO_EMAIL_WEBHOOK_URL?.trim();
    if (webhookUrl) {
      await this.sendViaWebhook(webhookUrl, input);
      return;
    }

    this.logger.log({
      message: 'Demo access code generated',
      email: input.email,
      organization: input.organization ?? undefined,
      code: input.code,
      expiresAt: input.expiresAt.toISOString(),
    });
  }

  private async sendViaWebhook(webhookUrl: string, input: DemoEmailInput): Promise<void> {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template: 'priage-demo-code',
        to: input.email,
        code: input.code,
        organization: input.organization,
        expiresAt: input.expiresAt.toISOString(),
      }),
    });

    if (!response.ok) {
      this.logger.error({
        message: 'Demo email webhook failed',
        status: response.status,
        email: input.email,
      });
    }
  }
}
