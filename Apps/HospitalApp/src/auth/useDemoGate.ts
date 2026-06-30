import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL, DEMO_ACCESS_REQUIRED_EVENT } from '../shared/api/client';
import { enterHospitalDemo } from '../shared/demo-runtime/demoRuntimeApi';
import { disconnectSocket } from '../shared/realtime/socket';
import { markHospitalSessionHint } from './AuthContext';
import { isStaticDemoMode, trackDemoEvent } from '../../../DemoShared/src/staticDemo';

interface DemoGateState {
  /** True while the initial probe is in flight */
  checking: boolean;
  /** True when the backend returned 403 "Demo access required" */
  gateActive: boolean;
  /** Last error message from a failed verify attempt */
  error: string | null;
  /** Submit the demo access code */
  verify: (email: string, code: string) => Promise<void>;
}

export function useDemoGate(): DemoGateState {
  const [checking, setChecking] = useState(true);
  const [gateActive, setGateActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (isStaticDemoMode()) {
        trackDemoEvent('static_demo_hospital_gate_bypassed');
        if (!cancelled) setChecking(false);
        return;
      }
      try {
        const res = await fetch(`${API_BASE_URL}/demo-sessions/me`, {
          credentials: 'include',
        });

        if (res.status === 403 && !cancelled) {
          setGateActive(true);
        }
      } catch {
        // Backend may not be running yet.
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const handleDemoAccessRequired = () => {
      disconnectSocket();
      setError(null);
      setGateActive(true);
    };

    window.addEventListener(DEMO_ACCESS_REQUIRED_EVENT, handleDemoAccessRequired);
    return () => window.removeEventListener(DEMO_ACCESS_REQUIRED_EVENT, handleDemoAccessRequired);
  }, []);

  const verify = useCallback(async (email: string, code: string) => {
    setError(null);
    try {
      if (isStaticDemoMode()) {
        trackDemoEvent('static_demo_hospital_code_entered', { hasEmail: Boolean(email), hasCode: Boolean(code) });
        markHospitalSessionHint();
        setGateActive(false);
        return;
      }
      if (!email) {
        const legacyRes = await fetch(`${API_BASE_URL}/demo-access`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });

        if (!legacyRes.ok) {
          const body = await legacyRes.json().catch(() => ({ message: 'Invalid access code' }));
          setError(body.message ?? 'Invalid access code');
          return;
        }

        setGateActive(false);
        return;
      }

      const res = await fetch(`${API_BASE_URL}/demo-sessions/verify`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Invalid access code' }));
        setError(body.message ?? 'Invalid access code');
        return;
      }

      await enterHospitalDemo();
      markHospitalSessionHint();
      setGateActive(false);
    } catch {
      setError('Unable to reach the server. Please try again.');
    }
  }, []);

  return { checking, gateActive, error, verify };
}
