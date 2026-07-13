import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { LoggingService } from '../logging/logging.service';
import { AnswerTriageDto } from './dto/answer-triage.dto';
import { StartTriageDto } from './dto/start-triage.dto';
import type { AiTriageProvider } from './providers/ai-triage.provider';
import { AnthropicTriageAdapter } from './providers/anthropic-triage.adapter';
import { OpenAiTriageAdapter } from './providers/openai-triage.adapter';
import { AiTriageSafetyService } from './safety/ai-triage-safety.service';
import { AiTriageStateStore } from './state/ai-triage-state.store';
import { AiTriageSummaryService } from './summary/ai-triage-summary.service';
import {
  AI_TRIAGE_MAX_QUESTIONS,
  type AiTriageAnswer,
  type AiTriageClientResponse,
  type AiTriageMandatoryAnswers,
  type AiTriagePatientContext,
  type AiTriageProviderOutput,
  type AiTriageQuestion,
  type AiTriageState,
} from './types/ai-triage.types';

@Injectable()
export class AiTriageService {
  constructor(
    private readonly store: AiTriageStateStore,
    private readonly safety: AiTriageSafetyService,
    private readonly summaries: AiTriageSummaryService,
    private readonly openAi: OpenAiTriageAdapter,
    private readonly anthropic: AnthropicTriageAdapter,
    private readonly logging: LoggingService,
  ) {}

  async start(
    authSessionId: number,
    patientId: number,
    dto: StartTriageDto,
    correlationId?: string,
  ): Promise<AiTriageClientResponse> {
    const session = await this.store.getOrCreateSession(authSessionId, patientId, correlationId);
    const existing = await this.store.loadState(session.id);
    if (existing) return this.toClientResponse(existing.state);

    const storedPatient = await this.store.loadPatientContext(session.id);
    const patient = { ...storedPatient, chiefComplaint: dto.chiefComplaint.trim() };
    const mandatoryAnswers = this.normalizeMandatory(dto.mandatoryAnswers);
    await this.store.saveBaseline(
      session.id,
      patientId,
      dto.chiefComplaint.trim(),
      mandatoryAnswers,
      correlationId,
    );
    const safety = this.safety.evaluate(patient, this.mandatorySafetyText(mandatoryAnswers));
    const now = new Date().toISOString();
    let state: AiTriageState = {
      sessionId: session.publicId,
      status: safety.urgent ? 'urgent_review' : 'in_progress',
      questionCount: 0,
      maxQuestions: AI_TRIAGE_MAX_QUESTIONS,
      currentQuestion: null,
      chiefComplaint: dto.chiefComplaint.trim(),
      mandatoryAnswers,
      answers: [],
      summary: this.summaries.merge(patient, mandatoryAnswers, [], null, safety.redFlags),
      provider: 'fallback',
      completionReason: safety.urgent ? this.safety.urgentMessage() : '',
      createdAt: now,
      updatedAt: now,
      submittedAt: null,
    };
    if (!safety.urgent) {
      state = await this.generateNext(state, [], 0, patient, mandatoryAnswers);
    }
    await this.store.saveState(session.id, patientId, state, null, correlationId);
    if (state.status === 'urgent_review') {
      await this.store.saveSubmittedSummary(session.id, patientId, state, correlationId);
    }
    await this.logState('start', state, patientId, correlationId);
    return this.toClientResponse(state);
  }

  async get(
    publicId: string,
    authSessionId: number,
    patientId: number,
  ): Promise<AiTriageClientResponse> {
    const session = await this.store.assertOwnedSession(publicId, authSessionId, patientId);
    const loaded = await this.store.loadState(session.id);
    if (!loaded) throw new NotFoundException('Triage session has not been started');
    return this.toClientResponse(loaded.state);
  }

