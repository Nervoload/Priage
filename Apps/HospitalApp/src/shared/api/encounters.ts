// hospital-app/src/shared/api/encounters.ts
// John Surette
// Dec 8, 2025
// encounters.ts


import { Encounter, EncounterStatus } from '../types/domain';
import { client } from './client.ts';


export async function listEncountersByStatus(status: EncounterStatus): Promise<Encounter[]> {
  return client.get(`/encounters?status=${status}`);
}

export async function updateEncounterStatus(id: number, status: EncounterStatus) {
  return client.patch(`/encounters/${id}/status`, { status });
}
