import { validateFinding, type Finding } from '../findingsModel';

export interface ParseResult {
  findings: Finding[];
  dropped: number;
}

export function parseFindings(raw: string): ParseResult {
  const json = extractJson(raw);
  if (json === null) return { findings: [], dropped: 0 };
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { findings: [], dropped: 0 };
  }
  const list = Array.isArray(data) ? data : (data as { findings?: unknown }).findings;
  if (!Array.isArray(list)) return { findings: [], dropped: 0 };
  const findings: Finding[] = [];
  let dropped = 0;
  for (const item of list) {
    const f = validateFinding(item);
    if (f) findings.push(f);
    else dropped++;
  }
  return { findings, dropped };
}

function extractJson(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) return trimmed;
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const start = trimmed.search(/[[{]/);
  if (start === -1) return null;
  return trimmed.slice(start).trim();
}
