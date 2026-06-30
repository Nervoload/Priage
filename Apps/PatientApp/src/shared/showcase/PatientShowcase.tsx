import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { sendPatientMessage } from '../api/encounters';
import { advanceInterview, confirmIntent, createIntent, startInterview } from '../api/intake';
import { isStaticDemoMode, resetDemoState, trackDemoEvent } from '../../../../DemoShared/src/staticDemo';
import { useGuestSession } from '../hooks/useGuestSession';

type PatientShowcaseStep = {
  id: string;
  target: string;
  title: string;
  body: string;
  nextLabel: string;
};

const DEMO_PATIENT = {
  firstName: 'Taylor',
  lastName: 'Demo',
  phone: '555-0199',
  age: 34,
  gender: 'Female',
  chiefComplaint: 'Chest tightness after climbing stairs',
  details: 'Started this morning and feels worse with exertion. Demo-only patient journey.',
};

const STEPS: PatientShowcaseStep[] = [
  {
    id: 'quick-check-in',
    target: 'patient.welcome.quick',
    title: 'Start without an account',
    body: 'Patients can begin a credible emergency intake as a guest, before they reach the hospital desk.',
    nextLabel: 'Create demo intake',
  },
  {
    id: 'dynamic-intake',
    target: 'patient.intake.interview',
    title: 'Focused intake questions',
    body: 'Priage captures just enough structured context to prepare the care team without burying the patient in forms.',
    nextLabel: 'Complete intake',
  },
  {
    id: 'hospital-routing',
    target: 'patient.routing.hospital',
    title: 'Select the destination hospital',
    body: 'The patient can choose the correct hospital and send intake context ahead of arrival.',
    nextLabel: 'Notify hospital',
  },
  {
    id: 'encounter-status',
    target: 'patient.encounter.summary',
    title: 'Live visit workspace',
    body: 'After confirmation, the patient sees status, instructions, care-team messaging, and their handoff summary.',
    nextLabel: 'Send symptom update',
  },
  {
    id: 'patient-messaging',
    target: 'patient.encounter.messages',
    title: 'Waiting room communication',
    body: 'Patients can report worsening symptoms while they wait, giving staff a signal before the next room is ready.',
    nextLabel: 'Finish tour',
  },
];

