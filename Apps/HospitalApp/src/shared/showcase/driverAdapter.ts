import { driver, type DriveStep, type Driver, type Side, type Alignment } from 'driver.js';
import 'driver.js/dist/driver.css';
import './showcase.css';
import type { ShowcaseStep } from './showcaseTypes';

interface DriverTourInput {
  steps: ShowcaseStep[];
  beforeStep: (step: ShowcaseStep) => Promise<void>;
  onStepViewed: (step: ShowcaseStep, index: number) => void;
  onCompleted: () => void;
  onSkipped: () => void;
}

const TARGET_WAIT_MS = 2200;

export async function startDriverTour(input: DriverTourInput): Promise<() => void> {
  let moving = false;
  let finished = false;

  async function prepareStep(index: number): Promise<void> {
    const step = input.steps[index];
    if (!step) return;
    await input.beforeStep(step);
    await waitForShowcaseTarget(step.target);
  }

  async function moveTo(driverObj: Driver, nextIndex: number): Promise<void> {
    if (moving) return;
    moving = true;
    try {
      if (nextIndex >= input.steps.length) {
        finished = true;
        input.onCompleted();
        driverObj.destroy();
        return;
      }

      if (nextIndex < 0) {
        driverObj.movePrevious();
        return;
      }

      await prepareStep(nextIndex);
      driverObj.moveTo(nextIndex);
    } finally {
      moving = false;
    }
  }

  const driveSteps: DriveStep[] = input.steps.map((step, index) => ({
    element: () => document.querySelector(`[data-showcase="${step.target}"]`) ?? document.body,
    popover: {
      title: step.title,
      description: step.description,
      side: step.side as Side | undefined,
      align: step.align as Alignment | undefined,
      onNextClick: (_element, _step, opts) => {
        void moveTo(opts.driver, index + 1);
      },
      onPrevClick: (_element, _step, opts) => {
        void moveTo(opts.driver, index - 1);
      },
      onCloseClick: (_element, _step, opts) => {
        finished = true;
        input.onSkipped();
        opts.driver.destroy();
      },
    },
    onHighlighted: () => {
      input.onStepViewed(step, index);
    },
  }));

  const driverObj = driver({
    steps: driveSteps,
    animate: true,
    smoothScroll: true,
    allowClose: true,
    overlayOpacity: 0.64,
    stagePadding: 8,
    stageRadius: 10,
    popoverClass: 'priage-showcase-popover',
    showProgress: true,
    showButtons: ['next', 'previous', 'close'],
    nextBtnText: 'Next',
    prevBtnText: 'Back',
    doneBtnText: 'Finish',
    onDestroyed: () => {
      if (!finished) {
        finished = true;
        input.onSkipped();
      }
    },
  });

  await prepareStep(0);
  driverObj.drive(0);

  return () => {
    if (driverObj.isActive()) {
      driverObj.destroy();
    }
  };
}

function waitForShowcaseTarget(target: string): Promise<void> {
  const selector = `[data-showcase="${target}"]`;
  const startedAt = performance.now();

  return new Promise((resolve) => {
    const tick = () => {
      if (document.querySelector(selector) || performance.now() - startedAt >= TARGET_WAIT_MS) {
        resolve();
        return;
      }
      window.requestAnimationFrame(tick);
    };
    tick();
  });
}