  async answer(
    publicId: string,
    authSessionId: number,
    patientId: number,
    dto: AnswerTriageDto,
    correlationId?: string,
  ): Promise<AiTriageClientResponse> {
    const session = await this.store.assertOwnedSession(publicId, authSessionId, patientId);
    const loaded = await this.store.loadState(session.id);
    if (!loaded) throw new NotFoundException('Triage session has not been started');
    const state = loaded.state;
    if (state.status === 'urgent_review' || state.status === 'submitted') {
      throw new ConflictException('This triage session is terminal');
    }
    if (state.status === 'ready_to_complete') {
      throw new ConflictException('This triage session is ready to complete');
    }
    if (!state.currentQuestion || state.currentQuestion.id !== dto.questionId) {
      throw new BadRequestException('Answer does not match the active question');
    }

    const answer = this.toAnswer(state.currentQuestion, dto);
    const answers = [...state.answers, answer];
    const questionCount = state.questionCount + 1;
    const storedPatient = await this.store.loadPatientContext(session.id);
    const patient = { ...storedPatient, chiefComplaint: state.chiefComplaint };
    const safety = this.safety.evaluate(
      patient,
      [this.mandatorySafetyText(state.mandatoryAnswers), ...answers.map((entry) => entry.answer)].join(' '),
    );

    await this.store.saveAnswer(session.id, patientId, answer, correlationId);
    const cannotContinue = /^(cannot|can.?t|unable to) (answer|continue)|stop (asking|the interview)/i.test(answer.answer);
    let next = safety.urgent
      ? this.urgentState(state, answers, questionCount, patient, safety.redFlags)
      : cannotContinue
        ? this.readyState(state, answers, questionCount, patient, null, 'Patient cannot answer further.')
        : await this.generateNext(state, answers, questionCount, patient, state.mandatoryAnswers);
    next = { ...next, updatedAt: new Date().toISOString() };
    await this.store.saveState(session.id, patientId, next, loaded.publicId, correlationId);
    if (next.status === 'urgent_review') {
      await this.store.saveSubmittedSummary(session.id, patientId, next, correlationId);
    }
    await this.logState('answer', next, patientId, correlationId);
    return this.toClientResponse(next);
  }

  async complete(
    publicId: string,
    authSessionId: number,
    patientId: number,
    correlationId?: string,
  ): Promise<AiTriageClientResponse> {
    const session = await this.store.assertOwnedSession(publicId, authSessionId, patientId);
    const loaded = await this.store.loadState(session.id);
    if (!loaded) throw new NotFoundException('Triage session has not been started');
    if (loaded.state.status === 'submitted') return this.toClientResponse(loaded.state);
    if (loaded.state.status === 'urgent_review') {
      throw new ConflictException('Urgent review sessions cannot be submitted through the standard flow');
    }
    if (loaded.state.status !== 'ready_to_complete') {
      throw new BadRequestException('Triage must be ready before it can be completed');
    }
    const now = new Date().toISOString();
    const submitted: AiTriageState = {
      ...loaded.state,
      status: 'submitted',
      currentQuestion: null,
      updatedAt: now,
      submittedAt: now,
    };
    await this.store.saveSubmittedSummary(session.id, patientId, submitted, correlationId);
    await this.store.saveState(session.id, patientId, submitted, loaded.publicId, correlationId);
    await this.logState('complete', submitted, patientId, correlationId);
    return this.toClientResponse(submitted);
  }

  async ensureSubmitted(authSessionId: number, patientId: number): Promise<void> {
    const session = await this.store.getOrCreateSession(authSessionId, patientId);
    const loaded = await this.store.loadState(session.id);
    if (!loaded || loaded.state.status !== 'submitted') {
      throw new BadRequestException('Please submit AI triage before selecting a hospital.');
    }
  }

