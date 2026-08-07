// test/presets.test.ts
import { describe, it, expect } from 'vitest';
import { PROVIDER_PRESETS, getPreset } from '../src/config/presets.js';

describe('PROVIDER_PRESETS', () => {
  it('includes the five named providers', () => {
    expect(PROVIDER_PRESETS.map((p) => p.id)).toEqual(['anthropic', 'openai', 'openrouter', 'groq', 'ollama']);
  });
  it('marks ollama as not needing a key', () => {
    expect(getPreset('ollama')?.needsKey).toBe(false);
  });
  it('marks cloud providers as needing a key', () => {
    for (const id of ['anthropic', 'openai', 'openrouter', 'groq']) {
      expect(getPreset(id)?.needsKey).toBe(true);
    }
  });
  it('gives every preset a default model and a provider kind', () => {
    for (const p of PROVIDER_PRESETS) {
      expect(p.defaultModel.length).toBeGreaterThan(0);
      expect(['anthropic', 'openai']).toContain(p.provider);
    }
  });
  it('returns undefined for an unknown preset', () => {
    expect(getPreset('gemini')).toBeUndefined();
  });
});
