import { AuditEngine } from '../src/auditEngine/auditEngine.js';
import { AnthropicLlmClient } from '../src/auditEngine/llmClient.js';
import { detectRepoContext } from '../src/auditEngine/repoContext.js';
import { isGitRepo, getGitDiff } from '../src/diffProvider.js';
import Anthropic from '@anthropic-ai/sdk';
import { getApiKey, loadConfig, type CliOptions } from './config.js';
import { renderHuman, renderJson } from './render.js';
import type { DiffGuardSettings } from '../src/types.js';
import type { Finding } from '../src/findingsModel.js';
import type { AuditResult } from '../src/auditEngine/auditEngine.js';

export interface RunDeps {
  getApiKey: (env: NodeJS.ProcessEnv) => string | null;
  getSettings: (env: NodeJS.ProcessEnv) => DiffGuardSettings;
  isGitRepo: (cwd: string) => Promise<boolean>;
  getGitDiff: (cwd: string, opts?: { staged?: boolean }) => Promise<string>;
  detectRepoContext: (diff: string) => string;
  createEngine: (settings: DiffGuardSettings, apiKey: string) => { audit(req: { diff: string; repoContext: string }, signal?: AbortSignal): Promise<AuditResult> };
  render: (findings: Finding[], opts: { threshold: DiffGuardSettings['severityThreshold']; dropped: number; truncated: boolean; fileCount: number; json: boolean; repoContext: string }) => string;
}

export const realDeps: RunDeps = {
  getApiKey,
  getSettings: loadConfig,
  isGitRepo,
  getGitDiff,
  detectRepoContext,
  createEngine: (settings, apiKey) => new AuditEngine({ llm: new AnthropicLlmClient(new Anthropic({ apiKey })), getSettings: () => settings }),
  render: (findings, opts) => (opts.json ? renderJson(findings, { dropped: opts.dropped, truncated: opts.truncated, repoContext: opts.repoContext }) : renderHuman(findings, { threshold: opts.threshold, dropped: opts.dropped, truncated: opts.truncated, fileCount: opts.fileCount })),
};

export async function run(cli: CliOptions, deps: RunDeps = realDeps): Promise<number> {
  const settings = deps.getSettings(process.env);
  const apiKey = deps.getApiKey(process.env);
  if (!apiKey) {
    console.error('DiffGuard: ANTHROPIC_API_KEY is not set. Set it to audit changes.');
    return 2;
  }

  const cwd = process.cwd();
  if (!(await deps.isGitRepo(cwd))) {
    console.error('DiffGuard: current directory is not a git repository.');
    return 2;
  }

  let diff: string;
  try {
    diff = await deps.getGitDiff(cwd, { staged: cli.staged });
  } catch (err) {
    console.error(`DiffGuard: could not read git diff — ${err instanceof Error ? err.message : String(err)}`);
    return 2;
  }

  if (diff.trim() === '') {
    console.log('DiffGuard: no changes to audit.');
    return 0;
  }

  const controller = new AbortController();
  const onSigint = () => controller.abort();
  process.once('SIGINT', onSigint);

  const engine = deps.createEngine(settings, apiKey);
  const repoContext = deps.detectRepoContext(diff);
  const result = await engine.audit({ diff, repoContext }, controller.signal);
  process.off('SIGINT', onSigint);

  if (result.error === 'cancelled') return 2;
  if (result.error === 'empty') {
    console.log('DiffGuard: no changes to audit.');
    return 0;
  }
  if (result.error) {
    console.error(`DiffGuard: audit failed — ${result.error}`);
    return 2;
  }

  // Count new/modified files (+++ b/ headers); deleted files have no b/ path.
  const fileCount = diff.split('\n').filter((l) => l.startsWith('+++ b/')).length;
  process.stdout.write(
    deps.render(result.findings, {
      threshold: settings.severityThreshold,
      dropped: result.dropped,
      truncated: result.truncated,
      fileCount,
      json: cli.json,
      repoContext,
    }) + '\n'
  );
  return result.findings.length > 0 ? 1 : 0;
}
