// HospitalApp/src/features/triage/useTriageEncounters.ts
// Hook that fetches encounters in TRIAGE status and their triage assessments.
// Also listens for real-time updates via Socket.IO.
//
// TODO: Wire this hook into TriageView.tsx to replace the prop-driven
//       encounter list from HospitalApp. Currently unused (dead code).

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Encounter, TriageAssessment } from '../../shared/types/domain';
import { listEncounters } from '../../shared/api/encounters';
import { listTriageAssessments } from '../../shared/api/triage';
import { getSocket } from '../../shared/realtime/socket';
import { RealtimeEvents } from '../../shared/types/domain';

interface UseTriageEncountersResult {
  /** Encounters currently in TRIAGE status. */
  encounters: Encounter[];
  /** Map from encounterId → ordered list of triage assessments. */
  assessmentsMap: Record<number, TriageAssessment[]>;
  /** True while the initial fetch is in progress. */
  loading: boolean;
  /** Error message, if any. */
  error: string | null;
  /** Re-fetch encounters from the server. */
  refresh: () => void;
}

export function useTriageEncounters(): UseTriageEncountersResult {
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [assessmentsMap, setAssessmentsMap] = useState<Record<number, TriageAssessment[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await listEncounters({ status: ['TRIAGE'] });
      if (!isMounted.current) return;

      setEncounters(res.data);

      // Fetch assessments for each encounter in parallel
      const entries = await Promise.all(
        res.data.map(async (enc) => {
          const assessments = await listTriageAssessments(enc.id);
          return [enc.id, assessments] as const;
        }),
      );

      if (!isMounted.current) return;
      setAssessmentsMap(Object.fromEntries(entries));
    } catch (err) {
      if (!isMounted.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load triage encounters');
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    fetchData();

    // Listen for real-time encounter updates and refresh
    const socket = getSocket();
    const handleUpdate = () => {
      fetchData();
    };

    socket.on(RealtimeEvents.EncounterUpdated, handleUpdate);

    return () => {
      isMounted.current = false;
      socket.off(RealtimeEvents.EncounterUpdated, handleUpdate);
    };
  }, [fetchData]);

  return {
    encounters,
    assessmentsMap,
    loading,
    error,
    refresh: fetchData,
  };
}
