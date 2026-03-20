import { useCallback, useEffect, useState } from 'react';
import {
  API_BASE_URL,
  DEMO_ACCESS_REQUIRED_EVENT,
  isDemoAccessRequiredResponse,
} from '../shared/api/client';
import { disconnectSocket } from '../shared/realtime/socket';

interface DemoGateState {
  /** True while the initial probe is in flight */
  checking: boolean;
  /** True when the backend returned 403 "Demo access required" */
  gateActive: boolean;
  /** Last error message from a failed verify attempt */
  error: string | null;
  /** Submit the demo access code */
  verify: (code: string) => Promise<void>;
}

export function useDemoGate(): DemoGateState {
  const [checking, setChecking] = useState(true);
  const [gateActive, setGateActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleDemoAccessRequired = () => {
      disconnectSocket();
      setError(null);
      setGateActive(true);
      setChecking(false);
    };

    window.addEventListener(DEMO_ACCESS_REQUIRED_EVENT, handleDemoAccessRequired);
    return () => window.removeEventListener(DEMO_ACCESS_REQUIRED_EVENT, handleDemoAccessRequired);
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Probe a guarded endpoint with raw fetch (not the app client wrapper)
    // to avoid triggering the auth-expired side-effect on 401.
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/me`, {
          credentials: 'include',
        });

        if (!res.ok) {
          const body = await res.text().catch(() => '');
          if (isDemoAccessRequiredResponse(res.status, body) && !cancelled) {
            disconnectSocket();
            setGateActive(true);
          }
        }
      } catch {
        // Network error — backend probably not reachable, let the app
        // handle that through its normal error paths.
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const verify = useCallback(async (code: string) => {
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/demo-access`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Invalid access code' }));
        setError(body.message ?? 'Invalid access code');
        return;
      }

      setGateActive(false);
    } catch {
      setError('Unable to reach the server. Please try again.');
    }
  }, []);

  return { checking, gateActive, error, verify };
}
