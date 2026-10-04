export const CLINIC_JOURNEY_STEPS = ['Assessment', 'Request a time', 'Clinic confirmation', 'Arrive at clinic', 'Physician Care', 'Visit complete'] as const;

// Returns the first unfinished step. A value equal to the number of steps means
// the visit is complete; -1 means it ended outside the normal booking path.
export function clinicJourneyStep(status: string, interviewStatus?: string): number {
  switch (status) {
    case 'INTAKE': return interviewStatus === 'complete' ? 1 : 0;
    case 'REQUESTED': return 2;
    case 'EXPECTED': return 3;
    case 'ADMITTED': return 4;
    case 'CARE': return 5;
    case 'COMPLETE': return CLINIC_JOURNEY_STEPS.length;
    default: return -1;
  }
}
