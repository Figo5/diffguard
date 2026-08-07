# DiffGuard CLI — Design

Date: 2026-08-07
Status: Approved by user (approach: A — standalone CLI on top of the engine)
Related: [2026-08-07-diffguard-design.md](2026-08-07-diffguard-design.md) (the VSCode extension this replaces as the delivery surface)

## 1. Context

DiffGuard was built and fully reviewed as a VSCode extension: an engine core (pure TS,
52 tests passing) that audits a git diff or selection for security issues and unintended
behavior changes via a user-provided Anthropic API key, plus a VSCode shell (commands,
inline diagnostics, sidebar tree).

The user has decided the delivery surface should be a **terminal tool**, not a VSCode
Marketplace extension, so DiffGuard is not limited to VSCode and can gate CI/pre-commit.
The finished extension is archived on the `vscode-extension` branch and will **not** be
published.

The engine core is already VSCode-free and is reused **verbatim**. What changes is the
outer shell: VSCode adapters are replaced with terminal adapters (env config, text/JSON
rendering, exit codes).

## 2. Requirements (user rulings)

1. **Structured findings + `--json`.** The strict-JSON engine contract is kept. The CLI
   renders a compact human-readable table; `--json` emits machine-readable output for
   CI/pre-commit. No prose-response prompt rewrite.
2. **Inputs: working tree + `--staged`.** Default audits `git diff`; `--staged` audits
   `git diff --cached` (pre-commit use). No path/file filters in v1.
3. **Exit-code gate: 0 / 1 / 2.** `0` = clean / no findings; `1` = findings found;
   `2` = error (missing key, not a git repo, API failure, cancelled). Any finding
   (any severity) → exit 1; no `--fail-on <severity>` flag in v1.
4. **Env-var config only.** `ANTHROPIC_API_KEY` (required) plus `DIFFGUARD_*` variables
   mirroring the extension settings, same defaults. No config-file discovery in v1.
5. **Approach A layout.** Engine stays a library in `src/`; terminal shell lives in
   `cli/`; VSCode-specific files are removed from `main` (preserved on `vscode-extension`).
6. **Publish to npm**, not the VSCode Marketplace.

## 3. Repo layout

```
diffguard/                        ← main branch (CLI-first)
├── src/                          ← engine library (kept as-is except two type-path changes)
│   ├── auditEngine/
│   │   ├── auditEngine.ts        ← AuditEngine.audit({diff, repoContext}, signal?) → AuditResult
│   │   ├── llmClient.ts          ← AnthropicLlmClient (Node-native)
│   │   ├── promptBuilder.ts
│   │   ├── findingsParser.ts
│   │   └── repoContext.ts
│   ├── findingsModel.ts          ← Finding, Severity, Category, validateFinding
│   ├── types.ts                  ← NEW: DiffGuardSettings (moved here from settings.ts; no vscode)
│   └── diffProvider.ts           ← isGitRepo, getGitDiff (gains a `staged` param)
├── cli/
│   ├── config.ts                 ← env-var settings → DiffGuardSettings (no vscode types)
│   ├── render.ts                 ← human table + --json serialization
│   ├── run.ts                    ← orchestration: config → diff → engine → render → exit code
│   └── main.ts                   ← bin entry: arg parsing, --help/--version, exit
├── bin/diffguard                 ← #!/usr/bin/env node shim → dist/cli/main.js
├── test/                         ← vitest (existing 52 + new CLI tests)
├── docs/superpowers/specs/       ← this spec (committed copy)
├── package.json                  ← "type": "module", "bin", npm scripts
├── .gitignore                    ← adds dist/, *.vsix stays ignored
└── .vscodeignore                 ← DELETED (no vsce packaging)
```

**Deleted from `main`** (archived on `vscode-extension`): `src/extension.ts`,
`src/diagnostics.ts`, `src/reportPanel.ts`, `src/settings.ts`, `vitest.config.ts`
(vscode alias — no longer needed), `test/vscode-stub.ts`, `.vscodeignore`,
`@types/vscode` devDep, the `views`/`commands`/`configuration`/`activationEvents`
contributions in `package.json`, and `vsce`/`@vscode/vsce` packaging bits.

## 4. CLI surface

```
diffguard                      audit the working-tree diff
diffguard --staged             audit the staged diff (pre-commit)
diffguard --json               machine-readable output
diffguard --help               usage
diffguard --version            version
```

- No positional arguments in v1. Unknown flags → usage + exit 2.
- `--staged` → `getGitDiff(cwd, { staged: true })` → `git diff --cached`.
- `--json` affects stdout format only; exit codes are identical.

## 5. Configuration (env)

| Env var | Default | Meaning |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | *(required)* | Anthropic key. Unset/missing → exit 2 with a stderr hint. |
| `DIFFGUARD_MODEL` | `claude-sonnet-5` | Anthropic model for audits. |
| `DIFFGUARD_SEVERITY_THRESHOLD` | `medium` | Minimum severity **for human display** (`critical`/`high`/`medium`/`low`/`info`). Invalid value → exit 2. |
| `DIFFGUARD_SECURITY_ENABLED` | `true` | Audit for security issues (`true`/`false`). |
| `DIFFGUARD_BEHAVIOR_ENABLED` | `true` | Audit for behavior changes. |
| `DIFFGUARD_MAX_DIFF_TOKENS` | `8000` | Max diff tokens before truncation → audit marked partial. |

