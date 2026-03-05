// useSeenEncounters — localStorage-backed set of encounter IDs that staff
// have "seen" (opened the detail panel). Persists across page reloads so
// the new-arrivals section stays accurate even after refreshes.

import { useState, useCallback, useEffect, useRef } from 'react';

const STORAGE_KEY = 'priage_seen_encounters';

/** Map of encounterId → ISO timestamp when first seen */
type SeenMap = Record<number, string>;

function load(): SeenMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SeenMap) : {};
  } catch {
    return {};
  }
}

function persist(map: SeenMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch { /* quota exceeded — ignore */ }
}

/**
 * Prune entries older than `maxAge` ms (default 24 h) so localStorage
 * doesn't grow unbounded.
 */
function pruned(map: SeenMap, maxAge = 24 * 60 * 60 * 1000): SeenMap {
  const cutoff = Date.now() - maxAge;
  const next: SeenMap = {};
  for (const [id, ts] of Object.entries(map)) {
    if (new Date(ts).getTime() > cutoff) {
      next[Number(id)] = ts;
    }
  }
  return next;
}

export function useSeenEncounters() {
  const [seen, setSeen] = useState<SeenMap>(() => pruned(load()));
  const seenRef = useRef(seen);
  seenRef.current = seen;

  // Persist whenever the map changes
  useEffect(() => {
    persist(seen);
  }, [seen]);

  /** Mark an encounter as seen (idempotent — keeps earliest timestamp). */
  const markSeen = useCallback((encounterId: number) => {
    setSeen(prev => {
      if (prev[encounterId]) return prev; // already seen
      return { ...prev, [encounterId]: new Date().toISOString() };
    });
  }, []);

  /** Check if an encounter has been seen. */
  const isSeen = useCallback(
    (encounterId: number) => !!seenRef.current[encounterId],
    [],
  );

  /** Get the timestamp when an encounter was first seen, or null. */
  const seenAt = useCallback(
    (encounterId: number) => seenRef.current[encounterId] ?? null,
    [],
  );

  /** Bulk check returning a Set of seen IDs (useful for filtering). */
  const seenIds = new Set(Object.keys(seen).map(Number));

  return { markSeen, isSeen, seenAt, seenIds } as const;
}
