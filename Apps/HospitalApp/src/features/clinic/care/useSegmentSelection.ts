import { useCallback, useEffect, useState } from 'react';
import type { CareSegment } from '../../../shared/api/care';
import { validateSelection } from './careModel';

export interface SegmentSelection {
  segmentId: string | null;
  start: number;
  end: number;
  quote: string;
  /** Where to place the toolbar, in viewport coordinates. */
  top: number;
  left: number;
  /** False when the selection runs across passages or doesn't match the stored text. */
  valid: boolean;
}

function segmentElement(node: Node | null): HTMLElement | null {
  const element = node instanceof HTMLElement ? node : node?.parentElement ?? null;
  return element?.closest<HTMLElement>('[data-segment-id]') ?? null;
}

/**
 * Tracks a text selection inside the reading area and resolves it to one
 * stored passage with exact offsets, so a comment anchors to the same words
 * the server holds. Offsets count characters from the start of the passage,
 * which works across highlight <mark> elements inside it.
 */
export function useSegmentSelection(container: HTMLElement | null, segments: ReadonlyMap<string, CareSegment>) {
  const [selection, setSelection] = useState<SegmentSelection | null>(null);

  const clear = useCallback(() => {
    window.getSelection()?.removeAllRanges();
    setSelection(null);
  }, []);

  useEffect(() => {
    if (!container) return;

    const read = () => {
      const browserSelection = window.getSelection();
      if (!browserSelection || browserSelection.isCollapsed || !browserSelection.rangeCount) { setSelection(null); return; }
      const range = browserSelection.getRangeAt(0);
      if (!container.contains(range.commonAncestorContainer)) { setSelection(null); return; }
      const startElement = segmentElement(range.startContainer);
      const endElement = segmentElement(range.endContainer);
      const rect = range.getBoundingClientRect();
      const position = { top: rect.top, left: rect.left + rect.width / 2 };
      const quote = range.toString();
      if (!startElement && !endElement) { setSelection(null); return; }
      if (!startElement || startElement !== endElement || !quote.trim()) {
        setSelection({ segmentId: null, start: 0, end: 0, quote, ...position, valid: false });
        return;
      }
      const segmentId = startElement.dataset.segmentId ?? '';
      const prefix = range.cloneRange();
      prefix.selectNodeContents(startElement);
      prefix.setEnd(range.startContainer, range.startOffset);
      const start = prefix.toString().length;
      const segment = segments.get(segmentId);
      const valid = !!segment && validateSelection(segment.text, start, quote);
      setSelection({ segmentId, start, end: start + quote.length, quote, ...position, valid });
    };

    const onPointerUp = () => window.setTimeout(read, 0);
    const onKeyUp = (event: KeyboardEvent) => { if (event.shiftKey || event.key.startsWith('Arrow')) read(); };
    const onSelectionChange = () => { if (window.getSelection()?.isCollapsed) setSelection(null); };
    const onScroll = () => setSelection(null);

    container.addEventListener('mouseup', onPointerUp);
    container.addEventListener('keyup', onKeyUp);
    // Capture, so scrolling any pane inside the container moves the toolbar out of the way.
    container.addEventListener('scroll', onScroll, { capture: true, passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('selectionchange', onSelectionChange);
    return () => {
      container.removeEventListener('mouseup', onPointerUp);
      container.removeEventListener('keyup', onKeyUp);
      container.removeEventListener('scroll', onScroll, { capture: true });
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('selectionchange', onSelectionChange);
    };
  }, [container, segments]);

  return { selection, clear };
}