`DiffGuardSettings` lives in `src/types.ts` (engine-owned, no `vscode` import — a
pure data interface). `auditEngine.ts`'s `import type` changes from `../settings` to
`../types`; the CLI imports it from there too. Invalid enum/boolean/number values are a
hard error (exit 2), not a silent fallback, because a pre-commit gate must fail loudly
on misconfiguration.

## 6. Output & rendering

### Human output (stdout)

Per finding:

```
[security] high  src/auth.ts:42
  Message text…
  Fix: suggested fix (when present)
```

Grouped by file, severity-descending within a file. Then a summary line:

```
3 findings (1 security, 2 behavior) · 1 dropped · partial audit (diff truncated)
```

- Severity threshold **filters human output** (mirrors the extension's inline
  diagnostics).
- `dropped` and `truncated` are always shown when non-zero; the dropped counter is
  "malformed finding(s) from the model".
- Clean run (no findings): a short confirmation, e.g. `No issues found in 12 files.`

### JSON output (`--json`, stdout)

One document: `{ "findings": [...], "dropped": 0, "truncated": false, "repoContext": "..." }`.
- **No severity filtering** on `--json` — the raw findings are the truth; filtering is a
  display concern.
- Findings serialize as-is from the engine (`category`, `severity`, `file`, `line`,
  `message`, `suggestedFix?`).

### Errors (stderr)

One clear line; exit 2. Cases: no `ANTHROPIC_API_KEY`, not a git repo, git failure,
API/LLM error (engine `error` message), cancelled, invalid config, unknown flag.

## 7. Data flow, errors, cancellation

```
main.ts (parse args)
  → config.ts (env → DiffGuardSettings)
  → run.ts:
      isGitRepo(cwd)?  no → exit 2
      getGitDiff(cwd, staged)
      diff empty? → exit 0 ("no changes to audit")
      AuditEngine.audit({diff, repoContext}, AbortSignal)
        error 'empty'    → exit 0
        error 'cancelled'→ exit 2 (SIGINT; nothing rendered)
        error message    → exit 2 (stderr)
        findings         → render (human | json) → exit 1 if any findings else 0
```

- The engine's `AuditResult` contract is unchanged; the CLI maps each value to an exit
  code + stderr line. The extension's tree-error/Retry UX has no CLI analog — the exit
  code is the contract.
- Cancellation: SIGINT → `AbortSignal` → engine returns `'cancelled'` → exit 2, no
  findings output. Same abort thread as the extension (`streamText(prompt, {signal})`).

## 8. Testing

- **Existing engine tests:** the 44 that cover surviving modules stay green and
  untouched. `settings.test.ts` (5) and `diagnostics.test.ts` (3) are deleted with the
  modules they test; `diffProvider.test.ts` gains cases for the new `staged` param
  (existing cases unchanged).
- **New CLI tests** (vitest, same fake-LLM pattern the engine already uses):
  - `config.test.ts` — env parsing, defaults, invalid severity/boolean/number → hard error.
  - `run.test.ts` — full orchestration with injected deps: exit 0/1/2 paths, empty diff,
    API error, cancelled, `--json` shape.
  - `render.test.ts` — human block format, grouping/ordering, threshold filtering,
    `suggestedFix` presence, summary line, JSON document shape, dropped/truncated flags.
  - `main.test.ts` — arg parsing: `--staged`, `--json`, `--help`, `--version`, unknown
    flags → exit 2 + usage.
- The only untested seam is the real `bin` shim (needs a spawned process + network).

## 9. Build & packaging

- `"type": "module"`, `tsc` → `dist/`, `"bin": { "diffguard": "bin/diffguard" }` shim
  → `dist/cli/main.js` (with shebang preserved via `bin/` wrapper or tsc shebang).
- `npm` scripts: `build` (tsc), `test` (vitest run), `prepack` (build), `start` (run
  via node).
- Publish: `npm publish` (no Marketplace). Requires `npm` auth + package name available.
- `@anthropic-ai/sdk` stays the only runtime dep. DevDeps: typescript, vitest, @types/node.

## 10. Out of scope (v1) / roadmap

- Pre-commit **hook installer** — `--staged` + exit 1 is the primitive; an
  auto-installer is a v2 nicety. (The extension's v2 "pre-commit hook mode" is now
  natively served by `--staged`.)
- `--path`/file filtering, `--fail-on <severity>`, config file, prose rendering.
- The extension itself (archived, may be revived later as a thin front-end over the
  same engine).

## 11. Risks

- `claude-sonnet-5` + `thinking: {type:'adaptive'}` streaming is unchanged and already
  production-tested through the engine; no new LLM surface.
- Deleting VSCode files is lossless (branch archive); `main` history retains them anyway.
- npm name `diffguard` may be taken — fall back to a scoped name (`@figo5/diffguard`)
  without design change.
