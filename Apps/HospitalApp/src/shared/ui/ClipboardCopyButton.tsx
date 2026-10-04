import { useEffect, useState } from 'react';

export function ClipboardCopyButton({ text, label, className = '', beforeCopy, iconOnly = false }: { text: string; label: string; className?: string; beforeCopy?: () => Promise<unknown>; iconOnly?: boolean }) {
  const [feedback, setFeedback] = useState('');

  useEffect(() => setFeedback(''), [text]);

  async function copy() {
    try {
      await beforeCopy?.();
      await navigator.clipboard.writeText(text);
      setFeedback('Copied');
    } catch {
      setFeedback('Copy failed. Select and copy the text manually.');
    }
  }

  return <span className="inline-flex items-center">
    <button type="button" aria-label={label} title={feedback || label} className={className || (iconOnly ? 'inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:border-priage-300 hover:bg-priage-50 focus:outline-none focus:ring-2 focus:ring-priage-200' : 'rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-priage-300 hover:bg-priage-50 focus:outline-none focus:ring-2 focus:ring-priage-200')} onClick={() => void copy()}>{iconOnly ? feedback === 'Copied' ? <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><path d="m5 12 4 4L19 6" strokeLinecap="round" strokeLinejoin="round" /></svg> : <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" strokeLinecap="round" strokeLinejoin="round" /></svg> : label}</button>
    {feedback && <span role="status" className={iconOnly ? 'sr-only' : 'ml-2 text-xs text-slate-700'}>{feedback}</span>}
  </span>;
}
