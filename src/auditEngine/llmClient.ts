// src/auditEngine/llmClient.ts
export interface StreamOptions {
  model: string;
  signal?: AbortSignal;
}

export interface LlmClient {
  streamText(prompt: string, opts: StreamOptions): Promise<{ text: string }>;
}
