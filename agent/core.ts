// agent/core.ts
import { Type } from '@sinclair/typebox';
import { getKeyFromKeychain } from './keychain.js';
import { resolve, sep } from 'node:path';
import { isGitRepo, getGitDiff, getRepoFiles } from '../src/diffProvider.js';
import { detectRepoContext } from '../src/auditEngine/repoContext.js';
import { createEngine } from '../src/auditEngine/engineFactory.js';
import type { DiffGuardSettings } from '../src/types.js';
import type { Finding } from '../src/findingsModel.js';
import type { AuditResult } from '../src/auditEngine/auditEngine.js';

export const TOOL_NAME = 'diffguard_audit';

export const TOOL_DESCRIPTION =
  'Audit code for security issues and unintended behavior changes. ' +
  'Scopes: "working" (default, uncommitted changes), "staged" (git index), ' +
  '"file:<path>" (a single file), "repo" (whole repository, security only). ' +
  'Returns a text report plus structured findings.';

export const TOOL_PARAMS = Type.Object({
  scope: Type.Optional(
    Type.String({ description: 'Audit scope: working, staged, file:<path>, or repo. Defaults to working.' })
  ),
});

export type AuditScope = 'working' | 'staged' | 'file' | 'repo';

export interface ParsedScope {
  scope: AuditScope;
  path?: string;
}

export function parseScope(raw: string | undefined): ParsedScope {
  if (raw === undefined || raw === '') return { scope: 'working' };
  if (raw === 'working' || raw === 'staged' || raw === 'repo') return { scope: raw };
  if (raw.startsWith('file:')) {
    const path = raw.slice('file:'.length);
    if (path.length === 0) throw new Error('file scope requires a path, e.g. file:src/a.ts');
    return { scope: 'file', path };
  }
  throw new Error(`Unknown audit scope: '${raw}' (expected working, staged, file:<path>, or repo)`);
}

export async function resolveCredentials(
  env: NodeJS.ProcessEnv,
  agentAuth?: string | null,
  keychain: () => Promise<string | null> = getKeyFromKeychain
): Promise<string | null> {
  if (agentAuth && agentAuth.trim().length > 0) return agentAuth.trim();
  const envKey = env.ANTHROPIC_API_KEY?.trim();
  if (envKey && envKey.length > 0) return envKey;
  return keychain();
}

export interface RunAuditDeps {
  isGitRepo: (cwd: string) => Promise<boolean>;
  getGitDiff: (cwd: string, opts?: { staged?: boolean; paths?: string[] }) => Promise<string>;
  getRepoFiles: (cwd: string, opts: { maxChars: number }) => Promise<{ files: string; truncated: boolean; fileCount: number }>;
  detectRepoContext: (diff: string) => string;
  createEngine: (settings: DiffGuardSettings, apiKey: string) => {
    audit(req: { diff: string; repoContext: string }, signal?: AbortSignal): Promise<AuditResult>;
    auditRepo(req: { files: string; truncated: boolean }, signal?: AbortSignal): Promise<AuditResult>;
  };
}

export interface RunAuditInput {
  cwd: string;
  scope: string | undefined;
  env: NodeJS.ProcessEnv;
  agentAuth?: string | null;
  settings: DiffGuardSettings;
  signal?: AbortSignal;
  deps?: Partial<RunAuditDeps>;
}

export interface RunAuditResult {
  text: string;
  findings: Finding[];
  error: string | null;
}

const realDeps: RunAuditDeps = {
  isGitRepo,
  getGitDiff,
  getRepoFiles,
  detectRepoContext,
  createEngine,
};

function renderReport(findings: Finding[], meta: { dropped: number; truncated: boolean; fileCount: number }): string {
  if (findings.length === 0) {
    const parts = [`No issues found in ${meta.fileCount} file${meta.fileCount === 1 ? '' : 's'}.`];
    if (meta.dropped > 0) parts.push(`${meta.dropped} dropped`);
    if (meta.truncated) parts.push('partial audit (truncated)');
    return parts.join(' ');
  }
  const blocks = findings.map(
    (f) => `[${f.category}] ${f.severity}  ${f.file}:${f.line}\n  ${f.message}${f.suggestedFix ? `\n  Fix: ${f.suggestedFix}` : ''}`
  );
  const categories = new Map<string, number>();
  for (const f of findings) categories.set(f.category, (categories.get(f.category) ?? 0) + 1);
  const summary = `${findings.length} finding${findings.length === 1 ? '' : 's'} (${[...categories.entries()].map(([c, n]) => `${n} ${c}`).join(', ')})`;
  return `${blocks.join('\n\n')}\n\n${summary}`;
}

export async function runAudit(input: RunAuditInput): Promise<RunAuditResult> {
  const deps = { ...realDeps, ...input.deps };
  const parsed = parseScope(input.scope);
  const apiKey = await resolveCredentials(input.env, input.agentAuth);
  if (!apiKey) {
    return { text: '', findings: [], error: 'no API key configured — set ANTHROPIC_API_KEY or run `diffguard key set`' };
  }
  if (!(await deps.isGitRepo(input.cwd))) {
    return { text: '', findings: [], error: 'not a git repository' };
  }

  const engine = deps.createEngine(input.settings, apiKey);

  if (parsed.scope === 'repo') {
    const files = await deps.getRepoFiles(input.cwd, { maxChars: input.settings.maxDiffTokens * 4 });
    const result = await engine.auditRepo({ files: files.files, truncated: files.truncated }, input.signal);
    return {
      text: renderReport(result.findings, { dropped: result.dropped, truncated: result.truncated, fileCount: files.fileCount }),
      findings: result.findings,
      error: result.error,
    };
  }

  if (parsed.scope === 'file') {
    const resolved = resolvePath(input.cwd, parsed.path!);
    if (resolved === null) {
      return { text: '', findings: [], error: `file scope path '${parsed.path}' is outside the working directory` };
    }
    const diff = await deps.getGitDiff(input.cwd, { paths: [parsed.path!] });
    if (diff.trim() === '') {
      return { text: 'No changes to audit.', findings: [], error: null };
    }
    const repoContext = deps.detectRepoContext(diff);
    const result = await engine.audit({ diff, repoContext }, input.signal);
    const fileCount = diff.split('\n').filter((l) => l.startsWith('+++ b/')).length;
    return {
      text: renderReport(result.findings, { dropped: result.dropped, truncated: result.truncated, fileCount }),
      findings: result.findings,
      error: result.error,
    };
  }

  const diff = await deps.getGitDiff(input.cwd, { staged: parsed.scope === 'staged' });
  if (diff.trim() === '') {
    return { text: 'No changes to audit.', findings: [], error: null };
  }
  const repoContext = deps.detectRepoContext(diff);
  const result = await engine.audit({ diff, repoContext }, input.signal);
  const fileCount = diff.split('\n').filter((l) => l.startsWith('+++ b/')).length;
  return {
    text: renderReport(result.findings, { dropped: result.dropped, truncated: result.truncated, fileCount }),
    findings: result.findings,
    error: result.error,
  };
}

function resolvePath(cwd: string, p: string): string | null {
  const abs = resolve(cwd, p);
  const root = resolve(cwd);
  if (abs !== root && !abs.startsWith(root + sep)) return null;
  return abs;
}
