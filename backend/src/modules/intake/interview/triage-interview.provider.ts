import { Injectable } from '@nestjs/common';
import type {
  InterviewPhase,
  InterviewUrgency,
  ProviderGenerationInput,
  ProviderGenerationResult,
  ProviderQuestionDraft,
} from './triage-interview.types';

/**
 * Simple AI question generator using OpenAI Chat Completions.
 * Takes the patient's complaint + prior answers and returns
 * dynamic follow-up questions in the same format the service expects.
 */
@Injectable()
export class TriageAiProvider {
  private readonly apiKey = process.env.TRIAGE_AI_API_KEY?.trim() ?? '';
  private readonly model = process.env.TRIAGE_AI_MODEL?.trim() || 'gpt-4o-mini';
  private readonly baseUrl = process.env.TRIAGE_AI_BASE_URL?.trim() || 'https://api.openai.com/v1';

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  /**
   * Generate the next batch of triage questions using AI.
   * Returns null if not configured or if the API call fails.
   */
  async generate(input: ProviderGenerationInput): Promise<ProviderGenerationResult | null> {
    if (!this.isConfigured()) {
      return null;
    }

    try {
      const systemPrompt = this.buildSystemPrompt();
      const userPrompt = this.buildUserPrompt(input);

      const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.4,
          max_tokens: 1200,
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json() as {
        id?: string;
        choices?: Array<{ message?: { content?: string } }>;
      };

      const content = data.choices?.[0]?.message?.content?.trim();
      if (!content) {
        return null;
      }

      return this.parseAiResponse(content, input, data.id ?? '');
    } catch {
      return null;
    }
  }

  // ─── Prompts ──────────────────────────────────────────────────────────

  private buildSystemPrompt(): string {
    return `You are a triage nurse at an emergency department. Your job is to generate follow-up questions for patients checking in digitally.

RULES:
- Generate questions that are SPECIFIC to the patient's chief complaint and their answers so far.
- Each question asks about ONE thing only.
- Use plain, patient-friendly language (no medical jargon).
- Ask the most urgent safety questions first, then symptom details, then relevant history.
- Do NOT re-ask anything already answered.
- Do NOT ask for name, age, sex, or phone — those are already collected.

QUESTION TYPES you can use:
- "text": short free-text answer (1-2 sentences)
- "textarea": longer free-text (for descriptions)
- "number": numeric input (e.g. pain scale 0-10)
- "boolean": yes/no question (must include choices: ["Yes", "No"])
- "single_select": pick one from a list (must include choices array)

PHASES:
- "urgent": red-flag / safety questions (breathing, bleeding, consciousness)
- "emergent": symptom detail questions (severity, timeline, associated symptoms)
- "history": background questions (medications, allergies, conditions)

Return a JSON object with this exact shape:
{
  "phase": "urgent" | "emergent" | "history",
  "sessionGoal": "brief description of what we're trying to learn",
  "targetQuestionCount": <number 3-12>,
  "shouldComplete": <boolean — true if enough info collected>,
  "completionReason": "why completing, or empty string",
  "urgency": "low" | "medium" | "high" | "emergency",
  "redFlags": ["list of concerning findings"],
  "recommendedAction": "brief staff recommendation",
  "summaryPreview": "brief summary of what we know so far",
  "questions": [
    {
      "phase": "urgent" | "emergent" | "history",
      "inputType": "text" | "textarea" | "number" | "boolean" | "single_select",
      "prompt": "the question to ask the patient",
      "helpText": "brief help text below the question",
      "placeholder": "example placeholder text or empty",
      "required": true | false,
      "choices": [] or ["Option A", "Option B"],
      "clinicalReason": "why this question matters",
      "askIfAmbiguous": true | false
    }
  ]
}

Output ONLY valid JSON, nothing else.`;
  }

