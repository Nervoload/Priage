import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import {
  ClinicQuestionnaireError, DEFAULT_CLINIC_QUESTIONS, clinicAnswerRecords, clinicQuestionsStatus, isClinicQuestionId,
  parseClinicQuestions, toInterviewQuestions, validateClinicQuestions, type ClinicQuestion,
} from '../src/modules/clinic/questionnaire/clinic-questionnaire';
import { ClinicQuestionnaireService } from '../src/modules/clinic/questionnaire/clinic-questionnaire.service';

const custom = (key: string, extra: Partial<ClinicQuestion> = {}) => ({ key, origin: 'custom', prompt: 'How did you hear about us?', helpText: null, inputType: 'single_select', choices: ['Friend', 'Search'], ...extra });

describe('clinic questions', () => {
  it('normalizes what an admin publishes', () => {
    expect(validateClinicQuestions([{ ...DEFAULT_CLINIC_QUESTIONS[0], prompt: '  Have you   travelled recently? ' }, custom('referral', { choices: [' Friend ', 'Search', ''] })])).toEqual([
      { ...DEFAULT_CLINIC_QUESTIONS[0], prompt: 'Have you travelled recently?' },
      { key: 'referral', origin: 'custom', prompt: 'How did you hear about us?', helpText: null, inputType: 'single_select', choices: ['Friend', 'Search'] },
    ]);
    expect(validateClinicQuestions([custom('notes', { inputType: 'text', choices: ['ignored'] })])[0].choices).toEqual([]);
    expect(validateClinicQuestions([])).toEqual([]);
  });

  it.each([
    ['not a list', 'x', 'Questions must be a list'],
    ['too many', Array.from({ length: 9 }, (_, index) => custom(`q${index}`)), 'up to 8'],
    ['a bad key', [custom('Bad Key')], 'valid key'],
    ['a repeated key', [custom('dup'), custom('dup')], 'repeats another'],
    ['an unknown default', [custom('made_up', { origin: 'default' })], 'isn’t one of Priage’s default'],
    ['a custom question with a default key', [custom('travel_14d')], 'kept for a default'],
    ['a short prompt', [custom('short', { prompt: 'Hi?' })], 'between 5 and 200'],
    ['long help text', [custom('help', { helpText: 'x'.repeat(201) })], 'help text over 200'],
    ['no answer type', [custom('kind', { inputType: 'number' as never })], 'needs an answer type'],
    ['one choice', [custom('few', { choices: ['Only'] })], '2 to 6 choices'],
    ['repeated choices', [custom('dupes', { choices: ['Yes', 'yes'] })], 'repeats a choice'],
    ['a long choice', [custom('long', { choices: ['x'.repeat(81), 'b'] })], 'over 80'],
  ])('refuses %s', (_label, input, message) => {
    expect(() => validateClinicQuestions(input)).toThrow(ClinicQuestionnaireError);
    expect(() => validateClinicQuestions(input)).toThrow(message);
  });

  it('reads malformed stored questions as none', () => {
    expect(parseClinicQuestions([{ key: 'x' }])).toEqual([]);
    expect(parseClinicQuestions(DEFAULT_CLINIC_QUESTIONS)).toHaveLength(1);
  });

  it('turns questions into interview questions with a clinic id', () => {
    const [travel, referral] = toInterviewQuestions([DEFAULT_CLINIC_QUESTIONS[0], custom('referral') as ClinicQuestion]);
    expect(travel).toMatchObject({ publicId: 'clinic:travel_14d', inputType: 'boolean', choices: ['Yes', 'No'], required: true, phase: 'urgent' });
    expect(referral.choices).toEqual(['Friend', 'Search']);
    expect(isClinicQuestionId(travel.publicId)).toBe(true);
    expect(isClinicQuestionId('q1')).toBe(false);
  });

  it('checks answers given after the interview', () => {
    const questions = [DEFAULT_CLINIC_QUESTIONS[0], custom('referral') as ClinicQuestion, custom('notes', { inputType: 'text', choices: [] }) as ClinicQuestion];
    const at = new Date('2026-10-03T15:00:00Z');
    expect(clinicAnswerRecords(questions, [{ key: 'travel_14d', valueBoolean: true }, { key: 'referral', valueChoice: 'Search' }, { key: 'notes', valueText: ' Side door ' }], at)).toEqual([
      expect.objectContaining({ questionPublicId: 'clinic:travel_14d', answerText: 'Yes', valueBoolean: true, answeredAt: at.toISOString() }),
      expect.objectContaining({ questionPublicId: 'clinic:referral', answerText: 'Search', valueChoice: 'Search' }),
      expect.objectContaining({ questionPublicId: 'clinic:notes', answerText: 'Side door', valueText: 'Side door' }),
    ]);
    expect(() => clinicAnswerRecords(questions, [{ key: 'travel_14d' }], at)).toThrow('Answer “Have you travelled');
    expect(() => clinicAnswerRecords(questions, [{ key: 'travel_14d', valueBoolean: false }, { key: 'referral', valueChoice: 'Billboard' }], at)).toThrow('Choose an answer');
    expect(() => clinicAnswerRecords(questions, [{ key: 'travel_14d', valueBoolean: false }, { key: 'referral', valueChoice: 'Friend' }, { key: 'notes', valueText: ' ' }], at)).toThrow('Answer “How did');
    expect(() => clinicAnswerRecords(questions, [{ key: 'travel_14d', valueBoolean: false }, { key: 'referral', valueChoice: 'Friend' }, { key: 'notes', valueText: 'x'.repeat(1001) }], at)).toThrow('under 1000');
    expect(() => clinicAnswerRecords(questions, 'nope', at)).toThrow(ClinicQuestionnaireError);
  });

  it('says where a visit stands with the clinic’s questions', () => {
    const pinned = { clinicQuestionnaire: { versionId: 4, version: 2, questions: [{ publicId: 'clinic:travel_14d' }] } };
    expect(clinicQuestionsStatus({ interviewState: { ...pinned, answers: [{ questionPublicId: 'clinic:travel_14d' }] }, hasResponse: false, activeVersion: 3 })).toBe('answered');
    expect(clinicQuestionsStatus({ interviewState: { ...pinned, answers: [] }, hasResponse: false, activeVersion: 3 })).toBe('pending');
    expect(clinicQuestionsStatus({ interviewState: { status: 'complete' }, hasResponse: true, activeVersion: 3 })).toBe('answered');
    expect(clinicQuestionsStatus({ interviewState: null, hasResponse: false, activeVersion: 3 })).toBe('pending');
    expect(clinicQuestionsStatus({ interviewState: null, hasResponse: false, activeVersion: null })).toBe('none');
  });
});

