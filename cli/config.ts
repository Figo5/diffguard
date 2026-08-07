// cli/config.ts
import { getKeyFromKeychain } from '../agent/keychain.js';
import { loadSettings } from '../src/config/loadSettings.js';
import type { ConfigFile } from '../src/config/configFile.js';
import type { DiffGuardSettings } from '../src/types.js';

export { SEVERITIES } from '../src/config/loadSettings.js';

export interface CliOptions {
  staged: boolean;
  json: boolean;
}

export function loadConfig(env: NodeJS.ProcessEnv, file: ConfigFile | null = null): DiffGuardSettings {
  return loadSettings(env, file);
}

export async function resolveCliKey(
  env: NodeJS.ProcessEnv,
  keychain: () => Promise<string | null> = getKeyFromKeychain
): Promise<string | null> {
  const envKey = env.ANTHROPIC_API_KEY?.trim();
  if (envKey && envKey.length > 0) return envKey;
  return keychain();
}

export async function resolveKeySource(
  env: NodeJS.ProcessEnv,
  keychain: () => Promise<string | null>
): Promise<'env' | 'keychain' | 'none'> {
  const envKey = env.ANTHROPIC_API_KEY?.trim();
  if (envKey && envKey.length > 0) return 'env';
  return (await keychain()) ? 'keychain' : 'none';
}
