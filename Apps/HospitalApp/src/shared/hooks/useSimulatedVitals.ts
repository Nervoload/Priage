// HospitalApp/src/shared/hooks/useSimulatedVitals.ts
// Provides subtly fluctuating vital sign values for demo purposes.
// Takes baseline vitals from the triage assessment and produces small oscillations.
// Deterministic per encounter ID so values are consistent across re-renders.

import { useState, useEffect, useRef } from 'react';
import type { VitalSigns } from '../types/domain';

export interface SimulatedVitals {
  heartRate: number | null;
  systolic: number | null;
  diastolic: number | null;
  temperature: number | null;
  oxygenSaturation: number | null;
  respiratoryRate: number | null;
}

/** Simple seeded pseudo-random (Mulberry32). Returns 0..1 */
function seededRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function parseBP(bp: string | undefined): { systolic: number; diastolic: number } | null {
  if (!bp) return null;
  const parts = bp.split('/');
  if (parts.length !== 2) return null;
  const systolic = parseInt(parts[0], 10);
  const diastolic = parseInt(parts[1], 10);
  if (isNaN(systolic) || isNaN(diastolic)) return null;
  return { systolic, diastolic };
}

function oscillate(base: number, range: number, rng: () => number): number {
  return Math.round((base + (rng() * 2 - 1) * range) * 10) / 10;
}

export function useSimulatedVitals(
  encounterId: number,
  baseVitals: VitalSigns | null | undefined,
  enabled = true,
): SimulatedVitals {
  const rngRef = useRef(seededRandom(encounterId * 31337 + Date.now()));
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled || !baseVitals) return;
    // Re-seed each interval for fresh randomness
    const interval = setInterval(() => {
      rngRef.current = seededRandom(encounterId * 31337 + Date.now());
      setTick((t) => t + 1);
    }, 3000 + (encounterId % 5) * 400); // 3–5s stagger per patient

    return () => clearInterval(interval);
  }, [encounterId, enabled, baseVitals]);

  if (!baseVitals || !enabled) {
    return {
      heartRate: baseVitals?.heartRate ?? null,
      systolic: parseBP(baseVitals?.bloodPressure)?.systolic ?? null,
      diastolic: parseBP(baseVitals?.bloodPressure)?.diastolic ?? null,
      temperature: baseVitals?.temperature ?? null,
      oxygenSaturation: baseVitals?.oxygenSaturation ?? null,
      respiratoryRate: baseVitals?.respiratoryRate ?? null,
    };
  }

  const rng = rngRef.current;
  const bp = parseBP(baseVitals.bloodPressure);

  // Use tick to prevent lint warning about unused dependency
  void tick;

  return {
    heartRate: baseVitals.heartRate != null ? Math.round(oscillate(baseVitals.heartRate, 3, rng)) : null,
    systolic: bp ? Math.round(oscillate(bp.systolic, 4, rng)) : null,
    diastolic: bp ? Math.round(oscillate(bp.diastolic, 3, rng)) : null,
    temperature: baseVitals.temperature != null
      ? Math.round(oscillate(baseVitals.temperature, 0.15, rng) * 10) / 10
      : null,
    oxygenSaturation: baseVitals.oxygenSaturation != null
      ? Math.min(100, Math.max(85, Math.round(oscillate(baseVitals.oxygenSaturation, 1, rng))))
      : null,
    respiratoryRate: baseVitals.respiratoryRate != null
      ? Math.round(oscillate(baseVitals.respiratoryRate, 1, rng))
      : null,
  };
}
