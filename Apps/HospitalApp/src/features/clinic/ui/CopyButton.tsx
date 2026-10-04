import { useEffect, useState } from 'react';
import { Button, IconButton } from './controls';

async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Copies text and says so in place. Falls back to asking for a manual copy. */
export function CopyButton({ text, label = 'Copy', iconOnly = false, size = 'sm', beforeCopy }: { text: string; label?: string; iconOnly?: boolean; size?: 'sm' | 'md'; beforeCopy?: () => Promise<unknown> }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  useEffect(() => {
    if (state === 'idle') return;
    const timer = window.setTimeout(() => setState('idle'), 2200);
    return () => window.clearTimeout(timer);
  }, [state]);

  async function copy() {
    try { await beforeCopy?.(); } catch { setState('failed'); return; }
    setState((await writeClipboard(text)) ? 'copied' : 'failed');
  }

  const shown = state === 'copied' ? 'Copied' : state === 'failed' ? 'Select and copy the text instead' : label;
  if (iconOnly) return <IconButton icon={state === 'copied' ? 'check' : 'copy'} label={shown} onClick={() => void copy()} />;
  return (
    <Button variant="quiet" size={size} icon={state === 'copied' ? 'check' : 'copy'} onClick={() => void copy()} aria-live="polite">
      {shown}
    </Button>
  );
}
