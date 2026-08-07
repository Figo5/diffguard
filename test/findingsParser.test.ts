import { describe, it, expect } from 'vitest';
import { parseFindings } from '../src/auditEngine/findingsParser.js';

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

  it('parses a JSON array with trailing prose after it', () => {
    const r = parseFindings(
      '[{"category":"security","severity":"high","file":"a.ts","line":1,"message":"m"}] thanks!'
    );
    expect(r.findings).toHaveLength(1);
    expect(r.dropped).toBe(0);
  });

  it('parses a JSON object with trailing prose after it', () => {
    const r = parseFindings(
      '{"findings":[{"category":"behavior","severity":"low","file":"b.ts","line":2,"message":"n"}]} let me know if you need anything else.'
    );
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0].category).toBe('behavior');
  });

  it('does not truncate early on a closing bracket inside a string value', () => {
    const r = parseFindings(
      '[{"category":"security","severity":"high","file":"a.ts","line":1,"message":"a[b]"}] trailing text'
    );
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0].message).toBe('a[b]');
  });

  it('parses nested arrays and objects fully despite trailing prose', () => {
    const raw =
      '{"findings":[{"category":"security","severity":"high","file":"a.ts","line":1,"message":"m","meta":{"tags":["x","y"],"nested":{"a":[1,2,3]}}}]} done.';
    const r = parseFindings(raw);
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0].file).toBe('a.ts');
  });
});
