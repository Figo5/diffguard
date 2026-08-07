import type { SecretStorage } from 'vscode';
import type { Severity } from './findingsModel';

export const API_KEY_SECRET = 'diffguard.apiKey';

export interface DiffGuardSettings {
  model: string;
  severityThreshold: Severity;
  securityEnabled: boolean;
  behaviorEnabled: boolean;
  maxDiffTokens: number;
}

export async function getApiKey(secrets: SecretStorage): Promise<string | null> {
  const key = await secrets.get(API_KEY_SECRET);
  return key && key.length > 0 ? key : null;
}

export async function setApiKey(secrets: SecretStorage, key: string): Promise<void> {
  await secrets.store(API_KEY_SECRET, key);
}

export function getSettings(config: { get<T>(key: string, defaultValue: T): T }): DiffGuardSettings {
  return {
    model: config.get('diffguard.model', 'claude-sonnet-5'),
    severityThreshold: config.get('diffguard.severityThreshold', 'medium' as Severity),
    securityEnabled: config.get('diffguard.securityEnabled', true),
    behaviorEnabled: config.get('diffguard.behaviorEnabled', true),
    maxDiffTokens: config.get('diffguard.maxDiffTokens', 8000),
  };
}
