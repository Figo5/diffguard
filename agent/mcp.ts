// agent/mcp.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { runAudit, TOOL_NAME, TOOL_DESCRIPTION, TOOL_PARAMS, parseScope } from './core.js';
import type { RunAuditResult } from './core.js';

export function buildToolHandler(
  audit: (input: { cwd: string; scope: string | undefined; env: NodeJS.ProcessEnv; settings: Parameters<typeof runAudit>[0]['settings']; signal?: AbortSignal }) => Promise<RunAuditResult>
) {
  return async (args: { scope?: string }): Promise<{ content: { type: 'text'; text: string }[]; structuredContent: { findings: unknown[]; error: string | null }; isError?: boolean }> => {
    try {
      parseScope(args.scope);
    } catch (err) {
      return {
        content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }],
        structuredContent: { findings: [], error: null },
        isError: true,
      };
    }
    const result = await audit({
      cwd: process.cwd(),
      scope: args.scope,
      env: process.env,
      settings: loadSettingsFromEnv(process.env),
    });
    return {
      content: [{ type: 'text', text: result.error ? result.error : result.text }],
      structuredContent: { findings: result.findings, error: result.error },
      ...(result.error ? { isError: true } : {}),
    };
  };
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

export async function startMcpServer(): Promise<void> {
  const server = new Server(
    { name: 'diffguard', version: '0.1.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: TOOL_NAME,
        description: TOOL_DESCRIPTION,
        inputSchema: TOOL_PARAMS,
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const args = (request.params.arguments ?? {}) as { scope?: string };
    const handler = buildToolHandler((input) =>
      runAudit({
        cwd: input.cwd,
        scope: input.scope,
        env: input.env,
        settings: input.settings,
        signal: input.signal,
      })
    );
    return handler(args);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
