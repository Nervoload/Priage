import { client } from '../api/client';
import type { LoginResponse } from '../types/domain';

export interface DemoRuntimeProfile {
  isDemo: true;
  profileId: string;
  label: string;
  expiresAt: string;
  apps: {
    hospital: boolean;
    patient: boolean;
  };
  hospitalViews: string[];
  defaultTourId: string;
  scenarioPack: string;
  watermark: string;
  disabledCapabilities: string[];
}

export interface InactiveDemoRuntime {
  isDemo: false;
}

export type DemoRuntimeResponse = DemoRuntimeProfile | InactiveDemoRuntime;

export async function getDemoRuntime(): Promise<DemoRuntimeResponse> {
  return client<DemoRuntimeResponse>('/demo-sessions/me', {
    suppressAuthExpired: true,
  });
}

export async function enterHospitalDemo(): Promise<LoginResponse> {
  return client<LoginResponse>('/demo-sessions/enter-hospital', {
    method: 'POST',
  });
}

export async function recordDemoEvent(type: string, metadata?: Record<string, unknown>): Promise<void> {
  await client('/demo-sessions/events', {
    method: 'POST',
    body: JSON.stringify({ type, metadata }),
    suppressAuthExpired: true,
  });
}
