import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import { useDemo } from '../../shared/demo';
import { updateIntakeDetails } from '../../shared/api/intake';
import { useGuestSession } from '../../shared/hooks/useGuestSession';
import { useToast } from '../../shared/ui/ToastContext';
import { QuestionPage } from './QuestionPage';
import { Routing } from './Routing';

const TOTAL_STEPS = 5;

function buildSummary({
  age,
  allergies,
  conditions,
  details,
}: {
  age: string;
  allergies: string;
  conditions: string;
  details: string;
}) {
  return (
    <div style={{ display: 'grid', gap: '0.3rem' }}>
      <div><strong>Age:</strong> {age || 'Not provided yet'}</div>
      <div><strong>Allergies:</strong> {allergies || 'Not provided yet'}</div>
      <div><strong>Conditions:</strong> {conditions || 'Not provided yet'}</div>
      <div><strong>Additional details:</strong> {details || 'Not provided yet'}</div>
    </div>
  );
}

export function PreTriage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { session } = useGuestSession();
  const { selectedScenario } = useDemo();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [age, setAge] = useState('');
  const [allergies, setAllergies] = useState('');
  const [conditions, setConditions] = useState('');
  const [details, setDetails] = useState('');

  const defaults = selectedScenario.preTriageDefaults;

  function applyDefaults() {
    if (!defaults) {
      showToast('No scenario defaults available for this step.');
      return;
    }
    setAge(defaults.age);
    setAllergies(defaults.allergies);
    setConditions(defaults.conditions);
    setDetails(defaults.details);
  }

  function clearCurrentStep() {
    if (step === 1) setAge('');
    if (step === 2) setAllergies('');
    if (step === 3) setConditions('');
    if (step === 4) setDetails('');
  }

  useEffect(() => {
    if (!defaults) return;
    if (age || allergies || conditions || details) return;
    applyDefaults();
    // Apply defaults only when scenario changes and fields are blank.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedScenario.id]);

  const summary = useMemo(() => buildSummary({ age, allergies, conditions, details }), [age, allergies, conditions, details]);

  if (!session) {
    return <Navigate to="/guest/start" replace />;
  }

  async function submitDetails() {
    setSubmitting(true);
    try {
      await updateIntakeDetails({
        age: age ? parseInt(age, 10) : undefined,
        allergies: allergies.trim() || undefined,
        conditions: conditions.trim() || undefined,
        details: details.trim() || undefined,
      });
      setStep(5);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to save details.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleRouted(encounterId: number) {
    navigate(`/guest/enroute/${encounterId}`);
  }

  if (step === 1) {
    return (
      <QuestionPage
        step={1}
        totalSteps={TOTAL_STEPS}
        question="How old are you?"
        description="This helps prioritize triage and medication safety."
        value={age}
        onChange={setAge}
        onNext={() => setStep(2)}
        placeholder="e.g. 39"
        required
        chips={['25', '34', '41', '72']}
        onChipSelect={setAge}
        summary={summary}
        onUseDefaults={applyDefaults}
        onClear={clearCurrentStep}
      />
    );
  }

  if (step === 2) {
    return (
      <QuestionPage
        step={2}
        totalSteps={TOTAL_STEPS}
        question="Do you have any allergies?"
        description="Include medication, food, or environmental allergies."
        value={allergies}
        onChange={setAllergies}
        onNext={() => setStep(3)}
        onBack={() => setStep(1)}
        placeholder="e.g. penicillin, peanuts, latex, or none"
        chips={['None', 'Penicillin', 'Peanuts', 'Latex']}
        onChipSelect={(value) => setAllergies(value)}
        summary={summary}
        onUseDefaults={applyDefaults}
        onClear={clearCurrentStep}
      />
    );
  }

  if (step === 3) {
    return (
      <QuestionPage
        step={3}
        totalSteps={TOTAL_STEPS}
        question="Any pre-existing conditions?"
        description="This gives triage teams context before you arrive."
        value={conditions}
        onChange={setConditions}
        onNext={() => setStep(4)}
        onBack={() => setStep(2)}
        placeholder="e.g. diabetes, asthma, high blood pressure, or none"
        chips={['None', 'Asthma', 'Diabetes', 'Hypertension']}
        onChipSelect={(value) => setConditions(value)}
        summary={summary}
        onUseDefaults={applyDefaults}
        onClear={clearCurrentStep}
      />
    );
  }

  if (step === 4) {
    return (
      <QuestionPage
        step={4}
        totalSteps={TOTAL_STEPS}
        question="Anything else the ER should know?"
        description="Share timing, severity changes, or medication you already took."
        value={details}
        onChange={setDetails}
        onNext={submitDetails}
        onBack={() => setStep(3)}
        placeholder="e.g. symptoms started 90 minutes ago, took aspirin at home..."
        multiline
        summary={summary}
        onUseDefaults={applyDefaults}
        onClear={clearCurrentStep}
        nextLabel={submitting ? 'Saving…' : 'Continue to hospital selection'}
      />
    );
  }

  return (
    <Routing onConfirmed={handleRouted} />
  );
}
