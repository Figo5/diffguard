// test/mcp.test.ts
import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildToolHandler } from '../agent/mcp.js';
import type { RunAuditResult } from '../agent/core.js';

// Never read the developer's real ~/.config/diffguard/config.json during tests.
process.env.XDG_CONFIG_HOME = mkdtempSync(join(tmpdir(), 'diffguard-mcp-test-'));

describe('buildToolHandler', () => {
  it('returns text and structured content for a clean audit', async () => {
    const runAudit = vi.fn(async () => ({ text: 'No issues found in 1 file.', findings: [], error: null } as RunAuditResult));
    const handler = buildToolHandler(runAudit);
    const result = await handler({ scope: 'working' });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('No issues found');
    expect(result.structuredContent).toEqual({ findings: [], error: null });
  });

  it('returns findings in structured content', async () => {
    const finding = { category: 'security', severity: 'high', file: 'a.ts', line: 1, message: 'Bad' };
    const runAudit = vi.fn(async () => ({ text: '[security] high a.ts:1', findings: [finding], error: null } as RunAuditResult));
    const handler = buildToolHandler(runAudit);
    const result = await handler({ scope: 'repo' });
    expect(result.structuredContent.findings).toEqual([finding]);
  });

  it('marks errors with isError and a message', async () => {
    const runAudit = vi.fn(async () => ({ text: '', findings: [], error: 'not a git repository' } as RunAuditResult));
    const handler = buildToolHandler(runAudit);
    const result = await handler({ scope: 'working' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('not a git repository');
  });

  it('rejects an invalid scope argument', async () => {
    const runAudit = vi.fn();
    const handler = buildToolHandler(runAudit);
    const result = await handler({ scope: 'bogus' });
    expect(result.isError).toBe(true);
    expect(runAudit).not.toHaveBeenCalled();
  });
});
