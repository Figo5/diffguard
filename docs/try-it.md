# Try a reproducible review

There are two ways to explore the workflow. The fixture walkthrough requires no
account or model. A model-backed review uses your configured provider and may
send the diff to that provider.

## Captured CLI walkthrough

From a clone, with Node.js 24 and git available:

```sh
git clone https://github.com/Figo5/diffguard.git
cd diffguard
npm ci
npm run build
npm run demo
```

The script creates a disposable git repository containing `query.js`, stages an
intentionally unsafe SQL interpolation, starts an OpenAI-compatible **fixture**
endpoint on `127.0.0.1`, and runs the real CLI against the staged diff. It checks
that the endpoint receives the example, returns a prewritten finding, and
checks the rendered output and findings exit code. It cleans up its temporary
repository and leaves your saved DiffGuard configuration alone.

The captured output is in [example-output.txt](example-output.txt). It shows
the CLI and provider request path working. **No LLM produced this finding; this
is not evidence of detection quality or a security audit.**

## Review with your chosen model

Create a separate scratch repository and stage a small change you understand.
After installing `@figo5/diffguard`, configure a provider interactively:

```sh
diffguard config
diffguard --staged
diffguard --staged --json
```

A useful first check is changing a parameterized query into string
interpolation. Does your selected model flag the changed line? Then repair
the query and review again. Model output can vary and may include false
positives or miss a problem. Exit `1` means findings; `2` means an error.

When reporting feedback, include the package version, provider/model, and a
minimal example you can share. Keep private code and credentials out of
public issues. Review [Privacy](../README.md#privacy) before sending a diff.
