// src/auditEngine/engineFactory.ts
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { AuditEngine } from './auditEngine.js';
import { AnthropicLlmClient } from './anthropicClient.js';
import { OpenAIClient } from './openaiClient.js';
import type { DiffGuardSettings } from '../types.js';

export function createEngine(settings: DiffGuardSettings, apiKey: string): AuditEngine {
  const llm =
    settings.provider === 'openai'
      ? new OpenAIClient(new OpenAI({ apiKey, ...(settings.baseUrl ? { baseURL: settings.baseUrl } : {}) }))
      : new AnthropicLlmClient(new Anthropic({ apiKey }));
  return new AuditEngine({ llm, getSettings: () => settings });
}
