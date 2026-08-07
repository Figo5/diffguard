import { execFile } from 'node:child_process';
import { readFile } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const readFileAsync = promisify(readFile);

export async function isGitRepo(cwd: string): Promise<boolean> {
  try {
    await execFileAsync('git', ['rev-parse', '--is-inside-work-tree'], { cwd });
    return true;
  } catch {
    return false;
  }
}

export async function getGitDiff(
  cwd: string,
  opts: { staged?: boolean; paths?: string[] } = {}
): Promise<string> {
  const args = ['diff', '--no-color'];
  if (opts.staged) args.push('--cached');
  if (opts.paths && opts.paths.length > 0) args.push('--', ...opts.paths);
  const { stdout } = await execFileAsync('git', args, { cwd, maxBuffer: 10 * 1024 * 1024 });
  return stdout;
}

export function getSelectionText(editor: {
  document: { getText(range: unknown): string };
  selection: unknown;
}): string {
  return editor.document.getText(editor.selection);
}

export interface RepoFiles {
  files: string;
  truncated: boolean;
  fileCount: number;
}

export async function getRepoFiles(cwd: string, opts: { maxChars: number }): Promise<RepoFiles> {
  const { stdout } = await execFileAsync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard'],
    { cwd, maxBuffer: 10 * 1024 * 1024 }
  );
  const paths = stdout.split('\n').filter((p) => p.length > 0 && !p.includes('node_modules'));
  const blocks: string[] = [];
  let total = 0;
  let truncated = false;
  let fileCount = 0;
  for (const p of paths) {
    let content: string;
    try {
      content = await readFileAsync(join(cwd, p), 'utf8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') continue; // deleted from working tree
      throw err;
    }
    if (content.includes('\0')) continue; // binary
    const block = `=== ${p} ===\n${content}`;
    if (blocks.length > 0 && total + block.length > opts.maxChars) {
      truncated = true;
      break;
    }
    blocks.push(block);
    total += block.length;
    fileCount++;
    if (total > opts.maxChars) truncated = true;
  }
  return { files: blocks.join('\n\n'), truncated, fileCount };
}
