// agent/pi.ts
import { runAudit, TOOL_NAME, TOOL_DESCRIPTION, TOOL_PARAMS } from './core.js';
import type { RunAuditResult } from './core.js';
import { loadSettingsFromEnv } from '../src/config/loadSettings.js';

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
        settings: await loadSettingsFromEnv(process.env),
        signal: ctx.signal,
      });
    },
  });
}
