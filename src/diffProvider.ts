import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function isGitRepo(cwd: string): Promise<boolean> {
  try {
    await execFileAsync('git', ['rev-parse', '--is-inside-work-tree'], { cwd });
    return true;
  } catch {
    return false;
  }
}

export async function getGitDiff(cwd: string, opts: { staged?: boolean } = {}): Promise<string> {
  const args = ['diff', '--no-color'];
  if (opts.staged) args.push('--cached');
  const { stdout } = await execFileAsync('git', args, { cwd, maxBuffer: 10 * 1024 * 1024 });
  return stdout;
}

export function getSelectionText(editor: {
  document: { getText(range: unknown): string };
  selection: unknown;
}): string {
  return editor.document.getText(editor.selection);
}
