// test/settings.test.ts
import { describe, it, expect } from 'vitest';
import { getApiKey, setApiKey, getSettings, API_KEY_SECRET } from '../src/settings';

function fakeSecrets(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    get: async (k: string) => store.get(k) ?? undefined,
    store: async (k: string, v: string) => { store.set(k, v); },
    delete: async (k: string) => { store.delete(k); },
  };
}

describe('getApiKey / setApiKey', () => {
  it('returns null when no key is stored', async () => {
    expect(await getApiKey(fakeSecrets() as never)).toBeNull();
  });

  it('returns the stored key', async () => {
    const secrets = fakeSecrets({ [API_KEY_SECRET]: 'sk-ant-123' });
    expect(await getApiKey(secrets as never)).toBe('sk-ant-123');
  });

  it('stores a key', async () => {
    const secrets = fakeSecrets();
    await setApiKey(secrets as never, 'sk-ant-456');
    expect(await getApiKey(secrets as never)).toBe('sk-ant-456');
  });
});

describe('getSettings', () => {
  it('returns defaults when nothing is configured', () => {
    const config = { get: <T>(_k: string, d: T) => d };
    expect(getSettings(config)).toEqual({
      model: 'claude-sonnet-5',
      severityThreshold: 'medium',
      securityEnabled: true,
      behaviorEnabled: true,
      maxDiffTokens: 8000,
    });
  });

  it('reads configured values', () => {
    const values: Record<string, unknown> = {
      'diffguard.model': 'claude-opus-5',
      'diffguard.severityThreshold': 'high',
      'diffguard.securityEnabled': false,
      'diffguard.maxDiffTokens': 4000,
    };
    const config = { get: <T>(k: string, d: T) => (k in values ? (values[k] as T) : d) };
    expect(getSettings(config)).toEqual({
      model: 'claude-opus-5',
      severityThreshold: 'high',
      securityEnabled: false,
      behaviorEnabled: true,
      maxDiffTokens: 4000,
    });
  });
});