describe('clinic questionnaire service', () => {
  const staff = { userId: 5, hospitalId: 4 };

  function service(latestVersion: number | null) {
    const tx = {
      $executeRaw: vi.fn(),
      clinicQuestionnaireVersion: {
        findFirst: vi.fn(async () => (latestVersion == null ? null : { version: latestVersion })),
        create: vi.fn(async () => ({})),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (work: (client: typeof tx) => unknown) => work(tx)),
      clinicQuestionnaireVersion: {
        findMany: vi.fn(async () => (latestVersion == null ? [] : [{ version: latestVersion, questions: DEFAULT_CLINIC_QUESTIONS, createdAt: new Date(), publishedByUserId: 5 }])),
        findFirst: vi.fn(async () => (latestVersion == null ? null : { id: 40, version: latestVersion, questions: DEFAULT_CLINIC_QUESTIONS })),
      },
    };
    return { questionnaire: new ClinicQuestionnaireService(prisma as never, { assertTenantEnabled: vi.fn() } as never, {} as never), tx };
  }

  it('starts a clinic that never published from Priage’s defaults', async () => {
    const view = await service(null).questionnaire.adminView(staff);
    expect(view).toMatchObject({ current: null, draft: DEFAULT_CLINIC_QUESTIONS, history: [], maxQuestions: 8 });
    expect(view.locked[0].key).toBe('safety_immediate_danger');
  });

  it('publishes the next version, and refuses when someone published first', async () => {
    const { questionnaire, tx } = service(2);
    await questionnaire.publish(staff, { expectedVersion: 2, questions: [...DEFAULT_CLINIC_QUESTIONS] });
    expect(tx.clinicQuestionnaireVersion.create).toHaveBeenCalledWith({ data: expect.objectContaining({ hospitalId: 4, version: 3, publishedByUserId: 5 }) });
    await expect(service(3).questionnaire.publish(staff, { expectedVersion: 2, questions: [] })).rejects.toBeInstanceOf(ConflictException);
    await expect(service(2).questionnaire.publish(staff, { expectedVersion: 2, questions: [{ key: 'x' }] })).rejects.toThrow('valid key');
  });

  it('pins the active version for a new interview', async () => {
    expect(await service(3).questionnaire.pinFor(4)).toMatchObject({ versionId: 40, version: 3, questions: [{ publicId: 'clinic:travel_14d' }] });
    expect(await service(null).questionnaire.pinFor(4)).toBeNull();
  });
});

