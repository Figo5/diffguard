// test/core.test.ts
import { describe, it, expect, vi } from 'vitest';
import { resolveCredentials, parseScope, TOOL_NAME, TOOL_DESCRIPTION, TOOL_PARAMS } from '../agent/core.js';

describe('resolveCredentials', () => {
  it('prefers the agent credential over env and keychain', async () => {
    const keychain = vi.fn(async () => 'sk-keychain');
    expect(await resolveCredentials({ ANTHROPIC_API_KEY: 'sk-env' }, 'sk-agent', keychain)).toBe('sk-agent');
    expect(keychain).not.toHaveBeenCalled();
  });

  it('falls back to the env var', async () => {
    const keychain = vi.fn(async () => 'sk-keychain');
    expect(await resolveCredentials({ ANTHROPIC_API_KEY: 'sk-env' }, null, keychain)).toBe('sk-env');
    expect(keychain).not.toHaveBeenCalled();
  });

  it('falls back to the keychain', async () => {
    const keychain = vi.fn(async () => 'sk-keychain');
    expect(await resolveCredentials({}, null, keychain)).toBe('sk-keychain');
  });

  it('returns null when nothing is available', async () => {
    const keychain = vi.fn(async () => null);
    expect(await resolveCredentials({}, null, keychain)).toBeNull();
  });
});

describe('parseScope', () => {
  it('defaults to working', () => {
    expect(parseScope(undefined)).toEqual({ scope: 'working' });
  });
  it('parses staged', () => {
    expect(parseScope('staged')).toEqual({ scope: 'staged' });
  });
  it('parses repo', () => {
    expect(parseScope('repo')).toEqual({ scope: 'repo' });
  });
  it('parses file with a path', () => {
    expect(parseScope('file:src/a.ts')).toEqual({ scope: 'file', path: 'src/a.ts' });
  });
  it('rejects an unknown scope', () => {
    expect(() => parseScope('bogus')).toThrow(/scope/i);
  });
  it('rejects a file scope without a path', () => {
    expect(() => parseScope('file:')).toThrow(/path/i);
  });
});

describe('tool contract', () => {
  it('exposes the tool name and description', () => {
    expect(TOOL_NAME).toBe('diffguard_audit');
    expect(TOOL_DESCRIPTION.length).toBeGreaterThan(20);
  });
  it('describes the scope param', () => {
    expect(TOOL_PARAMS.properties.scope.type).toBe('string');
    expect(TOOL_PARAMS.properties.scope.description).toContain('working');
  });
});
