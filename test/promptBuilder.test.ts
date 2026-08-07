import { describe, it, expect } from 'vitest';
import { buildPrompt, buildRepoAuditPrompt, truncateDiff } from '../src/auditEngine/promptBuilder.js';

const DIFF = 'diff --git a/src/auth.ts b/src/auth.ts\n@@ -40,3 +40,3 @@\n-  const q = "SELECT * FROM u WHERE id=" + id;\n+  const q = "SELECT * FROM u WHERE id=?";\n';

describe('truncateDiff', () => {
  it('returns the diff unchanged when under the cap', () => {
    expect(truncateDiff('abc', 10)).toEqual({ diff: 'abc', truncated: false });
  });

  it('truncates and flags when over the cap', () => {
    const r = truncateDiff('abcdefghij', 5);
    expect(r.truncated).toBe(true);
    expect(r.diff).toContain('… [diff truncated]');
    expect(r.diff.length).toBeLessThan(20);
  });
});

describe('buildPrompt', () => {
  it('embeds the diff and repo context', () => {
    const prompt = buildPrompt({ diff: DIFF, repoContext: 'Detected languages: TypeScript.', categories: ['security', 'behavior'], truncated: false });
    expect(prompt).toContain(DIFF);
    expect(prompt).toContain('Detected languages: TypeScript.');
  });

  it('lists only the enabled categories', () => {
    const prompt = buildPrompt({ diff: DIFF, repoContext: '', categories: ['security'], truncated: false });
    expect(prompt).toContain('Audit for: security.');
    expect(prompt).not.toContain('behavior');
  });

  it('defaults the category line when none are enabled', () => {
    const prompt = buildPrompt({ diff: DIFF, repoContext: '', categories: [], truncated: false });
    expect(prompt).toContain('Audit for: security, behavior.');
  });

  it('warns about truncation when flagged', () => {
    const prompt = buildPrompt({ diff: DIFF, repoContext: '', categories: ['security'], truncated: true });
    expect(prompt).toContain('WARNING: the diff was truncated');
  });

  it('does not warn when not truncated', () => {
    const prompt = buildPrompt({ diff: DIFF, repoContext: '', categories: ['security'], truncated: false });
    expect(prompt).not.toContain('WARNING');
  });

  it('demands JSON-only output', () => {
    const prompt = buildPrompt({ diff: DIFF, repoContext: '', categories: ['security'], truncated: false });
    expect(prompt).toContain('Return JSON only');
  });
});

describe('buildRepoAuditPrompt', () => {
  it('instructs a security-only audit of the given files', () => {
    const prompt = buildRepoAuditPrompt({ files: '=== a.ts ===\nconst x = 1;\n', truncated: false });
    expect(prompt).toContain('=== a.ts ===');
    expect(prompt).toContain('Audit for: security.');
    expect(prompt).not.toContain('behavior');
    expect(prompt).toContain('Return JSON only');
  });

  it('warns about truncation when flagged', () => {
    const prompt = buildRepoAuditPrompt({ files: '=== a.ts ===\nconst x = 1;\n', truncated: true });
    expect(prompt).toContain('WARNING: the repository was truncated');
  });
});
