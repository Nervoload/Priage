import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ApiError } from '../api/client';
import {
  getDemoRuntime,
  recordDemoEvent,
  type DemoRuntimeProfile,
  type DemoRuntimeResponse,
} from './demoRuntimeApi';

interface DemoRuntimeContextValue {
  loading: boolean;
  profile: DemoRuntimeProfile | null;
  isDemo: boolean;
  refresh: () => Promise<void>;
  recordEvent: (type: string, metadata?: Record<string, unknown>) => Promise<void>;
}

const DemoRuntimeContext = createContext<DemoRuntimeContextValue | null>(null);

function normalizeProfile(response: DemoRuntimeResponse): DemoRuntimeProfile | null {
  return response.isDemo ? response : null;
}

export function DemoRuntimeProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<DemoRuntimeProfile | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getDemoRuntime();
      setProfile(normalizeProfile(response));
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 403)) {
        console.error('[DemoRuntime] Failed to load demo runtime:', error);
      }
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const recordEvent = useCallback(async (type: string, metadata?: Record<string, unknown>) => {
    if (!profile) return;
    try {
      await recordDemoEvent(type, metadata);
    } catch (error) {
      console.warn('[DemoRuntime] Failed to record demo event:', error);
    }
  }, [profile]);

  const value = useMemo<DemoRuntimeContextValue>(
    () => ({
      loading,
      profile,
      isDemo: Boolean(profile),
      refresh,
      recordEvent,
    }),
    [loading, profile, refresh, recordEvent],
  );

  return (
    <DemoRuntimeContext.Provider value={value}>
      {children}
    </DemoRuntimeContext.Provider>
  );
}

export function useDemoRuntime(): DemoRuntimeContextValue {
  const context = useContext(DemoRuntimeContext);
  if (!context) {
    throw new Error('useDemoRuntime must be used within DemoRuntimeProvider');
  }
  return context;
}
