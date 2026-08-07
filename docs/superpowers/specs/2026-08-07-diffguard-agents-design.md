# DiffGuard for Coding Agents — Design

Date: 2026-08-07
Status: Approved by user (approach A — in-process shared core; one big plan)
Related: [2026-08-07-diffguard-cli-design.md](2026-08-07-diffguard-cli-design.md) (the CLI this builds on)

## 1. Context

DiffGuard is a published npm CLI (`@figo5/diffguard@0.1.0`) that audits a git diff for
security issues and unintended behavior changes via a user-provided Anthropic API key.
The engine core (`src/`) is a tested library (79 tests) with a strict-JSON findings
contract; the CLI (`cli/`) is one consumer of it.

The user wants DiffGuard available **inside coding agents** — the Pi coding agent
(earendil-works) and the MCP-capable agents (Claude Code, Codex, Cursor, Windsurf,
Copilot, Cline, …) — as an on-demand audit tool. Two user rulings expand the engine:

1. **Any provider key, not just Anthropic.** The wrapper should reuse whatever key the
   user already has configured for their coding agent, and the engine should work with
   OpenAI-compatible providers (OpenAI, OpenRouter, Groq, Ollama, vLLM, …), not just
   Anthropic.
2. **Whole-codebase audit**, mirroring ponytail's `/ponytail-audit` (whole repo) vs
   `/ponytail-review` (diff) split — DiffGuard's diff audit stays security + behavior;
   the repo audit is **security-only** (behavior is inherently diff-based).

## 2. Requirements (user rulings)

1. **On-demand audit tool.** The agent calls a `diffguard_audit` tool when asked or
   when it decides to. No auto-audit-after-edit hooks in v1.
