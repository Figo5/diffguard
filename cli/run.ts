import { detectRepoContext } from '../src/auditEngine/repoContext.js';
import { isGitRepo, getGitDiff } from '../src/diffProvider.js';
import { createEngine } from '../src/auditEngine/engineFactory.js';
import { resolveCliKey, loadConfig, type CliOptions } from './config.js';
import { readConfigFile, configFilePath, type ConfigFile } from '../src/config/configFile.js';
import { renderHuman, renderJson } from './render.js';
import type { DiffGuardSettings } from '../src/types.js';
import type { Finding } from '../src/findingsModel.js';
import type { AuditResult } from '../src/auditEngine/auditEngine.js';

export interface RunDeps {
  getApiKey: (env: NodeJS.ProcessEnv) => Promise<string | null>;
  getSettings: (env: NodeJS.ProcessEnv, file?: ConfigFile | null) => DiffGuardSettings;
  readConfigFile: (path: string) => Promise<ConfigFile | null>;
  configFilePath: (env: NodeJS.ProcessEnv) => string;
  isGitRepo: (cwd: string) => Promise<boolean>;
  getGitDiff: (cwd: string, opts?: { staged?: boolean }) => Promise<string>;
  detectRepoContext: (diff: string) => string;
  createEngine: (settings: DiffGuardSettings, apiKey: string) => { audit(req: { diff: string; repoContext: string }, signal?: AbortSignal): Promise<AuditResult> };
  render: (findings: Finding[], opts: { threshold: DiffGuardSettings['severityThreshold']; dropped: number; truncated: boolean; fileCount: number; json: boolean; repoContext: string }) => string;
}

export const realDeps: RunDeps = {
  getApiKey: resolveCliKey,
  getSettings: loadConfig,
  readConfigFile,
  configFilePath,
  isGitRepo,
  getGitDiff,
  detectRepoContext,
  createEngine,
  render: (findings, opts) => (opts.json ? renderJson(findings, { dropped: opts.dropped, truncated: opts.truncated, repoContext: opts.repoContext }) : renderHuman(findings, { threshold: opts.threshold, dropped: opts.dropped, truncated: opts.truncated, fileCount: opts.fileCount })),
};

export function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (/model/.test(m) && /not found|does not exist|unknown model/.test(m)) {
    return `${message} — check the model with \`diffguard config\`.`;
  }
  if (/401|unauthorized|invalid api key|authentication/.test(m)) {
    return `${message} — check your API key with \`diffguard config\` or \`diffguard key set\`.`;
  }
  if (/econnrefused|fetch failed|connect|network/.test(m)) {
    return `${message} — could not reach the provider. Is it running? Check \`diffguard config\`.`;
  }
  return message;
}

export async function run(cli: CliOptions, deps: RunDeps = realDeps): Promise<number> {
  let file: ConfigFile | null = null;
  let settings: DiffGuardSettings;
  try {
    file = await deps.readConfigFile(deps.configFilePath(process.env));
    settings = deps.getSettings(process.env, file);
  } catch (err) {
    console.error(`DiffGuard: could not read config — ${err instanceof Error ? err.message : String(err)}`);
    return 2;
  }
  const needsKey = file?.needsKey !== false;
  const apiKey = needsKey ? await deps.getApiKey(process.env) : 'local';
  if (!apiKey) {
    console.error('DiffGuard: no API key configured. Run `diffguard config` to set up a provider, or `diffguard key set` to store a key.');
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
    console.error(`DiffGuard: audit failed — ${friendlyError(result.error)}`);
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
