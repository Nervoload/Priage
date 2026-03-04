import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import { QuestionPage } from './QuestionPage';
import { Routing } from './Routing';
import { updateIntakeDetails } from '../../shared/api/intake';
import { useGuestSession } from '../../shared/hooks/useGuestSession';
import { useToast } from '../../shared/ui/ToastContext';

const TOTAL_STEPS = 5; // 4 questions + 1 routing

export function PreTriage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { session } = useGuestSession();
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

  if (!session) {
    return <Navigate to="/guest/start" replace />;
  }

  function handleRouted(encounterId: number) {
    navigate(`/guest/enroute/${encounterId}`);
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
      onConfirmed={handleRouted}
    />
  );
}