2. **Tool output: text + structured findings.** The tool returns a compact
   human-readable report (like the CLI's human output) plus the raw findings as
   structured data, so the agent can both read and reason precisely.
3. **Targets: Pi + MCP agents.** A native Pi TypeScript extension (Pi has no MCP
   support) and an MCP server (covers Claude Code, Codex, Cursor, Windsurf, Copilot,
   Cline, …).
4. **Audit scopes: `working` (default) / `staged` / `file:<path>`.** Mirrors the CLI
   plus a per-file filter the CLI lacks.
5. **Full provider abstraction.** The engine's LLM client becomes provider-agnostic:
   Anthropic (existing) + OpenAI-compatible (OpenAI, OpenRouter, Groq, Ollama, vLLM,
   …). The strict-JSON findings contract is enforced by the existing parser regardless
   of provider.
6. **Key resolution: agent credential → env → keychain.** Reuse the agent's own
   credential where the host exposes it (Pi's `getProviderAuth`); fall back to
   `ANTHROPIC_API_KEY`; then a platform keychain via a `diffguard key set` command.
   The key never enters the agent's context.
7. **Whole-repo audit: security-only.** `AuditEngine.auditRepo()` audits the current
   tree for security issues only; the diff audit keeps security + behavior.
8. **One big plan.** Engine v2 + agent integration in a single spec → plan →
   implementation cycle.

## 3. Architecture

```
diffguard/  (main)
├── src/                          ← engine v2 (library)
│   ├── auditEngine/
│   │   ├── auditEngine.ts        ← AuditEngine gains auditRepo()
│   │   ├── llmClient.ts          ← becomes the LlmClient interface
│   │   ├── anthropicClient.ts     ← NEW: existing Anthropic impl, extracted
│   │   ├── openaiClient.ts        ← NEW: OpenAI-compatible impl
│   │   ├── promptBuilder.ts      ← gains buildRepoAuditPrompt()
│   │   ├── findingsParser.ts     ← unchanged (the safety net)
│   │   └── repoContext.ts
│   ├── findingsModel.ts          ← unchanged (categories stay security|behavior)
│   ├── types.ts                  ← DiffGuardSettings gains provider + baseUrl
│   └── diffProvider.ts           ← gains getRepoFiles()
├── cli/                          ← unchanged surface; config gains provider fields
├── agent/                        ← NEW: the integration layer
│   ├── core.ts                   ← shared: key/model resolution, tool def, orchestration
│   ├── mcp.ts                    ← MCP stdio server (Claude Code, Codex, Cursor, …)
│   └── pi.ts                     ← Pi extension (registerTool)
├── package.json                  ← gains "exports" (engine as library) + agent bins
└── test/
```

The engine becomes a library via `exports` in package.json. `agent/` is a thin layer:
one shared core, two adapters. The CLI keeps working throughout — it is just another
consumer of the same engine.

## 4. Engine v2

### 4.1 Provider abstraction

`LlmClient` interface (in `llmClient.ts`):

```ts
export interface LlmClient {
  stream(prompt: string, opts: { signal?: AbortSignal }): AsyncIterable<string>;
}
```

- **`AnthropicClient`** (`anthropicClient.ts`): the current `llmClient.ts` code
  extracted behind the interface. Adaptive thinking stays.
- **`OpenAIClient`** (`openaiClient.ts`): `chat.completions.create({ stream: true })`
  with `response_format: { type: 'json_object' }` where the endpoint supports it;
  `baseUrl` config makes OpenRouter/Groq/Ollama/vLLM work with zero extra code.

The strict-JSON contract is enforced downstream by the existing `findingsParser`
(`sliceToMatchingBracket`), not by the provider — that is the safety net that makes
"any key" safe. Anthropic's adaptive thinking is Anthropic-only; OpenAI-compatible
providers get the same strict-JSON prompt without thinking. Findings quality may
differ slightly by provider; that is inherent to "any key."

The CLI's `run.ts` `createEngine` is updated to construct the client from
`settings.provider` (Anthropic → `AnthropicClient`, OpenAI-compatible →
`OpenAIClient` with `settings.baseUrl`), so the CLI honors the new provider fields
too.

### 4.2 Whole-repo audit

`AuditEngine.auditRepo({ files, repoContext }, signal?)` — new mode, same
`AuditResult` contract (`{findings, dropped, truncated, error}`), **security-only**.
Findings' `file`/`line` point at the current tree. The existing `audit()` (diff) is
untouched.

`promptBuilder.buildRepoAuditPrompt(...)` — security-only instructions, same
strict-JSON schema, so the parser and validation are reused verbatim.

`diffProvider.getRepoFiles(cwd)` — walk the tree respecting `.gitignore`, skip
`.git`/`node_modules`/binaries, cap total size (reuse the truncation budget).

### 4.3 Settings

`DiffGuardSettings` gains `provider: 'anthropic' | 'openai'` and `baseUrl?: string`.
`maxDiffTokens` is reused as the truncation budget for both modes. The CLI's
`DIFFGUARD_PROVIDER` / `DIFFGUARD_BASE_URL` env vars mirror the new fields.

## 5. Agent layer

### 5.1 `agent/core.ts` — shared brain

- `resolveCredentials(env, agentAuth?)` — chain: agent's own credential (where the
  host exposes it) → `ANTHROPIC_API_KEY` → platform keychain.
- `runAudit({ scope, cwd, credentials })` — collect diff or files → engine → render
  text + structured findings.
- The tool definition (name `diffguard_audit`, description, params: `scope`).
- `diffguard key set` CLI command backed by the platform keychain (macOS `security` /
  Linux `secret-tool`).

### 5.2 `agent/mcp.ts` — MCP stdio server

Exposes one tool (`diffguard_audit`). Returns text content + `structuredContent` with
the findings. Covers Claude Code, Codex, Cursor, Windsurf, Copilot, Cline…

### 5.3 `agent/pi.ts` — Pi extension

`pi.registerTool({ name: 'diffguard_audit', ... })` with a TypeBox schema, and —
the payoff — `ctx.modelRegistry.getProviderAuth(id)` to reuse the user's existing Pi
credential.

## 6. Data flow

```
agent calls tool → adapter (mcp.ts | pi.ts) → core.runAudit
  → engine (audit | auditRepo) → findings
  → text report + structured findings → back to the agent
```

## 7. Error handling, cancellation, security

| Failure | Behavior |
|---|---|
| No key anywhere (env, agent credential, keychain) | Tool returns "no API key configured — set ANTHROPIC_API_KEY or run `diffguard key set`" |
| Not a git repo | Tool returns "not a git repository" (diff scope) |
| Git/collect failure | Tool returns the underlying message |
| API failure (any provider) | Tool returns the engine's error message |
| Cancelled | Tool returns "cancelled" — nothing rendered |

The engine's `AuditResult.error` contract is unchanged; the adapters map it to tool
output. The agent's `AbortSignal` threads through to the engine's existing
cancellation path.

**Security posture** — the key never enters the agent's context, ever:

- **Pi:** `getProviderAuth(id)` resolves the user's existing credential in-process;
  the extension never prints it, never puts it in tool output, never persists it.
- **MCP:** inherits env; keychain fallback via `diffguard key set`.
- The wrapper passes the key straight to the engine's client constructor. No logging,
  no telemetry — same hygiene as the CLI.
- The tool's `file:` scope accepts a path but the wrapper resolves it against the repo
  root and rejects anything outside (no arbitrary file reads).

## 8. Testing

Existing 79 tests stay green, untouched. The CLI keeps working throughout.

New tests, same fake-LLM pattern the engine already uses:

| Area | What's tested |
|---|---|
| `OpenAIClient` | streams a fake `chat.completions` response; passes `response_format` when supported; threads `AbortSignal`; surfaces API errors |
| `auditRepo` | security-only findings from a fake LLM; `dropped`/`truncated` accounting; empty-repo → clean; cancellation |
| `getRepoFiles` | fixture tree: respects `.gitignore`, skips `.git`/`node_modules`/binaries, caps total size |
| repo prompt | security-only instructions, strict-JSON schema, no behavior category |
| `core.runAudit` | injected deps: diff scope, repo scope, `file:` scope, key-resolution chain (agent credential → env → keychain), error mapping |
| MCP tool handler | tool definition shape, params validation, text + structured content, error → `isError` |
| Pi extension | fake `ExtensionAPI`: `registerTool` called with the right name/schema; `getProviderAuth` credential reuse; signal threading |

The untested seams are the real MCP handshake and the real Pi host — those need a
live agent session, same as the CLI's real-API smoke test.

## 9. Out of scope (v1) / roadmap

- Auto-audit-after-edit hooks (Pi `tool_call` event) — on-demand only in v1.
- Over-engineering category for the repo audit — security-only in v1.
- Non-OpenAI-compatible providers (e.g. Gemini native) — the OpenAI-compatible
  surface covers most; native Gemini is a follow-up.
- Agent secret-store integrations beyond the keychain helper.
- Windows keychain support for `diffguard key set` — macOS `security` and Linux
  `secret-tool` in v1; Windows Credential Manager is a follow-up.

## 10. Risks

- **Provider parity:** findings quality may differ across providers (no adaptive
  thinking on OpenAI-compatible). The parser is the safety net; the contract holds.
- **Pi API drift:** `getProviderAuth` / `registerTool` are from Pi's current docs;
  Pi is pre-1.0 and the API may shift. The extension is thin, so drift is cheap to
  fix.
- **MCP spec drift:** the MCP SDK is evolving; the server is minimal (one tool), so
  upgrades are contained.
- **Engine regression:** the CLI must keep working while the engine is refactored
  (client extraction, new mode). The 79-test suite is the guard.
