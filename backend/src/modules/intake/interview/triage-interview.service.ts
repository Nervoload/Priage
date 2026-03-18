import { BadRequestException, Injectable } from '@nestjs/common';
import { ContextSourceType, Prisma, ReviewState, SummaryProjectionKind, TrustTier, VisibilityScope } from '@prisma/client';
import { randomUUID } from 'crypto';

import { IntakeSessionsService } from '../../intake-sessions/intake-sessions.service';
import { LoggingService } from '../../logging/logging.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AdvanceInterviewDto } from '../dto/interview.dto';
import { OpenAiCompatibleTriageInterviewProvider } from './triage-interview.provider';
import type {
  InterviewAnswerRecord,
  InterviewClientState,
  InterviewEmergencyAlert,
  InterviewGenerationMode,
  InterviewInputType,
  InterviewPatientContext,
  InterviewPhase,
  InterviewProviderState,
  InterviewQuestion,
  InterviewStateSnapshot,
  InterviewStatus,
  InterviewSummaryRecord,
  InterviewUrgency,
  ProviderGenerationInput,
  ProviderGenerationResult,
  ProviderInterviewResult,
  ProviderQuestionDraft,
} from './triage-interview.types';
import { SAFETY_GATE_PUBLIC_ID } from './triage-interview.types';

const MAX_DYNAMIC_QUESTIONS = 12;
const MIN_DYNAMIC_QUESTIONS = 3;
const BATCH_SIZE = 3;
const RESCUE_TARGET_QUESTION_COUNT = 4;

