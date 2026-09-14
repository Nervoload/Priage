import { useEffect, useRef, useState } from 'react';
import { isStaticDemoMode } from '../../../../DemoShared/src/staticDemo';

/** Stop typing as soon as the patient edits; cancel timers on navigation. */
export function useScenarioAutofill(text: string, fieldKey = text) {
  const [value, setValue] = useState('');
  const [filling, setFilling] = useState(false);
  const edited = useRef(false);

  useEffect(() => {
    edited.current = false;
    setValue('');
    if (!isStaticDemoMode() || !text) {
      setFilling(false);
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(text);
      setFilling(false);
      return;
    }
    setFilling(true);
    let index = 0;
    const timer = window.setInterval(() => {
      if (edited.current) {
        window.clearInterval(timer);
        setFilling(false);
        return;
      }
      index = Math.min(index + 4, text.length);
      setValue(text.slice(0, index));
      if (index === text.length) {
        setFilling(false);
        window.clearInterval(timer);
      }
    }, 24);
    return () => window.clearInterval(timer);
  }, [text, fieldKey]);

  function edit(next: string) {
    edited.current = true;
    setFilling(false);
    setValue(next);
  }
  return [value, edit, filling] as const;
}
