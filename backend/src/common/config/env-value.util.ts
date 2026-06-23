/** Shared parser for configuration values whose existing callers use integer semantics. */
export function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function readPositiveIntegerEnv(
  name: string,
  fallback: number,
  environment: NodeJS.ProcessEnv = process.env,
): number {
  return parsePositiveInteger(environment[name], fallback);
}

export function readBooleanEnv(
  name: string,
  fallback: boolean,
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  const value = environment[name]?.trim().toLowerCase();
  if (!value) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value);
}
