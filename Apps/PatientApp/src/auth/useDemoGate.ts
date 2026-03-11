import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL } from '../shared/api/client';

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
    let cancelled = false;

    // Probe a guarded endpoint with raw fetch (not the app client wrapper)
    // to avoid triggering the patient-session-expired side-effect on 401/403.
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/patient-auth/me`, {
          credentials: 'include',
        });

        if (res.status === 403) {
          const body = await res.text().catch(() => '');
          if (body.includes('Demo access required') && !cancelled) {
            setGateActive(true);
          }
        }
      } catch {
        // Network error — backend probably not reachable.
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
