import { Injectable } from '@nestjs/common';

import { TRIAGE_INTERVIEW_BASE_PROMPT_V2 } from './prompts/triage-interview-base.prompt';
import { renderSelectedCtasCues } from './prompts/triage-interview-ctas-reference';
import { TRIAGE_INTERVIEW_FEW_SHOT_EXAMPLES_V2 } from './prompts/triage-interview-few-shot-examples';
import { TRIAGE_INTERVIEW_OUTPUT_SCHEMA_PROMPT_V2 } from './prompts/triage-interview-output-schema.prompt';
import { TRIAGE_INTERVIEW_PHASE_PROMPTS_V2 } from './prompts/triage-interview-phase-prompts';
import { TRIAGE_INTERVIEW_RESPONSE_JSON_SCHEMA, TRIAGE_INTERVIEW_RESPONSE_SCHEMA_NAME } from './triage-interview-response.schema';
import type {
  InterviewInputType,
  InterviewInterrupt,
  InterviewPhase,
  InterviewUrgency,
  ProviderGenerationInput,
  ProviderGenerationResult,
  ProviderInterviewResult,
  ProviderQuestionDraft,
} from './triage-interview.types';

type OpenAiResponsesApiResponse = {
  id?: string;
  output_text?: string | null;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string | null;
      refusal?: string | null;
    }>;
  }>;
};

type OpenAiResponsePayload = {
  text: string;
  responseId: string;
};

type ReasoningEffort = 'low' | 'medium' | 'high';

@Injectable()
export class OpenAiCompatibleTriageInterviewProvider {
  private readonly apiKey = process.env.TRIAGE_AI_API_KEY?.trim() ?? '';
  private readonly model = process.env.TRIAGE_AI_MODEL?.trim() || 'gpt-5-mini';
  private readonly baseUrl = process.env.TRIAGE_AI_BASE_URL?.trim() || 'https://api.openai.com/v1';
  private readonly timeoutMs = Number(process.env.TRIAGE_AI_TIMEOUT_MS ?? '12000');
  private readonly promptVersion = process.env.TRIAGE_AI_PROMPT_VERSION?.trim() || 'v2';
  private readonly reasoningEffort = this.parseReasoningEffort(process.env.TRIAGE_AI_REASONING_EFFORT);
  private readonly maxOutputTokens = Number(process.env.TRIAGE_AI_MAX_OUTPUT_TOKENS ?? '1400');

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  async generate(input: ProviderGenerationInput): Promise<ProviderGenerationResult | null> {
    if (!this.isConfigured()) {
      return null;
    }

    try {
      const prompt = this.buildPrompt(input);
      const firstResponse = await this.callModel(prompt);
      const parsed = this.parseProviderResult(firstResponse.text);

      if (parsed) {
        return {
          result: parsed,
          providerState: {
            providerName: 'openai',
            model: this.model,
            responseId: firstResponse.responseId,
            promptVersion: this.promptVersion,
          },
        };
      }

      const repairedResponse = await this.callModel(
        [
          prompt,
          '',
          'The previous response was invalid or did not follow the schema exactly.',
          'Repair it into strict JSON that matches the required schema and do not add any commentary.',
          '',
          'Invalid content:',
          firstResponse.text,
        ].join('\n'),
      );

      const repaired = this.parseProviderResult(repairedResponse.text);
      if (!repaired) {
        return null;
      }

      return {
        result: repaired,
        providerState: {
          providerName: 'openai',
          model: this.model,
          responseId: repairedResponse.responseId,
          promptVersion: this.promptVersion,
        },
      };
    } catch {
      return null;
    }
  }

  private buildPrompt(input: ProviderGenerationInput): string {
    return [
      TRIAGE_INTERVIEW_BASE_PROMPT_V2,
      '',
      TRIAGE_INTERVIEW_OUTPUT_SCHEMA_PROMPT_V2,
      '',
      TRIAGE_INTERVIEW_PHASE_PROMPTS_V2[input.phase],
      '',
      renderSelectedCtasCues(input.patient, input.answers),
      '',
      TRIAGE_INTERVIEW_FEW_SHOT_EXAMPLES_V2,
      '',
      'Current generation request:',
      JSON.stringify(
        {
          phase: input.phase,
          dynamicQuestionsAnswered: input.askedCount,
          maxDynamicQuestions: input.maxQuestions,
          remainingBudget: Math.max(0, input.maxQuestions - input.askedCount),
          requestedBatchSize: input.batchSize,
          emergencyAcknowledged: input.emergencyAcknowledged,
          priorSessionGoal: input.sessionGoal,
          priorTargetQuestionCount: input.targetQuestionCount,
          patient: input.patient,
          answeredQuestions: input.answers.map((answer) => ({
            phase: answer.phase,
            prompt: answer.prompt,
            answerText: answer.answerText,
          })),
          unansweredPriorCandidates: input.pendingCandidates.map((question) => ({
            phase: question.phase,
            inputType: question.inputType,
            prompt: question.prompt,
            helpText: question.helpText || '',
            placeholder: question.placeholder || '',
            required: question.required,
            choices: question.choices,
            clinicalReason: question.clinicalReason || '',
            askIfAmbiguous: question.askIfAmbiguous,
          })),
        },
        null,
        2,
      ),
    ].join('\n');
  }

