import { client } from './client';
import type {
  HospitalSummary,
  HospitalConfigEnvelope,
  HospitalFeedbackSubmission,
  HospitalOperationalConfig,
  UpdateHospitalDetailsPayload,
} from '../types/domain';

export async function getHospital(hospitalId: number): Promise<HospitalSummary> {
  return client<HospitalSummary>(`/hospitals/${hospitalId}`);
}

export async function updateHospitalDetails(
  hospitalId: number,
  payload: UpdateHospitalDetailsPayload,
): Promise<HospitalSummary> {
  return client<HospitalSummary>(`/hospitals/${hospitalId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function getHospitalConfig(hospitalId: number): Promise<HospitalConfigEnvelope> {
  return client<HospitalConfigEnvelope>(`/hospitals/${hospitalId}/config`);
}

export async function updateHospitalConfig(
  hospitalId: number,
  config: HospitalOperationalConfig,
): Promise<HospitalConfigEnvelope> {
  return client<HospitalConfigEnvelope>(`/hospitals/${hospitalId}/config`, {
    method: 'PUT',
    body: JSON.stringify(config),
  });
}

export async function listAdmittanceFeedback(
  hospitalId: number,
  limit = 20,
): Promise<HospitalFeedbackSubmission[]> {
  return client<HospitalFeedbackSubmission[]>(`/hospitals/${hospitalId}/feedback?limit=${limit}`);
}

export async function submitAdmittanceFeedback(
  hospitalId: number,
  responses: Array<{ questionId: string; prompt: string; answer: string }>,
  bugReport?: string,
): Promise<HospitalFeedbackSubmission> {
  return client<HospitalFeedbackSubmission>(`/hospitals/${hospitalId}/feedback`, {
    method: 'POST',
    body: JSON.stringify({ responses, bugReport }),
  });
}
