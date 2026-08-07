import { run, realDeps } from './run.js';
import type { CliOptions } from './config.js';

export const VERSION = '0.1.0';

export function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = { staged: false, json: false };
  for (const arg of argv.slice(1)) {
    if (arg === '--staged') opts.staged = true;
    else if (arg === '--json') opts.json = true;
    else if (arg === '--help' || arg === '-h' || arg === '--version' || arg === '-v') continue;
    else if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`);
    else throw new Error(`Unexpected argument: ${arg}`);
  }
  return opts;
}

export const USAGE = `DiffGuard — audit code changes for security and behavior issues.

Usage:
  diffguard [--staged] [--json]

Options:
  --staged   audit the staged diff (git diff --cached) instead of the working tree
  --json     machine-readable JSON output
  --help     show this help
  --version  print the version

Exit codes:
  0  clean — no findings
  1  findings found
  2  error (missing key, not a git repo, or audit failure)

Environment:
  ANTHROPIC_API_KEY            required
  DIFFGUARD_MODEL              model (default claude-sonnet-5)
  DIFFGUARD_SEVERITY_THRESHOLD minimum severity shown in human output (default medium)
  DIFFGUARD_SECURITY_ENABLED   audit security issues (default true)
  DIFFGUARD_BEHAVIOR_ENABLED   audit behavior changes (default true)
  DIFFGUARD_MAX_DIFF_TOKENS    max diff size before truncation (default 8000)
  DIFFGUARD_PROVIDER           provider: anthropic or openai (default anthropic)
  DIFFGUARD_BASE_URL           base URL for OpenAI-compatible providers (default unset)`;

export async function main(argv: string[] = process.argv, deps = realDeps): Promise<void> {
  const raw = argv.slice(2);
  if (raw.includes('--help') || raw.includes('-h')) {
    console.log(USAGE);
    return;
  }
  if (raw.includes('--version') || raw.includes('-v')) {
    console.log(VERSION);
    return;
  }
  let cli: CliOptions;
  try {
    cli = parseArgs(['diffguard', ...raw]);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    console.error('Run `diffguard --help` for usage.');
    process.exitCode = 2;
    return;
  }
  process.exitCode = await run(cli, deps);
}
