import { afterEach, describe, expect, it, vi } from 'vitest';
import { client, PATIENT_SESSION_EXPIRED_EVENT } from './client';

describe('independent recovery authentication', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('keeps an expired recovery session from logging out the patient account', async () => {
    const dispatchEvent = vi.fn(); vi.stubGlobal('window', { dispatchEvent });
    const fetchMock = vi.fn<typeof fetch>(async () => new Response('Access code required', { status: 401 })); vi.stubGlobal('fetch', fetchMock);
    await expect(client('/clinic-intake/recovery/state', { independentSession: true })).rejects.toMatchObject({ status: 401 });
    expect(dispatchEvent).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls[0][1]).not.toHaveProperty('independentSession');
  });
  it('continues notifying account consumers about ordinary patient-session expiry', async () => {
    const dispatchEvent = vi.fn(); vi.stubGlobal('window', { dispatchEvent }); vi.stubGlobal('fetch', vi.fn(async () => new Response('Expired', { status: 401 })));
    await expect(client('/patient-auth/me')).rejects.toMatchObject({ status: 401 });
    expect(dispatchEvent.mock.calls[0][0].type).toBe(PATIENT_SESSION_EXPIRED_EVENT);
  });
});
