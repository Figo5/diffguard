import { describe, it, expect, vi } from 'vitest';
import { AuditEngine } from '../src/auditEngine/auditEngine';
import type { LlmClient } from '../src/auditEngine/llmClient';
import type { DiffGuardSettings } from '../src/settings';

const SETTINGS: DiffGuardSettings = {
  model: 'claude-sonnet-5',
  severityThreshold: 'medium',
  securityEnabled: true,
  behaviorEnabled: true,
  maxDiffTokens: 8000,
};

function fakeLlm(text: string): LlmClient {
  return { streamText: vi.fn(async () => ({ text })) };
}

const DIFF = 'diff --git a/a.ts b/a.ts\n+++ b/a.ts\n@@ -1 +1 @@\n-x\n+y\n';

describe('AuditEngine', () => {
  it('parses findings from the LLM response', async () => {
    const llm = fakeLlm('[{"category":"security","severity":"high","file":"a.ts","line":1,"message":"m"}]');
    const engine = new AuditEngine({ llm, getSettings: () => SETTINGS });
    const r = await engine.audit({ diff: DIFF, repoContext: '' });
    expect(r.error).toBeNull();
    expect(r.findings).toHaveLength(1);
    expect(r.dropped).toBe(0);
  });

  it('does not call the LLM for an empty diff', async () => {
    const llm = fakeLlm('[]');
    const engine = new AuditEngine({ llm, getSettings: () => SETTINGS });
    const r = await engine.audit({ diff: '', repoContext: '' });
    expect(r.error).toBe('empty');
    expect(llm.streamText).not.toHaveBeenCalled();
  });

  it('reports the error message when the LLM throws', async () => {
    const llm: LlmClient = { streamText: vi.fn(async () => { throw new Error('rate limited'); }) };
    const engine = new AuditEngine({ llm, getSettings: () => SETTINGS });
    const r = await engine.audit({ diff: DIFF, repoContext: '' });
    expect(r.error).toBe('rate limited');
  });

  it('reports cancelled when aborted', async () => {
    const llm: LlmClient = {
      streamText: vi.fn(async (_p, opts) => {
        opts?.signal?.throwIfAborted();
        throw new Error('aborted');
      }),
    };
    const engine = new AuditEngine({ llm, getSettings: () => SETTINGS });
    const controller = new AbortController();
    controller.abort();
    const r = await engine.audit({ diff: DIFF, repoContext: '' }, controller.signal);
    expect(r.error).toBe('cancelled');
  });

  it('flags truncation when the diff exceeds the cap', async () => {
    const llm = fakeLlm('[]');
    const engine = new AuditEngine({ llm, getSettings: () => ({ ...SETTINGS, maxDiffTokens: 1 }) });
    const r = await engine.audit({ diff: DIFF, repoContext: '' });
    expect(r.truncated).toBe(true);
  });

  it('passes only enabled categories to the prompt', async () => {
    const llm = fakeLlm('[]');
    const engine = new AuditEngine({ llm, getSettings: () => ({ ...SETTINGS, securityEnabled: false }) });
    await engine.audit({ diff: DIFF, repoContext: '' });
    const prompt = (llm.streamText as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(prompt).toContain('Audit for: behavior.');
    expect(prompt).not.toContain('security');
  });
});
