import { useEffect, useMemo, useState } from 'react';

import { listHospitals } from '../api/priage';
import type { Hospital } from '../types/domain';

export function useHospitalDirectory() {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const nextHospitals = await listHospitals();
        if (cancelled) {
          return;
        }

        setHospitals(nextHospitals);
        setError(null);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError : new Error('Could not load hospitals.'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const hospitalsBySlug = useMemo(() => {
    const next = new Map<string, Hospital>();
    hospitals.forEach((hospital) => {
      next.set(hospital.slug, hospital);
    });
    return next;
  }, [hospitals]);

  const hospitalsById = useMemo(() => {
    const next = new Map<number, Hospital>();
    hospitals.forEach((hospital) => {
      next.set(hospital.id, hospital);
    });
    return next;
  }, [hospitals]);

  return {
    hospitals,
    loading,
    error,
    findHospitalBySlug: (slug: string | null | undefined) => (slug ? hospitalsBySlug.get(slug) ?? null : null),
    findHospitalById: (id: number | null | undefined) => (id ? hospitalsById.get(id) ?? null : null),
  };
}
