const EXT_TO_LANG: Record<string, string> = {
  '.ts': 'TypeScript', '.tsx': 'TypeScript/React', '.js': 'JavaScript', '.jsx': 'JavaScript/React',
  '.py': 'Python', '.go': 'Go', '.rs': 'Rust', '.java': 'Java', '.rb': 'Ruby', '.php': 'PHP',
  '.cs': 'C#', '.sql': 'SQL', '.html': 'HTML', '.css': 'CSS', '.json': 'JSON', '.yml': 'YAML', '.yaml': 'YAML',
};

export function detectRepoContext(diff: string): string {
  const langs = new Set<string>();
  for (const line of diff.split('\n')) {
    const m = line.match(/^\+\+\+ b\/(.+)$/);
    if (!m) continue;
    const ext = m[1].match(/\.[A-Za-z0-9]+$/)?.[0];
    if (ext && EXT_TO_LANG[ext]) langs.add(EXT_TO_LANG[ext]);
  }
  return langs.size > 0 ? `Detected languages: ${[...langs].join(', ')}.` : '';
}
