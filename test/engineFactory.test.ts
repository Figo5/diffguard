// test/engineFactory.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createEngine } from '../src/auditEngine/engineFactory.js';
import { AnthropicLlmClient } from '../src/auditEngine/anthropicClient.js';
import { OpenAIClient } from '../src/auditEngine/openaiClient.js';
import type { DiffGuardSettings } from '../src/types.js';

const SETTINGS: DiffGuardSettings = {
  model: 'm',
  severityThreshold: 'medium',
  securityEnabled: true,
  behaviorEnabled: true,
  maxDiffTokens: 8000,
  provider: 'anthropic',
};

const DIFF = 'diff --git a/a.ts b/a.ts\n+++ b/a.ts\n@@ -1 +1 @@\n-x\n+y\n';

describe('createEngine', () => {
  it('builds an Anthropic-backed engine for provider anthropic', async () => {
    const spy = vi.spyOn(AnthropicLlmClient.prototype, 'streamText').mockResolvedValue({ text: '[]' });
    const engine = createEngine({ ...SETTINGS, provider: 'anthropic' }, 'sk-test');
    const r = await engine.audit({ diff: DIFF, repoContext: '' });
    expect(r.error).toBeNull();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('builds an OpenAI-backed engine for provider openai', async () => {
    const spy = vi.spyOn(OpenAIClient.prototype, 'streamText').mockResolvedValue({ text: '[]' });
    const engine = createEngine({ ...SETTINGS, provider: 'openai', baseUrl: 'http://localhost:11434/v1' }, 'sk-test');
    const r = await engine.audit({ diff: DIFF, repoContext: '' });
    expect(r.error).toBeNull();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
