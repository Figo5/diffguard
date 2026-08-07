import { describe, it, expect } from 'vitest';
import { loadConfig, resolveCliKey, SEVERITIES } from '../cli/config.js';
import type { Severity } from '../src/findingsModel.js';

describe('loadConfig', () => {
  it('applies defaults for a bare env', () => {
    const c = loadConfig({} as NodeJS.ProcessEnv);
    expect(c).toEqual({ model: 'claude-sonnet-5', severityThreshold: 'medium', securityEnabled: true, behaviorEnabled: true, maxDiffTokens: 8000, provider: 'anthropic', baseUrl: undefined });
  });
  it('reads DIFFGUARD_MODEL', () => {
    expect(loadConfig({ DIFFGUARD_MODEL: 'claude-opus-5' } as NodeJS.ProcessEnv).model).toBe('claude-opus-5');
  });
  it('reads booleans as true/false strings', () => {
    const c = loadConfig({ DIFFGUARD_SECURITY_ENABLED: 'false', DIFFGUARD_BEHAVIOR_ENABLED: 'true' } as NodeJS.ProcessEnv);
    expect(c.securityEnabled).toBe(false);
    expect(c.behaviorEnabled).toBe(true);
  });
  it('reads maxDiffTokens as a number', () => {
    expect(loadConfig({ DIFFGUARD_MAX_DIFF_TOKENS: '12000' } as NodeJS.ProcessEnv).maxDiffTokens).toBe(12000);
  });
  it('accepts every severity in SEVERITIES', () => {
    for (const s of SEVERITIES) {
      expect(loadConfig({ DIFFGUARD_SEVERITY_THRESHOLD: s } as NodeJS.ProcessEnv).severityThreshold).toBe(s);
    }
  });
  it('throws on an invalid severity', () => {
    expect(() => loadConfig({ DIFFGUARD_SEVERITY_THRESHOLD: 'catastrophic' } as NodeJS.ProcessEnv)).toThrow(/severity/i);
  });
  it('throws on an invalid boolean', () => {
    expect(() => loadConfig({ DIFFGUARD_SECURITY_ENABLED: 'maybe' } as NodeJS.ProcessEnv)).toThrow(/security/i);
  });
  it('throws on a non-numeric maxDiffTokens', () => {
    expect(() => loadConfig({ DIFFGUARD_MAX_DIFF_TOKENS: 'lots' } as NodeJS.ProcessEnv)).toThrow(/maxDiffTokens/i);
  });
  it('throws on an empty maxDiffTokens', () => {
    expect(() => loadConfig({ DIFFGUARD_MAX_DIFF_TOKENS: '' } as NodeJS.ProcessEnv)).toThrow(/maxDiffTokens/i);
  });
  it('throws on a hex-formatted maxDiffTokens', () => {
    expect(() => loadConfig({ DIFFGUARD_MAX_DIFF_TOKENS: '0x1F' } as NodeJS.ProcessEnv)).toThrow(/maxDiffTokens/i);
  });
});

describe('loadConfig provider', () => {
  it('defaults the provider to anthropic', () => {
    expect(loadConfig({} as NodeJS.ProcessEnv).provider).toBe('anthropic');
  });
  it('reads DIFFGUARD_PROVIDER=openai', () => {
    expect(loadConfig({ DIFFGUARD_PROVIDER: 'openai' } as NodeJS.ProcessEnv).provider).toBe('openai');
  });
  it('throws on an invalid provider', () => {
    expect(() => loadConfig({ DIFFGUARD_PROVIDER: 'gemini' } as NodeJS.ProcessEnv)).toThrow(/provider/i);
  });
  it('reads DIFFGUARD_BASE_URL', () => {
    expect(loadConfig({ DIFFGUARD_BASE_URL: 'http://localhost:11434/v1' } as NodeJS.ProcessEnv).baseUrl).toBe('http://localhost:11434/v1');
  });
  it('leaves baseUrl unset by default', () => {
    expect(loadConfig({} as NodeJS.ProcessEnv).baseUrl).toBeUndefined();
  });
  it('reads provider, model, and baseUrl from a config file', () => {
    const c = loadConfig({} as NodeJS.ProcessEnv, { provider: 'openai', model: 'gemma4:e2b', baseUrl: 'http://localhost:11434/v1' });
    expect(c).toMatchObject({ provider: 'openai', model: 'gemma4:e2b', baseUrl: 'http://localhost:11434/v1' });
  });
});

describe('resolveCliKey', () => {
  it('returns the trimmed env key', async () => {
    expect(await resolveCliKey({ ANTHROPIC_API_KEY: '  sk-ant-123  ' } as NodeJS.ProcessEnv)).toBe('sk-ant-123');
  });
  it('falls back to the keychain when env is unset', async () => {
    expect(await resolveCliKey({} as NodeJS.ProcessEnv, async () => 'sk-keychain')).toBe('sk-keychain');
  });
  it('falls back to the keychain for a blank env value', async () => {
    expect(await resolveCliKey({ ANTHROPIC_API_KEY: '   ' } as NodeJS.ProcessEnv, async () => 'sk-keychain')).toBe('sk-keychain');
  });
  it('returns null when neither env nor keychain has a key', async () => {
    expect(await resolveCliKey({} as NodeJS.ProcessEnv, async () => null)).toBeNull();
  });
});
