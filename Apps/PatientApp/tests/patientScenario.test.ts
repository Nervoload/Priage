import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { PATIENT_QUESTIONS, PATIENT_SCENARIO, PATIENT_TEXT_ANSWERS } from '../../DemoShared/src/patientScenario';
import { advanceDemoInterview, confirmDemoIntent, createDemoIntent, loadDemoState, startDemoInterview } from '../../DemoShared/src/staticDemo';

beforeEach(async () => {
  const storage = new Map<string, string>();
  vi.stubGlobal('BroadcastChannel', undefined);
  vi.stubGlobal('window', {
    localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) },
    location: { search: '' },
  });
  await createDemoIntent(PATIENT_SCENARIO);
});

describe('conference patient intake', () => {
  it('keeps the mandatory safety copy aligned with the live service and requires an answer', async () => {
    const live = readFileSync(new URL('../../../backend/src/modules/intake/interview/triage-interview.service.ts', import.meta.url), 'utf8');
    const first = (await startDemoInterview()).currentQuestion!;
    expect(first.publicId).toBe('safety_immediate_danger');
    expect(live).toContain(`prompt: '${first.prompt}'`);
    expect(live).toContain(`helpText: '${first.helpText}'`);
    await expect(advanceDemoInterview({ questionPublicId: first.publicId })).rejects.toThrow('Please answer');
  });

  it('requires emergency acknowledgement without skipping the incident question', async () => {
    const warning = await advanceDemoInterview({ questionPublicId: 'safety_immediate_danger', valueBoolean: true });
    expect(warning.status).toBe('emergency_ack_required');
    expect(warning.emergencyAlert?.title).toBe('Get emergency help now');
    await expect(advanceDemoInterview({ questionPublicId: 'head-impact', valueText: 'An answer' })).rejects.toThrow('acknowledge');
    const next = await advanceDemoInterview({ action: 'acknowledge_emergency' });
    expect(next.currentQuestion?.publicId).toBe('head-impact');
  });

  it('persists selected answers through resume and includes them in the hospital handoff', async () => {
    for (const question of PATIENT_QUESTIONS) {
      const answer = question.inputType === 'boolean' ? { valueBoolean: false }
        : question.inputType === 'number' ? { valueNumber: 0 }
        : question.inputType === 'single_select' ? { valueChoice: question.choices[1] }
        : { valueText: PATIENT_TEXT_ANSWERS[question.publicId] };
      await advanceDemoInterview({ questionPublicId: question.publicId, ...answer });
    }
    expect((await startDemoInterview()).status).toBe('complete');
    const encounter = await confirmDemoIntent({ hospitalSlug: 'demo-hospital' });
    expect(encounter.chiefComplaint).toBe(PATIENT_SCENARIO.chiefComplaint);
    expect(encounter.priageSummary?.questionAnswers).toHaveLength(8);
    expect(encounter.priageSummary?.briefing).toContain('headache right now? 0');
    expect(encounter.priageSummary?.briefing).toContain('getting worse? No');
    expect(encounter.priageSummary?.briefing).not.toMatch(/demo|actually ai/i);
    expect(loadDemoState().interview.askedCount).toBe(8);
    await createDemoIntent(PATIENT_SCENARIO);
    expect((await startDemoInterview()).currentQuestion?.publicId).toBe('safety_immediate_danger');
  });

  it('rejects stale double submissions and out-of-range pain answers', async () => {
    await advanceDemoInterview({ questionPublicId: 'safety_immediate_danger', valueBoolean: false });
    await expect(advanceDemoInterview({ questionPublicId: 'safety_immediate_danger', valueBoolean: false })).rejects.toThrow('already changed');
    for (const question of PATIENT_QUESTIONS.slice(1, 5)) {
      await advanceDemoInterview({ questionPublicId: question.publicId, valueText: 'Fall from bike', valueChoice: question.choices[0] });
    }
    await expect(advanceDemoInterview({ questionPublicId: 'head-pain', valueNumber: 11 })).rejects.toThrow('0 to 10');
  });
});
