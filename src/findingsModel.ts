export type Category = 'security' | 'behavior';
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface Finding {
  category: Category;
  severity: Severity;
  file: string;
  line: number;
  message: string;
  suggestedFix?: string;
}

const CATEGORIES: readonly Category[] = ['security', 'behavior'];
const SEVERITIES: readonly Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

export function validateFinding(raw: unknown): Finding | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.category !== 'string' || !(CATEGORIES as readonly string[]).includes(r.category)) return null;
  if (typeof r.severity !== 'string' || !(SEVERITIES as readonly string[]).includes(r.severity)) return null;
  if (typeof r.file !== 'string' || r.file.length === 0) return null;
  if (typeof r.line !== 'number' || !Number.isInteger(r.line) || r.line < 1) return null;
  if (typeof r.message !== 'string' || r.message.length === 0) return null;
  const finding: Finding = {
    category: r.category as Category,
    severity: r.severity as Severity,
    file: r.file,
    line: r.line,
    message: r.message,
  };
  if (typeof r.suggestedFix === 'string' && r.suggestedFix.length > 0) {
    finding.suggestedFix = r.suggestedFix;
  }
  return finding;
}
