import { describe, it, expect } from 'vitest';
import { validateFinding } from '../src/findingsModel';

describe('validateFinding', () => {
  it('accepts a valid finding', () => {
    const f = validateFinding({
      category: 'security',
      severity: 'high',
      file: 'src/auth.ts',
      line: 42,
      message: 'SQL query built with string interpolation — injection risk',
      suggestedFix: 'Use parameterized queries',
    });
    expect(f).toEqual({
      category: 'security',
      severity: 'high',
      file: 'src/auth.ts',
      line: 42,
      message: 'SQL query built with string interpolation — injection risk',
      suggestedFix: 'Use parameterized queries',
    });
  });

  it('accepts a finding without suggestedFix', () => {
    const f = validateFinding({ category: 'behavior', severity: 'low', file: 'a.ts', line: 1, message: 'm' });
    expect(f).toEqual({ category: 'behavior', severity: 'low', file: 'a.ts', line: 1, message: 'm' });
    expect(f!.suggestedFix).toBeUndefined();
  });

  it('rejects an unknown category', () => {
    expect(validateFinding({ category: 'license', severity: 'high', file: 'a.ts', line: 1, message: 'm' })).toBeNull();
  });

  it('rejects an unknown severity', () => {
    expect(validateFinding({ category: 'security', severity: 'urgent', file: 'a.ts', line: 1, message: 'm' })).toBeNull();
  });

  it('rejects a missing or empty file', () => {
    expect(validateFinding({ category: 'security', severity: 'high', line: 1, message: 'm' })).toBeNull();
    expect(validateFinding({ category: 'security', severity: 'high', file: '', line: 1, message: 'm' })).toBeNull();
  });

  it('rejects a non-integer or non-positive line', () => {
    expect(validateFinding({ category: 'security', severity: 'high', file: 'a.ts', line: 0, message: 'm' })).toBeNull();
    expect(validateFinding({ category: 'security', severity: 'high', file: 'a.ts', line: 1.5, message: 'm' })).toBeNull();
    expect(validateFinding({ category: 'security', severity: 'high', file: 'a.ts', line: 'x', message: 'm' })).toBeNull();
  });

  it('rejects an empty message', () => {
    expect(validateFinding({ category: 'security', severity: 'high', file: 'a.ts', line: 1, message: '' })).toBeNull();
  });

  it('rejects non-objects', () => {
    expect(validateFinding(null)).toBeNull();
    expect(validateFinding('security')).toBeNull();
    expect(validateFinding(42)).toBeNull();
  });
});
