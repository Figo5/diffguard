# DiffGuard

Audit code changes for **security issues** and **unintended behavior changes** using your
own Anthropic API key. DiffGuard reads a git diff, sends it to Claude for review, and
prints structured findings — or exits cleanly when nothing's wrong. Built for the
terminal: works on any machine with `git` and Node, drops straight into CI and
pre-commit hooks.

## Install

```bash
npm install -g diffguard
```

## Setup

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

Get a key at https://console.anthropic.com/. Your key is used only for requests to
Anthropic; DiffGuard never logs or stores it.

## Usage

```bash
diffguard            # audit the working-tree diff
diffguard --staged   # audit the staged diff (pre-commit)
diffguard --json     # machine-readable output
```

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
| `ANTHROPIC_API_KEY` | *(required)* | Anthropic API key |
| `DIFFGUARD_MODEL` | `claude-sonnet-5` | Model used for audits |
| `DIFFGUARD_SEVERITY_THRESHOLD` | `medium` | Minimum severity shown in human output (`critical`/`high`/`medium`/`low`/`info`) |
| `DIFFGUARD_SECURITY_ENABLED` | `true` | Audit for security issues |
| `DIFFGUARD_BEHAVIOR_ENABLED` | `true` | Audit for behavior changes |
| `DIFFGUARD_MAX_DIFF_TOKENS` | `8000` | Max diff size before truncation (audit becomes partial) |

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
