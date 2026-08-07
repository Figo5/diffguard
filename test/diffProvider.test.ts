// test/diffProvider.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { isGitRepo, getGitDiff, getSelectionText } from '../src/diffProvider.js';

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'diffguard-test-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  writeFileSync(join(dir, 'a.ts'), 'const x = 1;\n');
  execFileSync('git', ['add', '.'], { cwd: dir });
  execFileSync('git', ['commit', '-q', '-m', 'init'], { cwd: dir });
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('isGitRepo', () => {
  it('is true inside a git repo', async () => {
    expect(await isGitRepo(dir)).toBe(true);
  });

  it('is false outside a git repo', async () => {
    expect(await isGitRepo(tmpdir())).toBe(false);
  });
});

describe('getGitDiff', () => {
  it('returns an empty string when there are no changes', async () => {
    expect(await getGitDiff(dir)).toBe('');
  });

  it('returns the diff of uncommitted changes', async () => {
    writeFileSync(join(dir, 'a.ts'), 'const x = 2;\n');
    const diff = await getGitDiff(dir);
    expect(diff).toContain('diff --git');
    expect(diff).toContain('-const x = 1;');
    expect(diff).toContain('+const x = 2;');
  });
});

describe('getSelectionText', () => {
  it('returns the selected text from the editor', () => {
    const editor = { document: { getText: (r: unknown) => (r === 'sel' ? 'selected code' : '') }, selection: 'sel' };
    expect(getSelectionText(editor as never)).toBe('selected code');
  });
});
