import { Role } from '@prisma/client';

export type ClinicalReadCapability =
  | 'encounter.list.operational'
  | 'encounter.list.clinical'
  | 'encounter.detail.operational'
  | 'encounter.detail.clinical'
  | 'hospital.queue.operational'
  | 'hospital.queue.clinical';

const ROLE_CAPABILITIES: Readonly<Record<Role, ReadonlySet<ClinicalReadCapability>>> = {
  [Role.STAFF]: new Set([
    'encounter.list.operational',
    'encounter.detail.operational',
    'hospital.queue.operational',
  ]),
  [Role.NURSE]: new Set([
    'encounter.list.operational',
    'encounter.list.clinical',
    'encounter.detail.operational',
    'encounter.detail.clinical',
    'hospital.queue.operational',
    'hospital.queue.clinical',
  ]),
  [Role.DOCTOR]: new Set([
    'encounter.list.operational',
    'encounter.list.clinical',
    'encounter.detail.operational',
    'encounter.detail.clinical',
    'hospital.queue.operational',
    'hospital.queue.clinical',
  ]),
  [Role.ADMIN]: new Set([
    'encounter.list.operational',
    'encounter.list.clinical',
    'encounter.detail.operational',
    'encounter.detail.clinical',
    'hospital.queue.operational',
    'hospital.queue.clinical',
  ]),
};

export function hasClinicalCapability(role: Role, capability: ClinicalReadCapability): boolean {
  return ROLE_CAPABILITIES[role].has(capability);
}

export const STAFF_OPERATIONAL_ENCOUNTER_FIELDS = Object.freeze([
  'id',
  'createdAt',
  'updatedAt',
  'status',
  'hospitalId',
  'patientId',
  'expectedAt',
  'arrivedAt',
  'triagedAt',
  'waitingAt',
  'seenAt',
  'departedAt',
  'cancelledAt',
  'patient.id',
  'patient.firstName',
  'patient.lastName',
] as const);

export const CLINICAL_ENCOUNTER_FIELDS = Object.freeze([
  'chiefComplaint',
  'details',
  'currentCtasLevel',
  'currentPriorityScore',
  'patient.phone',
  'patient.age',
  'patient.gender',
  'patient.heightCm',
  'patient.weightKg',
  'patient.allergies',
  'patient.conditions',
  'patient.optionalHealthInfo',
  'priagePreview',
  'priageSummary',
  'triageAssessments',
  'triageAssessments.note',
  'alerts',
  'messages',
  'activityLog',
  'intakeImages',
] as const);

export const ROLE_FIELD_AUTHORIZATION = Object.freeze({
  [Role.STAFF]: {
    operational: STAFF_OPERATIONAL_ENCOUNTER_FIELDS,
    clinical: Object.freeze([]),
  },
  [Role.NURSE]: {
    operational: STAFF_OPERATIONAL_ENCOUNTER_FIELDS,
    clinical: CLINICAL_ENCOUNTER_FIELDS,
  },
  [Role.DOCTOR]: {
    operational: STAFF_OPERATIONAL_ENCOUNTER_FIELDS,
    clinical: CLINICAL_ENCOUNTER_FIELDS,
  },
  [Role.ADMIN]: {
    operational: STAFF_OPERATIONAL_ENCOUNTER_FIELDS,
    clinical: CLINICAL_ENCOUNTER_FIELDS,
  },
} satisfies Readonly<Record<Role, {
  operational: readonly string[];
  clinical: readonly string[];
}>>);
