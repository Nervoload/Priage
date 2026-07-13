import { Injectable } from '@nestjs/common';

import { AI_TRIAGE_SYSTEM_PROMPT, buildAiTriagePrompt } from '../prompts/ai-triage.prompts';
import type { AiTriageGenerationInput, AiTriageProviderResult } from '../types/ai-triage.types';
import { parseAiTriageProviderOutput } from '../validation/ai-triage-response.schema';
import type { AiTriageProvider } from './ai-triage.provider';

type AnthropicResponse = {
  id?: string;
  content?: Array<{ type?: string; text?: string }>;
};

@Injectable()
export class AnthropicTriageAdapter implements AiTriageProvider {
  readonly name = 'anthropic' as const;

  isConfigured(): boolean {
    return !!process.env.ANTHROPIC_API_KEY?.trim();
  }

  async generateNextStep(input: AiTriageGenerationInput): Promise<AiTriageProviderResult | null> {
    if (!this.isConfigured()) return null;
    const prompt = buildAiTriagePrompt(input);
    try {
      const first = await this.call(prompt);
      let output = parseAiTriageProviderOutput(first.text);
      let responseId = first.id;
      if (!output) {
        const repaired = await this.call(`${prompt}\nYour previous output was malformed. Return one valid JSON object only.`);
        output = parseAiTriageProviderOutput(repaired.text);
        responseId = repaired.id;
      }
      return output ? {
        output,
        provider: this.name,
        model: process.env.AI_MODEL?.trim() || 'claude-sonnet-4-5',
        responseId,
      } : null;
    } catch {
      return null;
    }
  }

  private async call(prompt: string): Promise<{ text: string; id: string }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), readTimeout());
    try {
      const response = await fetch(`${(process.env.ANTHROPIC_BASE_URL?.trim() || 'https://api.anthropic.com/v1').replace(/\/$/, '')}/messages`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY?.trim() || '',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: process.env.AI_MODEL?.trim() || 'claude-sonnet-4-5',
          max_tokens: 1000,
          system: AI_TRIAGE_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!response.ok) throw new Error(`Anthropic triage request failed: ${response.status}`);
      const body = await response.json() as AnthropicResponse;
      const text = body.content?.find((item) => item.type === 'text')?.text?.trim() || '';
      if (!text) throw new Error('Anthropic triage response was empty');
      return { text, id: body.id ?? '' };
    } finally {
      clearTimeout(timeout);
    }
  }
}

function readTimeout(): number {
  const parsed = Number(process.env.AI_TIMEOUT_MS ?? '12000');
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 12000;
}