  private buildUserPrompt(input: ProviderGenerationInput): string {
    const parts: string[] = [];

    // Patient info
    parts.push(`Patient complaint: "${input.patient.chiefComplaint ?? 'Not specified'}"`);
    if (input.patient.details) parts.push(`Details: "${input.patient.details}"`);
    if (input.patient.age != null) parts.push(`Age: ${input.patient.age}`);
    if (input.patient.gender) parts.push(`Gender: ${input.patient.gender}`);
    if (input.patient.allergies) parts.push(`Allergies: ${input.patient.allergies}`);
    if (input.patient.conditions) parts.push(`Conditions: ${input.patient.conditions}`);

    // Prior answers
    if (input.answers.length > 0) {
      parts.push('');
      parts.push('Already asked and answered:');
      for (const a of input.answers) {
        parts.push(`- Q: "${a.prompt}" → A: "${a.answerText}"`);
      }
    }

    // Request
    parts.push('');
    parts.push(`Current phase: ${input.phase}`);
    parts.push(`Questions asked so far: ${input.askedCount} of ${input.maxQuestions} max`);
    parts.push(`Generate up to ${input.batchSize} new questions for this patient.`);
    parts.push(`Set shouldComplete=true if you have enough info (minimum ${input.askedCount >= 3 ? 'reached' : 'not yet reached, need at least 3'}).`);

    return parts.join('\n');
  }

  // ─── Response Parsing ─────────────────────────────────────────────────

  private parseAiResponse(
    content: string,
    input: ProviderGenerationInput,
    responseId: string,
  ): ProviderGenerationResult | null {
    try {
      const parsed = JSON.parse(content) as Record<string, unknown>;

      // Validate required top-level fields
      const phase = this.toPhase(parsed.phase) ?? input.phase;
      const urgency = this.toUrgency(parsed.urgency) ?? 'medium';
      const sessionGoal = typeof parsed.sessionGoal === 'string' ? parsed.sessionGoal : '';
      const targetQuestionCount = typeof parsed.targetQuestionCount === 'number' ? parsed.targetQuestionCount : 6;
      const shouldComplete = typeof parsed.shouldComplete === 'boolean' ? parsed.shouldComplete : false;
      const completionReason = typeof parsed.completionReason === 'string' ? parsed.completionReason : '';
      const summaryPreview = typeof parsed.summaryPreview === 'string' ? parsed.summaryPreview : '';
      const recommendedAction = typeof parsed.recommendedAction === 'string' ? parsed.recommendedAction : '';

      const redFlags = Array.isArray(parsed.redFlags)
        ? parsed.redFlags.filter((f): f is string => typeof f === 'string')
        : [];

      // Parse questions
      const questions: ProviderQuestionDraft[] = [];
      if (Array.isArray(parsed.questions)) {
        for (const q of parsed.questions) {
          const draft = this.parseQuestion(q, phase);
          if (draft) questions.push(draft);
        }
      }

      return {
        result: {
          phase,
          sessionGoal,
          targetQuestionCount,
          shouldComplete,
          completionReason,
          urgency,
          redFlags,
          recommendedAction,
          summaryPreview,
          interrupt: { type: 'none', title: '', body: '', recommendation: '', reason: '' },
          questions,
        },
        providerState: {
          providerName: 'openai',
          model: this.model,
          responseId,
          promptVersion: 'v1-chat',
        },
      };
    } catch {
      return null;
    }
  }

  private parseQuestion(value: unknown, fallbackPhase: InterviewPhase): ProviderQuestionDraft | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const q = value as Record<string, unknown>;

    if (typeof q.prompt !== 'string' || !q.prompt.trim()) return null;

    const inputType = this.toInputType(q.inputType) ?? 'text';
    const choices = Array.isArray(q.choices)
      ? q.choices.filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
      : [];

    // Boolean questions must have Yes/No choices
    if (inputType === 'boolean' && choices.length === 0) {
      choices.push('Yes', 'No');
    }

    return {
      phase: this.toPhase(q.phase) ?? fallbackPhase,
      inputType,
      prompt: (q.prompt as string).trim(),
      helpText: typeof q.helpText === 'string' ? q.helpText.trim() : '',
      placeholder: typeof q.placeholder === 'string' ? q.placeholder.trim() : '',
      required: typeof q.required === 'boolean' ? q.required : true,
      choices,
      clinicalReason: typeof q.clinicalReason === 'string' ? q.clinicalReason.trim() : '',
      askIfAmbiguous: typeof q.askIfAmbiguous === 'boolean' ? q.askIfAmbiguous : false,
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  private toPhase(v: unknown): InterviewPhase | null {
    if (v === 'urgent' || v === 'emergent' || v === 'history') return v;
    return null;
  }

  private toUrgency(v: unknown): InterviewUrgency | null {
    if (v === 'low' || v === 'medium' || v === 'high' || v === 'emergency') return v;
    return null;
  }

  private toInputType(v: unknown): ProviderQuestionDraft['inputType'] | null {
    if (v === 'text' || v === 'textarea' || v === 'number' || v === 'boolean' || v === 'single_select') return v;
    return null;
  }
}
