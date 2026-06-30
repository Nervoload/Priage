import { client } from './client';
import {
  getDemoHospitalConfig,
  getDemoHospitalSummary,
  isStaticDemoMode,
  listDemoHospitalFeedback,
  submitDemoHospitalFeedback,
  trackDemoEvent,
  updateDemoHospitalConfig,
} from '../../../../DemoShared/src/staticDemo';
import type {
  HospitalSummary,
  HospitalConfigEnvelope,
  HospitalFeedbackSubmission,
  HospitalOperationalConfig,
  UpdateHospitalDetailsPayload,
} from '../types/domain';

export async function getHospital(hospitalId: number): Promise<HospitalSummary> {
  if (isStaticDemoMode()) {
    return getDemoHospitalSummary() as HospitalSummary;
  }
  return client<HospitalSummary>(`/hospitals/${hospitalId}`);
}

export async function updateHospitalDetails(
  hospitalId: number,
  payload: UpdateHospitalDetailsPayload,
): Promise<HospitalSummary> {
  if (isStaticDemoMode()) {
    trackDemoEvent('hospital_details_update_attempted', { hospitalId, slug: payload.slug });
    return getDemoHospitalSummary() as HospitalSummary;
  }
  return client<HospitalSummary>(`/hospitals/${hospitalId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function getHospitalConfig(hospitalId: number): Promise<HospitalConfigEnvelope> {
  if (isStaticDemoMode()) {
    return getDemoHospitalConfig() as HospitalConfigEnvelope;
  }
  return client<HospitalConfigEnvelope>(`/hospitals/${hospitalId}/config`);
}

export async function updateHospitalConfig(
  hospitalId: number,
  config: HospitalOperationalConfig,
): Promise<HospitalConfigEnvelope> {
  if (isStaticDemoMode()) {
    return updateDemoHospitalConfig(config) as Promise<HospitalConfigEnvelope>;
  }
  return client<HospitalConfigEnvelope>(`/hospitals/${hospitalId}/config`, {
    method: 'PUT',
    body: JSON.stringify(config),
  });
}

export async function listAdmittanceFeedback(
  hospitalId: number,
  limit = 20,
): Promise<HospitalFeedbackSubmission[]> {
  if (isStaticDemoMode()) {
    void hospitalId;
    void limit;
    return listDemoHospitalFeedback() as HospitalFeedbackSubmission[];
  }
  return client<HospitalFeedbackSubmission[]>(`/hospitals/${hospitalId}/feedback?limit=${limit}`);
}

export async function submitAdmittanceFeedback(
  hospitalId: number,
  responses: Array<{ questionId: string; prompt: string; answer: string }>,
  bugReport?: string,
): Promise<HospitalFeedbackSubmission> {
  if (isStaticDemoMode()) {
    void hospitalId;
    return submitDemoHospitalFeedback(responses, bugReport) as HospitalFeedbackSubmission;
  }
  return client<HospitalFeedbackSubmission>(`/hospitals/${hospitalId}/feedback`, {
    method: 'POST',
    body: JSON.stringify({ responses, bugReport }),
  });
}
