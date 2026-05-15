import { client } from './client';
import type { AuthUser, HospitalStaffListItem, UpdateStaffProfilePayload } from '../types/domain';

export async function updateMyProfile(payload: UpdateStaffProfilePayload): Promise<AuthUser> {
  return client<AuthUser>('/users/me', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function listUsers(role?: string): Promise<HospitalStaffListItem[]> {
  const query = role ? `?role=${encodeURIComponent(role)}` : '';
  return client<HospitalStaffListItem[]>(`/users${query}`);
}
