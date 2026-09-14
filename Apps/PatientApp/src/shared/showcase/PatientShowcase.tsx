import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { isStaticDemoMode, resetDemoState } from '../../../../DemoShared/src/staticDemo';
import { useAuth } from '../hooks/useAuth';
import { useGuestSession } from '../hooks/useGuestSession';

// Existing launch links begin a fresh patient journey, with no overlay or skipped steps.
export function PatientShowcase() {
  const navigate = useNavigate();
  const { setSession } = useGuestSession();
  const { clearSession } = useAuth();
  const launchParams = useRef(new URLSearchParams(window.location.search));
  const started = useRef(false);
  useEffect(() => {
    if (!isStaticDemoMode() || started.current) return;
    const params = launchParams.current;
    if (params.get('showcase') !== 'patient' && params.get('tour') !== '1') return;
    started.current = true;
    resetDemoState();
    clearSession();
    setSession(null);
    navigate('/guest/start', { replace: true });
  }, [clearSession, navigate, setSession]);
  return null;
}
