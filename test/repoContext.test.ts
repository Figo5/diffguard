import { describe, it, expect } from 'vitest';
import { detectRepoContext } from '../src/auditEngine/repoContext.js';

describe('detectRepoContext', () => {
  it('detects languages from +++ file headers', () => {
    const diff = 'diff --git a/a.ts b/a.ts\n+++ b/a.ts\n@@ -1 +1 @@\n-x\n+y\ndiff --git a/b.py b/b.py\n+++ b/b.py\n';
    expect(detectRepoContext(diff)).toBe('Detected languages: TypeScript, Python.');
  });

  it('returns empty when no file headers are present', () => {
    expect(detectRepoContext('no headers here')).toBe('');
  });

  it('ignores unknown extensions', () => {
    expect(detectRepoContext('+++ b/weird.xyz\n')).toBe('');
  });
});