describe('clinic questions for general-site patients', () => {
  const patient = { patientId: 9 } as never;

  function patientService(options: { status?: string; pinned?: boolean; responded?: boolean; latestVersion?: number | null }) {
    const prisma = {
      encounter: { findFirst: vi.fn(async () => ({ id: 7, status: options.status ?? 'INTAKE', hospitalId: 4, intakeSessions: [{ id: 11 }] })) },
      contextItem: {
        findFirst: vi.fn(async ({ where }: { where: { itemType: string } }) => {
          if (where.itemType === 'ai_interview_state') return { payload: { status: 'complete', answers: [], ...(options.pinned ? { clinicQuestionnaire: { versionId: 40, version: 3, questions: [{ publicId: 'clinic:travel_14d' }] } } : {}) } };
          return options.responded ? { id: 1 } : null;
        }),
      },
      clinicQuestionnaireVersion: { findFirst: vi.fn(async () => (options.latestVersion === null ? null : { id: 40, version: options.latestVersion ?? 3, questions: DEFAULT_CLINIC_QUESTIONS })) },
    };
    const intakeSessions = { appendContextItemsByIntakeSessionId: vi.fn(async () => []) };
    return { questionnaire: new ClinicQuestionnaireService(prisma as never, { assertTenantEnabled: vi.fn() } as never, intakeSessions as never), intakeSessions };
  }

  it('lists the questions still owed before booking, without the clinic’s internal fields', async () => {
    expect(await patientService({}).questionnaire.patientQuestions(7, patient)).toEqual({
      status: 'pending', version: 3,
      questions: [{ key: 'travel_14d', prompt: DEFAULT_CLINIC_QUESTIONS[0].prompt, helpText: DEFAULT_CLINIC_QUESTIONS[0].helpText, inputType: 'boolean', choices: [] }],
    });
    expect(await patientService({ latestVersion: null }).questionnaire.patientQuestions(7, patient)).toEqual({ status: 'none', version: null, questions: [] });
    // Questions pinned in the interview are answered there, not here.
    expect((await patientService({ pinned: true }).questionnaire.patientQuestions(7, patient)).questions).toEqual([]);
  });

  it('stores the answers with the exact questions shown', async () => {
    const { questionnaire, intakeSessions } = patientService({});
    await questionnaire.submitPatientAnswers(7, patient, { version: 3, answers: [{ key: 'travel_14d', valueBoolean: false }] });
    const [intakeSessionId, items] = intakeSessions.appendContextItemsByIntakeSessionId.mock.calls[0] as unknown as [number, Array<{ itemType: string; payload: { version: number; questions: unknown[]; answers: Array<{ answerText: string }>; timing: string } }>];
    expect(intakeSessionId).toBe(11);
    expect(items[0]).toMatchObject({ itemType: 'clinic_questionnaire_response', payload: { version: 3, timing: 'after_interview', answers: [{ answerText: 'No' }] } });
    expect(items[0].payload.questions).toHaveLength(1);
  });

  it('refuses answers to an old version, after booking, or for pinned questions', async () => {
    await expect(patientService({}).questionnaire.submitPatientAnswers(7, patient, { version: 2, answers: [] })).rejects.toThrow('changed its questions');
    await expect(patientService({ status: 'REQUESTED' }).questionnaire.submitPatientAnswers(7, patient, { version: 3, answers: [] })).rejects.toBeInstanceOf(ConflictException);
    await expect(patientService({ pinned: true }).questionnaire.submitPatientAnswers(7, patient, { version: 3, answers: [] })).rejects.toThrow('part of your assessment');
    await expect(patientService({}).questionnaire.submitPatientAnswers(7, patient, { version: 3, answers: [{ key: 'travel_14d' }] })).rejects.toThrow('Answer');
  });

  it('accepts a repeat submission once answered without storing it twice', async () => {
    const { questionnaire, intakeSessions } = patientService({ responded: true });
    expect((await questionnaire.submitPatientAnswers(7, patient, { version: 3, answers: [] })).status).toBe('answered');
    expect(intakeSessions.appendContextItemsByIntakeSessionId).not.toHaveBeenCalled();
  });
});
