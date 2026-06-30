import type { AssetSummary } from '../types/domain';
import { sendDurablePatientUpload } from '../patientCommandOutbox';
import { client } from './client';
import {
  isStaticDemoMode,
  trackDemoEvent,
} from '../../../../DemoShared/src/staticDemo';

// This helper is deliberately retained even while its direct client call sites
// are feature-gated. The security regression verifies that patient uploads use
// the durable command path rather than an ad-hoc fetch implementation.
export async function uploadIntakeImages(files: File[]): Promise<AssetSummary[]> {
  if (isStaticDemoMode()) {
    trackDemoEvent('demo_upload_blocked', { kind: 'intake', fileCount: files.length });
    return [];
  }
  return sendDurablePatientUpload<AssetSummary[]>(
    '/patient/assets/intake/images',
    files.map((file) => ({ file })),
  );
}

export async function listIntakeImages(): Promise<AssetSummary[]> {
  if (isStaticDemoMode()) {
    return [];
  }
  return client<AssetSummary[]>('/patient/assets/intake/images');
}

export async function uploadMessageImages(
  encounterId: number,
  files: File[],
): Promise<AssetSummary[]> {
  if (isStaticDemoMode()) {
    trackDemoEvent('demo_upload_blocked', { kind: 'message', encounterId, fileCount: files.length });
    return [];
  }
  return sendDurablePatientUpload<AssetSummary[]>(
    `/patient/encounters/${encounterId}/message-images`,
    files.map((file) => ({ file })),
  );
}
