// test/loadSettings.test.ts
import { describe, it, expect } from 'vitest';
import { loadSettings, SEVERITIES } from '../src/config/loadSettings.js';
import type { ConfigFile } from '../src/config/configFile.js';

const FILE: ConfigFile = { provider: 'openai', model: 'gemma4:e2b', baseUrl: 'http://localhost:11434/v1', needsKey: false };

describe('loadSettings', () => {
  it('applies defaults with no env and no file', () => {
    expect(loadSettings({} as NodeJS.ProcessEnv, null)).toEqual({
      model: 'claude-sonnet-5', severityThreshold: 'medium', securityEnabled: true,
      behaviorEnabled: true, maxDiffTokens: 8000, provider: 'anthropic', baseUrl: undefined,
    });
  });
  it('reads provider, model, and baseUrl from the file', () => {
    expect(loadSettings({} as NodeJS.ProcessEnv, FILE)).toMatchObject({
      provider: 'openai', model: 'gemma4:e2b', baseUrl: 'http://localhost:11434/v1',
    });
  });
  it('env vars override the file', () => {
    const s = loadSettings({ DIFFGUARD_MODEL: 'claude-opus-5', DIFFGUARD_PROVIDER: 'anthropic' } as NodeJS.ProcessEnv, FILE);
    expect(s.model).toBe('claude-opus-5');
    expect(s.provider).toBe('anthropic');
  });
  it('env DIFFGUARD_BASE_URL overrides the file baseUrl', () => {
    expect(loadSettings({ DIFFGUARD_BASE_URL: 'http://other:1234/v1' } as NodeJS.ProcessEnv, FILE).baseUrl).toBe('http://other:1234/v1');
  });
  it('keeps strict env validation for severity', () => {
    expect(() => loadSettings({ DIFFGUARD_SEVERITY_THRESHOLD: 'catastrophic' } as NodeJS.ProcessEnv, null)).toThrow(/severity/i);
  });
  it('keeps strict env validation for provider', () => {
    expect(() => loadSettings({ DIFFGUARD_PROVIDER: 'gemini' } as NodeJS.ProcessEnv, null)).toThrow(/provider/i);
  });
  it('throws on an invalid provider in the file', () => {
    expect(() => loadSettings({} as NodeJS.ProcessEnv, { provider: 'gemini' } as ConfigFile)).toThrow(/provider/i);
  });
  it('keeps strict env validation for maxDiffTokens', () => {
    expect(() => loadSettings({ DIFFGUARD_MAX_DIFF_TOKENS: 'lots' } as NodeJS.ProcessEnv, null)).toThrow(/maxDiffTokens/i);
  });
  it('exposes SEVERITIES for the CLI renderer', () => {
    expect(SEVERITIES).toEqual(['critical', 'high', 'medium', 'low', 'info']);
  });
});
