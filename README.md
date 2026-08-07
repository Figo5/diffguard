# DiffGuard

DiffGuard audits code changes — AI-generated or hand-written — for **security issues**
and **unintended behavior changes**, using your own Anthropic API key. It reads your
current git diff (or a selection), sends it to Claude for review, and surfaces the
findings as inline squiggles and a sidebar panel so you can catch problems before you
commit.

![demo](docs/demo.gif)

> The GIF above is a placeholder. Replace `docs/demo.gif` with a real screen recording
> of DiffGuard in action.

## Setup

1. Get an API key from [Anthropic](https://console.anthropic.com/).
2. Run **"DiffGuard: Set API Key"** from the Command Palette and paste your key. It is
   stored in VSCode's SecretStorage — see [Privacy](#privacy) below.
3. Run **"DiffGuard: Audit Changes"** to scan your current git diff.

## Usage

DiffGuard exposes two commands from the Command Palette:

- **DiffGuard: Audit Changes** — audits the working tree's git diff. If the current
  folder isn't a git repository, DiffGuard offers to audit a selection instead.
- **DiffGuard: Audit Selection** — audits the text currently selected in the active
  editor. Useful outside a git repo, or to focus on a specific hunk.

While an audit runs, a progress notification appears in the bottom-right corner with a
cancel button. Findings are shown two ways:

- **Inline squiggles** in the editor, at the line each finding applies to.
- **DiffGuard Findings**, a panel in the Explorer sidebar. Clicking a finding jumps to
  its location in the file.

### Settings

Configure DiffGuard under `Settings → Extensions → DiffGuard`, or directly in
`settings.json`:

| Setting | Default | Description |
| --- | --- | --- |
| `diffguard.model` | `claude-sonnet-5` | Anthropic model used for audits. |
| `diffguard.severityThreshold` | `medium` | Minimum severity shown (`critical`, `high`, `medium`, `low`, `info`). |
| `diffguard.securityEnabled` | `true` | Audit for security issues. |
| `diffguard.behaviorEnabled` | `true` | Audit for unintended behavior changes. |
| `diffguard.maxDiffTokens` | `8000` | Max diff size (in tokens) before the diff is truncated and the audit is marked partial. |

## How it works

1. DiffGuard collects your git diff (or selection) and some lightweight repo context.
2. It builds a prompt instructing Claude to return findings as strict JSON, and streams
   the response with a cancellable progress notification.
3. The response is parsed and validated — malformed findings are dropped and reported,
   never silently accepted.
4. Validated findings are rendered as inline diagnostics (filtered by your severity
   threshold) and listed in the DiffGuard Findings panel.

If the diff is empty, DiffGuard tells you there's nothing to audit rather than making a
request. If the diff is too large, it's truncated to `diffguard.maxDiffTokens` and the
audit is marked partial. If the model call fails, you get an error with a **Retry**
option; findings from a cancelled audit are simply discarded and previous results stay
visible.

## Privacy

- Your Anthropic API key is stored **only** in VSCode's built-in SecretStorage. It is
  never written to `settings.json`, never logged, and never leaves your machine except
  in requests you make directly to Anthropic.
- The diff (or selection) you audit **is sent to Anthropic** to generate findings. Don't
  audit code you aren't comfortable sending to a third-party API.
- DiffGuard makes no other network calls and collects no telemetry.

## v2 roadmap

These are ideas under consideration, not implemented in v1:

- A pre-commit hook mode to audit automatically before each commit.
- Auto-audit on edit, for near-real-time feedback.
- Test-gap detection and license-compliance checks alongside security/behavior findings.
- A richer webview report in place of (or alongside) the sidebar tree.

## License

MIT — see [LICENSE](LICENSE).
