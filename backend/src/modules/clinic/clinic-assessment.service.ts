import { BadRequestException, Injectable } from '@nestjs/common';

import { readAssessmentConfig, type AssessmentEngine } from '../assessment/assessment-config';
import { harnessOnlyFields, type AdvanceAssessmentDto, type StartAssessmentDto } from '../assessment/dto/assessment.dto';
import { AssessmentHarnessService, type AnswerAttribution } from '../assessment/harness/assessment-harness.service';
import { isHarnessPayload } from '../assessment/harness/harness-state';
import type { AssessmentClientState } from '../assessment/harness/harness-types';
import { TriageInterviewService } from '../intake/interview/triage-interview.service';
import type { ClinicQuestionnairePin, InterviewClientState, InterviewStatus } from '../intake/interview/triage-interview.types';
import { PrismaService } from '../prisma/prisma.service';

export type ClinicAssessmentState = AssessmentClientState | InterviewClientState;
export type ClinicAssessmentStatus = 'not_started' | InterviewStatus | 'review';

/**
 * Routes a clinic visit's assessment to the engine it started with. A new
 * assessment uses the configured engine; a running one never changes engine,
 * so flipping the setting can't hand a half-finished assessment to the other.
 */
@Injectable()
export class ClinicAssessmentService {
  private readonly configured = readAssessmentConfig().engine;

  constructor(
    private readonly prisma: PrismaService,
    private readonly harness: AssessmentHarnessService,
    private readonly legacy: TriageInterviewService,
  ) {}

  get configuredEngine(): AssessmentEngine {
    return this.configured;
  }

  /** The engine an assessment uses: the one stored on its state, or the configured one when it hasn't started. */
  async engineFor(intakeSessionId: number): Promise<AssessmentEngine> {
    const head = await this.prisma.contextItem.findFirst({
      where: { intakeSessionId, itemType: 'ai_interview_state', supersededBy: { none: {} } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { payload: true },
    });
    if (!head) return this.configured;
    return isHarnessPayload(head.payload) ? 'harness' : 'legacy';
  }

  async start(intakeSessionId: number, patientId: number, clinicQuestionnaire: ClinicQuestionnairePin | null, start?: StartAssessmentDto): Promise<ClinicAssessmentState> {
    if (await this.engineFor(intakeSessionId) === 'harness') return this.harness.start(intakeSessionId, patientId, { clinicQuestionnaire, start });
    return this.legacy.startByIntakeSession(intakeSessionId, patientId, undefined, { clinicQuestionnaire });
  }

  async advance(intakeSessionId: number, patientId: number, dto: AdvanceAssessmentDto, attribution: AnswerAttribution): Promise<ClinicAssessmentState> {
    if (await this.engineFor(intakeSessionId) === 'harness') return this.harness.advance(intakeSessionId, patientId, dto, attribution);
    const extra = harnessOnlyFields(dto);
    if (extra.length) throw new BadRequestException(`This assessment doesn't accept: ${extra.join(', ')}`);
    return this.legacy.advanceByIntakeSession(intakeSessionId, patientId, { ...dto, action: dto.action as 'acknowledge_emergency' | undefined }, attribution);
  }

  /**
   * The current state for polling, or null before the assessment starts; this
   * never creates one, so a desk tablet can ask who is answering first. A
   * started legacy assessment is resumed through its own start, as before.
   */
  async state(intakeSessionId: number, patientId: number, clinicQuestionnaire: ClinicQuestionnairePin | null): Promise<ClinicAssessmentState | null> {
    if (await this.engineFor(intakeSessionId) === 'harness') return this.harness.state(intakeSessionId);
    if (await this.legacy.statusByIntakeSession(intakeSessionId) === 'not_started') return null;
    return this.legacy.startByIntakeSession(intakeSessionId, patientId, undefined, { clinicQuestionnaire });
  }

  async status(intakeSessionId: number): Promise<ClinicAssessmentStatus> {
    return await this.engineFor(intakeSessionId) === 'harness' ? this.harness.status(intakeSessionId) : this.legacy.statusByIntakeSession(intakeSessionId);
  }
}
