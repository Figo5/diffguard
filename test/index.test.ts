// test/index.test.ts
import { describe, it, expect } from 'vitest';
import * as engine from '../src/index.js';

describe('engine library exports', () => {
  it('exposes the audit engine and factory', () => {
    expect(engine.AuditEngine).toBeTypeOf('function');
    expect(engine.createEngine).toBeTypeOf('function');
  });
  it('exposes the provider clients', () => {
    expect(engine.AnthropicLlmClient).toBeTypeOf('function');
    expect(engine.OpenAIClient).toBeTypeOf('function');
  });
  it('exposes the repo file collector and repo prompt', () => {
    expect(engine.getRepoFiles).toBeTypeOf('function');
    expect(engine.buildRepoAuditPrompt).toBeTypeOf('function');
  });
  it('exposes the types', () => {
    // Types are exported but erased at runtime; verify the module has the expected re-exports
    expect(engine.AuditEngine).toBeDefined(); // class is also a type
    expect(engine.parseFindings).toBeTypeOf('function'); // function alongside its types
  });
});