  private async callModel(prompt: string): Promise<OpenAiResponsePayload> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const body: Record<string, unknown> = {
        model: this.model,
        instructions: 'You are a structured emergency intake planning engine.',
        input: prompt,
        max_output_tokens: this.maxOutputTokens,
        text: {
          format: {
            type: 'json_schema',
            name: TRIAGE_INTERVIEW_RESPONSE_SCHEMA_NAME,
            strict: true,
            schema: TRIAGE_INTERVIEW_RESPONSE_JSON_SCHEMA,
          },
        },
      };

      if (this.reasoningEffort) {
        body.reasoning = { effort: this.reasoningEffort };
      }

      const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/responses`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`Interview provider failed with ${response.status}`);
      }

      const parsed = await response.json() as OpenAiResponsesApiResponse;
      const outputText = this.extractOutputText(parsed);
      if (!outputText) {
        throw new Error('Interview provider returned no structured output.');
      }

      return {
        text: outputText,
        responseId: typeof parsed.id === 'string' ? parsed.id : '',
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private extractOutputText(response: OpenAiResponsesApiResponse): string {
    if (typeof response.output_text === 'string' && response.output_text.trim().length > 0) {
      return response.output_text.trim();
    }

    for (const item of response.output ?? []) {
      for (const content of item.content ?? []) {
        if (typeof content.text === 'string' && content.text.trim().length > 0) {
          return content.text.trim();
        }
        if (typeof content.refusal === 'string' && content.refusal.trim().length > 0) {
          return '';
        }
      }
    }

    return '';
  }

  private parseProviderResult(content: string): ProviderInterviewResult | null {
    if (!content) {
      return null;
    }

    try {
      const parsed = JSON.parse(content) as Record<string, unknown>;
      if (
        !this.isPhase(parsed.phase)
        || typeof parsed.sessionGoal !== 'string'
        || typeof parsed.targetQuestionCount !== 'number'
        || typeof parsed.shouldComplete !== 'boolean'
        || typeof parsed.completionReason !== 'string'
        || !this.isUrgency(parsed.urgency)
      ) {
        return null;
      }

      const interrupt = this.parseInterrupt(parsed.interrupt);
      if (!interrupt) {
        return null;
      }

      const questions = Array.isArray(parsed.questions)
        ? parsed.questions
            .map((question) => this.parseQuestion(question))
            .filter((question): question is ProviderQuestionDraft => question !== null)
        : [];

      const redFlags = Array.isArray(parsed.redFlags)
        ? parsed.redFlags
            .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
            .map((value) => value.trim())
        : [];

      return {
        phase: parsed.phase,
        sessionGoal: parsed.sessionGoal.trim(),
        targetQuestionCount: parsed.targetQuestionCount,
        shouldComplete: parsed.shouldComplete,
        completionReason: parsed.completionReason.trim(),
        urgency: parsed.urgency,
        redFlags,
        recommendedAction: typeof parsed.recommendedAction === 'string' ? parsed.recommendedAction.trim() : '',
        summaryPreview: typeof parsed.summaryPreview === 'string' ? parsed.summaryPreview.trim() : '',
        interrupt,
        questions,
      };
    } catch {
      return null;
    }
  }

  private parseInterrupt(value: unknown): InterviewInterrupt | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const interrupt = value as Record<string, unknown>;
    if (
      (interrupt.type !== 'none' && interrupt.type !== 'emergency_ack_required')
      || typeof interrupt.title !== 'string'
      || typeof interrupt.body !== 'string'
      || typeof interrupt.recommendation !== 'string'
      || typeof interrupt.reason !== 'string'
    ) {
      return null;
    }

    return {
      type: interrupt.type,
      title: interrupt.title.trim(),
      body: interrupt.body.trim(),
      recommendation: interrupt.recommendation.trim(),
      reason: interrupt.reason.trim(),
    };
  }

  private parseQuestion(value: unknown): ProviderQuestionDraft | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const question = value as Record<string, unknown>;
    if (
      !this.isPhase(question.phase)
      || !this.isInputType(question.inputType)
      || typeof question.prompt !== 'string'
      || typeof question.helpText !== 'string'
      || typeof question.placeholder !== 'string'
      || typeof question.required !== 'boolean'
      || typeof question.clinicalReason !== 'string'
      || typeof question.askIfAmbiguous !== 'boolean'
    ) {
      return null;
    }

    const choices = Array.isArray(question.choices)
      ? question.choices
          .filter((choice): choice is string => typeof choice === 'string' && choice.trim().length > 0)
          .map((choice) => choice.trim())
      : [];

    return {
      phase: question.phase,
      inputType: question.inputType,
      prompt: question.prompt.trim(),
      helpText: question.helpText.trim(),
      placeholder: question.placeholder.trim(),
      required: question.required,
      choices,
      clinicalReason: question.clinicalReason.trim(),
      askIfAmbiguous: question.askIfAmbiguous,
    };
  }

  private parseReasoningEffort(value: string | undefined): ReasoningEffort | null {
    if (value === 'low' || value === 'medium' || value === 'high') {
      return value;
    }
    return null;
  }

  private isPhase(value: unknown): value is InterviewPhase {
    return value === 'urgent' || value === 'emergent' || value === 'history';
  }

  private isInputType(value: unknown): value is InterviewInputType {
    return value === 'text' || value === 'textarea' || value === 'number' || value === 'boolean' || value === 'single_select';
  }

  private isUrgency(value: unknown): value is InterviewUrgency {
    return value === 'low' || value === 'medium' || value === 'high' || value === 'emergency';
  }
}
