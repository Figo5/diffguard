import { describe, it, expect } from 'vitest';
import { renderHuman, renderJson } from '../cli/render.js';
import type { Finding } from '../src/findingsModel.js';

const mk = (over: Partial<Finding>): Finding => ({
  category: 'security', severity: 'high', file: 'src/a.ts', line: 5, message: 'Bad', suggestedFix: undefined, ...over,
});

const FINDINGS: Finding[] = [
  mk({ file: 'src/a.ts', line: 10, severity: 'low', message: 'Low issue', category: 'behavior' }),
  mk({ file: 'src/a.ts', line: 5, severity: 'high', message: 'Bad', suggestedFix: 'Use a safe API' }),
  mk({ file: 'src/b.ts', line: 1, severity: 'info', message: 'Info note', category: 'behavior' }),
];

describe('renderHuman', () => {
  it('groups by file, orders severity-descending, includes Fix lines', () => {
    // threshold 'info' shows all three findings (low and info are below 'medium')
    const out = renderHuman(FINDINGS, { threshold: 'info', dropped: 0, truncated: false, fileCount: 2 });
    expect(out).toContain('src/a.ts');
    expect(out).toContain('src/b.ts');
    expect(out.indexOf('Bad') < out.indexOf('Low issue')).toBe(true);
    expect(out).toContain('Fix: Use a safe API');
  });
  it('filters below the threshold', () => {
    const out = renderHuman(FINDINGS, { threshold: 'high', dropped: 0, truncated: false, fileCount: 2 });
    expect(out).toContain('Bad');
    expect(out).not.toContain('Low issue');
    expect(out).not.toContain('Info note');
  });
  it('renders a clean message when there are no findings', () => {
    expect(renderHuman([], { threshold: 'medium', dropped: 0, truncated: false, fileCount: 3 })).toContain('No issues found in 3 files');
  });
  it('reports dropped and truncated when non-zero', () => {
    const out = renderHuman(FINDINGS, { threshold: 'low', dropped: 2, truncated: true, fileCount: 2 });
    expect(out).toContain('2 dropped');
    expect(out).toContain('partial');
  });
});

describe('renderJson', () => {
  it('serializes the raw findings unfiltered with metadata', () => {
    const doc = JSON.parse(renderJson(FINDINGS, { dropped: 1, truncated: true, repoContext: 'Detected languages: TypeScript.' }));
    expect(doc.findings).toHaveLength(3);
    expect(doc.findings.find((f: Finding) => f.message === 'Bad')?.suggestedFix).toBe('Use a safe API');
    expect(doc.dropped).toBe(1);
    expect(doc.truncated).toBe(true);
    expect(doc.repoContext).toContain('TypeScript');
  });
});
