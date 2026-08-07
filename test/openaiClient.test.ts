// test/openaiClient.test.ts
import { describe, it, expect, vi } from 'vitest';
import { OpenAIClient } from '../src/auditEngine/openaiClient.js';

function fakeOpenAI() {
  const chunks = [
    { choices: [{ delta: { content: '{"findings":' } }] },
    { choices: [{ delta: { content: '[]}' } }] },
  ];
  const stream = (async function* () {
    for (const c of chunks) yield c;
  })();
  const create = vi.fn(async () => stream);
  return { client: { chat: { completions: { create } } }, create };
}

describe('OpenAIClient', () => {
  it('streams a chat.completions response into text with response_format', async () => {
    const { client, create } = fakeOpenAI();
    const llm = new OpenAIClient(client as never);
    const result = await llm.streamText('the prompt', { model: 'gpt-5' });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-5',
        stream: true,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: 'the prompt' }],
      }),
      expect.anything()
    );
    expect(result.text).toBe('{"findings":[]}');
  });

  it('forwards the abort signal', async () => {
    const { client, create } = fakeOpenAI();
    const llm = new OpenAIClient(client as never);
    const controller = new AbortController();
    await llm.streamText('p', { model: 'm', signal: controller.signal });
    expect(create).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ signal: controller.signal }));
  });

  it('surfaces API errors', async () => {
    const { client, create } = fakeOpenAI();
    create.mockRejectedValueOnce(new Error('rate limited'));
    const llm = new OpenAIClient(client as never);
    await expect(llm.streamText('p', { model: 'm' })).rejects.toThrow('rate limited');
  });
});
