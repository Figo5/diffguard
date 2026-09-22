# Validation note — 2026-09-22

The published 0.1.3 package matches main's package version. `npm run build`,
`node bin/diffguard --help` and `node bin/diffguard --version` pass.

`npm test` on Node.js 26.8.1 reports 182 passing tests across 23 passing files,
with `test/main.test.ts` failing during collection. `cli/main.ts` resolves
`../../package.json` relative to its module: that is correct after compilation
into `dist/cli/`, but resolves outside the repository when Vitest imports the
TypeScript source directly. This is a pre-existing test/source-path issue,
retained for a focused development fix. No CI workflow is currently configured.
