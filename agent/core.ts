// agent/core.ts
import { Type } from '@sinclair/typebox';
import { getKeyFromKeychain } from './keychain.js';

export const TOOL_NAME = 'diffguard_audit';

export const TOOL_DESCRIPTION =
  'Audit code for security issues and unintended behavior changes. ' +
  'Scopes: "working" (default, uncommitted changes), "staged" (git index), ' +
  '"file:<path>" (a single file), "repo" (whole repository, security only). ' +
  'Returns a text report plus structured findings.';

export const TOOL_PARAMS = Type.Object({
  scope: Type.Optional(
    Type.String({ description: 'Audit scope: working, staged, file:<path>, or repo. Defaults to working.' })
  ),
});

export type AuditScope = 'working' | 'staged' | 'file' | 'repo';

export interface ParsedScope {
  scope: AuditScope;
  path?: string;
}

export function parseScope(raw: string | undefined): ParsedScope {
  if (raw === undefined || raw === '') return { scope: 'working' };
  if (raw === 'working' || raw === 'staged' || raw === 'repo') return { scope: raw };
  if (raw.startsWith('file:')) {
    const path = raw.slice('file:'.length);
    if (path.length === 0) throw new Error('file scope requires a path, e.g. file:src/a.ts');
    return { scope: 'file', path };
  }
  throw new Error(`Unknown audit scope: '${raw}' (expected working, staged, file:<path>, or repo)`);
}

export async function resolveCredentials(
  env: NodeJS.ProcessEnv,
  agentAuth?: string | null,
  keychain: () => Promise<string | null> = getKeyFromKeychain
): Promise<string | null> {
  if (agentAuth && agentAuth.trim().length > 0) return agentAuth.trim();
  const envKey = env.ANTHROPIC_API_KEY?.trim();
  if (envKey && envKey.length > 0) return envKey;
  return keychain();
}
