// test/llmClient.test.ts
import { describe, it, expect, vi } from 'vitest';
import { AnthropicLlmClient } from '../src/auditEngine/llmClient.js';

function fakeAnthropic() {
  const stream = {
    on: vi.fn((event: string, cb: (delta: string) => void) => {
      if (event === 'text') cb('{"findings":[]}');
    }),
    finalMessage: vi.fn(async () => ({})),
  };
  const messages = { stream: vi.fn(() => stream) };
  return { client: { messages }, messages, stream };
}

describe('AnthropicLlmClient', () => {
  it('sends the prompt with the configured model, adaptive thinking, and a system prompt', async () => {
    const { client, messages } = fakeAnthropic();
    const llm = new AnthropicLlmClient(client as never);
    const result = await llm.streamText('the prompt', { model: 'claude-sonnet-5' });
    expect(messages.stream).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-sonnet-5',
        max_tokens: 4096,
        thinking: { type: 'adaptive' },
        system: expect.stringContaining('DiffGuard'),
        messages: [{ role: 'user', content: 'the prompt' }],
      }),
      expect.anything()
    );
    expect(result.text).toBe('{"findings":[]}');
  });

  it('forwards the abort signal', async () => {
    const { client, messages } = fakeAnthropic();
    const llm = new AnthropicLlmClient(client as never);
    const controller = new AbortController();
    await llm.streamText('p', { model: 'm', signal: controller.signal });
    expect(messages.stream).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ signal: controller.signal })
    );
  });
});
