import { client } from '../api/client';
import type { LoginResponse } from '../types/domain';
import {
  getDemoRuntimeProfile,
  getDemoStaffLoginResponse,
  isStaticDemoMode,
  trackDemoEvent,
} from '../../../../DemoShared/src/staticDemo';

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
  if (isStaticDemoMode()) {
    return getDemoRuntimeProfile();
  }
  return client<DemoRuntimeResponse>('/demo-sessions/me', {
    suppressAuthExpired: true,
  });
}

export async function enterHospitalDemo(): Promise<LoginResponse> {
  if (isStaticDemoMode()) {
    trackDemoEvent('demo_opened', { app: 'hospital' });
    return getDemoStaffLoginResponse() as LoginResponse;
  }
  return client<LoginResponse>('/demo-sessions/enter-hospital', {
    method: 'POST',
  });
}

export async function recordDemoEvent(type: string, metadata?: Record<string, unknown>): Promise<void> {
  if (isStaticDemoMode()) {
    trackDemoEvent(type, metadata);
    return;
  }
  await client('/demo-sessions/events', {
    method: 'POST',
    body: JSON.stringify({ type, metadata }),
    suppressAuthExpired: true,
  });
}