  private async generateNext(
    prior: AiTriageState,
    answers: AiTriageAnswer[],
    questionCount: number,
    patient: AiTriagePatientContext,
    mandatoryAnswers: AiTriageMandatoryAnswers,
  ): Promise<AiTriageState> {
    if (questionCount >= AI_TRIAGE_MAX_QUESTIONS) {
      return this.readyState(prior, answers, questionCount, patient, null, 'Maximum question limit reached.');
    }
    const provider = this.provider();
    const result = provider ? await provider.generateNextStep({
      patient,
      mandatoryAnswers,
      answers,
      questionCount,
      maxQuestions: AI_TRIAGE_MAX_QUESTIONS,
      previousQuestions: answers.map((entry) => entry.question),
    }) : null;
    const output = result?.output ?? null;
    if (output?.status === 'urgent_review' || output?.urgentReview || output?.urgency === 'emergency') {
      return this.urgentState(
        prior,
        answers,
        questionCount,
        patient,
        output.redFlags.length ? output.redFlags : [output.urgencyReason || 'Possible emergency warning sign reported'],
      );
    }
    if (output?.shouldComplete) {
      return this.readyState(prior, answers, questionCount, patient, output, output.completionReason || 'Triage information is sufficient.');
    }
    const providerQuestion = output?.question
      ? this.materializeQuestion(output.question, answers)
      : null;
    if (output?.question && !providerQuestion) {
      await this.logging.warn('AI triage question rejected as duplicate or already covered', {
        service: 'AiTriageService',
        operation: 'generateNext',
      }, {
        prompt: output.question.prompt,
        topic: output.question.topic,
        chiefComplaint: patient.chiefComplaint,
      });
    }
    if (!result && !provider) {
      await this.logging.warn('AI triage provider unavailable; using fallback question bank', {
        service: 'AiTriageService',
        operation: 'generateNext',
      }, {
        aiProvider: process.env.AI_PROVIDER?.trim() || '(auto)',
        openAiConfigured: this.openAi.isConfigured(),
        anthropicConfigured: this.anthropic.isConfigured(),
      });
    } else if (result === null && provider) {
      await this.logging.warn('AI triage provider returned no usable output; using fallback question bank', {
        service: 'AiTriageService',
        operation: 'generateNext',
      }, {
        provider: provider.name,
      });
    }
    const fallbackQuestion = providerQuestion ?? this.fallbackQuestion(patient, mandatoryAnswers, answers);
    if (!fallbackQuestion) {
      return this.readyState(prior, answers, questionCount, patient, output, 'No additional non-repetitive questions are needed.');
    }
    return {
      ...prior,
      status: 'in_progress',
      questionCount,
      currentQuestion: fallbackQuestion,
      answers,
      summary: this.summaries.merge(patient, mandatoryAnswers, answers, output),
      provider: providerQuestion && result ? result.provider : 'fallback',
      completionReason: '',
    };
  }

  private readyState(
    prior: AiTriageState,
    answers: AiTriageAnswer[],
    questionCount: number,
    patient: AiTriagePatientContext,
    output: AiTriageProviderOutput | null,
    reason: string,
  ): AiTriageState {
    return {
      ...prior,
      status: 'ready_to_complete',
      questionCount,
      currentQuestion: null,
      answers,
      summary: this.summaries.merge(patient, prior.mandatoryAnswers, answers, output),
      completionReason: reason,
    };
  }

  private urgentState(
    prior: AiTriageState,
    answers: AiTriageAnswer[],
    questionCount: number,
    patient: AiTriagePatientContext,
    redFlags: string[],
  ): AiTriageState {
    return {
      ...prior,
      status: 'urgent_review',
      questionCount,
      currentQuestion: null,
      answers,
      summary: this.summaries.merge(
        patient,
        prior.mandatoryAnswers,
        answers,
        null,
        redFlags.length ? redFlags : ['Possible emergency warning sign reported'],
      ),
      provider: 'fallback',
      completionReason: this.safety.urgentMessage(),
    };
  }

  private provider(): AiTriageProvider | null {
    const preferred = (process.env.AI_PROVIDER || '').trim().toLowerCase();
    if (preferred === 'anthropic') {
      return this.anthropic.isConfigured() ? this.anthropic : null;
    }
    if (preferred === 'openai') {
      return this.openAi.isConfigured() ? this.openAi : null;
    }
    if (!preferred) {
      if (this.openAi.isConfigured()) return this.openAi;
      if (this.anthropic.isConfigured()) return this.anthropic;
    }
    return null;
  }

