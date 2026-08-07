import type { Finding, Severity } from '../src/findingsModel.js';
import { SEVERITIES } from './config.js';

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

export interface HumanOptions {
  threshold: Severity;
  dropped: number;
  truncated: boolean;
  fileCount: number;
}

export function renderHuman(findings: Finding[], opts: HumanOptions): string {
  const shown = findings
    .filter((f) => SEVERITY_RANK[f.severity] <= SEVERITY_RANK[opts.threshold])
    .sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]));

  if (shown.length === 0) {
    return `No issues found in ${opts.fileCount} files.`;
  }

  const blocks: string[] = [];
  for (const f of shown) {
    blocks.push(`[${f.category}] ${f.severity}  ${f.file}:${f.line}\n  ${f.message}${f.suggestedFix ? `\n  Fix: ${f.suggestedFix}` : ''}`);
  }
  const categories = new Map<string, number>();
  for (const f of shown) categories.set(f.category, (categories.get(f.category) ?? 0) + 1);
  const summary = `${shown.length} finding${shown.length === 1 ? '' : 's'} (${[...categories.entries()].map(([c, n]) => `${n} ${c}`).join(', ')})`;
  const parts = [summary];
  if (opts.dropped > 0) parts.push(`${opts.dropped} dropped`);
  if (opts.truncated) parts.push('partial audit (diff truncated)');
  return `${blocks.join('\n\n')}\n\n${parts.join(' · ')}`;
}

export interface JsonMeta {
  dropped: number;
  truncated: boolean;
  repoContext: string;
}

export function renderJson(findings: Finding[], meta: JsonMeta): string {
  return JSON.stringify(
    { findings, dropped: meta.dropped, truncated: meta.truncated, repoContext: meta.repoContext },
    null,
    2
  );
}
