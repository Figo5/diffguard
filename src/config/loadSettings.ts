// src/config/loadSettings.ts
import type { DiffGuardSettings } from '../types.js';
import type { Severity } from '../findingsModel.js';
import type { ConfigFile } from './configFile.js';
import { configFilePath, readConfigFile } from './configFile.js';

export const SEVERITIES: readonly Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

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
  const raw = value.trim();
  if (!/^\d+$/.test(raw)) throw new Error(`Invalid ${name}: '${value}' (expected a decimal number)`);
  return Number(raw);
}

function requireProvider(value: string | undefined): 'anthropic' | 'openai' {
  if (value === undefined) return 'anthropic';
  if (value === 'anthropic' || value === 'openai') return value;
  throw new Error(`Invalid DIFFGUARD_PROVIDER: '${value}' (expected 'anthropic' or 'openai')`);
}

export function loadSettings(env: NodeJS.ProcessEnv, file: ConfigFile | null): DiffGuardSettings {
  return {
    model: env.DIFFGUARD_MODEL ?? file?.model ?? 'claude-sonnet-5',
    severityThreshold: requireSeverity(env.DIFFGUARD_SEVERITY_THRESHOLD, 'DIFFGUARD_SEVERITY_THRESHOLD'),
    securityEnabled: requireBoolean(env.DIFFGUARD_SECURITY_ENABLED, 'DIFFGUARD_SECURITY_ENABLED'),
    behaviorEnabled: requireBoolean(env.DIFFGUARD_BEHAVIOR_ENABLED, 'DIFFGUARD_BEHAVIOR_ENABLED'),
    maxDiffTokens: requireNumber(env.DIFFGUARD_MAX_DIFF_TOKENS, 'maxDiffTokens', 8000),
    provider: requireProvider(env.DIFFGUARD_PROVIDER ?? file?.provider),
    baseUrl: env.DIFFGUARD_BASE_URL?.trim() || file?.baseUrl?.trim() || undefined,
  };
}

export async function loadSettingsFromEnv(env: NodeJS.ProcessEnv, opts: { filePath?: string } = {}): Promise<DiffGuardSettings> {
  const path = opts.filePath ?? configFilePath(env);
  const file = await readConfigFile(path);
  return loadSettings(env, file);
}