  private materializeQuestion(
    draft: Omit<AiTriageQuestion, 'id'>,
    answers: AiTriageAnswer[],
  ): AiTriageQuestion | null {
    // The provider already receives previousQuestions and is instructed not to
    // repeat itself, so only reject verbatim repeats. Heuristic topic/overlap
    // filters were discarding valid AI questions and surfacing the static bank.
    const exactRepeat = answers.some(
      (entry) => this.normalize(entry.question) === this.normalize(draft.prompt),
    );
    if (exactRepeat) return null;
    return { ...draft, id: `tq_${randomUUID()}` };
  }

  private fallbackQuestion(
    patient: AiTriagePatientContext,
    mandatory: AiTriageMandatoryAnswers,
    answers: AiTriageAnswer[],
  ): AiTriageQuestion | null {
    const complaint = patient.chiefComplaint?.trim().toLowerCase() || 'symptom';
    const bank: Array<Omit<AiTriageQuestion, 'id'>> = [
      { prompt: `Where exactly are you feeling the ${complaint}?`, inputType: 'text', choices: [], helpText: 'Describe one location.', allowsOther: true, required: true, topic: 'location' },
      { prompt: `How would you describe the ${complaint}?`, inputType: 'textarea', choices: [], helpText: 'Use your own words.', allowsOther: true, required: true, topic: 'character' },
      { prompt: `Besides the ${complaint}, what other symptoms are you having right now?`, inputType: 'textarea', choices: [], helpText: 'A short list is enough. Enter none if there are no others.', allowsOther: true, required: true, topic: 'associated_symptoms' },
      { prompt: `Was there an injury, illness, or event just before the ${complaint} began?`, inputType: 'textarea', choices: [], helpText: 'Enter no if there was not.', allowsOther: true, required: true, topic: 'trigger' },
      { prompt: `What makes the ${complaint} better or worse?`, inputType: 'textarea', choices: [], helpText: 'Enter unknown if you are not sure.', allowsOther: true, required: true, topic: 'modifying_factors' },
    ];
    const offset = this.hashComplaint(complaint) % bank.length;
    const rotated = [...bank.slice(offset), ...bank.slice(0, offset)];
    const draft = rotated.find((question) =>
      !this.isRepeated(question.prompt, answers, question.topic)
      && !this.isAlreadyProvided(question.prompt, patient, mandatory));
    return draft ? { ...draft, id: `tq_${randomUUID()}` } : null;
  }

