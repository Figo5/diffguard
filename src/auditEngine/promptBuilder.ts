import type { Category } from '../findingsModel.js';

export interface Truncation {
  diff: string;
  truncated: boolean;
}

export function truncateDiff(diff: string, maxChars: number): Truncation {
  if (diff.length <= maxChars) return { diff, truncated: false };
  const suffix = '… [diff truncated]';
  const availableChars = Math.max(0, maxChars - suffix.length);
  return { diff: diff.slice(0, availableChars) + suffix, truncated: true };
}

export interface PromptInput {
  diff: string;
  repoContext: string;
  categories: Category[];
  truncated: boolean;
}

export function buildPrompt(input: PromptInput): string {
  const categoryLine =
    input.categories.length > 0
      ? `Audit for: ${input.categories.join(', ')}.`
      : 'Audit for: security, behavior.';
  const categoriesForJson = input.categories.length > 0 ? input.categories : ['security', 'behavior'];
  const categoryOptions = categoriesForJson.map(c => `"${c}"`).join('|');
  return [
    'You are DiffGuard, a code-change auditor. You review a diff and report issues found.',
    '',
    'Rules:',
    '- Only report findings you can point to a specific line in the diff.',
    '- Never invent files or lines not present in the diff.',
    '- Prefer fewer, high-confidence findings over a long list of guesses.',
    '- Return JSON only, no prose, no markdown fences.',
    '',
    categoryLine,
    '',
    'Repo context:',
    input.repoContext || '(none detected)',
    '',
    ...(input.truncated
      ? ['WARNING: the diff was truncated. Audit only the portion shown.', '']
      : []),
    'Diff:',
    '```',
    input.diff,
    '```',
    '',
    'Respond with a JSON array of findings. Each finding:',
    `{"category":${categoryOptions},"severity":"critical"|"high"|"medium"|"low"|"info","file":"<path from diff>","line":<1-based line number>,"message":"<what and why>","suggestedFix":"<optional>"}`,
  ].join('\n');
}
