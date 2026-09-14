import { useDemoRuntime } from '../demo-runtime/useDemoRuntime';
import { useShowcase } from './ShowcaseProvider';

export function ShowcaseLauncher() {
  const { profile } = useDemoRuntime();
  const { running, startTour } = useShowcase();

  if (!profile) return null;

  return (
    <button
      type="button"
      onClick={() => startTour(profile.defaultTourId)}
      disabled={running}
      className="
        fixed bottom-5 left-5 z-[70] inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-200
        bg-white/95 px-3.5 py-2.5 text-sm font-bold text-slate-800 shadow-[0_18px_48px_-30px_rgba(15,23,42,0.55)]
        backdrop-blur transition-all hover:-translate-y-0.5 hover:border-priage-300 hover:text-priage-700
        disabled:cursor-not-allowed disabled:opacity-70
      "
      title="Start product tour"
      aria-label="Start product tour"
    >
      <svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M3 13V3.8c0-.7.75-1.14 1.36-.8l8.1 4.6a.92.92 0 0 1 0 1.6l-8.1 4.6A.9.9 0 0 1 3 13Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
      {running ? 'Tour running' : 'Product Tour'}
    </button>
  );
}
