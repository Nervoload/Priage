import { useDemoRuntime } from './useDemoRuntime';

export function DemoWatermark() {
  const { profile } = useDemoRuntime();

  if (!profile) return null;

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[70] rounded-md border border-amber-200 bg-amber-50/92 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-amber-900 shadow-[0_12px_32px_-22px_rgba(15,23,42,0.35)] backdrop-blur">
      {profile.watermark}
    </div>
  );
}