@Injectable()
export class TriageInterviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly intakeSessions: IntakeSessionsService,
    private readonly loggingService: LoggingService,
    private readonly provider: OpenAiCompatibleTriageInterviewProvider,
  ) {}

  async startBySession(
    authSessionId: number,
    patientId: number,
    correlationId?: string,
  ): Promise<InterviewClientState> {
    const draft = await this.intakeSessions.getOrCreateDraftForAuthSession(authSessionId, patientId, correlationId);
    const latest = await this.loadLatestState(draft.id);

    if (!latest) {
      const initialState = this.buildInitialState();
      const persisted = await this.persistState(draft.id, patientId, initialState, null, correlationId);
      return this.toClientState(persisted);
    }

    if (latest.snapshot.status === 'in_progress' && !latest.snapshot.currentQuestion) {
      const refreshed = await this.replenishOrComplete(draft.id, patientId, latest.snapshot, correlationId);
      const persisted = await this.persistState(draft.id, patientId, refreshed, latest.publicId, correlationId);
      return this.toClientState(persisted);
    }

    return this.toClientState(latest.snapshot);
  }

  async advanceBySession(
    authSessionId: number,
    patientId: number,
    dto: AdvanceInterviewDto,
    correlationId?: string,
  ): Promise<InterviewClientState> {
    const draft = await this.intakeSessions.getOrCreateDraftForAuthSession(authSessionId, patientId, correlationId);
    const latest = await this.loadLatestState(draft.id);
    const currentState = latest?.snapshot ?? this.buildInitialState();
    const previousPublicId = latest?.publicId ?? null;

    if (currentState.status === 'complete') {
      return this.toClientState(currentState);
    }

    if (currentState.status === 'emergency_ack_required') {
      if (dto.action !== 'acknowledge_emergency') {
        throw new BadRequestException('Emergency acknowledgment is required before continuing.');
      }

      const nextState = await this.replenishOrComplete(
        draft.id,
        patientId,
        {
          ...currentState,
          status: 'in_progress',
          emergencyAcknowledged: true,
          emergencyAlert: null,
          pendingCandidates: currentState.pendingCandidates,
        },
        correlationId,
      );

      const persisted = await this.persistState(draft.id, patientId, nextState, previousPublicId, correlationId);
      return this.toClientState(persisted);
    }

    const activeQuestion = currentState.currentQuestion;
    if (!activeQuestion) {
      const nextState = await this.replenishOrComplete(draft.id, patientId, currentState, correlationId);
      const persisted = await this.persistState(draft.id, patientId, nextState, previousPublicId, correlationId);
      return this.toClientState(persisted);
    }

    if (dto.questionPublicId !== activeQuestion.publicId) {
      throw new BadRequestException('Interview answer does not match the active question.');
    }

    const answer = this.buildAnswerRecord(activeQuestion, dto);
    await this.persistAnswer(draft.id, patientId, answer, correlationId);

    if (activeQuestion.publicId === SAFETY_GATE_PUBLIC_ID && answer.valueBoolean === true) {
      const emergencyState: InterviewStateSnapshot = {
        ...currentState,
        status: 'emergency_ack_required',
        currentQuestion: null,
        cachedQuestions: [],
        pendingCandidates: [],
        answers: [...currentState.answers, answer],
        emergencyAlert: this.buildEmergencyAlert(),
        summaryPreview: 'Emergency warning shown. Awaiting patient acknowledgment before continuing.',
      };
      const persisted = await this.persistState(draft.id, patientId, emergencyState, previousPublicId, correlationId);
      return this.toClientState(persisted);
    }

    const increment = activeQuestion.publicId === SAFETY_GATE_PUBLIC_ID ? 0 : 1;
    const answeredState: InterviewStateSnapshot = {
      ...currentState,
      askedCount: currentState.askedCount + increment,
      answers: [...currentState.answers, answer],
      currentQuestion: null,
      emergencyAlert: null,
    };

    const patient = await this.loadPatientContext(draft.id);
    const ambiguityRequiresReplan = activeQuestion.askIfAmbiguous && this.isAmbiguousAnswer(answer);
    const riskChanged = activeQuestion.publicId === SAFETY_GATE_PUBLIC_ID
      ? false
      : this.answerMateriallyChangesRisk(patient, currentState.answers, answer);
    const targetReached = answeredState.targetQuestionCount !== null
      && answeredState.askedCount >= answeredState.targetQuestionCount;
    const shouldReplan =
      activeQuestion.publicId === SAFETY_GATE_PUBLIC_ID
      || currentState.cachedQuestions.length === 0
      || ambiguityRequiresReplan
      || riskChanged
      || targetReached
      || answeredState.askedCount >= MAX_DYNAMIC_QUESTIONS;

    const pendingCandidates = shouldReplan ? currentState.cachedQuestions : [];

    const nextState = shouldReplan
      ? await this.replenishOrComplete(
          draft.id,
          patientId,
          {
            ...answeredState,
            cachedQuestions: [],
            pendingCandidates,
          },
          correlationId,
        )
      : {
          ...answeredState,
          phase: currentState.cachedQuestions[0].phase,
          currentQuestion: currentState.cachedQuestions[0],
          cachedQuestions: currentState.cachedQuestions.slice(1),
          pendingCandidates: [],
        };

    const persisted = await this.persistState(draft.id, patientId, nextState, previousPublicId, correlationId);
    return this.toClientState(persisted);
  }

  async ensureInterviewCompleteBySession(
    authSessionId: number,
    patientId: number,
    correlationId?: string,
  ): Promise<void> {
    const draft = await this.intakeSessions.getOrCreateDraftForAuthSession(authSessionId, patientId, correlationId);
    const latest = await this.loadLatestState(draft.id);

    if (!latest || latest.snapshot.status !== 'complete') {
      throw new BadRequestException('Please complete the intake interview before selecting a hospital.');
    }
  }

  private async replenishOrComplete(
    intakeSessionId: number,
    patientId: number,
    state: InterviewStateSnapshot,
    correlationId?: string,
  ): Promise<InterviewStateSnapshot> {
    const patient = await this.loadPatientContext(intakeSessionId);

    if (state.askedCount >= MAX_DYNAMIC_QUESTIONS) {
      return this.completeInterview(intakeSessionId, patientId, state, patient, null, correlationId);
    }

    if (!this.hasAnsweredSafetyGate(state.answers)) {
      return {
        ...state,
        status: 'in_progress',
        phase: 'urgent',
        currentQuestion: this.buildSafetyGateQuestion(),
        cachedQuestions: [],
        pendingCandidates: [],
      };
    }

    const phase = this.determinePhase(patient, state.answers, state.phase);
    const batchSize = Math.min(BATCH_SIZE, MAX_DYNAMIC_QUESTIONS - state.askedCount);

    if (batchSize <= 0) {
      return this.completeInterview(intakeSessionId, patientId, state, patient, null, correlationId);
    }

    const providerInput: ProviderGenerationInput = {
      patient,
      phase,
      answers: state.answers,
      askedCount: state.askedCount,
      maxQuestions: MAX_DYNAMIC_QUESTIONS,
      batchSize,
      emergencyAcknowledged: state.emergencyAcknowledged,
      pendingCandidates: state.pendingCandidates,
      sessionGoal: state.sessionGoal,
      targetQuestionCount: state.targetQuestionCount,
      providerState: state.providerState,
    };

    let generation = await this.provider.generate(providerInput);
    let generationMode: InterviewGenerationMode = 'ai';

    if (!generation) {
      generation = this.buildRescueFallback(providerInput);
      generationMode = 'fallback';
    }

    const targetQuestionCount = this.clampTargetQuestionCount(generation.result.targetQuestionCount, state.askedCount);
    const summaryRecord = this.buildSummaryRecord(patient, state.answers, generation.result);
    const generationState = {
      sessionGoal: generation.result.sessionGoal.trim() || state.sessionGoal,
      targetQuestionCount,
      completionReason: generation.result.completionReason.trim(),
      summaryPreview: summaryRecord.summaryPreview,
      summaryRecord,
      providerState: generation.providerState ?? state.providerState,
      generationMode,
    };

    const generatedQuestions = this.materializeQuestions(generation.result.questions, state.answers).slice(0, batchSize);

    if (generation.result.interrupt.type === 'emergency_ack_required') {
      return {
        ...state,
        ...generationState,
        status: 'emergency_ack_required',
        phase: generation.result.phase,
        currentQuestion: null,
        cachedQuestions: [],
        pendingCandidates: generatedQuestions,
        emergencyAlert: {
          title: generation.result.interrupt.title || 'Get emergency help now',
          body: generation.result.interrupt.body || 'Your latest answers may reflect a life-threatening emergency.',
          recommendation: generation.result.interrupt.recommendation || 'Acknowledge this warning if you still want to continue.',
        },
      };
    }

    const shouldCompleteNow =
      generation.result.shouldComplete
      && state.askedCount >= MIN_DYNAMIC_QUESTIONS;

    if (generatedQuestions.length === 0) {
      if (shouldCompleteNow || state.askedCount >= MAX_DYNAMIC_QUESTIONS) {
        return this.completeInterview(
          intakeSessionId,
          patientId,
          {
            ...state,
            ...generationState,
            phase: generation.result.phase,
            pendingCandidates: [],
          },
          patient,
          generation.result,
          correlationId,
        );
      }

      if (generationMode === 'ai') {
        const fallback = this.buildRescueFallback(providerInput);
        const fallbackTarget = this.clampTargetQuestionCount(fallback.result.targetQuestionCount, state.askedCount);
        const fallbackSummary = this.buildSummaryRecord(patient, state.answers, fallback.result);
        const fallbackQuestions = this.materializeQuestions(fallback.result.questions, state.answers).slice(0, batchSize);

        if (fallbackQuestions.length === 0 && state.askedCount >= MIN_DYNAMIC_QUESTIONS) {
          return this.completeInterview(
            intakeSessionId,
            patientId,
            {
              ...state,
              phase: fallback.result.phase,
              sessionGoal: fallback.result.sessionGoal.trim() || state.sessionGoal,
              targetQuestionCount: fallbackTarget,
              completionReason: fallback.result.completionReason.trim(),
              summaryPreview: fallbackSummary.summaryPreview,
              summaryRecord: fallbackSummary,
              providerState: state.providerState,
              generationMode: 'fallback',
              pendingCandidates: [],
            },
            patient,
            fallback.result,
            correlationId,
          );
        }

        return {
          ...state,
          status: 'in_progress',
          phase: fallbackQuestions[0]?.phase ?? fallback.result.phase,
          currentQuestion: fallbackQuestions[0] ?? null,
          cachedQuestions: fallbackQuestions.slice(1),
          pendingCandidates: [],
          emergencyAlert: null,
          summaryPreview: fallbackSummary.summaryPreview,
          summaryRecord: fallbackSummary,
          sessionGoal: fallback.result.sessionGoal.trim() || state.sessionGoal,
          targetQuestionCount: fallbackTarget,
          completionReason: fallback.result.completionReason.trim(),
          providerState: state.providerState,
          generationMode: 'fallback',
        };
      }

      return this.completeInterview(
        intakeSessionId,
        patientId,
        {
          ...state,
          ...generationState,
          phase: generation.result.phase,
          pendingCandidates: [],
        },
        patient,
        generation.result,
        correlationId,
      );
    }

    return {
      ...state,
      ...generationState,
      status: 'in_progress',
      phase: generatedQuestions[0].phase,
      currentQuestion: generatedQuestions[0],
      cachedQuestions: generatedQuestions.slice(1),
      pendingCandidates: [],
      emergencyAlert: null,
    };
  }

  private async completeInterview(
    intakeSessionId: number,
    patientId: number,
    state: InterviewStateSnapshot,
    patient: InterviewPatientContext,
    result: ProviderInterviewResult | null,
    correlationId?: string,
  ): Promise<InterviewStateSnapshot> {
    const summaryRecord = this.buildSummaryRecord(patient, state.answers, result);

    const completedState: InterviewStateSnapshot = {
      ...state,
      status: 'complete',
      phase: result?.phase ?? state.phase,
      currentQuestion: null,
      cachedQuestions: [],
      pendingCandidates: [],
      emergencyAlert: null,
      summaryPreview: summaryRecord.summaryPreview,
      summaryRecord,
      sessionGoal: result?.sessionGoal?.trim() || state.sessionGoal,
      targetQuestionCount: result
        ? this.clampTargetQuestionCount(result.targetQuestionCount, state.askedCount)
        : state.targetQuestionCount,
      completionReason: result?.completionReason?.trim() || state.completionReason || 'Interview complete.',
    };

    await this.persistSummary(intakeSessionId, patientId, summaryRecord, completedState, correlationId);
    return completedState;
  }

  private buildInitialState(): InterviewStateSnapshot {
    return {
      interviewPublicId: `intr_${randomUUID()}`,
      status: 'in_progress',
      phase: 'urgent',
      askedCount: 0,
      maxQuestions: MAX_DYNAMIC_QUESTIONS,
      currentQuestion: this.buildSafetyGateQuestion(),
      cachedQuestions: [],
      pendingCandidates: [],
      emergencyAlert: null,
      summaryPreview: '',
      answers: [],
      emergencyAcknowledged: false,
      summaryRecord: null,
      sessionGoal: '',
      targetQuestionCount: null,
      completionReason: '',
      providerState: null,
      generationMode: 'ai',
    };
  }

  private buildSafetyGateQuestion(): InterviewQuestion {
    return {
      publicId: SAFETY_GATE_PUBLIC_ID,
      phase: 'urgent',
      inputType: 'boolean',
      prompt: 'Are you in immediate danger right now?',
      helpText: 'If you have severe trouble breathing, central chest pain, heavy bleeding, stroke-like symptoms, or you feel unsafe waiting, tell us now.',
      placeholder: '',
      required: true,
      choices: ['Yes', 'No'],
      clinicalReason: 'Immediate life-threatening check before the dynamic interview begins.',
      askIfAmbiguous: false,
    };
  }

  private buildEmergencyAlert(): InterviewEmergencyAlert {
    return {
      title: 'Get emergency help now',
      body: 'Your answer suggests this may be a life-threatening emergency. Call 911 or go to the nearest emergency department immediately if you cannot get there safely on your own.',
      recommendation: 'Acknowledge this warning if you still want to continue the intake flow.',
    };
  }

  private buildAnswerRecord(question: InterviewQuestion, dto: AdvanceInterviewDto): InterviewAnswerRecord {
    const answerText = this.normalizeAnswerText(question, dto);
    if (!answerText) {
      throw new BadRequestException('An answer is required to continue the interview.');
    }

    return {
      questionPublicId: question.publicId,
      phase: question.phase,
      prompt: question.prompt,
      inputType: question.inputType,
      answeredAt: new Date().toISOString(),
      answerText,
      valueText: dto.valueText?.trim() || undefined,
      valueNumber: typeof dto.valueNumber === 'number' ? dto.valueNumber : undefined,
      valueBoolean: typeof dto.valueBoolean === 'boolean' ? dto.valueBoolean : undefined,
      valueChoice: dto.valueChoice?.trim() || undefined,
    };
  }

  private normalizeAnswerText(question: InterviewQuestion, dto: AdvanceInterviewDto): string {
    if (question.inputType === 'boolean' && typeof dto.valueBoolean === 'boolean') {
      return dto.valueBoolean ? 'Yes' : 'No';
    }
    if (question.inputType === 'number' && typeof dto.valueNumber === 'number' && Number.isFinite(dto.valueNumber)) {
      return String(dto.valueNumber);
    }
    if (question.inputType === 'single_select' && dto.valueChoice?.trim()) {
      return dto.valueChoice.trim();
    }
    if ((question.inputType === 'text' || question.inputType === 'textarea') && dto.valueText?.trim()) {
      return dto.valueText.trim();
    }
    return '';
  }

  private isAmbiguousAnswer(answer: InterviewAnswerRecord): boolean {
    const normalized = answer.answerText.trim().toLowerCase();
    if (!normalized) {
      return true;
    }
    if (normalized.length < 3) {
      return true;
    }
    return ['not sure', 'unsure', 'maybe', 'idk', 'i don\'t know', 'unknown', 'a bit', 'kind of'].some((token) => normalized.includes(token));
  }

  private materializeQuestions(
    drafts: ProviderQuestionDraft[],
    answers: InterviewAnswerRecord[],
  ): InterviewQuestion[] {
    const seenPrompts = new Set(answers.map((answer) => this.normalizePrompt(answer.prompt)));

    return drafts
      .filter((draft) => draft.prompt.trim().length > 0)
      .map((draft) => ({
        publicId: `iq_${randomUUID()}`,
        phase: draft.phase,
        inputType: draft.inputType,
        prompt: draft.prompt.trim(),
        helpText: draft.helpText.trim(),
        placeholder: draft.placeholder.trim(),
        required: draft.required,
        choices: draft.choices,
        clinicalReason: draft.clinicalReason.trim(),
        askIfAmbiguous: draft.askIfAmbiguous,
      }))
      .filter((question) => {
        const key = this.normalizePrompt(question.prompt);
        if (!key || seenPrompts.has(key)) {
          return false;
        }
        seenPrompts.add(key);
        return true;
      });
  }

  private determinePhase(
    patient: InterviewPatientContext,
    answers: InterviewAnswerRecord[],
    currentPhase: InterviewPhase,
  ): InterviewPhase {
    const dynamicCount = this.getDynamicAnswerCount(answers);
    const urgency = this.inferUrgency(patient, answers);

    if (dynamicCount === 0) {
      return 'urgent';
    }

    if (urgency === 'emergency' || urgency === 'high') {
      if (dynamicCount < 3) {
        return 'urgent';
      }
      if (dynamicCount < 6) {
        return 'emergent';
      }
      return 'history';
    }

    if (currentPhase === 'history' && dynamicCount >= 4) {
      return 'history';
    }
    if (dynamicCount < 2) {
      return 'urgent';
    }
    if (dynamicCount < 5) {
      return 'emergent';
    }
    return 'history';
  }

  private buildRescueFallback(input: ProviderGenerationInput): ProviderGenerationResult {
    const urgency = this.inferUrgency(input.patient, input.answers);
    const summaryPreview = this.buildSummaryPreview(input.patient, input.answers, urgency);
    const askedPrompts = new Set(input.answers.map((answer) => this.normalizePrompt(answer.prompt)));
    const bank = this.buildRescueQuestionBank();
    const targetQuestionCount = Math.min(MAX_DYNAMIC_QUESTIONS, Math.max(MIN_DYNAMIC_QUESTIONS, RESCUE_TARGET_QUESTION_COUNT));

    const questions = bank[input.phase]
      .filter((question) => !askedPrompts.has(this.normalizePrompt(question.prompt)))
      .slice(0, input.batchSize);

    return {
      result: {
        phase: input.phase,
        sessionGoal: input.sessionGoal || 'Collect a minimal emergency intake summary with red flags, severity, and a short relevant history.',
        targetQuestionCount,
        shouldComplete: input.askedCount >= targetQuestionCount,
        completionReason: input.askedCount >= targetQuestionCount
          ? 'Rescue fallback gathered a minimal set of intake questions.'
          : '',
        urgency,
        redFlags: this.extractRedFlags(input.patient, input.answers),
        recommendedAction: this.getRecommendedAction(urgency),
        summaryPreview,
        interrupt: {
          type: 'none',
          title: '',
          body: '',
          recommendation: '',
          reason: '',
        },
        questions,
      },
      providerState: input.providerState ?? {
        providerName: 'openai',
        model: 'fallback',
        responseId: '',
        promptVersion: 'fallback-v1',
      },
    };
  }

  private buildRescueQuestionBank(): Record<InterviewPhase, ProviderQuestionDraft[]> {
    return {
      urgent: [
        {
          phase: 'urgent',
          inputType: 'text',
          prompt: 'When did this start, and how quickly did it become this bad?',
          helpText: 'A short timeline helps staff understand urgency.',
          placeholder: 'e.g. started 2 hours ago and worsened over 20 minutes',
          required: true,
          choices: [],
          clinicalReason: 'Onset and time course affect acuity.',
          askIfAmbiguous: true,
        },
        {
          phase: 'urgent',
          inputType: 'number',
          prompt: 'How severe is it right now on a scale from 0 to 10?',
          helpText: '0 means no symptom and 10 is the worst imaginable.',
          placeholder: '0-10',
          required: true,
          choices: [],
          clinicalReason: 'Severity helps prioritize acuity.',
          askIfAmbiguous: false,
        },
        {
          phase: 'urgent',
          inputType: 'boolean',
          prompt: 'Is it getting rapidly worse, or are you having trouble breathing, heavy bleeding, or passing out?',
          helpText: 'Tell us if any of these are happening now.',
          placeholder: '',
          required: true,
          choices: ['Yes', 'No'],
          clinicalReason: 'Generic red-flag rescue screen.',
          askIfAmbiguous: false,
        },
      ],
      emergent: [
        {
          phase: 'emergent',
          inputType: 'textarea',
          prompt: 'What other symptoms are happening with this right now?',
          helpText: 'A short list is enough.',
          placeholder: 'e.g. nausea, dizziness, fever, numbness',
          required: true,
          choices: [],
          clinicalReason: 'Associated symptoms help separate higher-risk patterns.',
          askIfAmbiguous: true,
        },
        {
          phase: 'emergent',
          inputType: 'text',
          prompt: 'Have you taken anything or done anything for this already today?',
          helpText: 'Include medication, inhalers, ice, rest, or anything else important.',
          placeholder: 'e.g. took Tylenol, used inhaler, nothing yet',
          required: false,
          choices: [],
          clinicalReason: 'Prior actions affect handoff and next questioning.',
          askIfAmbiguous: false,
        },
        {
          phase: 'emergent',
          inputType: 'boolean',
          prompt: 'Do you feel worse with activity, walking, or standing up?',
          helpText: 'A yes or no is enough.',
          placeholder: '',
          required: false,
          choices: ['Yes', 'No'],
          clinicalReason: 'Simple worsening/instability screen.',
          askIfAmbiguous: false,
        },
      ],
      history: [
        {
          phase: 'history',
          inputType: 'text',
          prompt: 'What medical conditions or past issues matter most for this problem?',
          helpText: 'A short list is enough.',
          placeholder: 'e.g. asthma, diabetes, migraines, none',
          required: false,
          choices: [],
          clinicalReason: 'Relevant history improves handoff quality.',
          askIfAmbiguous: true,
        },
        {
          phase: 'history',
          inputType: 'text',
          prompt: 'What medications or allergies should the care team know about right now?',
          helpText: 'Include daily medications and important allergies.',
          placeholder: 'e.g. insulin, blood thinner, penicillin allergy, none',
          required: false,
          choices: [],
          clinicalReason: 'Medication and allergy context supports safer intake.',
          askIfAmbiguous: false,
        },
        {
          phase: 'history',
          inputType: 'textarea',
          prompt: 'Anything else important the emergency team should know before you arrive?',
          helpText: 'Include pregnancy context, recent surgery, or a major concern if relevant.',
          placeholder: 'Short note',
          required: false,
          choices: [],
          clinicalReason: 'Captures final handoff details.',
          askIfAmbiguous: false,
        },
      ],
    };
  }

  private clampTargetQuestionCount(targetQuestionCount: number, askedCount: number): number {
    const safeTarget = Number.isFinite(targetQuestionCount) ? Math.trunc(targetQuestionCount) : MIN_DYNAMIC_QUESTIONS;
    return Math.max(MIN_DYNAMIC_QUESTIONS, Math.min(MAX_DYNAMIC_QUESTIONS, Math.max(askedCount, safeTarget)));
  }

  private answerMateriallyChangesRisk(
    patient: InterviewPatientContext,
    existingAnswers: InterviewAnswerRecord[],
    answer: InterviewAnswerRecord,
  ): boolean {
    const previousUrgency = this.inferUrgency(patient, existingAnswers);
    const nextUrgency = this.inferUrgency(patient, [...existingAnswers, answer]);

    if (this.rankUrgency(nextUrgency) > this.rankUrgency(previousUrgency)) {
      return true;
    }

    const combinedText = `${answer.prompt} ${answer.answerText}`.toLowerCase();
    if (answer.inputType === 'number') {
      const severity = Number(answer.answerText);
      return Number.isFinite(severity) && severity >= 8;
    }

    if (answer.inputType === 'boolean' && answer.valueBoolean === true) {
      return /(breath|breathing|chest|bleeding|faint|pass out|weakness|speech|confusion|seizure|pregnan|severe)/.test(combinedText);
    }

    return /(rapidly worse|suddenly|can.t breathe|cannot breathe|passed out|faint|severe bleeding|worst headache|new weakness)/.test(combinedText);
  }

  private rankUrgency(value: InterviewUrgency): number {
    switch (value) {
      case 'emergency':
        return 4;
      case 'high':
        return 3;
      case 'medium':
        return 2;
      default:
        return 1;
    }
  }

  private inferUrgency(
    patient: InterviewPatientContext,
    answers: InterviewAnswerRecord[],
  ): InterviewUrgency {
    const text = [
      patient.chiefComplaint,
      patient.details,
      ...answers.map((answer) => answer.answerText),
    ].filter(Boolean).join(' ').toLowerCase();

    if (/(unconscious|can.t breathe|cannot breathe|seizure|stroke|severe bleeding|blue lips|anaphylaxis|passed out)/.test(text)) {
      return 'emergency';
    }
    if (/(chest pain|chest pressure|shortness of breath|trouble breathing|fainting|heavy bleeding|worst headache|new weakness|confusion|severe allergic reaction)/.test(text)) {
      return 'high';
    }

    const severityAnswer = answers.find((answer) => answer.prompt.toLowerCase().includes('scale from 0 to 10'));
    const severity = severityAnswer ? Number(severityAnswer.answerText) : NaN;
    if (Number.isFinite(severity) && severity >= 9) {
      return 'emergency';
    }
    if (Number.isFinite(severity) && severity >= 7) {
      return 'high';
    }
    if (Number.isFinite(severity) && severity >= 4) {
      return 'medium';
    }

    if (/(fever|vomiting|worse|spreading|dizziness|infection|severe pain|pregnan|dehydration)/.test(text)) {
      return 'medium';
    }
    return 'low';
  }

  private extractRedFlags(
    patient: InterviewPatientContext,
    answers: InterviewAnswerRecord[],
  ): string[] {
    const text = [
      patient.chiefComplaint,
      patient.details,
      ...answers.map((answer) => answer.answerText),
    ].filter(Boolean).join(' ').toLowerCase();
    const flags = [
      { pattern: /(chest pain|chest pressure)/, label: 'Chest pain or pressure' },
      { pattern: /(trouble breathing|shortness of breath|can.t breathe|cannot breathe)/, label: 'Breathing difficulty' },
      { pattern: /(weakness|speech|confusion|seizure|stroke)/, label: 'Neurologic red flag' },
      { pattern: /(bleeding|blood)/, label: 'Bleeding concern' },
      { pattern: /(passed out|fainting|unconscious)/, label: 'Loss of consciousness or fainting' },
      { pattern: /(pregnan|pregnancy|pelvic pain|vaginal bleeding)/, label: 'Pregnancy-relevant concern' },
    ];

    return flags.filter((flag) => flag.pattern.test(text)).map((flag) => flag.label);
  }

  private buildSummaryRecord(
    patient: InterviewPatientContext,
    answers: InterviewAnswerRecord[],
    result: ProviderInterviewResult | null,
  ): InterviewSummaryRecord {
    const urgency = result?.urgency ?? this.inferUrgency(patient, answers);
    const redFlags = result?.redFlags?.length ? result.redFlags : this.extractRedFlags(patient, answers);
    const summaryPreview = result?.summaryPreview?.trim() || this.buildSummaryPreview(patient, answers, urgency);
    const recommendedAction = result?.recommendedAction?.trim() || this.getRecommendedAction(urgency);
    const combinedDetails = this.buildCombinedDetails(patient.details ?? '', summaryPreview, answers);

    return {
      urgency,
      redFlags,
      recommendedAction,
      summaryPreview,
      combinedDetails,
    };
  }

  private buildSummaryPreview(
    patient: InterviewPatientContext,
    answers: InterviewAnswerRecord[],
    urgency: InterviewUrgency,
  ): string {
    const timeline = answers.find((answer) => answer.prompt.toLowerCase().includes('when did this start'));
    const severity = answers.find((answer) => answer.prompt.toLowerCase().includes('scale from 0 to 10'));
    const worsening = answers.find((answer) => answer.prompt.toLowerCase().includes('getting rapidly worse') || answer.prompt.toLowerCase().includes('worse'));
    const name = [patient.firstName, patient.lastName].filter(Boolean).join(' ').trim() || 'Patient';

    const parts = [
      `${name} reports ${patient.chiefComplaint?.trim() || 'an acute concern'}.`,
      timeline ? `Timeline: ${timeline.answerText}.` : '',
      severity ? `Severity: ${severity.answerText}/10.` : '',
      worsening ? `Worsening: ${worsening.answerText}.` : '',
      `Current intake urgency: ${urgency}.`,
    ].filter(Boolean);

    return parts.join(' ');
  }

  private buildCombinedDetails(
    originalDetails: string,
    summaryPreview: string,
    answers: InterviewAnswerRecord[],
  ): string {
    const patientNarrative = originalDetails.trim();
    const qaLines = answers
      .filter((answer) => answer.questionPublicId !== SAFETY_GATE_PUBLIC_ID)
      .map((answer) => `- ${answer.prompt} ${answer.answerText}`)
      .join('\n');

    return [
      patientNarrative ? `Patient note:\n${patientNarrative}` : '',
      summaryPreview ? `AI intake summary:\n${summaryPreview}` : '',
      qaLines ? `Structured Q&A:\n${qaLines}` : '',
    ].filter(Boolean).join('\n\n');
  }

  private getRecommendedAction(urgency: InterviewUrgency): string {
    switch (urgency) {
      case 'emergency':
        return 'Immediate emergency evaluation is recommended.';
      case 'high':
        return 'Prompt emergency department assessment is recommended.';
      case 'medium':
        return 'Same-day medical assessment is recommended.';
      default:
        return 'Collect the remaining minimum intake history and continue with encounter creation.';
    }
  }

  private hasAnsweredSafetyGate(answers: InterviewAnswerRecord[]): boolean {
    return answers.some((answer) => answer.questionPublicId === SAFETY_GATE_PUBLIC_ID);
  }

  private getDynamicAnswerCount(answers: InterviewAnswerRecord[]): number {
    return answers.filter((answer) => answer.questionPublicId !== SAFETY_GATE_PUBLIC_ID).length;
  }

  private normalizePrompt(prompt: string): string {
    return prompt.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  private toClientState(snapshot: InterviewStateSnapshot): InterviewClientState {
    return {
      interviewPublicId: snapshot.interviewPublicId,
      status: snapshot.status,
      phase: snapshot.phase,
      askedCount: snapshot.askedCount,
      maxQuestions: snapshot.maxQuestions,
      currentQuestion: snapshot.currentQuestion,
      cachedQuestions: snapshot.cachedQuestions,
      emergencyAlert: snapshot.emergencyAlert,
      summaryPreview: snapshot.summaryPreview,
    };
  }

  private async loadPatientContext(intakeSessionId: number): Promise<InterviewPatientContext> {
    const summary = await this.prisma.summaryProjection.findFirst({
      where: {
        intakeSessionId,
        kind: SummaryProjectionKind.OPERATIONAL,
        active: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    if (!summary || !summary.content || typeof summary.content !== 'object' || Array.isArray(summary.content)) {
      return {};
    }

    const content = summary.content as Record<string, unknown>;
    const patient = content.patient && typeof content.patient === 'object' && !Array.isArray(content.patient)
      ? content.patient as Record<string, unknown>
      : {};

    return {
      firstName: typeof patient.firstName === 'string' ? patient.firstName : null,
      lastName: typeof patient.lastName === 'string' ? patient.lastName : null,
      age: typeof patient.age === 'number' ? patient.age : null,
      gender: typeof patient.gender === 'string' ? patient.gender : null,
      phone: typeof patient.phone === 'string' ? patient.phone : null,
      chiefComplaint: typeof content.chiefComplaint === 'string' ? content.chiefComplaint : null,
      details: typeof content.details === 'string' ? content.details : null,
      allergies: typeof patient.allergies === 'string' ? patient.allergies : null,
      conditions: typeof patient.conditions === 'string' ? patient.conditions : null,
    };
  }

  private async loadLatestState(
    intakeSessionId: number,
  ): Promise<{ publicId: string; snapshot: InterviewStateSnapshot } | null> {
    const item = await this.prisma.contextItem.findFirst({
      where: {
        intakeSessionId,
        itemType: 'ai_interview_state',
        supersededBy: { none: {} },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        publicId: true,
        payload: true,
      },
    });

    if (!item) {
      return null;
    }

    const snapshot = this.parseStateSnapshot(item.payload);
    if (!snapshot) {
      return null;
    }

    return {
      publicId: item.publicId,
      snapshot,
    };
  }

  private parseStateSnapshot(payload: unknown): InterviewStateSnapshot | null {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return null;
    }

    const value = payload as Record<string, unknown>;
    const status = value.status;
    const phase = value.phase;
    const askedCount = value.askedCount;
    const maxQuestions = value.maxQuestions;
    const interviewPublicId = value.interviewPublicId;

    if (
      typeof interviewPublicId !== 'string'
      || !this.isStatus(status)
      || !this.isPhase(phase)
      || typeof askedCount !== 'number'
      || typeof maxQuestions !== 'number'
    ) {
      return null;
    }

    const answers = Array.isArray(value.answers)
      ? value.answers
          .map((answer) => this.parseAnswerRecord(answer))
          .filter((answer): answer is InterviewAnswerRecord => answer !== null)
      : [];

    return {
      interviewPublicId,
      status,
      phase,
      askedCount,
      maxQuestions,
      currentQuestion: this.parseQuestion(value.currentQuestion),
      cachedQuestions: Array.isArray(value.cachedQuestions)
        ? value.cachedQuestions.map((question) => this.parseQuestion(question)).filter((question): question is InterviewQuestion => question !== null)
        : [],
      pendingCandidates: Array.isArray(value.pendingCandidates)
        ? value.pendingCandidates.map((question) => this.parseQuestion(question)).filter((question): question is InterviewQuestion => question !== null)
        : [],
      emergencyAlert: this.parseEmergencyAlert(value.emergencyAlert),
      summaryPreview: typeof value.summaryPreview === 'string' ? value.summaryPreview : '',
      answers,
      emergencyAcknowledged: value.emergencyAcknowledged === true,
      summaryRecord: this.parseSummaryRecord(value.summaryRecord),
      sessionGoal: typeof value.sessionGoal === 'string' ? value.sessionGoal : '',
      targetQuestionCount: typeof value.targetQuestionCount === 'number' ? value.targetQuestionCount : null,
      completionReason: typeof value.completionReason === 'string' ? value.completionReason : '',
      providerState: this.parseProviderState(value.providerState),
      generationMode: value.generationMode === 'fallback' || value.fallbackUsed === true ? 'fallback' : 'ai',
    };
  }

  private parseQuestion(value: unknown): InterviewQuestion | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const question = value as Record<string, unknown>;
    if (
      typeof question.publicId !== 'string'
      || !this.isPhase(question.phase)
      || !this.isInputType(question.inputType)
      || typeof question.prompt !== 'string'
    ) {
      return null;
    }

    return {
      publicId: question.publicId,
      phase: question.phase,
      inputType: question.inputType,
      prompt: question.prompt,
      helpText: typeof question.helpText === 'string' ? question.helpText : '',
      placeholder: typeof question.placeholder === 'string' ? question.placeholder : '',
      required: question.required !== false,
      choices: Array.isArray(question.choices) ? question.choices.filter((choice): choice is string => typeof choice === 'string') : [],
      clinicalReason: typeof question.clinicalReason === 'string' ? question.clinicalReason : '',
      askIfAmbiguous: question.askIfAmbiguous === true,
    };
  }

  private parseAnswerRecord(value: unknown): InterviewAnswerRecord | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    const answer = value as Record<string, unknown>;
    if (
      typeof answer.questionPublicId !== 'string'
      || !this.isPhase(answer.phase)
      || !this.isInputType(answer.inputType)
      || typeof answer.prompt !== 'string'
      || typeof answer.answeredAt !== 'string'
      || typeof answer.answerText !== 'string'
    ) {
      return null;
    }

    return {
      questionPublicId: answer.questionPublicId,
      phase: answer.phase,
      prompt: answer.prompt,
      inputType: answer.inputType,
      answeredAt: answer.answeredAt,
      answerText: answer.answerText,
      valueText: typeof answer.valueText === 'string' ? answer.valueText : undefined,
      valueNumber: typeof answer.valueNumber === 'number' ? answer.valueNumber : undefined,
      valueBoolean: typeof answer.valueBoolean === 'boolean' ? answer.valueBoolean : undefined,
      valueChoice: typeof answer.valueChoice === 'string' ? answer.valueChoice : undefined,
    };
  }

  private parseEmergencyAlert(value: unknown): InterviewEmergencyAlert | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const alert = value as Record<string, unknown>;
    if (typeof alert.title !== 'string' || typeof alert.body !== 'string' || typeof alert.recommendation !== 'string') {
      return null;
    }

    return {
      title: alert.title,
      body: alert.body,
      recommendation: alert.recommendation,
    };
  }

  private parseSummaryRecord(value: unknown): InterviewSummaryRecord | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const summary = value as Record<string, unknown>;
    if (
      !this.isUrgency(summary.urgency)
      || typeof summary.recommendedAction !== 'string'
      || typeof summary.summaryPreview !== 'string'
      || typeof summary.combinedDetails !== 'string'
    ) {
      return null;
    }

    return {
      urgency: summary.urgency,
      redFlags: Array.isArray(summary.redFlags) ? summary.redFlags.filter((flag): flag is string => typeof flag === 'string') : [],
      recommendedAction: summary.recommendedAction,
      summaryPreview: summary.summaryPreview,
      combinedDetails: summary.combinedDetails,
    };
  }

  private parseProviderState(value: unknown): InterviewProviderState | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const providerState = value as Record<string, unknown>;
    if (
      providerState.providerName !== 'openai'
      || typeof providerState.model !== 'string'
      || typeof providerState.responseId !== 'string'
      || typeof providerState.promptVersion !== 'string'
    ) {
      return null;
    }

    return {
      providerName: 'openai',
      model: providerState.model,
      responseId: providerState.responseId,
      promptVersion: providerState.promptVersion,
    };
  }

  private async persistState(
    intakeSessionId: number,
    patientId: number,
    snapshot: InterviewStateSnapshot,
    supersedesPublicId: string | null,
    correlationId?: string,
  ): Promise<InterviewStateSnapshot> {
    await this.intakeSessions.appendContextItemByIntakeSessionId(
      intakeSessionId,
      {
        itemType: 'ai_interview_state',
        schemaVersion: 'v2',
        payload: this.toJsonValue(snapshot),
        sourceType: ContextSourceType.AI,
        trustTier: TrustTier.UNTRUSTED,
        reviewState: ReviewState.UNREVIEWED,
        visibilityScope: VisibilityScope.STORED_ONLY,
        patientId,
        supersedesPublicId: supersedesPublicId ?? undefined,
      },
      correlationId,
    );

    return snapshot;
  }

  private async persistAnswer(
    intakeSessionId: number,
    patientId: number,
    answer: InterviewAnswerRecord,
    correlationId?: string,
  ): Promise<void> {
    await this.intakeSessions.appendContextItemByIntakeSessionId(
      intakeSessionId,
      {
        itemType: 'ai_interview_answer',
        schemaVersion: 'v1',
        payload: this.toJsonValue(answer),
        sourceType: ContextSourceType.PATIENT,
        trustTier: TrustTier.UNTRUSTED,
        reviewState: ReviewState.UNREVIEWED,
        visibilityScope: VisibilityScope.STORED_ONLY,
        patientId,
      },
      correlationId,
    );
  }

  private async persistSummary(
    intakeSessionId: number,
    patientId: number,
    summary: InterviewSummaryRecord,
    state: InterviewStateSnapshot,
    correlationId?: string,
  ): Promise<void> {
    const latestSummary = await this.prisma.contextItem.findFirst({
      where: {
        intakeSessionId,
        itemType: 'ai_triage_summary',
        supersededBy: { none: {} },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { publicId: true },
    });

    await this.intakeSessions.appendContextItemByIntakeSessionId(
      intakeSessionId,
      {
        itemType: 'ai_triage_summary',
        schemaVersion: 'v2',
        payload: this.toJsonValue({
          urgency: summary.urgency,
          redFlags: summary.redFlags,
          recommendedAction: summary.recommendedAction,
          summaryPreview: summary.summaryPreview,
          details: summary.combinedDetails,
          sessionGoal: state.sessionGoal,
          completionReason: state.completionReason,
          generationMode: state.generationMode,
        }),
        sourceType: ContextSourceType.AI,
        trustTier: TrustTier.UNTRUSTED,
        reviewState: ReviewState.UNREVIEWED,
        visibilityScope: VisibilityScope.ADMISSIONS,
        patientId,
        supersedesPublicId: latestSummary?.publicId,
      },
      correlationId,
    );

    await this.loggingService.info(
      'Persisted AI triage summary',
      {
        service: 'TriageInterviewService',
        operation: 'persistSummary',
        correlationId,
        patientId,
      },
      {
        intakeSessionId,
        urgency: summary.urgency,
        redFlagCount: summary.redFlags.length,
        generationMode: state.generationMode,
      },
    );
  }

  private isPhase(value: unknown): value is InterviewPhase {
    return value === 'urgent' || value === 'emergent' || value === 'history';
  }

  private isInputType(value: unknown): value is InterviewInputType {
    return value === 'text' || value === 'textarea' || value === 'number' || value === 'boolean' || value === 'single_select';
  }

  private isStatus(value: unknown): value is InterviewStatus {
    return value === 'in_progress' || value === 'emergency_ack_required' || value === 'complete';
  }

  private isUrgency(value: unknown): value is InterviewUrgency {
    return value === 'low' || value === 'medium' || value === 'high' || value === 'emergency';
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
