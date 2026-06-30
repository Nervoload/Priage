import { client } from './client';
import type { AuthUser, HospitalStaffListItem, UpdateStaffProfilePayload } from '../types/domain';
import {
  getDemoStaffAuthUser,
  isStaticDemoMode,
  trackDemoEvent,
} from '../../../../DemoShared/src/staticDemo';

export async function updateMyProfile(payload: UpdateStaffProfilePayload): Promise<AuthUser> {
  if (isStaticDemoMode()) {
    trackDemoEvent('staff_profile_update_attempted', { changedEmail: Boolean(payload.email), changedPassword: Boolean(payload.newPassword) });
    return getDemoStaffAuthUser() as AuthUser;
  }
  return client<AuthUser>('/users/me', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function listUsers(role?: string): Promise<HospitalStaffListItem[]> {
  if (isStaticDemoMode()) {
    const user = getDemoStaffAuthUser();
    if (role && user.role !== role) return [];
    return [{
      id: user.userId,
      email: user.email,
      role: user.role,
      createdAt: new Date().toISOString(),
      hospitalId: user.hospitalId,
    }] as HospitalStaffListItem[];
  }
  const query = role ? `?role=${encodeURIComponent(role)}` : '';
  return client<HospitalStaffListItem[]>(`/users${query}`);
}
