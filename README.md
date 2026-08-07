# DiffGuard

Audit code changes for **security issues** and **unintended behavior changes** using your
own Anthropic API key. DiffGuard reads a git diff, sends it to Claude for review, and
prints structured findings — or exits cleanly when nothing's wrong. Built for the
terminal: works on any machine with `git` and Node, drops straight into CI and
pre-commit hooks.

## Install

```bash
npm install -g @figo5/diffguard
```

## Setup

    diffguard config

`diffguard config` walks you through choosing a provider (Anthropic, OpenAI, OpenRouter,
Groq, Ollama, or a custom OpenAI-compatible base URL), picking a model, and storing your
API key in the platform keychain. Afterwards, plain `diffguard` just works — no env vars
needed. Non-interactive setup is available too:

    diffguard config --provider=ollama --model=gemma4:e2b
    diffguard config --show    # print the effective config (never the key)
    diffguard config --reset   # clear the saved config

Note: `diffguard config --key=...` puts the key on the command line, where it's visible
in shell history and to anyone who can list processes on the machine. Prefer the
interactive wizard (`diffguard config`) or `diffguard key set`, which read the key from a
hidden prompt or stdin instead.

You can still configure everything with env vars instead — see the Configuration table.
Env vars always override the saved config file.

## Usage

```bash
diffguard            # audit the working-tree diff
diffguard --staged   # audit the staged diff (pre-commit)
diffguard --json     # machine-readable output
diffguard config    # one-time setup: provider, model, and key
```

### In coding agents

DiffGuard is available as an on-demand audit tool inside coding agents:

- **Pi** — install the extension at `~/.pi/agent/extensions/pi.ts` (or `.pi/extensions/pi.ts`).
- **MCP-capable agents** (Claude Code, Codex, Cursor, Windsurf, Copilot, Cline) — run the
  `diffguard-mcp` stdio server and add it as an MCP server.

The agent calls the `diffguard_audit` tool with a `scope` argument:

| Scope | Audits |
| --- | --- |
| `working` (default) | uncommitted changes |
| `staged` | the git index (pre-commit) |
| `file:<path>` | a single file |
| `repo` | the whole repository (security only) |

The tool returns a text report plus structured findings. The API key is resolved from the
agent's own credential (Pi), `ANTHROPIC_API_KEY`, or the platform keychain
(`diffguard key set`). The key never enters the agent's context.

The agent layer reads the same saved config file as the CLI, so the provider and model you
configure with `diffguard config` apply to Pi and MCP too. (Local providers like Ollama
still need a key in the agent's environment — set `ANTHROPIC_API_KEY` to any value.)

### Exit codes

| Code | Meaning |
| --- | --- |
| 0 | Clean — no findings |
| 1 | Findings found |
| 2 | Error (missing key, not a git repo, audit failure) |

Use it as a pre-commit gate:

```bash
# .git/hooks/pre-commit, or via a pre-commit framework
diffguard --staged || exit 1
```

### Example

```
$ diffguard
[security] high  src/auth.ts:42
  Credentials compared with == instead of a constant-time comparison.
  Fix: use crypto.timingSafeEqual.

2 findings (1 security, 1 behavior)
```

### Configuration

| Env var | Default | Meaning |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | *(unset)* | API key. Checked first; falls back to the platform keychain. Not needed for local providers like Ollama. |
| `DIFFGUARD_MODEL` | `claude-sonnet-5` | Model used for audits |
| `DIFFGUARD_SEVERITY_THRESHOLD` | `medium` | Minimum severity shown in human output (`critical`/`high`/`medium`/`low`/`info`) |
| `DIFFGUARD_SECURITY_ENABLED` | `true` | Audit for security issues |
| `DIFFGUARD_BEHAVIOR_ENABLED` | `true` | Audit for behavior changes |
| `DIFFGUARD_MAX_DIFF_TOKENS` | `8000` | Max diff size before truncation (audit becomes partial) |
| `DIFFGUARD_PROVIDER` | `anthropic` | Provider: `anthropic` or `openai` (OpenAI-compatible) |
| `DIFFGUARD_BASE_URL` | *(unset)* | Base URL for OpenAI-compatible providers (e.g. `http://localhost:11434/v1`) |
| `~/.config/diffguard/config.json` | *(unset)* | Saved settings from `diffguard config` (provider, model, base URL, `needsKey`). Env vars override it. Set `XDG_CONFIG_HOME` to relocate. |

Precedence: **env var > config file > default**. The API key is never stored in the config
file — it lives in the platform keychain (`diffguard key set` / `diffguard config`) or the
`ANTHROPIC_API_KEY` env var. The CLI checks the env var first, then the keychain.

## How it works

1. DiffGuard collects the git diff and some lightweight repo context.
2. It builds a prompt instructing Claude to return findings as strict JSON, and streams
   the response (cancel with `Ctrl-C`).
3. The response is parsed and validated — malformed findings are dropped and counted,
   never silently accepted.
4. Findings print as a grouped report, or as raw JSON with `--json`.

If the diff is empty, DiffGuard exits 0 without calling the API. If the diff is too
large, it's truncated to `DIFFGUARD_MAX_DIFF_TOKENS` and the audit is marked partial.

## Privacy

- The diff you audit is sent to Anthropic to generate findings. Don't audit code you
  aren't comfortable sending to a third-party API.
- DiffGuard makes no other network calls and collects no telemetry.

## Roadmap

- Pre-commit hook installer (`diffguard install`).
- `--path` filtering, `--fail-on <severity>`.
- Test-gap and license-compliance checks alongside security/behavior findings.

## License

MIT — see [LICENSE](LICENSE).
