import type { DiffGuardSettings } from '../src/types.js';
import type { Severity } from '../src/findingsModel.js';

// CLI-owned severity list (findingsModel's internal SEVERITIES is not exported —
// validation is the engine's concern; display/parsing is the CLI's).
export const SEVERITIES: readonly Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

export interface CliOptions {
  staged: boolean;
  json: boolean;
}

function requireSeverity(value: string | undefined, name: string): Severity {
  if (value === undefined) return 'medium';
  if ((SEVERITIES as readonly string[]).includes(value)) return value as Severity;
  throw new Error(`Invalid ${name}: '${value}' (expected one of ${SEVERITIES.join(', ')})`);
}

function requireBoolean(value: string | undefined, name: string): boolean {
  if (value === undefined) return true;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`Invalid ${name}: '${value}' (expected 'true' or 'false')`);
}

function requireNumber(value: string | undefined, name: string, fallback: number): number {
  if (value === undefined) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`Invalid maxDiffTokens: '${value}' (expected a number)`);
  return n;
}

export function loadConfig(env: NodeJS.ProcessEnv): DiffGuardSettings {
  return {
    model: env.DIFFGUARD_MODEL ?? 'claude-sonnet-5',
    severityThreshold: requireSeverity(env.DIFFGUARD_SEVERITY_THRESHOLD, 'DIFFGUARD_SEVERITY_THRESHOLD'),
    securityEnabled: requireBoolean(env.DIFFGUARD_SECURITY_ENABLED, 'DIFFGUARD_SECURITY_ENABLED'),
    behaviorEnabled: requireBoolean(env.DIFFGUARD_BEHAVIOR_ENABLED, 'DIFFGUARD_BEHAVIOR_ENABLED'),
    maxDiffTokens: requireNumber(env.DIFFGUARD_MAX_DIFF_TOKENS, 'DIFFGUARD_MAX_DIFF_TOKENS', 8000),
  };
}

export function getApiKey(env: NodeJS.ProcessEnv): string | null {
  const key = env.ANTHROPIC_API_KEY?.trim();
  return key && key.length > 0 ? key : null;
}
