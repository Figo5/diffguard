import { buildPrompt, buildRepoAuditPrompt, truncateDiff } from './promptBuilder.js';
import { parseFindings } from './findingsParser.js';
import type { LlmClient } from './llmClient.js';
import type { Finding } from '../findingsModel.js';
import type { DiffGuardSettings } from '../types.js';

export interface AuditRequest {
  diff: string;
  repoContext: string;
}

export interface RepoAuditRequest {
  files: string;
  truncated: boolean;
}

export interface AuditResult {
  findings: Finding[];
  dropped: number;
  truncated: boolean;
  error: string | null;
}

export class AuditEngine {
  constructor(private readonly deps: { llm: LlmClient; getSettings: () => DiffGuardSettings }) {}

  async audit(req: AuditRequest, signal?: AbortSignal): Promise<AuditResult> {
    if (req.diff.trim() === '') {
      return { findings: [], dropped: 0, truncated: false, error: 'empty' };
    }
    const settings = this.deps.getSettings();
    const categories = [
      ...(settings.securityEnabled ? (['security'] as const) : []),
      ...(settings.behaviorEnabled ? (['behavior'] as const) : []),
    ];
    const maxDiffChars = settings.maxDiffTokens * 4; // ~4 chars per token
    const { diff, truncated } = truncateDiff(req.diff, maxDiffChars);
    const prompt = buildPrompt({ diff, repoContext: req.repoContext, categories, truncated });
    try {
      const { text } = await this.deps.llm.streamText(prompt, { model: settings.model, signal });
      const { findings, dropped } = parseFindings(text);
      return { findings, dropped, truncated, error: null };
    } catch (err) {
      if (signal?.aborted) {
        return { findings: [], dropped: 0, truncated, error: 'cancelled' };
      }
      return { findings: [], dropped: 0, truncated, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async auditRepo(req: RepoAuditRequest, signal?: AbortSignal): Promise<AuditResult> {
    if (req.files.trim() === '') {
      return { findings: [], dropped: 0, truncated: false, error: 'empty' };
    }
    const settings = this.deps.getSettings();
    const prompt = buildRepoAuditPrompt({ files: req.files, truncated: req.truncated });
    try {
      const { text } = await this.deps.llm.streamText(prompt, { model: settings.model, signal });
      const { findings, dropped } = parseFindings(text);
      return { findings, dropped, truncated: req.truncated, error: null };
    } catch (err) {
      if (signal?.aborted) {
        return { findings: [], dropped: 0, truncated: req.truncated, error: 'cancelled' };
      }
      return { findings: [], dropped: 0, truncated: req.truncated, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
