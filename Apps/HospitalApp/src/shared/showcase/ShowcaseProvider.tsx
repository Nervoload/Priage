import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useDemoRuntime } from '../demo-runtime/useDemoRuntime';
import { startDriverTour } from './driverAdapter';
import { getShowcaseTour } from './showcaseRegistry';
import type { ShowcaseNavigationAdapter, ShowcaseStep } from './showcaseTypes';
import {
  isStaticDemoMode,
  runDemoShowcaseAction,
  type DemoShowcaseActionId,
} from '../../../../DemoShared/src/staticDemo';

interface ShowcaseContextValue {
  running: boolean;
  startTour: (tourId?: string) => void;
  stopTour: () => void;
}

const ShowcaseContext = createContext<ShowcaseContextValue | null>(null);

export function ShowcaseProvider({
  children,
  navigation,
}: {
  children: ReactNode;
  navigation: ShowcaseNavigationAdapter;
}) {
  const { profile, recordEvent } = useDemoRuntime();
  const [running, setRunning] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);
  const navigationRef = useRef(navigation);
  const autoStartedRef = useRef(false);

  useEffect(() => {
    navigationRef.current = navigation;
  }, [navigation]);

  const stopTour = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    setRunning(false);
  }, []);

  const beforeStep = useCallback(async (step: ShowcaseStep) => {
    if (step.actionId && isStaticDemoMode()) {
      runDemoShowcaseAction(step.actionId as DemoShowcaseActionId);
    }
    const adapter = navigationRef.current;
    if (step.view && adapter.availableViews.includes(step.view) && adapter.currentView !== step.view) {
      adapter.navigateTo(step.view);
      await delay(280);
      return;
    }
    await delay(90);
  }, []);

  const startTour = useCallback((tourId?: string) => {
    if (!profile || running) return;
    const tour = getShowcaseTour(tourId ?? profile.defaultTourId);
    if (!tour) return;

    setRunning(true);
    void recordEvent('tour_started', { tourId: tour.id });
    void startDriverTour({
      steps: tour.steps,
      beforeStep,
      onStepViewed: (step, index) => {
        void recordEvent('tour_step_viewed', {
          tourId: tour.id,
          stepId: step.id,
          stepIndex: index,
        });
      },
      onCompleted: () => {
        cleanupRef.current = null;
        setRunning(false);
        void recordEvent('tour_completed', { tourId: tour.id });
      },
      onSkipped: () => {
        cleanupRef.current = null;
        setRunning(false);
        void recordEvent('tour_skipped', { tourId: tour.id });
      },
    }).then((cleanup) => {
      cleanupRef.current = cleanup;
    }).catch((error) => {
      console.error('[Showcase] Failed to start tour:', error);
      setRunning(false);
    });
  }, [beforeStep, profile, recordEvent, running]);

  useEffect(() => {
    if (!profile || running || autoStartedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const shouldAutoStart = params.get('tour') === '1' || params.get('showcase') === 'hospital';
    if (!shouldAutoStart) return;
    autoStartedRef.current = true;
    const timer = window.setTimeout(() => startTour(profile.defaultTourId), 650);
    return () => window.clearTimeout(timer);
  }, [profile, running, startTour]);

  useEffect(() => () => {
    cleanupRef.current?.();
  }, []);

  const value = useMemo<ShowcaseContextValue>(
    () => ({ running, startTour, stopTour }),
    [running, startTour, stopTour],
  );

  return (
    <ShowcaseContext.Provider value={value}>
      {children}
    </ShowcaseContext.Provider>
  );
}

export function useShowcase(): ShowcaseContextValue {
  const context = useContext(ShowcaseContext);
  if (!context) {
    throw new Error('useShowcase must be used within ShowcaseProvider');
  }
  return context;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
