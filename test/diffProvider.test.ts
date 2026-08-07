// test/diffProvider.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { isGitRepo, getGitDiff, getSelectionText, getRepoFiles } from '../src/diffProvider.js';

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

describe('getGitDiff staged', () => {
  it('returns the staged diff with staged:true and the working-tree diff by default', async () => {
    writeFileSync(join(dir, 'a.ts'), 'const x = 3;\n');
    expect(await getGitDiff(dir)).toContain('+const x = 3;');
    expect(await getGitDiff(dir, { staged: true })).toBe('');
    execFileSync('git', ['add', 'a.ts'], { cwd: dir });
    expect(await getGitDiff(dir, { staged: true })).toContain('+const x = 3;');
    expect(await getGitDiff(dir)).toBe('');
  });
});

describe('getSelectionText', () => {
  it('returns the selected text from the editor', () => {
    const editor = { document: { getText: (r: unknown) => (r === 'sel' ? 'selected code' : '') }, selection: 'sel' };
    expect(getSelectionText(editor as never)).toBe('selected code');
  });
});

describe('getGitDiff paths', () => {
  it('filters the diff to the given paths', async () => {
    writeFileSync(join(dir, 'a.ts'), 'const x = 4;\n');
    writeFileSync(join(dir, 'b.ts'), 'const b = 9;\n');
    execFileSync('git', ['add', 'b.ts'], { cwd: dir });
    writeFileSync(join(dir, 'b.ts'), 'const b = 10;\n');
    const all = await getGitDiff(dir);
    expect(all).toContain('a.ts');
    expect(all).toContain('b.ts');
    const onlyA = await getGitDiff(dir, { paths: ['a.ts'] });
    expect(onlyA).toContain('a.ts');
    expect(onlyA).not.toContain('b.ts');
  });
});

describe('getRepoFiles', () => {
  let repo: string;
  beforeAll(() => {
    repo = mkdtempSync(join(tmpdir(), 'diffguard-repo-'));
    execFileSync('git', ['init', '-q'], { cwd: repo });
    writeFileSync(join(repo, 'a.ts'), 'const a = 1;\n');
    writeFileSync(join(repo, 'b.ts'), 'const b = 2;\n');
    writeFileSync(join(repo, '.gitignore'), 'ignored.txt\n');
    writeFileSync(join(repo, 'ignored.txt'), 'secret\n');
    mkdirSync(join(repo, 'node_modules'));
    writeFileSync(join(repo, 'node_modules', 'dep.js'), 'module.exports = 1;\n');
    writeFileSync(join(repo, 'blob.bin'), Buffer.from([0, 1, 2, 0, 3]));
    execFileSync('git', ['add', '.'], { cwd: repo });
    execFileSync('git', ['commit', '-q', '-m', 'init'], { cwd: repo });
    writeFileSync(join(repo, 'untracked.ts'), 'const u = 1;\n');
  });
  afterAll(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  it('includes tracked + untracked non-ignored files, skipping node_modules and binaries', async () => {
    const r = await getRepoFiles(repo, { maxChars: 100000 });
    expect(r.files).toContain('=== a.ts ===');
    expect(r.files).toContain('=== b.ts ===');
    expect(r.files).toContain('=== untracked.ts ===');
    expect(r.files).not.toContain('=== ignored.txt ===');
    expect(r.files).not.toContain('node_modules');
    expect(r.files).not.toContain('=== blob.bin ===');
    expect(r.fileCount).toBe(4); // a.ts, b.ts, .gitignore, untracked.ts
    expect(r.truncated).toBe(false);
  });

  it('caps total size and flags truncation', async () => {
    const r = await getRepoFiles(repo, { maxChars: 20 });
    expect(r.truncated).toBe(true);
    expect(r.fileCount).toBe(1); // only the first file fits
  });

  it('skips a tracked file that has been deleted from the working tree', async () => {
    rmSync(join(repo, 'b.ts'));
    const r = await getRepoFiles(repo, { maxChars: 100000 });
    expect(r.files).toContain('=== a.ts ===');
    expect(r.files).not.toContain('=== b.ts ===');
    // restore for any subsequent tests
    writeFileSync(join(repo, 'b.ts'), 'const b = 2;\n');
  });
});
