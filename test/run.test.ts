import { describe, it, expect, vi } from 'vitest';
import { run, friendlyError, type RunDeps } from '../cli/run.js';
import type { Finding } from '../src/findingsModel.js';

const FINDING: Finding = { category: 'security', severity: 'high', file: 'a.ts', line: 1, message: 'Bad', suggestedFix: undefined };

function deps(over: Partial<RunDeps> = {}): RunDeps {
  return {
    getApiKey: () => 'sk-test',
    getSettings: () => ({ model: 'm', severityThreshold: 'medium', securityEnabled: true, behaviorEnabled: true, maxDiffTokens: 8000, provider: 'anthropic' }),
    readConfigFile: async () => null,
    configFilePath: () => '/tmp/diffguard-config.json',
    isGitRepo: async () => true,
    getGitDiff: async () => 'diff --git a/a.ts b/a.ts',
    detectRepoContext: () => '',
    createEngine: () => ({ audit: async () => ({ findings: [FINDING], dropped: 0, truncated: false, error: null }) }) as never,
    render: () => 'rendered',
    ...over,
  } as RunDeps;
}

describe('run', () => {
  it('returns 1 when findings exist', async () => {
    expect(await run({ staged: false, json: false }, deps())).toBe(1);
  });
  it('returns 0 on a clean audit', async () => {
    const d = deps({ createEngine: () => ({ audit: async () => ({ findings: [], dropped: 0, truncated: false, error: null }) }) as never });
    expect(await run({ staged: false, json: false }, d)).toBe(0);
  });
  it('returns 0 on an empty diff (no changes)', async () => {
    const d = deps({ getGitDiff: async () => '' });
    expect(await run({ staged: false, json: false }, d)).toBe(0);
  });
  it('returns 2 when the API key is missing', async () => {
    const d = deps({ getApiKey: () => null });
    expect(await run({ staged: false, json: false }, d)).toBe(2);
  });
  it('returns 2 when not a git repo', async () => {
    const d = deps({ isGitRepo: async () => false });
    expect(await run({ staged: false, json: false }, d)).toBe(2);
  });
  it('returns 2 on an API error, with a stderr message', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const d = deps({ createEngine: () => ({ audit: async () => ({ findings: [], dropped: 0, truncated: false, error: 'boom' }) }) as never });
    expect(await run({ staged: false, json: false }, d)).toBe(2);
    expect(err).toHaveBeenCalledWith(expect.stringContaining('boom'));
    err.mockRestore();
  });
  it('returns 2 on cancellation', async () => {
    const d = deps({ createEngine: () => ({ audit: async () => ({ findings: [], dropped: 0, truncated: false, error: 'cancelled' }) }) as never });
    expect(await run({ staged: false, json: false }, d)).toBe(2);
  });
  it('returns 2 when the diff command fails', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const d = deps({ getGitDiff: async () => { throw new Error('git exploded'); } });
    expect(await run({ staged: false, json: false }, d)).toBe(2);
    expect(err).toHaveBeenCalledWith(expect.stringContaining('git exploded'));
    err.mockRestore();
  });
  it('passes the staged option through to getGitDiff', async () => {
    const staged = vi.fn(async () => 'diff');
    await run({ staged: true, json: false }, deps({ getGitDiff: staged }));
    expect(staged).toHaveBeenCalledWith(expect.any(String), { staged: true });
  });
  it('passes a signal to the engine audit call', async () => {
    const audit = vi.fn(async () => ({ findings: [], dropped: 0, truncated: false, error: null }));
    await run({ staged: false, json: false }, deps({ createEngine: () => ({ audit }) as never }));
    expect(audit.mock.calls[0][1]).toBeInstanceOf(AbortSignal);
  });
  it('returns 2 when the config file is unreadable', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const d = deps({ readConfigFile: async () => { throw new Error('bad json'); } });
    expect(await run({ staged: false, json: false }, d)).toBe(2);
    expect(err).toHaveBeenCalledWith(expect.stringContaining('bad json'));
    err.mockRestore();
  });
  it('skips the key requirement when the config says needsKey:false', async () => {
    const d = deps({ readConfigFile: async () => ({ needsKey: false }), getApiKey: async () => null });
    expect(await run({ staged: false, json: false }, d)).toBe(1);
  });
  it('friendlyError appends a config hint for model errors', () => {
    expect(friendlyError('model "x" not found')).toContain('diffguard config');
  });
  it('friendlyError appends a hint for 401 errors', () => {
    expect(friendlyError('401 Unauthorized')).toContain('diffguard config');
  });
  it('friendlyError passes through unrelated messages', () => {
    expect(friendlyError('boom')).toBe('boom');
  });
  it('friendlyError appends a hint for connection/network errors', () => {
    expect(friendlyError('ECONNREFUSED connecting to localhost')).toContain('diffguard config');
  });
});
