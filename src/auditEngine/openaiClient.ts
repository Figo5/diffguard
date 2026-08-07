// src/auditEngine/openaiClient.ts
import OpenAI from 'openai';
import type { LlmClient, StreamOptions } from './llmClient.js';

export class OpenAIClient implements LlmClient {
  constructor(private readonly client: OpenAI) {}

  async streamText(prompt: string, opts: StreamOptions): Promise<{ text: string }> {
    const stream = await this.client.chat.completions.create(
      {
        model: opts.model,
        messages: [{ role: 'user', content: prompt }],
        stream: true,
        response_format: { type: 'json_object' },
      },
      { signal: opts.signal }
    );
    let text = '';
    for await (const chunk of stream) {
      text += chunk.choices[0]?.delta?.content ?? '';
    }
    return { text };
  }
}
