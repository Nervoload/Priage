import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ContextSourceType,
  Prisma,
  ReviewState,
  SummaryProjectionKind,
  TrustTier,
  VisibilityScope,
} from '@prisma/client';
import { randomUUID } from 'crypto';

import { IntakeSessionsService } from '../../intake-sessions/intake-sessions.service';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  AiTriageAnswer,
  AiTriagePatientContext,
  AiTriageState,
} from '../types/ai-triage.types';

@Injectable()
export class AiTriageStateStore {
  // Production deployment requires an explicit review of consent, access,
  // retention/deletion, audit, encryption, and applicable healthcare/privacy
  // obligations. This storage shape alone does not establish compliance.
  constructor(
    private readonly prisma: PrismaService,
    private readonly intakeSessions: IntakeSessionsService,
  ) {}

  async getOrCreateSession(authSessionId: number, patientId: number, correlationId?: string) {
    return this.intakeSessions.getOrCreateDraftForAuthSession(authSessionId, patientId, correlationId);
  }

  async assertOwnedSession(publicId: string, authSessionId: number, patientId: number) {
    const session = await this.prisma.intakeSession.findFirst({
      where: { publicId, authSessionId, patientId },
      select: { id: true, publicId: true, patientId: true },
    });
    if (!session) throw new NotFoundException('Triage session not found');
    return session;
  }

  async loadState(intakeSessionId: number): Promise<{ state: AiTriageState; publicId: string } | null> {
    const item = await this.prisma.contextItem.findFirst({
      where: {
        intakeSessionId,
        itemType: 'ai_triage_state',
        supersededBy: { none: {} },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { publicId: true, payload: true },
    });
    const state = item ? this.parseState(item.payload) : null;
    return item && state ? { state, publicId: item.publicId } : null;
  }

  async saveState(
    intakeSessionId: number,
    patientId: number,
    state: AiTriageState,
    previousPublicId: string | null,
    correlationId?: string,
  ): Promise<void> {
    await this.intakeSessions.appendContextItemByIntakeSessionId(
      intakeSessionId,
      {
        itemType: 'ai_triage_state',
        schemaVersion: 'v1',
        payload: this.json(state),
        sourceType: ContextSourceType.AI,
        trustTier: TrustTier.UNTRUSTED,
        reviewState: ReviewState.UNREVIEWED,
        visibilityScope: VisibilityScope.STORED_ONLY,
        patientId,
        supersedesPublicId: previousPublicId ?? undefined,
      },
      correlationId,
    );
  }

  async saveAnswer(
    intakeSessionId: number,
    patientId: number,
    answer: AiTriageAnswer,
    correlationId?: string,
  ): Promise<void> {
    await this.intakeSessions.appendContextItemByIntakeSessionId(
      intakeSessionId,
      {
        itemType: 'ai_triage_answer',
        schemaVersion: 'v1',
        payload: this.json(answer),
        sourceType: ContextSourceType.PATIENT,
        trustTier: TrustTier.UNTRUSTED,
        reviewState: ReviewState.UNREVIEWED,
        visibilityScope: VisibilityScope.STORED_ONLY,
        patientId,
      },
      correlationId,
    );
  }

  async saveBaseline(
    intakeSessionId: number,
    patientId: number,
    chiefComplaint: string,
    mandatoryAnswers: AiTriageState['mandatoryAnswers'],
    correlationId?: string,
  ): Promise<void> {
    await this.intakeSessions.appendContextItemByIntakeSessionId(
      intakeSessionId,
      {
        itemType: 'ai_triage_baseline',
        schemaVersion: 'v1',
        payload: this.json({ chiefComplaint, mandatoryAnswers }),
        sourceType: ContextSourceType.PATIENT,
        trustTier: TrustTier.UNTRUSTED,
        reviewState: ReviewState.UNREVIEWED,
        visibilityScope: VisibilityScope.STORED_ONLY,
        patientId,
      },
      correlationId,
    );
  }

  async loadPatientContext(intakeSessionId: number): Promise<AiTriagePatientContext> {
    const summary = await this.prisma.summaryProjection.findFirst({
      where: { intakeSessionId, kind: SummaryProjectionKind.OPERATIONAL, active: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { content: true },
    });
    const content = this.record(summary?.content);
    const patient = this.record(content.patient);
    return {
      age: typeof patient.age === 'number' ? patient.age : null,
      gender: typeof patient.gender === 'string' ? patient.gender : null,
      chiefComplaint: typeof content.chiefComplaint === 'string' ? content.chiefComplaint : null,
      details: typeof content.details === 'string' ? content.details : null,
      allergies: typeof patient.allergies === 'string' ? patient.allergies : null,
      conditions: typeof patient.conditions === 'string' ? patient.conditions : null,
    };
  }

  async saveSubmittedSummary(
    intakeSessionId: number,
    patientId: number,
    state: AiTriageState,
    correlationId?: string,
  ): Promise<void> {
    const generatedAt = new Date().toISOString();
    const content = {
      ...state.summary,
      caseSummary: state.summary.briefing,
      recommendedCtasLevel: null,
      questionAnswers: state.answers.map((answer) => ({
        question: answer.question,
        answer: answer.answer,
        phase: 'intake',
        answeredAt: answer.answeredAt,
      })),
      progressionRisks: [],
      answers: state.answers,
      mandatoryAnswers: state.mandatoryAnswers,
      urgentReview: state.status === 'urgent_review',
      generatedAt,
      generationMode: state.provider === 'fallback' ? 'fallback' : 'ai',
    };
    await this.intakeSessions.appendContextItemByIntakeSessionId(
      intakeSessionId,
      {
        itemType: 'ai_triage_summary',
        schemaVersion: 'v1',
        payload: this.json(content),
        sourceType: ContextSourceType.AI,
        trustTier: TrustTier.UNTRUSTED,
        reviewState: ReviewState.UNREVIEWED,
        visibilityScope: VisibilityScope.ADMISSIONS,
        patientId,
      },
      correlationId,
    );
    await this.prisma.$transaction(async (tx) => {
      await tx.summaryProjection.updateMany({
        where: { intakeSessionId, kind: SummaryProjectionKind.AI_DERIVED, active: true },
        data: { active: false },
      });
      await tx.summaryProjection.create({
        data: {
          publicId: `sum_${randomUUID()}`,
          kind: SummaryProjectionKind.AI_DERIVED,
          intakeSessionId,
          sourceType: ContextSourceType.AI,
          trustTier: TrustTier.UNTRUSTED,
          reviewState: ReviewState.UNREVIEWED,
          visibilityScope: VisibilityScope.CLINICAL,
          content: this.json(content),
        },
      });
    });
  }

  private parseState(value: unknown): AiTriageState | null {
    const state = this.record(value);
    if (
      typeof state.sessionId !== 'string'
      || !this.isStatus(state.status)
      || typeof state.questionCount !== 'number'
      || typeof state.maxQuestions !== 'number'
      || !Array.isArray(state.answers)
      || typeof state.createdAt !== 'string'
      || typeof state.updatedAt !== 'string'
    ) return null;
    return state as unknown as AiTriageState;
  }

  private isStatus(value: unknown): value is AiTriageState['status'] {
    return value === 'in_progress' || value === 'ready_to_complete'
      || value === 'urgent_review' || value === 'submitted';
  }

  private record(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  }

  private json(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
