import { describe, it, expect } from 'vitest';
import { loadConfig, getApiKey, SEVERITIES } from '../cli/config.js';
import type { Severity } from '../src/findingsModel.js';

describe('loadConfig', () => {
  it('applies defaults for a bare env', () => {
    const c = loadConfig({} as NodeJS.ProcessEnv);
    expect(c).toEqual({ model: 'claude-sonnet-5', severityThreshold: 'medium', securityEnabled: true, behaviorEnabled: true, maxDiffTokens: 8000 });
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
});

describe('getApiKey', () => {
  it('returns the trimmed key', () => {
    expect(getApiKey({ ANTHROPIC_API_KEY: '  sk-ant-123  ' } as NodeJS.ProcessEnv)).toBe('sk-ant-123');
  });
  it('returns null when unset', () => {
    expect(getApiKey({} as NodeJS.ProcessEnv)).toBeNull();
  });
  it('returns null for a blank value', () => {
    expect(getApiKey({ ANTHROPIC_API_KEY: '   ' } as NodeJS.ProcessEnv)).toBeNull();
  });
});