export function PatientShowcase() {
  const navigate = useNavigate();
  const { session, setSession } = useGuestSession();
  const [running, setRunning] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const autoStartedRef = useRef(false);

  const step = STEPS[stepIndex];

  useEffect(() => {
    if (!isStaticDemoMode() || autoStartedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const shouldStart = params.get('tour') === '1' || params.get('showcase') === 'patient';
    if (!shouldStart) return;
    autoStartedRef.current = true;
    startTour();
  }, []);

  useEffect(() => {
    if (!running || !step) return;
    trackDemoEvent('tour_step_viewed', {
      tourId: 'patient-guest-demo',
      stepId: step.id,
      stepIndex,
    });
  }, [running, step, stepIndex]);

  useEffect(() => {
    if (!running || !step) return;
    const target = document.querySelector<HTMLElement>(`[data-showcase="${step.target}"]`);
    target?.classList.add('patient-showcase-target');
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return () => {
      target?.classList.remove('patient-showcase-target');
    };
  }, [running, step]);

  const startTour = useCallback(() => {
    resetDemoState();
    setSession(null);
    setStepIndex(0);
    setRunning(true);
    navigate('/welcome');
    trackDemoEvent('tour_started', { tourId: 'patient-guest-demo' });
  }, [navigate, setSession]);

  const stopTour = useCallback((completed: boolean) => {
    setRunning(false);
    trackDemoEvent(completed ? 'tour_completed' : 'tour_skipped', { tourId: 'patient-guest-demo' });
  }, []);

  const handleNext = useCallback(async () => {
    if (!step || busy) return;
    setBusy(true);
    try {
      if (step.id === 'quick-check-in') {
        const result = await createIntent(DEMO_PATIENT);
        setSession({
          patientId: result.patientId,
          encounterId: result.encounterId,
          hospitalSlug: null,
          ...DEMO_PATIENT,
        });
        navigate('/guest/chatbot');
      } else if (step.id === 'dynamic-intake') {
        await startInterview();
        await advanceInterview({ questionPublicId: 'demo-onset', valueChoice: 'Today' });
        await advanceInterview({ questionPublicId: 'demo-worse', valueBoolean: true });
        await advanceInterview({ questionPublicId: 'demo-context', valueText: 'No known allergies. Demo-only patient scenario.' });
        navigate('/guest/routing');
      } else if (step.id === 'hospital-routing') {
        const encounter = await confirmIntent({ hospitalSlug: 'demo-hospital' });
        setSession({
          patientId: session?.patientId ?? encounter.id,
          encounterId: encounter.id,
          hospitalSlug: 'demo-hospital',
          ...DEMO_PATIENT,
        });
        navigate(`/encounters/${encounter.id}/current`);
      } else if (step.id === 'encounter-status') {
        const encounterId = session?.encounterId;
        if (encounterId) {
          await sendPatientMessage(
            encounterId,
            'My chest tightness is getting worse while I wait.',
            true,
            `patient-showcase-${Date.now()}`,
          );
        }
      } else if (step.id === 'patient-messaging') {
        stopTour(true);
        return;
      }

      setStepIndex((current) => Math.min(current + 1, STEPS.length - 1));
    } finally {
      setBusy(false);
    }
  }, [busy, navigate, session?.encounterId, session?.patientId, setSession, step, stopTour]);

  const launcher = useMemo(() => {
    if (!isStaticDemoMode() || running) return null;
    return (
      <button className="patient-showcase-launcher" type="button" onClick={startTour}>
        Patient Tour
      </button>
    );
  }, [running, startTour]);

  if (!isStaticDemoMode()) return null;

  return (
    <>
      {launcher}
      {running && step && (
        <div className="patient-showcase-layer" role="dialog" aria-modal="true" aria-label="Patient product tour">
          <div className="patient-showcase-scrim" />
          <section className="patient-showcase-card">
            <p>{stepIndex + 1} of {STEPS.length}</p>
            <h2>{step.title}</h2>
            <span>{step.body}</span>
            <div>
              <button type="button" className="secondary" onClick={() => stopTour(false)}>
                Skip
              </button>
              <button type="button" onClick={() => void handleNext()} disabled={busy}>
                {busy ? 'Working...' : step.nextLabel}
              </button>
            </div>
          </section>
        </div>
      )}
      <style>{showcaseCss}</style>
    </>
  );
}

const showcaseCss = `
.patient-showcase-launcher {
  position: fixed;
  left: 18px;
  bottom: 18px;
  z-index: 9990;
  border: 1px solid rgba(22, 76, 137, 0.2);
  border-radius: 999px;
  background: #1b3f9f;
  color: #fff;
  padding: 12px 16px;
  box-shadow: 0 18px 40px rgba(27, 63, 159, 0.24);
  font-weight: 800;
  cursor: pointer;
}
.patient-showcase-layer {
  position: fixed;
  inset: 0;
  z-index: 9998;
  pointer-events: none;
}
.patient-showcase-scrim {
  position: absolute;
  inset: 0;
  background: rgba(12, 24, 38, 0.45);
}
.patient-showcase-card {
  position: fixed;
  right: 22px;
  bottom: 22px;
  z-index: 10002;
  width: min(420px, calc(100vw - 32px));
  display: grid;
  gap: 10px;
  border: 1px solid rgba(27, 63, 159, 0.18);
  border-radius: 8px;
  background: rgba(255, 253, 248, 0.98);
  box-shadow: 0 24px 70px rgba(12, 24, 38, 0.28);
  padding: 18px;
  pointer-events: auto;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
}
.patient-showcase-card p {
  margin: 0;
  color: #1b3f9f;
  font-size: 12px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.patient-showcase-card h2 {
  margin: 0;
  color: #14233a;
  font-size: 22px;
}
.patient-showcase-card span {
  color: #536172;
  line-height: 1.5;
}
.patient-showcase-card div {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.patient-showcase-card button {
  border: 1px solid rgba(27, 63, 159, 0.18);
  border-radius: 7px;
  background: #1b3f9f;
  color: #fff;
  padding: 10px 13px;
  font-weight: 850;
  cursor: pointer;
}
.patient-showcase-card button.secondary {
  background: #fff;
  color: #1b3f9f;
}
.patient-showcase-target {
  position: relative !important;
  z-index: 10001 !important;
  outline: 3px solid #60a5fa !important;
  outline-offset: 5px !important;
  box-shadow: 0 0 0 8px rgba(96, 165, 250, 0.22), 0 18px 55px rgba(12, 24, 38, 0.18) !important;
}
`;
