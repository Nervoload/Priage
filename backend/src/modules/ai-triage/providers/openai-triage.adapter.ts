import { Injectable } from '@nestjs/common';

import { AI_TRIAGE_SYSTEM_PROMPT, buildAiTriagePrompt } from '../prompts/ai-triage.prompts';
import type { AiTriageGenerationInput, AiTriageProviderResult } from '../types/ai-triage.types';
import {
  AI_TRIAGE_RESPONSE_JSON_SCHEMA,
  AI_TRIAGE_RESPONSE_SCHEMA_NAME,
  parseAiTriageProviderOutput,
} from '../validation/ai-triage-response.schema';
import type { AiTriageProvider } from './ai-triage.provider';

type OpenAiResponse = {
  id?: string;
  output_text?: string;
  output?: Array<{ content?: Array<{ text?: string }> }>;
};

@Injectable()
export class OpenAiTriageAdapter implements AiTriageProvider {
  readonly name = 'openai' as const;

  isConfigured(): boolean {
    return !!process.env.OPENAI_API_KEY?.trim();
  }

  async generateNextStep(input: AiTriageGenerationInput): Promise<AiTriageProviderResult | null> {
    if (!this.isConfigured()) return null;
    const prompt = buildAiTriagePrompt(input);
    try {
      const first = await this.call(prompt);
      let output = parseAiTriageProviderOutput(first.text);
      let responseId = first.id;
      if (!output) {
        const repaired = await this.call(`${prompt}\nYour previous output was malformed. Return valid schema JSON only.`);
        output = parseAiTriageProviderOutput(repaired.text);
        responseId = repaired.id;
      }
      return output ? {
        output,
        provider: this.name,
        model: process.env.AI_MODEL?.trim() || 'gpt-5-mini',
        responseId,
      } : null;
    } catch (error) {
      // Fail closed to the fallback bank, but leave a trace of why the AI call failed.
      console.warn(`[ai-triage] OpenAI request failed: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  private async call(prompt: string): Promise<{ text: string; id: string }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), readTimeout());
    const model = process.env.AI_MODEL?.trim() || 'gpt-5-mini';
    const payload: Record<string, unknown> = {
      model,
      instructions: AI_TRIAGE_SYSTEM_PROMPT,
      input: prompt,
      // Reasoning models spend part of this budget on hidden reasoning tokens,
      // so keep the cap generous enough that the JSON answer is never truncated.
      max_output_tokens: 4000,
      text: {
        format: {
          type: 'json_schema',
          name: AI_TRIAGE_RESPONSE_SCHEMA_NAME,
          strict: true,
          schema: AI_TRIAGE_RESPONSE_JSON_SCHEMA,
        },
      },
    };
    if (/^(gpt-5|o\d)/.test(model)) {
      payload.reasoning = { effort: 'low' };
    }
    try {
      const response = await fetch(`${(process.env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1').replace(/\/$/, '')}/responses`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY?.trim()}`,
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`OpenAI triage request failed: ${response.status} ${detail.slice(0, 300)}`);
      }
      const body = await response.json() as OpenAiResponse;
      const text = body.output_text?.trim()
        || body.output?.flatMap((item) => item.content ?? []).map((item) => item.text ?? '').find(Boolean)
        || '';
      if (!text) throw new Error('OpenAI triage response was empty');
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
