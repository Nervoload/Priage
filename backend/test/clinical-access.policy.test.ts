import { Role } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  CLINICAL_ENCOUNTER_FIELDS,
  ROLE_FIELD_AUTHORIZATION,
  hasClinicalCapability,
} from '../src/modules/clinical-access/clinical-access.policy';

describe('clinical access policy', () => {
  it.each([Role.NURSE, Role.DOCTOR, Role.ADMIN, Role.CLINICAL_ADMIN])('%s can read clinical encounter detail', (role) => {
    expect(hasClinicalCapability(role, 'encounter.detail.clinical')).toBe(true);
    expect(ROLE_FIELD_AUTHORIZATION[role].clinical).toEqual(CLINICAL_ENCOUNTER_FIELDS);
  });

  it('gives IT administrators no patient or clinical fields', () => {
    expect(hasClinicalCapability(Role.IT_ADMIN, 'encounter.list.operational')).toBe(false);
    expect(hasClinicalCapability(Role.IT_ADMIN, 'encounter.detail.clinical')).toBe(false);
    expect(ROLE_FIELD_AUTHORIZATION[Role.IT_ADMIN]).toEqual({ operational: [], clinical: [] });
  });

  it('keeps general staff to operational fields', () => {
    expect(hasClinicalCapability(Role.STAFF, 'encounter.detail.clinical')).toBe(false);
    expect(ROLE_FIELD_AUTHORIZATION[Role.STAFF].clinical).toEqual([]);
  });
});
