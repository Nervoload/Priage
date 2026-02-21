// PatientApp/src/features/pre-triage/PreTriage.tsx
// Pre-triage wizard — collects additional patient details after intake intent.
// Steps: Age → Allergies → Pre-existing conditions → Additional details → Routing
// Then confirms the encounter at a specific hospital.

import { useState } from 'react';
import { QuestionPage } from './QuestionPage';
import { Routing } from './Routing';
import { updateIntakeDetails } from '../../shared/api/encounters';
import { useToast } from '../../shared/ui/ToastContext';
import type { PatientSession, Encounter } from '../../shared/types/domain';

interface PreTriageProps {
  session: PatientSession;
  onComplete: (encounter: Encounter, session: PatientSession) => void;
}

const TOTAL_STEPS = 5; // 4 questions + 1 routing

export function PreTriage({ session, onComplete }: PreTriageProps) {
  const { showToast } = useToast();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Answers
  const [age, setAge] = useState('');
  const [allergies, setAllergies] = useState('');
  const [conditions, setConditions] = useState('');
  const [details, setDetails] = useState('');

  async function submitDetails() {
    setSubmitting(true);
    try {
      await updateIntakeDetails({
        age: age ? parseInt(age, 10) : undefined,
        allergies: allergies.trim() || undefined,
        conditions: conditions.trim() || undefined,
        details: details.trim() || undefined,
      });
      // Move to routing step
      setStep(5);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save details.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleRouted(encounter: Encounter, updatedSession: PatientSession) {
    onComplete(encounter, updatedSession);
  }

  // Step 1: Age
  if (step === 1) {
    return (
      <QuestionPage
        step={1}
        totalSteps={TOTAL_STEPS}
        question="How old are you?"
        value={age}
        onChange={setAge}
        onNext={() => setStep(2)}
        placeholder="e.g. 34"
      />
    );
  }

  // Step 2: Allergies
  if (step === 2) {
    return (
      <QuestionPage
        step={2}
        totalSteps={TOTAL_STEPS}
        question="Do you have any allergies?"
        value={allergies}
        onChange={setAllergies}
        onNext={() => setStep(3)}
        onBack={() => setStep(1)}
        placeholder="e.g. penicillin, peanuts, latex — or 'none'"
      />
    );
  }

  // Step 3: Pre-existing conditions
  if (step === 3) {
    return (
      <QuestionPage
        step={3}
        totalSteps={TOTAL_STEPS}
        question="Any pre-existing conditions?"
        value={conditions}
        onChange={setConditions}
        onNext={() => setStep(4)}
        onBack={() => setStep(2)}
        placeholder="e.g. diabetes, asthma, high blood pressure — or 'none'"
      />
    );
  }

  // Step 4: Additional details
  if (step === 4) {
    return (
      <QuestionPage
        step={4}
        totalSteps={TOTAL_STEPS}
        question="Anything else the ER should know?"
        value={details}
        onChange={setDetails}
        onNext={submitDetails}
        onBack={() => setStep(3)}
        placeholder="e.g. symptoms started 2 hours ago, taking ibuprofen..."
        multiline
        nextLabel={submitting ? 'Saving...' : 'Continue'}
      />
    );
  }

  // Step 5: Hospital routing
  return (
    <Routing
      session={session}
      onConfirmed={handleRouted}
    />
  );
}