  private hashComplaint(value: string): number {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
    }
    return hash;
  }

  private isRepeated(prompt: string, answers: AiTriageAnswer[], topic?: string): boolean {
    const words = this.words(prompt);
    return answers.some((entry) => {
      if (topic && entry.topic && this.normalize(topic) === this.normalize(entry.topic)) return true;
      const prior = this.words(entry.question);
      const overlap = [...words].filter((word) => prior.has(word)).length;
      return this.normalize(prompt) === this.normalize(entry.question)
        || overlap / Math.max(1, Math.min(words.size, prior.size)) >= 0.7;
    });
  }

  private isAlreadyProvided(
    prompt: string,
    patient: AiTriagePatientContext,
    mandatory: AiTriageMandatoryAnswers,
  ): boolean {
    const normalized = prompt.toLowerCase();
    const severityAnswered = mandatory.severity != null;
    return (
      (/(allerg|medicin|medical condition|past medical|health condition)/.test(normalized)
        && mandatory.relevantHistory.trim().length > 0)
      || (/(when did|how long|what time|start|onset|began)/.test(normalized) && mandatory.onset.trim().length > 0)
      || (/(severity|0 to 10|pain scale|rate.*(pain|symptom)|how severe)/.test(normalized) && severityAnswered)
      || (this.asksAboutProgression(normalized) && mandatory.progression.trim().length > 0)
      || (/(what.*happen|describe.*concern|chief complaint|main concern|reason for visit|why are you)/.test(normalized)
        && !!patient.chiefComplaint?.trim())
      || (/\bage\b|how old/.test(normalized) && patient.age !== null)
    );
  }

  private asksAboutProgression(normalized: string): boolean {
    if (/(make.*(better|worse)|what.*better or worse|reliev|aggravat|trigger|when you|during|after|walking|standing|lying|eating|moving|bending|lifting|pressure|activity|exercise|position)/.test(normalized)) {
      return false;
    }
    return /(getting better|getting worse|gotten better|gotten worse|stayed the same|stay the same|changed since|since it started|over time|improving|worsening|progression|better or worse)/.test(normalized);
  }

  private toAnswer(question: AiTriageQuestion, dto: AnswerTriageDto): AiTriageAnswer {
    let answer = dto.answer?.trim() ?? '';
    if (question.inputType === 'boolean' && typeof dto.valueBoolean === 'boolean') answer = dto.valueBoolean ? 'Yes' : 'No';
    if (question.inputType === 'number' && typeof dto.valueNumber === 'number') answer = String(dto.valueNumber);
    if (question.inputType === 'single_select' && dto.valueChoice?.trim()) answer = dto.valueChoice.trim();
    if ((question.inputType === 'text' || question.inputType === 'textarea') && dto.valueText?.trim()) answer = dto.valueText.trim();
    if (!answer) throw new BadRequestException('An answer is required');
    if (question.inputType === 'single_select' && !question.allowsOther && !question.choices.includes(answer)) {
      throw new BadRequestException('Answer must be one of the available choices');
    }
    return {
      questionId: question.id,
      question: question.prompt,
      topic: question.topic,
      answer,
      answeredAt: new Date().toISOString(),
    };
  }

  private normalizeMandatory(value: AiTriageMandatoryAnswers): AiTriageMandatoryAnswers {
    return {
      onset: value.onset.trim(),
      severity: value.severity,
      progression: value.progression,
      relevantHistory: value.relevantHistory.trim(),
    };
  }

  private mandatorySafetyText(value: AiTriageMandatoryAnswers): string {
    return [
      value.onset,
      typeof value.severity === 'number' ? `severity ${value.severity} out of 10` : value.severity,
      value.progression,
      value.relevantHistory,
    ].join(' ');
  }

  private toClientResponse(state: AiTriageState): AiTriageClientResponse {
    const status: AiTriageClientResponse['status'] = state.status === 'in_progress'
      ? 'ask_question'
      : state.status === 'ready_to_complete'
        ? 'complete'
        : state.status;
    return {
      sessionId: state.sessionId,
      status,
      question: state.currentQuestion
        ? {
            id: state.currentQuestion.id,
            text: state.currentQuestion.prompt,
            inputType: state.currentQuestion.inputType,
            options: state.currentQuestion.choices,
            allowsOther: state.currentQuestion.allowsOther,
            required: state.currentQuestion.required,
            helpText: state.currentQuestion.helpText,
          }
        : null,
      reasonForQuestion: state.currentQuestion?.helpText || null,
      urgentReview: state.status === 'urgent_review',
      urgencyReason: state.status === 'urgent_review'
        ? state.summary.redFlags.join('; ') || 'A possible emergency warning sign was reported.'
        : null,
      patientMessage: state.status === 'urgent_review' ? this.safety.urgentMessage() : null,
      summary: state.summary,
      chiefComplaint: state.chiefComplaint,
      mandatoryAnswers: state.mandatoryAnswers,
      answers: state.answers,
      questionCount: state.questionCount,
      maxQuestions: state.maxQuestions,
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
      submittedAt: state.submittedAt,
    };
  }

  private normalize(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  }

  private words(value: string): Set<string> {
    const ignored = new Set(['the', 'a', 'an', 'is', 'are', 'what', 'how', 'do', 'does', 'this', 'your', 'you', 'and', 'or']);
    return new Set(this.normalize(value).split(' ').filter((word) => word.length > 2 && !ignored.has(word)));
  }

  private async logState(operation: string, state: AiTriageState, patientId: number, correlationId?: string) {
    await this.logging.info('AI triage state changed', {
      service: 'AiTriageService',
      operation,
      correlationId,
      patientId,
    }, {
      status: state.status,
      providerType: state.provider,
      questionCount: state.questionCount,
      redFlagCount: state.summary.redFlags.length,
    });
  }
}
