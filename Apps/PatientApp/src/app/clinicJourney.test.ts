import { describe, expect, it } from 'vitest';
import { CLINIC_JOURNEY_STEPS, clinicJourneyStep } from './clinicJourney';

describe('clinic journey presentation', () => {
  it('follows the server-owned intake, booking, arrival, Care and completion states', () => {
    expect(clinicJourneyStep('INTAKE', 'in_progress')).toBe(0);
    expect(clinicJourneyStep('INTAKE', 'complete')).toBe(1);
    expect(clinicJourneyStep('REQUESTED', 'complete')).toBe(2);
    expect(clinicJourneyStep('EXPECTED', 'complete')).toBe(3);
    expect(clinicJourneyStep('ADMITTED', 'complete')).toBe(4);
    expect(clinicJourneyStep('CARE', 'complete')).toBe(5);
    expect(clinicJourneyStep('COMPLETE', 'complete')).toBe(CLINIC_JOURNEY_STEPS.length);
  });

  it('does not present a cancelled visit as an upcoming appointment', () => {
    expect(clinicJourneyStep('CANCELLED', 'complete')).toBe(-1);
    expect(clinicJourneyStep('UNRESOLVED', 'complete')).toBe(-1);
  });
});
