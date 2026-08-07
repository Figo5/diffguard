// test/core.test.ts
import { describe, it, expect, vi } from 'vitest';
import { resolveCredentials, parseScope, TOOL_NAME, TOOL_DESCRIPTION, TOOL_PARAMS, runAudit } from '../agent/core.js';
import type { Finding } from '../src/findingsModel.js';

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

const SETTINGS = {
  model: 'm',
  severityThreshold: 'medium',
  securityEnabled: true,
  behaviorEnabled: true,
  maxDiffTokens: 8000,
  provider: 'anthropic' as const,
};

const FINDING: Finding = { category: 'security', severity: 'high', file: 'a.ts', line: 1, message: 'Bad' };

describe('runAudit', () => {
  it('returns a text report and findings for the working scope', async () => {
    const result = await runAudit({
      cwd: '/repo',
      scope: 'working',
      env: { ANTHROPIC_API_KEY: 'sk-test' },
      settings: SETTINGS,
      deps: {
        isGitRepo: async () => true,
        getGitDiff: async () => 'diff --git a/a.ts b/a.ts',
        getRepoFiles: async () => ({ files: '=== a.ts ===\nconst x = 1;\n', truncated: false, fileCount: 1 }),
        detectRepoContext: () => '',
        createEngine: () => ({ audit: async () => ({ findings: [FINDING], dropped: 0, truncated: false, error: null }), auditRepo: async () => ({ findings: [], dropped: 0, truncated: false, error: null }) }) as never,
      },
    });
    expect(result.error).toBeNull();
    expect(result.findings).toEqual([FINDING]);
    expect(result.text).toContain('security');
  });

  it('returns an error when not a git repo', async () => {
    const result = await runAudit({
      cwd: '/repo',
      scope: 'working',
      env: { ANTHROPIC_API_KEY: 'sk-test' },
      settings: SETTINGS,
      deps: {
        isGitRepo: async () => false,
        getGitDiff: async () => '',
        getRepoFiles: async () => ({ files: '', truncated: false, fileCount: 0 }),
        detectRepoContext: () => '',
        createEngine: () => ({ audit: async () => ({ findings: [], dropped: 0, truncated: false, error: null }), auditRepo: async () => ({ findings: [], dropped: 0, truncated: false, error: null }) }) as never,
      },
    });
    expect(result.error).toContain('not a git repository');
  });

  it('returns an error when no API key is available', async () => {
    const result = await runAudit({
      cwd: '/repo',
      scope: 'working',
      env: {},
      settings: SETTINGS,
      deps: {
        isGitRepo: async () => true,
        getGitDiff: async () => 'diff',
        getRepoFiles: async () => ({ files: '', truncated: false, fileCount: 0 }),
        detectRepoContext: () => '',
        createEngine: () => ({ audit: async () => ({ findings: [], dropped: 0, truncated: false, error: null }), auditRepo: async () => ({ findings: [], dropped: 0, truncated: false, error: null }) }) as never,
      },
    });
    expect(result.error).toContain('no API key');
  });

  it('runs the repo audit for the repo scope', async () => {
    const auditRepo = vi.fn(async () => ({ findings: [FINDING], dropped: 0, truncated: false, error: null }));
    const result = await runAudit({
      cwd: '/repo',
      scope: 'repo',
      env: { ANTHROPIC_API_KEY: 'sk-test' },
      settings: SETTINGS,
      deps: {
        isGitRepo: async () => true,
        getGitDiff: async () => '',
        getRepoFiles: async () => ({ files: '=== a.ts ===\nconst x = 1;\n', truncated: false, fileCount: 1 }),
        detectRepoContext: () => '',
        createEngine: () => ({ audit: async () => ({ findings: [], dropped: 0, truncated: false, error: null }), auditRepo }) as never,
      },
    });
    expect(auditRepo).toHaveBeenCalled();
    expect(result.findings).toEqual([FINDING]);
  });

  it('audits a single file for the file scope', async () => {
    const getGitDiff = vi.fn(async () => 'diff --git a/src/a.ts b/src/a.ts');
    const result = await runAudit({
      cwd: '/repo',
      scope: 'file:src/a.ts',
      env: { ANTHROPIC_API_KEY: 'sk-test' },
      settings: SETTINGS,
      deps: {
        isGitRepo: async () => true,
        getGitDiff,
        getRepoFiles: async () => ({ files: '', truncated: false, fileCount: 0 }),
        detectRepoContext: () => '',
        createEngine: () => ({ audit: async () => ({ findings: [FINDING], dropped: 0, truncated: false, error: null }), auditRepo: async () => ({ findings: [], dropped: 0, truncated: false, error: null }) }) as never,
      },
    });
    expect(getGitDiff).toHaveBeenCalledWith('/repo', { paths: ['src/a.ts'] });
    expect(result.findings).toEqual([FINDING]);
  });

  it('rejects a file scope that escapes the working directory', async () => {
    const result = await runAudit({
      cwd: '/repo',
      scope: 'file:../etc/passwd',
      env: { ANTHROPIC_API_KEY: 'sk-test' },
      settings: SETTINGS,
      deps: {
        isGitRepo: async () => true,
        getGitDiff: async () => '',
        getRepoFiles: async () => ({ files: '', truncated: false, fileCount: 0 }),
        detectRepoContext: () => '',
        createEngine: () => ({ audit: async () => ({ findings: [], dropped: 0, truncated: false, error: null }), auditRepo: async () => ({ findings: [], dropped: 0, truncated: false, error: null }) }) as never,
      },
    });
    expect(result.error).toContain('outside');
  });

  it('returns cancelled when the audit is aborted', async () => {
    const result = await runAudit({
      cwd: '/repo',
      scope: 'working',
      env: { ANTHROPIC_API_KEY: 'sk-test' },
      settings: SETTINGS,
      signal: new AbortController().signal,
      deps: {
        isGitRepo: async () => true,
        getGitDiff: async () => 'diff',
        getRepoFiles: async () => ({ files: '', truncated: false, fileCount: 0 }),
        detectRepoContext: () => '',
        createEngine: () => ({ audit: async () => ({ findings: [], dropped: 0, truncated: false, error: 'cancelled' }), auditRepo: async () => ({ findings: [], dropped: 0, truncated: false, error: null }) }) as never,
      },
    });
    expect(result.error).toBe('cancelled');
  });

  it('resolves with an error instead of rejecting when a git call throws', async () => {
    const result = await runAudit({
      cwd: '/repo',
      scope: 'working',
      env: { ANTHROPIC_API_KEY: 'sk-test' },
      settings: SETTINGS,
      deps: {
        isGitRepo: async () => true,
        getGitDiff: async () => {
          throw new Error('fatal: not a git repository (boom)');
        },
        getRepoFiles: async () => ({ files: '', truncated: false, fileCount: 0 }),
        detectRepoContext: () => '',
        createEngine: () => ({ audit: async () => ({ findings: [], dropped: 0, truncated: false, error: null }), auditRepo: async () => ({ findings: [], dropped: 0, truncated: false, error: null }) }) as never,
      },
    });
    expect(result.error).toContain('boom');
    expect(result.findings).toEqual([]);
    expect(result.text).toBe('');
  });

  it('resolves with an error instead of throwing when the scope is invalid', async () => {
    const result = await runAudit({
      cwd: '/repo',
      scope: 'bogus',
      env: { ANTHROPIC_API_KEY: 'sk-test' },
      settings: SETTINGS,
      deps: {
        isGitRepo: async () => true,
        getGitDiff: async () => '',
        getRepoFiles: async () => ({ files: '', truncated: false, fileCount: 0 }),
        detectRepoContext: () => '',
        createEngine: () => ({ audit: async () => ({ findings: [], dropped: 0, truncated: false, error: null }), auditRepo: async () => ({ findings: [], dropped: 0, truncated: false, error: null }) }) as never,
      },
    });
    expect(result.error).toContain('scope');
    expect(result.findings).toEqual([]);
    expect(result.text).toBe('');
  });
});
