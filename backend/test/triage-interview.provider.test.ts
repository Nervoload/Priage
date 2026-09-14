import { afterEach, describe, expect, it, vi } from 'vitest';

import { OpenAiCompatibleTriageInterviewProvider } from '../src/modules/intake/interview/triage-interview.provider';
import { assertProductionConfiguration } from '../src/common/config/production-config';

describe('triage interview provider mode', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('is disabled by default even when a key is present', () => {
    vi.stubEnv('TRIAGE_INTERVIEW_MODE', 'deterministic');
    vi.stubEnv('TRIAGE_AI_API_KEY', 'test-key');
    expect(new OpenAiCompatibleTriageInterviewProvider().isConfigured()).toBe(false);
  });

  it('requires both explicit external mode and a key', () => {
    vi.stubEnv('TRIAGE_INTERVIEW_MODE', 'external');
    vi.stubEnv('TRIAGE_AI_API_KEY', 'test-key');
    expect(new OpenAiCompatibleTriageInterviewProvider().isConfigured()).toBe(true);
  });

  it('uses stateless Responses calls and excludes direct patient identifiers', async () => {
    vi.stubEnv('TRIAGE_INTERVIEW_MODE', 'external');
    vi.stubEnv('TRIAGE_AI_API_KEY', 'test-key');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'response-id', output_text: '{}' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await new OpenAiCompatibleTriageInterviewProvider().generate({
      phase: 'urgent',
      askedCount: 0,
      maxQuestions: 10,
      batchSize: 2,
      emergencyAcknowledged: false,
      sessionGoal: '',
      targetQuestionCount: 5,
      patient: {
        firstName: 'DirectFirst',
        lastName: 'DirectLast',
        phone: '555-555-0199',
        age: 42,
        gender: 'female',
        chiefComplaint: 'headache',
        details: 'started this morning',
        allergies: null,
        conditions: null,
      },
      answers: [],
      pendingCandidates: [],
    } as never);

    const request = fetchMock.mock.calls[0]?.[1] as { body: string };
    const body = JSON.parse(request.body) as { store: boolean; input: string };
    expect(body.store).toBe(false);
    expect(body.input).not.toContain('DirectFirst');
    expect(body.input).not.toContain('DirectLast');
    expect(body.input).not.toContain('555-555-0199');
    expect(body.input).toContain('headache');
  });

  it('blocks every external provider setting in production', () => {
    const required = {
      DATABASE_URL: 'postgresql://example/db?sslmode=require',
      REDIS_HOST: 'redis', REDIS_PASSWORD: 'secret', REDIS_TLS: 'true',
      CORS_ORIGINS: 'https://hospital.example.ca', GATEWAY_SHARED_SECRET: 'secret',
      STAFF_MFA_ENCRYPTION_KEY: 'secret', STAFF_MFA_REQUIRED: 'true',
      STAFF_DEVICE_BINDING_REQUIRED: 'true', CARE_TEAM_ACCESS_REQUIRED: 'true',
      SENSITIVE_READ_AUDIT_FAIL_CLOSED: 'true', ASSET_STORAGE_PROVIDER: 's3',
      ASSET_STORAGE_BUCKET: 'assets', ASSET_S3_KMS_KEY_ID: 'kms', ASSET_SCANNER_URL: 'https://scanner',
      AUDIT_ARCHIVE_BUCKET: 'audit', DATABASE_PROXY_MODE: 'pgbouncer', DATABASE_POOL_MAX: '20',
      WEBHOOK_SECRET_ENCRYPTION_KEY: 'key', WEBHOOK_ALLOWED_HOSTS: 'hooks.example.ca',
      HOSPITAL_DASHBOARD_URL: 'https://hospital.example.ca/alerts',
    };
    vi.stubEnv('NODE_ENV', 'production');
    Object.entries(required).forEach(([name, value]) => vi.stubEnv(name, value));
    vi.stubEnv('TRIAGE_INTERVIEW_MODE', 'deterministic');
    vi.stubEnv('TRIAGE_AI_API_KEY', 'must-be-rejected');
    expect(() => assertProductionConfiguration()).toThrow(/External triage AI/);
  });
});
