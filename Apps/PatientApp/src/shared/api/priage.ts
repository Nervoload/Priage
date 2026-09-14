// Priage AI API calls.

import { client } from './client';
import type { Hospital } from '../types/domain';

/** GET /patient/priage/hospitals — list available hospitals */
export async function listHospitals(): Promise<Hospital[]> {
  return client<Hospital[]>('/patient/priage/hospitals');
}
