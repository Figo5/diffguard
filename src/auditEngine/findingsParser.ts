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
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) return sliceToMatchingBracket(trimmed);
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return sliceToMatchingBracket(fenced[1].trim());
  const start = trimmed.search(/[[{]/);
  if (start === -1) return null;
  return sliceToMatchingBracket(trimmed.slice(start).trim());
}

/**
 * Given a string starting with '{' or '[', scans forward tracking bracket
 * nesting depth (ignoring bracket characters inside quoted strings) and
 * slices at the matching closing bracket, discarding any trailing content
 * (e.g. prose the model appended after the JSON block).
 */
function sliceToMatchingBracket(text: string): string | null {
  const open = text[0];
  if (open !== '{' && open !== '[') return null;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === '{' || ch === '[') {
      depth++;
    } else if (ch === '}' || ch === ']') {
      depth--;
      if (depth === 0) return text.slice(0, i + 1);
    }
  }

  return text;
}
