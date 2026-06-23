import { parsePositiveInteger } from '../../common/config/env-value.util';

export type EventDispatchConfig = {
  claimTtlMs: number;
  immediateDispatchGraceMs: number;
  batchSize: number;
  maxAttempts: number;
};

const DEFAULTS: EventDispatchConfig = {
  claimTtlMs: 60_000,
  immediateDispatchGraceMs: 10_000,
  batchSize: 100,
  maxAttempts: 10,
};

export function getEventDispatchConfig(environment: NodeJS.ProcessEnv = process.env): EventDispatchConfig {
  return {
    claimTtlMs: parsePositiveInteger(environment.EVENT_CLAIM_TTL_MS, DEFAULTS.claimTtlMs),
    immediateDispatchGraceMs: parsePositiveInteger(
      environment.EVENT_IMMEDIATE_DISPATCH_GRACE_MS,
      DEFAULTS.immediateDispatchGraceMs,
    ),
    batchSize: parsePositiveInteger(environment.EVENT_DISPATCH_BATCH_SIZE, DEFAULTS.batchSize),
    maxAttempts: parsePositiveInteger(environment.EVENT_DISPATCH_MAX_ATTEMPTS, DEFAULTS.maxAttempts),
  };
}
