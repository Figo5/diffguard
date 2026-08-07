// src/auditEngine/anthropicClient.ts
import Anthropic from '@anthropic-ai/sdk';
import type { LlmClient, StreamOptions } from './llmClient.js';

export class AnthropicLlmClient implements LlmClient {
  constructor(private readonly client: Anthropic) {}

  async streamText(prompt: string, opts: StreamOptions): Promise<{ text: string }> {
    const stream = this.client.messages.stream(
      {
        model: opts.model,
        max_tokens: 4096,
        thinking: { type: 'adaptive' },
        system: 'You are DiffGuard, a code-change auditor. Respond with strict JSON only.',
        messages: [{ role: 'user', content: prompt }],
      },
      { signal: opts.signal }
    );
    let text = '';
    stream.on('text', (delta) => {
      text += delta;
    });
    await stream.finalMessage();
    return { text };
  }
}
