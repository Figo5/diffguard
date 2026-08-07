// agent/pi.ts
import { runAudit, TOOL_NAME, TOOL_DESCRIPTION, TOOL_PARAMS } from './core.js';
import type { RunAuditResult } from './core.js';

export interface PiExtensionApi {
  registerTool(tool: {
    name: string;
    description: string;
    schema: unknown;
    handler: (args: { scope?: string }, ctx: { signal?: AbortSignal }) => Promise<RunAuditResult>;
  }): void;
  modelRegistry: {
    getProviderAuth(id: string): Promise<string | null>;
  };
}

export function registerPiExtension(
  api: PiExtensionApi,
  audit: (input: Parameters<typeof runAudit>[0]) => Promise<RunAuditResult> = runAudit
): void {
  api.registerTool({
    name: TOOL_NAME,
    description: TOOL_DESCRIPTION,
    schema: TOOL_PARAMS,
    handler: async (args, ctx) => {
      const agentAuth = await api.modelRegistry.getProviderAuth('anthropic');
      return audit({
        cwd: process.cwd(),
        scope: args.scope,
        env: process.env,
        agentAuth,
        settings: loadSettingsFromEnv(process.env),
        signal: ctx.signal,
      });
    },
  });
}

function loadSettingsFromEnv(env: NodeJS.ProcessEnv) {
  return {
    model: env.DIFFGUARD_MODEL ?? 'claude-sonnet-5',
    severityThreshold: 'medium' as const,
    securityEnabled: true,
    behaviorEnabled: true,
    maxDiffTokens: Number(env.DIFFGUARD_MAX_DIFF_TOKENS ?? 8000),
    provider: (env.DIFFGUARD_PROVIDER === 'openai' ? 'openai' : 'anthropic') as 'anthropic' | 'openai',
    baseUrl: env.DIFFGUARD_BASE_URL?.trim() || undefined,
  };
}
