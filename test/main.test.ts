import { describe, it, expect, vi } from 'vitest';
import { parseArgs, VERSION } from '../cli/main.js';
import { readFileSync } from 'node:fs';

it('resolves the version from the source package', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  expect(VERSION).toBe(pkg.version);
});

describe('parseArgs', () => {
  it('defaults to working-tree diff, human output', () => {
    expect(parseArgs(['diffguard'])).toEqual({ staged: false, json: false });
  });
  it('parses --staged', () => {
    expect(parseArgs(['diffguard', '--staged'])).toEqual({ staged: true, json: false });
  });
  it('parses --json', () => {
    expect(parseArgs(['diffguard', '--json'])).toEqual({ staged: false, json: true });
  });
  it('throws on an unknown flag', () => {
    expect(() => parseArgs(['diffguard', '--nope'])).toThrow(/unknown option/i);
  });
  it('throws on a positional argument', () => {
    expect(() => parseArgs(['diffguard', 'src'])).toThrow(/unexpected argument/i);
  });
});
