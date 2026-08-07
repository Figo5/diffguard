// test/diagnostics.test.ts
import { describe, it, expect } from 'vitest';
import { severityToVscode } from '../src/diagnostics';

describe('severityToVscode', () => {
  it('maps critical and high to Error', () => {
    expect(severityToVscode('critical')).toBe(0); // DiagnosticSeverity.Error
    expect(severityToVscode('high')).toBe(0);
  });

  it('maps medium to Warning', () => {
    expect(severityToVscode('medium')).toBe(1); // DiagnosticSeverity.Warning
  });

  it('maps low and info to Information', () => {
    expect(severityToVscode('low')).toBe(2); // DiagnosticSeverity.Information
    expect(severityToVscode('info')).toBe(2);
  });
});
