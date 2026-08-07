import { describe, it, expect } from 'vitest';
import { parseFindings } from '../src/auditEngine/findingsParser';

describe('parseFindings', () => {
  it('parses a plain JSON array of findings', () => {
    const r = parseFindings('[{"category":"security","severity":"high","file":"a.ts","line":1,"message":"m"}]');
    expect(r.findings).toHaveLength(1);
    expect(r.dropped).toBe(0);
    expect(r.findings[0].file).toBe('a.ts');
  });

  it('parses an object wrapping a findings array', () => {
    const r = parseFindings('{"findings":[{"category":"behavior","severity":"low","file":"b.ts","line":2,"message":"n"}]}');
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0].category).toBe('behavior');
  });

  it('salvages valid entries and counts dropped ones', () => {
    const raw = JSON.stringify([
      { category: 'security', severity: 'high', file: 'a.ts', line: 1, message: 'ok' },
      { category: 'license', severity: 'high', file: 'a.ts', line: 1, message: 'bad category' },
      { category: 'security', severity: 'high', file: 'a.ts', line: 0, message: 'bad line' },
    ]);
    const r = parseFindings(raw);
    expect(r.findings).toHaveLength(1);
    expect(r.dropped).toBe(2);
  });

  it('strips markdown fences', () => {
    const r = parseFindings('```json\n[{"category":"security","severity":"high","file":"a.ts","line":1,"message":"m"}]\n```');
    expect(r.findings).toHaveLength(1);
  });

  it('extracts JSON after leading prose', () => {
    const r = parseFindings('Here are the findings:\n[{"category":"security","severity":"high","file":"a.ts","line":1,"message":"m"}]');
    expect(r.findings).toHaveLength(1);
  });

  it('returns empty for non-JSON', () => {
    expect(parseFindings('the model went off the rails')).toEqual({ findings: [], dropped: 0 });
  });

  it('returns empty for JSON that is not a findings list', () => {
    expect(parseFindings('{"foo": 1}')).toEqual({ findings: [], dropped: 0 });
  });

  it('returns empty for an empty string', () => {
    expect(parseFindings('')).toEqual({ findings: [], dropped: 0 });
  });
});
