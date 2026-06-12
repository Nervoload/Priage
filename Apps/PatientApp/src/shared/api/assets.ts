import type { AssetSummary } from '../types/domain';
import { sendDurablePatientUpload } from '../patientCommandOutbox';
import { client } from './client';

export async function uploadIntakeImages(files: File[]): Promise<AssetSummary[]> {
  return sendDurablePatientUpload<AssetSummary[]>(
    '/patient/assets/intake/images',
    files.map((file) => ({ file })),
  );
}

export async function listIntakeImages(): Promise<AssetSummary[]> {
  return client<AssetSummary[]>('/patient/assets/intake/images');
}

export async function uploadMessageImages(
  encounterId: number,
  files: File[],
): Promise<AssetSummary[]> {
  return sendDurablePatientUpload<AssetSummary[]>(
    `/patient/encounters/${encounterId}/message-images`,
    files.map((file) => ({ file })),
  );
}
